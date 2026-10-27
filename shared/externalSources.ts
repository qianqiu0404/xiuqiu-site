// Health, freshness and snapshot rules for read-only feeds that
// vercel.json rewrites to other origins. Pure: callers inject fetch, clock and
// parsers, so the browser, the Vite build and the health script share one rule.

export type ExternalSourceId = 'grok' | 'research' | 'chatgpt'

// Keep the existing scheduled health check and build snapshots on their
// established sources. A new source is checked only when explicitly selected.
export const DEFAULT_EXTERNAL_SOURCES: readonly ExternalSourceId[] = ['grok', 'research']

export interface ExternalSourceDef {
  id: ExternalSourceId
  label: string
  /** Same-origin path served through the vercel.json rewrite. */
  livePath: string
  /** Upstream URL behind the rewrite; the build and health check read it directly. */
  upstream: string
  /** Static copy emitted by the build, used only when the live path fails. */
  snapshotPath: string
  /** Older than this is shown as possibly paused upstream, not as an error. */
  maxAgeHours: number
}

export const EXTERNAL_SOURCES: Record<ExternalSourceId, ExternalSourceDef> = {
  grok: {
    id: 'grok',
    label: 'Grok Bot 新闻',
    livePath: '/grok-news-data/index.json',
    upstream: 'https://raw.githubusercontent.com/qianqiu0404/xiuqiu-site/refs/heads/news/x-ai-digest/feed/v1/index.json',
    snapshotPath: '/external-snapshots/grok-news.json',
    maxAgeHours: 48,
  },
  research: {
    id: 'research',
    label: '共享研究',
    livePath: '/research-data/index.json',
    upstream: 'https://shared-research.vercel.app/feed/v1/index.json',
    snapshotPath: '/external-snapshots/research.json',
    maxAgeHours: 72,
  },
  chatgpt: {
    id: 'chatgpt',
    label: 'ChatGPT推荐',
    livePath: '/chatgpt-news-data/index.json',
    upstream: 'https://raw.githubusercontent.com/qianqiu0404/xiuqiu-site/refs/heads/news/chatgpt-daily/feed/v1/index.json',
    snapshotPath: '/external-snapshots/chatgpt-news.json',
    maxAgeHours: 48,
  },
}

export const EXTERNAL_MAX_BYTES = 2 * 1024 * 1024
const HOUR_MS = 3_600_000
const CLOCK_SKEW_MS = 5 * 60_000

export type ExternalFreshness = 'fresh' | 'stale' | 'unknown'

export function externalFreshness(updatedAt: string | null | undefined, maxAgeHours: number, now: number): { freshness: ExternalFreshness; ageHours: number | null } {
  const parsed = updatedAt ? Date.parse(updatedAt) : NaN
  // A missing or future timestamp says nothing about upstream health.
  if (!Number.isFinite(parsed) || parsed - now > CLOCK_SKEW_MS) return { freshness: 'unknown', ageHours: null }
  const ageHours = Math.max(0, (now - parsed) / HOUR_MS)
  return { freshness: ageHours > maxAgeHours ? 'stale' : 'fresh', ageHours }
}

export interface ExternalSnapshot<T> {
  schema_version: 1
  source: ExternalSourceId
  fetched_at: string
  data: T
}

export function parseExternalSnapshot<T>(value: unknown, source: ExternalSourceId, parse: (data: unknown) => T): ExternalSnapshot<T> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('快照格式不正确')
  const v = value as Record<string, unknown>
  if (v.schema_version !== 1 || v.source !== source) throw new Error('快照版本或来源不匹配')
  if (typeof v.fetched_at !== 'string' || !Number.isFinite(Date.parse(v.fetched_at))) throw new Error('快照时间不正确')
  return { schema_version: 1, source, fetched_at: v.fetched_at, data: parse(v.data) }
}

/** Reads a JSON body with a timeout and the same size cap the page clients use. */
export async function fetchBoundedJson(url: string, fetcher: typeof fetch, timeoutMs: number): Promise<{ status: number; json: unknown }> {
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), timeoutMs)
  try {
    const response = await fetcher(url, { signal: abort.signal, credentials: 'omit', cache: 'no-store', redirect: 'error' })
    if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status })
    const type = response.headers.get('content-type') || ''
    // raw.githubusercontent.com serves JSON as text/plain.
    if (!/json|text\/plain/.test(type)) throw Object.assign(new Error(`不支持的类型 ${type || '未知'}`), { status: response.status })
    if (Number(response.headers.get('content-length')) > EXTERNAL_MAX_BYTES) throw Object.assign(new Error('响应过大'), { status: response.status })
    const text = await response.text()
    if (new TextEncoder().encode(text).length > EXTERNAL_MAX_BYTES) throw Object.assign(new Error('响应过大'), { status: response.status })
    return { status: response.status, json: JSON.parse(text) }
  } catch (error) {
    if (abort.signal.aborted) throw Object.assign(new Error(`超时 ${timeoutMs}ms`), { status: null })
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export interface ExternalIndexShape { updated_at: string | null }

export interface ExternalProbe {
  source: ExternalSourceId
  url: string
  ok: boolean
  status: number | null
  elapsedMs: number
  updatedAt: string | null
  records: number | null
  freshness: ExternalFreshness
  ageHours: number | null
  error: string | null
}

export function externalRecordCount(index: unknown): number | null {
  const v = index as { records?: unknown[]; cards?: unknown[] }
  if (Array.isArray(v?.records)) return v.records.length
  if (Array.isArray(v?.cards)) return v.cards.length
  return null
}

export async function probeExternalSource(
  def: ExternalSourceDef,
  url: string,
  parse: (value: unknown) => ExternalIndexShape,
  options: { fetcher?: typeof fetch; now?: () => number; timeoutMs?: number } = {},
): Promise<ExternalProbe & { data?: unknown }> {
  const fetcher = options.fetcher ?? fetch, now = options.now ?? Date.now
  const started = now()
  const base = { source: def.id, url, updatedAt: null, records: null, freshness: 'unknown' as const, ageHours: null }
  try {
    const { status, json } = await fetchBoundedJson(url, fetcher, options.timeoutMs ?? 15_000)
    const index = parse(json)
    const { freshness, ageHours } = externalFreshness(index.updated_at, def.maxAgeHours, now())
    return { ...base, ok: true, status, elapsedMs: now() - started, updatedAt: index.updated_at, records: externalRecordCount(index), freshness, ageHours, error: null, data: json }
  } catch (error) {
    const status = (error as { status?: number | null }).status ?? null
    // undici reports network errors as a bare "fetch failed"; the cause has the code.
    const cause = (error as { cause?: { code?: string; message?: string } }).cause
    const message = error instanceof Error ? error.message : String(error)
    return { ...base, ok: false, status, elapsedMs: now() - started, error: cause ? `${message} (${cause.code || cause.message})` : message }
  }
}

export type ExternalParsers = Record<ExternalSourceId, (value: unknown) => ExternalIndexShape>

export interface ExternalProbeOptions { sources?: readonly ExternalSourceId[]; base?: string; fetcher?: typeof fetch; now?: () => number; timeoutMs?: number }

export async function probeAllExternalSources(parsers: ExternalParsers, options: ExternalProbeOptions = {}) {
  return Promise.all((options.sources ?? DEFAULT_EXTERNAL_SOURCES).map(id => EXTERNAL_SOURCES[id]).map(def =>
    probeExternalSource(def, options.base ? new URL(def.livePath, options.base).href : def.upstream, parsers[def.id], options)))
}

export interface ExternalSnapshotFile { source: ExternalSourceId; fileName: string | null; json?: string; error: string | null }

/**
 * Snapshots go into the build output only. They are never committed, so they
 * stay outside the frozen public/data contract and the generated-data check.
 */
export async function buildExternalSnapshotFiles(parsers: ExternalParsers, options: Omit<ExternalProbeOptions, 'base'> = {}): Promise<ExternalSnapshotFile[]> {
  const now = options.now ?? Date.now
  const probes = await probeAllExternalSources(parsers, { ...options, now })
  // One retry per failed source: a transient network error should not drop
  // the fallback copy for a whole release.
  for (const [i, probe] of probes.entries()) {
    if (probe.ok) continue
    const def = EXTERNAL_SOURCES[probe.source]
    probes[i] = await probeExternalSource(def, def.upstream, parsers[def.id], { ...options, now })
  }
  return probes.map(probe => {
    if (!probe.ok) return { source: probe.source, fileName: null, error: probe.error }
    const snapshot: ExternalSnapshot<unknown> = { schema_version: 1, source: probe.source, fetched_at: new Date(now()).toISOString(), data: probe.data }
    return { source: probe.source, fileName: EXTERNAL_SOURCES[probe.source].snapshotPath.slice(1), json: `${JSON.stringify(snapshot)}\n`, error: null }
  })
}
