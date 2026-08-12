import { signArticleCatalogRequest } from './article-catalog-auth.js'

declare const process: { env: Record<string, string | undefined> }

export function isRadarUpstreamConfigured(): boolean {
  return Boolean(process.env.RADAR_PUBLIC_API_BASE_URL)
}

export async function fetchRadarUpstream(target: string, fetchImpl: typeof fetch = fetch, options: { notFoundAsNull?: boolean } = {}): Promise<unknown> {
  const base = process.env.RADAR_PUBLIC_API_BASE_URL
  const secret = process.env.RADAR_PUBLIC_API_HMAC_SECRET
  const keyId = process.env.RADAR_PUBLIC_API_HMAC_KEY_ID
  if (!base || !secret || !keyId || !target.startsWith('/v1/')) throw new Error('radar_upstream_unconfigured')
  const parsed = new URL(base)
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || !parsed.hostname || !['','/'].includes(parsed.pathname)) {
    throw new Error('radar_upstream_invalid')
  }
  const headers = signArticleCatalogRequest({ secret, keyId, method: 'GET', target })
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 4_000)
  try {
    const response = await fetchImpl(new URL(target, parsed), { method:'GET',headers:{accept:'application/json',...headers},redirect:'error',signal:controller.signal })
    if (response.status === 404 && options.notFoundAsNull) return null
    if (!response.ok) throw new Error(`radar_upstream_http_${response.status}`)
    return await response.json()
  } finally { clearTimeout(timeout) }
}
