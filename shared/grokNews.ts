export const GROK_BOT_ID = 'x-ai-digest' as const
export interface GrokNewsItem {
  origin_id: string
  revision: number
  bot_id: typeof GROK_BOT_ID
  visibility: 'public'
  review_status: 'unreviewed'
  collected_at: string
  published_at: string | null
  event_date: string | null
  domain: 'ai' | 'web3' | 'market' | 'research'
  title: string
  summary: string
  source_url: string
  source_name: string
  source_access: 'accessible' | 'partial' | 'unavailable' | 'not_checked'
  source_excerpt: string | null
  bot_analysis: string | null
}
export interface GrokNewsRecord extends GrokNewsItem { id: string; fingerprint: string }
export interface GrokNewsIndex { schema_version: 1; bot_id: typeof GROK_BOT_ID; updated_at: string | null; records: GrokNewsRecord[] }

function obj(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('新闻资料格式不正确')
  return value as Record<string, unknown>
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('新闻资料字段不正确')
  if (/(?:gh[pousr]_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{20,}|sk-[a-zA-Z0-9_-]{24,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|authorization\s*:\s*bearer)/i.test(value)) throw new Error('拒绝发布疑似凭据')
  return value
}
function date(value: unknown): string {
  const result = text(value, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0, 10) !== result) throw new Error('新闻日期不正确')
  return result
}
function timestamp(value: unknown): string {
  const result = text(value, 40)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(result) || !Number.isFinite(Date.parse(result))) throw new Error('新闻时间必须含时区')
  date(result.slice(0, 10))
  return result
}
function optional(value: unknown, max: number): string | null { return value == null ? null : text(value, max) }
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (!choices.includes(value as T)) throw new Error('新闻字段不受支持')
  return value as T
}
export function grokSourceUrl(value: unknown): string {
  const result = text(value, 4000), url = new URL(result)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.')
    || /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(url.hostname)
    || /\.(?:local|internal|localhost)$/.test(url.hostname)) throw new Error('新闻必须使用公开原始链接')
  return url.href
}
export function parseGrokItem(value: unknown): GrokNewsItem {
  const item = obj(value), origin = text(item.origin_id, 180)
  if (!/^x-ai-digest:[a-z0-9:_.-]+$/i.test(origin) || !Number.isSafeInteger(item.revision) || Number(item.revision) < 1) throw new Error('新闻标识或版本不正确')
  return {
    origin_id: origin, revision: Number(item.revision), bot_id: choice(item.bot_id, [GROK_BOT_ID]),
    visibility: choice(item.visibility, ['public']), review_status: choice(item.review_status, ['unreviewed']),
    collected_at: timestamp(item.collected_at), published_at: item.published_at == null ? null : timestamp(item.published_at),
    event_date: item.event_date == null ? null : date(item.event_date),
    domain: choice(item.domain, ['ai', 'web3', 'market', 'research']),
    title: text(item.title, 200), summary: text(item.summary, 1500), source_url: grokSourceUrl(item.source_url),
    source_name: text(item.source_name, 200), source_access: choice(item.source_access, ['accessible', 'partial', 'unavailable', 'not_checked']),
    source_excerpt: optional(item.source_excerpt, 200), bot_analysis: optional(item.bot_analysis, 3000),
  }
}
export function parseGrokBatch(value: unknown): GrokNewsItem[] {
  const batch = obj(value)
  if (batch.schema_version !== 1 || batch.bot_id !== GROK_BOT_ID || !Array.isArray(batch.items) || !batch.items.length || batch.items.length > 50) throw new Error('新闻批次不正确')
  const items = batch.items.map(parseGrokItem)
  if (new Set(items.map(item => item.origin_id)).size !== items.length) throw new Error('同批次新闻标识重复')
  return items
}
export function parseGrokIndex(value: unknown): GrokNewsIndex {
  const index = obj(value)
  if (index.schema_version !== 1 || index.bot_id !== GROK_BOT_ID || !Array.isArray(index.records) || index.records.length > 2000) throw new Error('新闻索引版本不受支持')
  const records = index.records.map(value => {
    const record = obj(value), id = text(record.id, 40), fingerprint = text(record.fingerprint, 64)
    if (!/^grok-[a-f0-9]{24}$/.test(id) || !/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error('新闻索引标识不正确')
    return { ...parseGrokItem(value), id, fingerprint }
  })
  if (new Set(records.map(r => r.id)).size !== records.length || new Set(records.map(r => r.origin_id)).size !== records.length) throw new Error('新闻索引标识重复')
  return { schema_version: 1, bot_id: GROK_BOT_ID, updated_at: index.updated_at == null ? null : timestamp(index.updated_at), records }
}
