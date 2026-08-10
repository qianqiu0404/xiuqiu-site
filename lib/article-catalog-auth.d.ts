export const ARTICLE_CATALOG_AUTH_HEADERS: Readonly<Record<'keyId' | 'timestamp' | 'nonce' | 'bodyHash' | 'signature', string>>
export const ARTICLE_CATALOG_MAX_SKEW_MS: number
export function sha256Hex(body?: string): string
export function canonicalArticleCatalogRequest(input: Record<string, string | number>): string
export function signArticleCatalogRequest(input: {
  secret: string
  keyId: string
  method?: string
  target: string
  body?: string
  timestamp?: number
  nonce?: string
}): Record<string, string>
export function verifyArticleCatalogRequest(input: {
  keys: Record<string, string>
  method: string
  target: string
  body?: string
  headers?: Record<string, string | string[] | undefined> | Headers
  now?: number
  maxSkewMs?: number
  replayCache?: Map<string, number>
}): { ok: true; keyId: string } | { ok: false; code: string }
export function parseArticleCatalogKeys(value: string | undefined): Record<string, string>
