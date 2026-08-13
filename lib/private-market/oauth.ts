import type { MarketRadarRequest, MarketRadarResponse } from '../market-radar/http.js'
import { parseCookies, tokenHash } from '../market-snapshot/auth.js'
import { getPrivateMarketSession } from '../market-snapshot/repository.js'

export const PRIVATE_MARKET_CALLBACK = 'https://xiuqiu-site-m2-preview.vercel.app/api/private-market/auth/github/callback'
export const PRIVATE_MARKET_ORIGIN = 'https://xiuqiu-site-m2-preview.vercel.app'
export const FLOW_COOKIE = 'xiuqiu_private_market_flow'
export const SESSION_COOKIE = 'xiuqiu_private_market_session'

declare const process: { env: Record<string, string | undefined> }

export function privateMarketConfig() {
  const clientId = process.env.PRIVATE_MARKET_GITHUB_CLIENT_ID || ''
  const clientSecret = process.env.PRIVATE_MARKET_GITHUB_CLIENT_SECRET || ''
  const flowSecret = process.env.PRIVATE_MARKET_FLOW_SECRET || ''
  const redirect = process.env.PRIVATE_MARKET_GITHUB_REDIRECT || ''
  const allowedUserId = Number(process.env.PRIVATE_MARKET_GITHUB_USER_ID || '155644811')
  if (!clientId || !clientSecret || flowSecret.length < 32 || redirect !== PRIVATE_MARKET_CALLBACK || allowedUserId !== 155644811) {
    throw new Error('Private market GitHub login is not configured for the fixed Preview boundary.')
  }
  return { clientId, clientSecret, flowSecret, redirect, allowedUserId }
}

export function preparePrivateMarketResponse(res: MarketRadarResponse): void {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
}

export async function requirePrivateMarketSession(req: MarketRadarRequest, res: MarketRadarResponse) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
  const session = token ? await getPrivateMarketSession(tokenHash(token)) : null
  if (!session || session.githubUserId !== 155644811) {
    res.status(401).json({ code: 'authentication_required', error: 'GitHub login is required.' })
    return null
  }
  return { ...session, token }
}

export function hasExpectedOrigin(req: MarketRadarRequest): boolean {
  const value = req.headers.origin
  return (Array.isArray(value) ? value[0] : value) === PRIVATE_MARKET_ORIGIN
}
