import { allowMethods, getClientId, prepareNoStoreResponse, preparePublicResponse, queryValue, type MarketRadarRequest, type MarketRadarResponse } from '../lib/market-radar/http.js'
import {
  marketSnapshotBody,
  openFlowVerifier,
  parseCookies,
  parseMarketSnapshotKeys,
  pkceChallenge,
  privateCookie,
  randomToken,
  sealFlowVerifier,
  tokenHash,
  verifyMarketSnapshotSignature,
} from '../lib/market-snapshot/auth.js'
import { parseMarketSnapshot } from '../lib/market-snapshot/contract.js'
import { marketRoutePath } from '../lib/market-snapshot/routes.js'
import {
  consumePrivateMarketAuthFlow,
  consumePrivateMarketLoginRateLimit,
  createPrivateMarketAuthFlow,
  createPrivateMarketSession,
  getPrivateMarketSnapshot,
  getPublicMarketStatus,
  ingestMarketSnapshot,
  revokePrivateMarketSession,
} from '../lib/market-snapshot/repository.js'
import {
  FLOW_COOKIE,
  hasExpectedOrigin,
  preparePrivateMarketResponse,
  privateMarketConfig,
  PRIVATE_MARKET_ORIGIN,
  requirePrivateMarketSession,
  SESSION_COOKIE,
} from '../lib/private-market/oauth.js'

declare const process: { env: Record<string, string | undefined> }

interface GitHubTokenResponse { access_token?: string; error?: string; scope?: string }
interface GitHubUser { id?: number; login?: string }

async function ingest(req: MarketRadarRequest, res: MarketRadarResponse) {
  prepareNoStoreResponse(res)
  if (!allowMethods(req, res, ['POST'])) return
  const body = marketSnapshotBody(req.body)
  const verified = verifyMarketSnapshotSignature({
    body,
    headers: req.headers,
    keys: parseMarketSnapshotKeys(process.env.MARKET_SNAPSHOT_INGEST_KEYS),
  })
  if (!verified.ok) return res.status(401).json({ code: verified.code, error: 'Market snapshot authentication failed.' })
  try {
    const snapshot = parseMarketSnapshot(JSON.parse(body))
    let status: 'created' | 'existing'
    try {
      status = await ingestMarketSnapshot(snapshot, verified.keyId, verified.nonce, verified.timestamp)
    } catch {
      return res.status(503).json({ code: 'market_snapshot_storage_unavailable', error: 'Market snapshot storage is temporarily unavailable.' })
    }
    return res.status(status === 'created' ? 201 : 200).json({ status, snapshotId: snapshot.snapshotId, asOf: snapshot.asOf })
  } catch (error) {
    const message = error instanceof SyntaxError ? 'Invalid JSON body.' : 'Market snapshot was rejected.'
    return res.status(400).json({ code: 'invalid_market_snapshot', error: message })
  }
}

async function publicStatus(req: MarketRadarRequest, res: MarketRadarResponse) {
  preparePublicResponse(res)
  if (!allowMethods(req, res, ['GET'])) return
  try {
    return res.status(200).json(await getPublicMarketStatus())
  } catch {
    return res.status(200).json({
      status: 'unavailable', snapshotId: null, asOf: null, generatedAt: null, mode: null,
      coverage: [], message: '市场快照暂时不可用。',
    })
  }
}

async function login(req: MarketRadarRequest, res: MarketRadarResponse) {
  preparePrivateMarketResponse(res)
  if (!allowMethods(req, res, ['GET'])) return
  try {
    if (!await consumePrivateMarketLoginRateLimit(tokenHash(getClientId(req)))) {
      return res.status(429).json({ code: 'login_rate_limited', error: 'Too many private market login attempts.' })
    }
    const config = privateMarketConfig()
    const state = randomToken(32)
    const verifier = randomToken(64)
    await createPrivateMarketAuthFlow(tokenHash(state), sealFlowVerifier(verifier, config.flowSecret))
    const target = new URL('https://github.com/login/oauth/authorize')
    target.searchParams.set('client_id', config.clientId)
    target.searchParams.set('redirect_uri', config.redirect)
    target.searchParams.set('state', state)
    target.searchParams.set('code_challenge', pkceChallenge(verifier))
    target.searchParams.set('code_challenge_method', 'S256')
    target.searchParams.set('allow_signup', 'false')
    res.setHeader('Set-Cookie', privateCookie(FLOW_COOKIE, state, 600, '/api/private-market/auth/github/callback'))
    res.setHeader('Location', target.toString())
    return res.status(302).end()
  } catch {
    return res.status(503).json({ code: 'authentication_unavailable', error: 'Private market login is not configured.' })
  }
}

async function callback(req: MarketRadarRequest, res: MarketRadarResponse) {
  preparePrivateMarketResponse(res)
  if (!allowMethods(req, res, ['GET'])) return
  try {
    const config = privateMarketConfig()
    const state = queryValue(req, 'state') || ''
    const code = queryValue(req, 'code') || ''
    const cookieState = parseCookies(req.headers.cookie)[FLOW_COOKIE] || ''
    if (!state || state !== cookieState || !code) {
      return res.status(400).json({ code: 'invalid_oauth_state', error: 'GitHub login state is invalid or expired.' })
    }
    const sealedVerifier = await consumePrivateMarketAuthFlow(tokenHash(state))
    if (!sealedVerifier) {
      return res.status(400).json({ code: 'expired_oauth_state', error: 'GitHub login state is invalid or expired.' })
    }
    const verifier = openFlowVerifier(sealedVerifier, config.flowSecret)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8_000)
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirect,
        code_verifier: verifier,
      }),
    })
    const tokenPayload = await tokenResponse.json() as GitHubTokenResponse
    clearTimeout(timeout)
    if (!tokenResponse.ok || !tokenPayload.access_token || (tokenPayload.scope || '').trim() !== '') {
      return res.status(401).json({ code: 'github_token_rejected', error: 'GitHub login could not be verified.' })
    }
    const userController = new AbortController()
    const userTimeout = setTimeout(() => userController.abort(), 8_000)
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${tokenPayload.access_token}`,
        'User-Agent': 'xiuqiu-private-market-preview',
      },
      signal: userController.signal,
    })
    const user = await userResponse.json() as GitHubUser
    clearTimeout(userTimeout)
    if (!userResponse.ok || user.id !== config.allowedUserId || typeof user.login !== 'string') {
      return res.status(403).json({ code: 'account_not_allowed', error: 'This GitHub account cannot open the private market page.' })
    }
    const sessionToken = randomToken(48)
    await createPrivateMarketSession(tokenHash(sessionToken), user.id, user.login)
    res.setHeader('Set-Cookie', [
      privateCookie(FLOW_COOKIE, '', 0, '/api/private-market/auth/github/callback'),
      privateCookie(SESSION_COOKIE, sessionToken, 12 * 60 * 60, '/'),
    ])
    res.setHeader('Location', `${PRIVATE_MARKET_ORIGIN}/private/market`)
    return res.status(302).end()
  } catch {
    return res.status(401).json({ code: 'authentication_failed', error: 'GitHub login could not be verified.' })
  }
}

async function privateSnapshot(req: MarketRadarRequest, res: MarketRadarResponse) {
  preparePrivateMarketResponse(res)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (!allowMethods(req, res, ['GET'])) return
  try {
    if (!await requirePrivateMarketSession(req, res)) return
    const snapshot = await getPrivateMarketSnapshot()
    if (!snapshot) return res.status(404).json({ code: 'snapshot_unavailable', error: 'No private market snapshot is available.' })
    return res.status(200).json(snapshot)
  } catch {
    return res.status(503).json({ code: 'private_market_unavailable', error: 'Private market data is temporarily unavailable.' })
  }
}

async function logout(req: MarketRadarRequest, res: MarketRadarResponse) {
  preparePrivateMarketResponse(res)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (!allowMethods(req, res, ['POST'])) return
  if (!hasExpectedOrigin(req)) return res.status(403).json({ code: 'invalid_origin', error: 'Logout origin is not allowed.' })
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
  if (token) await revokePrivateMarketSession(tokenHash(token))
  res.setHeader('Set-Cookie', privateCookie(SESSION_COOKIE, '', 0, '/'))
  return res.status(200).json({ status: 'signed_out' })
}

export default async function handler(req: MarketRadarRequest, res: MarketRadarResponse) {
  const path = marketRoutePath(req.url)
  if (path === 'internal/market-snapshots') return ingest(req, res)
  if (path === 'market-radar/market-status') return publicStatus(req, res)
  if (path === 'private-market/auth/github/login') return login(req, res)
  if (path === 'private-market/auth/github/callback') return callback(req, res)
  if (path === 'private-market/snapshot') return privateSnapshot(req, res)
  if (path === 'private-market/logout') return logout(req, res)
  prepareNoStoreResponse(res)
  return res.status(404).json({ code: 'not_found', error: 'M2 endpoint not found.' })
}
