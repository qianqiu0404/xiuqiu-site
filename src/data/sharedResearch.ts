import { createExternalLoader } from './externalSourceStatus.ts'
import type { ResearchCard, ResearchDetail, ResearchIndex, ResearchMaterial, ResearchNode } from './readingFeed.ts'

export const RESEARCH_HOME = 'https://shared-research.vercel.app/'
const ID = /^[a-z0-9][a-z0-9-]{0,159}$/
const TAGS = new Set('p h2 h3 h4 h5 h6 ul ol li strong em code pre blockquote table thead tbody tr th td hr br a div span del'.split(' '))
const MAX_BYTES = 2 * 1024 * 1024
const TTL = 5 * 60 * 1000

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('资料格式不正确')
  return value as Record<string, unknown>
}
function string(value: unknown, max = 1000): string {
  if (typeof value !== 'string' || value.length > max) throw new Error('资料字段不正确')
  return value
}
function nullable(value: unknown): string | null { return value === null ? null : string(value) }
function id(value: unknown): string {
  const result = string(value, 160)
  if (!ID.test(result)) throw new Error('资料标识不正确')
  return result
}
function choice<T extends string>(value: unknown, values: readonly T[]): T {
  if (!values.includes(value as T)) throw new Error('资料字段不受支持')
  return value as T
}
function list<T>(value: unknown, parse: (entry: unknown) => T, max = 2000): T[] {
  if (!Array.isArray(value) || value.length > max) throw new Error('资料列表不正确')
  return value.map(parse)
}
export function researchUrl(value: unknown): string {
  const result = string(value, 10000)
  const url = new URL(result)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('资料链接不安全')
  return url.href
}
function sourceUrl(value: unknown): string {
  const result = researchUrl(value)
  if (new URL(result).origin !== new URL(RESEARCH_HOME).origin) throw new Error('资料来源不正确')
  return result
}
function date(value: unknown): string {
  const result = string(value, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0, 10) !== result) throw new Error('资料日期不正确')
  return result
}
function material(value: unknown): ResearchMaterial {
  const m = object(value)
  return { id: id(m.id), title: string(m.title), url: sourceUrl(m.url), source_url: m.source_url === null ? null : researchUrl(m.source_url),
    source_type: choice(m.source_type, ['primary', 'secondary', 'model_output', 'unknown']),
    source_access: choice(m.source_access, ['accessible', 'partial', 'unavailable', 'not_checked']) }
}
function card(value: unknown): ResearchCard {
  const c = object(value)
  return { id: id(c.id), kind: choice(c.kind, ['capture', 'event', 'daily_brief', 'weekly_brief']), title: string(c.title),
    summary: string(c.summary, 3000), category: string(c.category), date: date(c.date),
    date_basis: choice(c.date_basis, ['event', 'published', 'collected', 'brief']),
    collected_at: nullable(c.collected_at), published_at: nullable(c.published_at), event_date: nullable(c.event_date), updated_at: nullable(c.updated_at),
    evidence_status: choice(c.evidence_status, ['unverified', 'source_checked', 'corroborated', 'disputed', 'refuted']),
    url: sourceUrl(c.url), materials: list(c.materials, material), topic_ids: list(c.topic_ids, v => string(v)), coverage: nullable(c.coverage) }
}
export function parseResearchIndex(value: unknown): ResearchIndex {
  const v = object(value), source = object(v.source)
  if (v.schema_version !== 1 || source.name !== 'shared-research' || !/^[a-f0-9]{40}$/.test(string(source.revision))) throw new Error('资料接口版本不受支持')
  if (!Number.isSafeInteger(v.record_count) || Number(v.record_count) < 0) throw new Error('资料计数不正确')
  const cards = list(v.cards, card), briefs = list(v.briefs, card)
  if (new Set([...cards, ...briefs].map(c => c.id)).size !== cards.length + briefs.length) throw new Error('资料标识重复')
  return { schema_version: 1, source: { name: 'shared-research', home_url: sourceUrl(source.home_url), revision: string(source.revision) },
    updated_at: nullable(v.updated_at), record_count: Number(v.record_count), cards, briefs }
}
export function parseResearchDetail(value: unknown, expectedId: string): ResearchDetail {
  const v = object(value), record = card(v.record)
  if (v.schema_version !== 1 || record.id !== expectedId) throw new Error('资料详情与链接不一致')
  let count = 0
  function node(value: unknown, depth = 0): ResearchNode {
    if (++count > 30000 || depth > 40) throw new Error('资料正文过大')
    const n = object(value)
    if ('text' in n) return { text: string(n.text, 100000) }
    const tag = string(n.tag, 20)
    if (!TAGS.has(tag)) throw new Error('资料正文含不支持的内容')
    const result: ResearchNode = { tag, children: list(n.children, child => node(child, depth + 1), 30000) }
    if (tag === 'a' && n.href !== undefined) result.href = researchUrl(n.href)
    if (tag === 'a' && n.record_id !== undefined) result.record_id = id(n.record_id)
    return result
  }
  return { schema_version: 1, record, content: list(v.content, v => node(v), 30000) }
}

export class ResearchRequestError extends Error {
  readonly status: number
  constructor(status: number) {
    super(status === 404 ? '没有找到这条资料' : '共享研究暂时无法载入')
    this.status = status
  }
}

// Same-origin on Vercel and Vite. No GitHub API, login, token or browser storage.
export function createResearchClient(fetcher: typeof fetch = fetch, now = Date.now) {
  const cache = new Map<string, { value: unknown; expires: number }>()
  const pending = new Map<string, Promise<unknown>>()
  async function request<T>(path: string, parse: (v: unknown) => T, force = false): Promise<T> {
    const cached = cache.get(path)
    if (!force && cached && cached.expires > now()) return cached.value as T
    if (pending.has(path)) return pending.get(path) as Promise<T>
    const task = (async () => {
      const abort = new AbortController()
      const timeout = setTimeout(() => abort.abort(), 10000)
      try {
        const response = await fetcher(`/research-data/${path}`, { signal: abort.signal, credentials: 'omit', redirect: 'error' })
        if (!response.ok) throw new ResearchRequestError(response.status)
        if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('资料接口返回格式不正确')
        if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('资料响应过大')
        const reader = response.body?.getReader()
        if (!reader) throw new Error('资料正文为空')
        const decoder = new TextDecoder(), chunks: string[] = []
        let bytes = 0
        while (true) {
          const part = await reader.read()
          if (part.done) break
          bytes += part.value.byteLength
          if (bytes > MAX_BYTES) { await reader.cancel(); throw new Error('资料响应过大') }
          chunks.push(decoder.decode(part.value, { stream: true }))
        }
        chunks.push(decoder.decode())
        const value = parse(JSON.parse(chunks.join('')))
        cache.set(path, { value, expires: now() + TTL })
        return value
      } finally { clearTimeout(timeout) }
    })()
    pending.set(path, task)
    try { return await task } finally { pending.delete(path) }
  }
  return {
    loadIndex: (force = false) => request('index.json', parseResearchIndex, force),
    loadDetail: (recordId: string, force = false) => request(`records/${id(recordId)}.json`, v => parseResearchDetail(v, recordId), force),
  }
}
const client = createResearchClient()
export const loadResearchIndex = client.loadIndex
// Index only: record details have no snapshot and still need the live source.
export const loadResearchIndexWithFallback = createExternalLoader('research', loadResearchIndex, parseResearchIndex)
export const loadResearchDetail = client.loadDetail
