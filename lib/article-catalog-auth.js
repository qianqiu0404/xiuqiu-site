import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

export const ARTICLE_CATALOG_AUTH_HEADERS = Object.freeze({
  keyId: 'x-content-key-id',
  timestamp: 'x-content-timestamp',
  nonce: 'x-content-nonce',
  bodyHash: 'x-content-body-sha256',
  signature: 'x-content-signature',
})

export const ARTICLE_CATALOG_MAX_SKEW_MS = 60_000

export function sha256Hex(body = '') {
  return createHash('sha256').update(body).digest('hex')
}

export function canonicalArticleCatalogRequest({
  keyId,
  method,
  target,
  timestamp,
  nonce,
  bodyHash,
}) {
  return [
    'article-catalog-v1',
    keyId,
    method.toUpperCase(),
    target,
    String(timestamp),
    nonce,
    bodyHash,
  ].join('\n')
}

function safeHexEqual(left, right, expectedBytes) {
  if (
    typeof left !== 'string'
    || typeof right !== 'string'
    || !new RegExp(`^[0-9a-f]{${expectedBytes * 2}}$`).test(left)
    || !new RegExp(`^[0-9a-f]{${expectedBytes * 2}}$`).test(right)
  ) return false
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'))
}

export function signArticleCatalogRequest({
  secret,
  keyId,
  method = 'GET',
  target,
  body = '',
  timestamp = Date.now(),
  nonce = randomBytes(16).toString('hex'),
}) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('Article Catalog signing secret must contain at least 32 characters.')
  }
  if (typeof keyId !== 'string' || !/^[a-z0-9][a-z0-9_-]{2,63}$/i.test(keyId)) {
    throw new Error('Article Catalog key id is invalid.')
  }
  if (typeof target !== 'string' || !target.startsWith('/')) {
    throw new Error('Article Catalog request target is invalid.')
  }
  const bodyHash = sha256Hex(body)
  const canonical = canonicalArticleCatalogRequest({
    keyId,
    method,
    target,
    timestamp,
    nonce,
    bodyHash,
  })
  const signature = createHmac('sha256', secret).update(canonical).digest('hex')
  return {
    [ARTICLE_CATALOG_AUTH_HEADERS.keyId]: keyId,
    [ARTICLE_CATALOG_AUTH_HEADERS.timestamp]: String(timestamp),
    [ARTICLE_CATALOG_AUTH_HEADERS.nonce]: nonce,
    [ARTICLE_CATALOG_AUTH_HEADERS.bodyHash]: bodyHash,
    [ARTICLE_CATALOG_AUTH_HEADERS.signature]: signature,
  }
}

function headerValue(headers, name) {
  if (!headers) return undefined
  if (typeof headers.get === 'function') return headers.get(name) || undefined
  const value = headers[name] ?? headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

export function verifyArticleCatalogRequest({
  keys,
  method,
  target,
  body = '',
  headers,
  now = Date.now(),
  maxSkewMs = ARTICLE_CATALOG_MAX_SKEW_MS,
  replayCache = new Map(),
}) {
  if (!keys || typeof keys !== 'object' || Object.keys(keys).length === 0) {
    return { ok: false, code: 'auth_unavailable' }
  }
  const keyId = headerValue(headers, ARTICLE_CATALOG_AUTH_HEADERS.keyId)
  const timestampText = headerValue(headers, ARTICLE_CATALOG_AUTH_HEADERS.timestamp)
  const nonce = headerValue(headers, ARTICLE_CATALOG_AUTH_HEADERS.nonce)
  const claimedBodyHash = headerValue(headers, ARTICLE_CATALOG_AUTH_HEADERS.bodyHash)
  const claimedSignature = headerValue(headers, ARTICLE_CATALOG_AUTH_HEADERS.signature)
  if (!keyId || !timestampText || !nonce || !claimedBodyHash || !claimedSignature) {
    return { ok: false, code: 'missing_signature' }
  }
  const secret = keys[keyId]
  if (typeof secret !== 'string' || secret.length < 32) return { ok: false, code: 'unknown_key' }
  if (!/^\d{13}$/.test(timestampText) || !/^[0-9a-f]{32}$/.test(nonce)) {
    return { ok: false, code: 'invalid_signature' }
  }
  const timestamp = Number(timestampText)
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > maxSkewMs) {
    return { ok: false, code: 'expired_signature' }
  }
  const bodyHash = sha256Hex(body)
  if (!safeHexEqual(claimedBodyHash, bodyHash, 32)) {
    return { ok: false, code: 'invalid_body_hash' }
  }
  const canonical = canonicalArticleCatalogRequest({
    keyId,
    method,
    target,
    timestamp,
    nonce,
    bodyHash,
  })
  const expectedSignature = createHmac('sha256', secret).update(canonical).digest('hex')
  if (!safeHexEqual(claimedSignature, expectedSignature, 32)) {
    return { ok: false, code: 'invalid_signature' }
  }

  for (const [cachedNonce, expiresAt] of replayCache) {
    if (expiresAt <= now) replayCache.delete(cachedNonce)
  }
  const replayKey = `${keyId}:${nonce}`
  if (replayCache.has(replayKey)) return { ok: false, code: 'replayed_signature' }
  replayCache.set(replayKey, timestamp + maxSkewMs)
  return { ok: true, keyId }
}

export function parseArticleCatalogKeys(value) {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter(([keyId, secret]) => (
        /^[a-z0-9][a-z0-9_-]{2,63}$/i.test(keyId)
        && typeof secret === 'string'
        && secret.length >= 32
      )),
    )
  } catch {
    return {}
  }
}
