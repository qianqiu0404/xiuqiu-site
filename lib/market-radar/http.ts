export interface MarketRadarRequest {
  method?: string
  query?: Record<string, string | string[] | undefined>
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

export interface MarketRadarResponse {
  setHeader(name: string, value: string | string[] | number): void
  status(code: number): {
    json(body: unknown): void
    end(): void
  }
}

declare const process: { env: Record<string, string | undefined> }

const attempts = new Map<string, { count: number; resetAt: number }>()

export function preparePublicResponse(res: MarketRadarResponse): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
  res.setHeader('X-Content-Type-Options', 'nosniff')
}

export function preparePrivateResponse(res: MarketRadarResponse): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
}

export function allowMethods(req: MarketRadarRequest, res: MarketRadarResponse, methods: string[]): boolean {
  if (req.method && methods.includes(req.method)) return true
  res.setHeader('Allow', methods.join(', '))
  res.status(405).json({ code: 'method_not_allowed', error: 'Method not allowed.' })
  return false
}

export function queryValue(req: MarketRadarRequest, key: string): string | undefined {
  const value = req.query?.[key]
  return Array.isArray(value) ? value[0] : value
}

export function clampInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

export function parseJsonBody(body: unknown): Record<string, unknown> {
  if (!body) return {}
  if (typeof body === 'object') return body as Record<string, unknown>
  if (typeof body !== 'string') return {}
  try {
    const parsed = JSON.parse(body)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

export function getClientId(req: MarketRadarRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return (value || 'unknown').split(',')[0].trim().slice(0, 80)
}

export function consumeRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const current = attempts.get(key)
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (current.count >= limit) return false
  current.count += 1
  return true
}

export function hasInternalToken(req: MarketRadarRequest): boolean {
  const configured = process.env.MARKET_RADAR_DISPATCH_TOKEN
  if (!configured) return false
  const header = req.headers.authorization
  const value = Array.isArray(header) ? header[0] : header
  const supplied = value?.startsWith('Bearer ') ? value.slice(7) : ''
  if (supplied.length !== configured.length) return false
  let mismatch = 0
  for (let index = 0; index < supplied.length; index += 1) {
    mismatch |= supplied.charCodeAt(index) ^ configured.charCodeAt(index)
  }
  return mismatch === 0
}

export async function hashClientId(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(`market-radar:${value}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 32)
}
