import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const MARKET_SNAPSHOT_INGEST_PATH = '/api/internal/market-snapshots'
export const MARKET_SNAPSHOT_MAX_SKEW_MS = 60_000

export const MARKET_SNAPSHOT_HEADERS = Object.freeze({
  keyId: 'x-market-key-id', timestamp: 'x-market-timestamp', nonce: 'x-market-nonce',
  bodyHash: 'x-market-body-sha256', signature: 'x-market-signature',
})

function header(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function safeHexEqual(left: string, right: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(left) || !/^[0-9a-f]{64}$/.test(right)) return false
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'))
}

export function marketSnapshotBody(body: unknown): string {
  if (typeof body === 'string') return body
  return JSON.stringify(body ?? {})
}

export function verifyMarketSnapshotSignature(input: {
  body: string
  headers: Record<string, string | string[] | undefined>
  keys: Record<string, string>
  now?: number
}): { ok: true; keyId: string; nonce: string; timestamp: number } | { ok: false; code: string } {
  const keyId = header(input.headers, MARKET_SNAPSHOT_HEADERS.keyId)
  const timestampText = header(input.headers, MARKET_SNAPSHOT_HEADERS.timestamp)
  const nonce = header(input.headers, MARKET_SNAPSHOT_HEADERS.nonce)
  const bodyHash = header(input.headers, MARKET_SNAPSHOT_HEADERS.bodyHash)
  const signature = header(input.headers, MARKET_SNAPSHOT_HEADERS.signature)
  if (!keyId || !timestampText || !nonce || !bodyHash || !signature) return { ok: false, code: 'missing_signature' }
  const secret = input.keys[keyId]
  if (!secret || secret.length < 32) return { ok: false, code: 'unknown_key' }
  if (!/^\d{13}$/.test(timestampText) || !/^[0-9a-f]{32}$/.test(nonce)) return { ok: false, code: 'invalid_signature' }
  const timestamp = Number(timestampText)
  if (!Number.isSafeInteger(timestamp) || Math.abs((input.now ?? Date.now()) - timestamp) > MARKET_SNAPSHOT_MAX_SKEW_MS) return { ok: false, code: 'expired_signature' }
  const expectedBodyHash = createHash('sha256').update(input.body).digest('hex')
  if (!safeHexEqual(bodyHash, expectedBodyHash)) return { ok: false, code: 'invalid_body_hash' }
  const canonical = ['market-snapshot-v1', keyId, 'POST', MARKET_SNAPSHOT_INGEST_PATH, timestampText, nonce, bodyHash].join('\n')
  const expected = createHmac('sha256', secret).update(canonical).digest('hex')
  if (!safeHexEqual(signature, expected)) return { ok: false, code: 'invalid_signature' }
  return { ok: true, keyId, nonce, timestamp }
}

export function parseMarketSnapshotKeys(value: string | undefined): Record<string, string> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    return Object.fromEntries(Object.entries(parsed).filter(([key, secret]) => /^[a-z0-9][a-z0-9_-]{2,63}$/i.test(key) && typeof secret === 'string' && secret.length >= 32)) as Record<string, string>
  } catch {
    return {}
  }
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function tokenHash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

function flowKey(secret: string): Buffer {
  if (secret.length < 32) throw new Error('Private market flow secret must contain at least 32 characters.')
  return createHash('sha256').update(`private-market-flow:${secret}`).digest()
}

export function sealFlowVerifier(verifier: string, secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', flowKey(secret), iv)
  const ciphertext = Buffer.concat([cipher.update(verifier, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), ciphertext].map(value => value.toString('base64url')).join('.')
}

export function openFlowVerifier(value: string, secret: string): string {
  const parts = value.split('.').map(part => Buffer.from(part, 'base64url'))
  if (parts.length !== 3 || parts[0].length !== 12 || parts[1].length !== 16) throw new Error('Invalid OAuth flow ciphertext.')
  const decipher = createDecipheriv('aes-256-gcm', flowKey(secret), parts[0])
  decipher.setAuthTag(parts[1])
  return Buffer.concat([decipher.update(parts[2]), decipher.final()]).toString('utf8')
}

export function parseCookies(value: string | string[] | undefined): Record<string, string> {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return {}
  return Object.fromEntries(raw.split(';').map(item => {
    const index = item.indexOf('=')
    return index < 0 ? ['', ''] : [item.slice(0, index).trim(), decodeURIComponent(item.slice(index + 1))]
  }).filter(([key]) => key))
}

export function privateCookie(name: string, value: string, maxAgeSeconds: number, path = '/'): string {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=${path}; HttpOnly; Secure; SameSite=Lax`
}
