export const GROK_BOT_ID = 'x-ai-digest' as const
export const CHATGPT_BOT_ID = 'chatgpt-daily' as const
export const NEWS_PRODUCERS = Object.freeze({
  grok: Object.freeze({ botId: GROK_BOT_ID, originPrefix: 'x-ai-digest:', idPrefix: 'grok-', branch: 'news/x-ai-digest', label: 'Grok Bot', dataPath: '/grok-news-data/index.json' }),
  chatgpt: Object.freeze({ botId: CHATGPT_BOT_ID, originPrefix: 'chatgpt-daily:', idPrefix: 'chatgpt-', branch: 'news/chatgpt-daily', label: 'ChatGPT 推荐', dataPath: '/chatgpt-news-data/index.json' }),
})
export type NewsProducer = keyof typeof NEWS_PRODUCERS
export type NewsBotId<P extends NewsProducer = NewsProducer> = (typeof NEWS_PRODUCERS)[P]['botId']
export interface NewsItem<P extends NewsProducer = NewsProducer> {
  origin_id: string
  revision: number
  bot_id: NewsBotId<P>
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
export interface NewsRecord<P extends NewsProducer = NewsProducer> extends NewsItem<P> { id: string; fingerprint: string }
export interface NewsIndex<P extends NewsProducer = NewsProducer> { schema_version: 1; bot_id: NewsBotId<P>; updated_at: string | null; records: NewsRecord<P>[] }
export interface GrokNewsItem extends NewsItem<'grok'> {}
export interface GrokNewsRecord extends NewsRecord<'grok'> {}
export interface GrokNewsIndex extends NewsIndex<'grok'> {}

export function newsProducerConfig<P extends NewsProducer>(producer: P): (typeof NEWS_PRODUCERS)[P] {
  if (typeof producer !== 'string' || !Object.prototype.hasOwnProperty.call(NEWS_PRODUCERS, producer)) throw new Error('新闻来源不受支持')
  return NEWS_PRODUCERS[producer]
}

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
export function parseNewsItem<P extends NewsProducer>(value: unknown, producer: P): NewsItem<P> {
  const config = newsProducerConfig(producer)
  const item = obj(value), origin = text(item.origin_id, 180)
  if (!origin.toLowerCase().startsWith(config.originPrefix) || !/^[a-z0-9:_.-]+$/i.test(origin.slice(config.originPrefix.length))
    || !Number.isSafeInteger(item.revision) || Number(item.revision) < 1) throw new Error('新闻标识或版本不正确')
  return {
    origin_id: origin, revision: Number(item.revision), bot_id: choice(item.bot_id, [config.botId]) as NewsBotId<P>,
    visibility: choice(item.visibility, ['public']), review_status: choice(item.review_status, ['unreviewed']),
    collected_at: timestamp(item.collected_at), published_at: item.published_at == null ? null : timestamp(item.published_at),
    event_date: item.event_date == null ? null : date(item.event_date),
    domain: choice(item.domain, ['ai', 'web3', 'market', 'research']),
    title: text(item.title, 200), summary: text(item.summary, 1500), source_url: grokSourceUrl(item.source_url),
    source_name: text(item.source_name, 200), source_access: choice(item.source_access, ['accessible', 'partial', 'unavailable', 'not_checked']),
    source_excerpt: optional(item.source_excerpt, 200), bot_analysis: optional(item.bot_analysis, 3000),
  }
}
export function parseNewsBatch<P extends NewsProducer>(value: unknown, producer: P): NewsItem<P>[] {
  const config = newsProducerConfig(producer)
  const batch = obj(value)
  if (batch.schema_version !== 1 || batch.bot_id !== config.botId || !Array.isArray(batch.items) || !batch.items.length || batch.items.length > 50) throw new Error('新闻批次不正确')
  const items = batch.items.map(item => parseNewsItem(item, producer))
  if (new Set(items.map(item => item.origin_id)).size !== items.length) throw new Error('同批次新闻标识重复')
  return items
}
export function parseNewsIndex<P extends NewsProducer>(value: unknown, producer: P): NewsIndex<P> {
  const config = newsProducerConfig(producer)
  const index = obj(value)
  if (index.schema_version !== 1 || index.bot_id !== config.botId || !Array.isArray(index.records) || index.records.length > 2000) throw new Error('新闻索引版本不受支持')
  const records = index.records.map(value => {
    const record = obj(value), id = text(record.id, 40), fingerprint = text(record.fingerprint, 64)
    if (!id.startsWith(config.idPrefix) || !/^[a-f0-9]{24}$/.test(id.slice(config.idPrefix.length)) || !/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error('新闻索引标识不正确')
    return { ...parseNewsItem(value, producer), id, fingerprint }
  })
  if (new Set(records.map(r => r.id)).size !== records.length || new Set(records.map(r => r.origin_id)).size !== records.length) throw new Error('新闻索引标识重复')
  return { schema_version: 1, bot_id: config.botId as NewsBotId<P>, updated_at: index.updated_at == null ? null : timestamp(index.updated_at), records }
}

export function parseGrokItem(value: unknown): GrokNewsItem { return parseNewsItem(value, 'grok') }
export function parseGrokBatch(value: unknown): GrokNewsItem[] { return parseNewsBatch(value, 'grok') }
export function parseGrokIndex(value: unknown): GrokNewsIndex { return parseNewsIndex(value, 'grok') }
