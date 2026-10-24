import { parseGrokIndex } from '../../shared/grokNews.ts'
import type { GrokNewsIndex, GrokNewsRecord } from '../../shared/grokNews.ts'
import type { ReadingItem, ResearchCard, ResearchDetail } from './readingFeed.ts'
import { researchCalendarDate } from './sharedResearchPresentation.ts'

export function grokCard(record: GrokNewsRecord): ResearchCard {
  const href = `/research?producer=grok&id=${record.id}`
  return { id: record.id, kind: 'capture', title: record.title, summary: record.summary, category: record.domain,
    date: record.event_date || researchCalendarDate(record.published_at || record.collected_at),
    date_basis: record.event_date ? 'event' : record.published_at ? 'published' : 'collected',
    collected_at: record.collected_at, published_at: record.published_at, event_date: record.event_date, updated_at: record.collected_at,
    evidence_status: 'unverified', url: href,
    materials: [{ id: record.id, title: record.source_name, url: href, source_url: record.source_url, source_type: 'model_output', source_access: record.source_access }],
    topic_ids: [], coverage: null }
}
export function grokReadingItems(index?: GrokNewsIndex): ReadingItem[] {
  return (index?.records || []).map(record => {
    const card = grokCard(record)
    return { id: record.id, kind: 'grok', domain: record.domain, topic: `grok-${record.domain}`, date: card.date,
      title: record.title, summary: record.summary, href: card.url, research: card }
  })
}
export function grokUpdateLabel(index: GrokNewsIndex): string {
  return `Grok Bot 直投 · ${index.records.length} 条 · ${index.updated_at ? `最近收录 ${researchCalendarDate(index.updated_at)}` : '暂无资料'} · 搜索整理未经人工复核。`
}
export function grokDetail(record: GrokNewsRecord): ResearchDetail {
  const p = (value: string) => ({ tag: 'p', children: [{ text: value }] })
  const h = (value: string) => ({ tag: 'h2', children: [{ text: value }] })
  return { schema_version: 1, record: grokCard(record), content: [h('Grok Bot 整理'), p(record.summary),
    ...(record.source_excerpt ? [h('原文摘录'), { tag: 'blockquote', children: [p(record.source_excerpt)] }] : []),
    ...(record.bot_analysis ? [h('Bot 分析与待核对事项'), p(record.bot_analysis)] : []),
    p('以上由 x-ai-digest 搜索整理，未经人工复核。原文可访问不等于所述事实已证实。')] }
}
export function createGrokNewsClient(fetcher: typeof fetch = fetch, now = Date.now) {
  let cached: GrokNewsIndex | undefined, expires = 0, pending: Promise<GrokNewsIndex> | undefined
  function load(force = false): Promise<GrokNewsIndex> {
    if (!force && cached && now() < expires) return Promise.resolve(cached)
    if (pending) return pending
    pending = (async () => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000)
      try {
        const response = await fetcher(`/grok-news-data/index.json?v=${Math.floor(now() / (force ? 1 : 60000))}`, { signal: controller.signal, credentials: 'omit', cache: 'no-store' })
        if (!response.ok) throw new Error('Grok Bot 资料暂时无法读取')
        if (Number(response.headers.get('content-length')) > 2 * 1024 * 1024) throw new Error('新闻索引过大')
        const text = await response.text()
        if (new TextEncoder().encode(text).length > 2 * 1024 * 1024) throw new Error('新闻索引过大')
        const value = parseGrokIndex(JSON.parse(text))
        cached = value
        expires = now() + 60000
        return value
      } finally { clearTimeout(timer) }
    })().finally(() => { pending = undefined })
    return pending
  }
  return { load }
}
const client = createGrokNewsClient()
export const loadGrokNews = client.load
export async function loadGrokDetail(id: string, force = false): Promise<ResearchDetail | undefined> {
  const record = (await loadGrokNews(force)).records.find(record => record.id === id)
  return record ? grokDetail(record) : undefined
}
export type { GrokNewsIndex }
