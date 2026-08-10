import { signArticleCatalogRequest } from '../lib/article-catalog-auth.js'
import { normalizeContentCatalogPreviewPayload } from '../src/data/contentCatalogPreviewContract.ts'

declare const process: {
  env: Record<string, string | undefined>
}

interface PreviewRequest {
  method?: string
}

interface PreviewResponse {
  setHeader(name: string, value: string): void
  status(code: number): {
    json(body: unknown): void
    end(): void
  }
}

interface PreviewHandlerOptions {
  fetchImpl?: typeof fetch
  now?: () => number
  nonce?: string
  timeoutMs?: number
}

const UPSTREAM_TARGET = '/v1/public/articles'
const DEFAULT_TIMEOUT_MS = 4_000

function prepareResponse(res: PreviewResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
}

function send(res: PreviewResponse, status: number, body: unknown) {
  return res.status(status).json(body)
}

function previewEnabled() {
  return process.env.VERCEL_ENV === 'preview'
    && process.env.CONTENT_CATALOG_PREVIEW_ENABLED === 'true'
}

function upstreamUrl(value: string | undefined): URL | undefined {
  if (!value) return undefined
  try {
    const parsed = new URL(value)
    if (
      parsed.protocol !== 'https:'
      || parsed.username
      || parsed.password
      || parsed.search
      || parsed.hash
      || (parsed.pathname !== '/' && parsed.pathname !== '')
    ) return undefined
    parsed.pathname = UPSTREAM_TARGET
    return parsed
  } catch {
    return undefined
  }
}

export async function handleContentCatalogPreview(
  req: PreviewRequest,
  res: PreviewResponse,
  {
    fetchImpl = fetch,
    now = () => Date.now(),
    nonce,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  }: PreviewHandlerOptions = {},
) {
  prepareResponse(res)
  if (!previewEnabled()) return send(res, 404, { error: 'Not found.' })
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return send(res, 405, { error: 'Method not allowed.' })
  }

  const targetUrl = upstreamUrl(process.env.ARTICLE_CATALOG_PREVIEW_UPSTREAM_URL)
  const secret = process.env.ARTICLE_CATALOG_PREVIEW_SECRET
  const keyId = process.env.ARTICLE_CATALOG_PREVIEW_KEY_ID
  if (!targetUrl || !secret || !keyId) {
    return send(res, 503, { error: 'Content catalog preview is unavailable.' })
  }

  let signedHeaders: Record<string, string>
  try {
    signedHeaders = signArticleCatalogRequest({
      secret,
      keyId,
      method: 'GET',
      target: UPSTREAM_TARGET,
      body: '',
      timestamp: now(),
      nonce,
    })
  } catch {
    return send(res, 503, { error: 'Content catalog preview is unavailable.' })
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const upstream = await fetchImpl(targetUrl, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...signedHeaders,
      },
      redirect: 'error',
      signal: controller.signal,
    })
    if (!upstream.ok) {
      return send(res, 502, { error: 'Content catalog preview is unavailable.' })
    }
    const text = await upstream.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return send(res, 502, { error: 'Content catalog preview is unavailable.' })
    }
    const catalog = normalizeContentCatalogPreviewPayload(parsed)
    if (!catalog) return send(res, 502, { error: 'Content catalog preview is unavailable.' })
    return send(res, 200, catalog)
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError'
    return send(res, timedOut ? 504 : 502, { error: 'Content catalog preview is unavailable.' })
  } finally {
    clearTimeout(timeoutId)
  }
}

export default async function handler(req: PreviewRequest, res: PreviewResponse) {
  return handleContentCatalogPreview(req, res)
}
