import type { NewsIndex, NewsProducer, NewsRecord } from '../../shared/grokNews.ts'
import type { ReadingItem, ResearchCard, ResearchDetail } from './readingFeed.ts'
import { researchCalendarDate } from './sharedResearchPresentation.ts'

const NEWS_LABELS: Record<NewsProducer, string> = { grok: 'Grok Bot', chatgpt: 'ChatGPT推荐' }

export function newsDetailContext(value: unknown): { producer: NewsProducer | undefined; sourceLabel: string; listPath: string } {
  const producer = value === 'grok' || value === 'chatgpt' ? value : undefined
  return { producer, sourceLabel: producer === 'grok' ? 'Grok Bot 新闻' : producer === 'chatgpt' ? NEWS_LABELS.chatgpt : '共享研究',
    listPath: `/?domain=${producer || 'research'}` }
}

export function newsCard(record: NewsRecord, producer: NewsProducer): ResearchCard {
  const href = `/research?producer=${producer}&id=${record.id}`
  return { id: record.id, kind: 'capture', title: record.title, summary: record.summary, category: record.domain,
    date: record.event_date || researchCalendarDate(record.published_at || record.collected_at),
    date_basis: record.event_date ? 'event' : record.published_at ? 'published' : 'collected',
    collected_at: record.collected_at, published_at: record.published_at, event_date: record.event_date, updated_at: record.collected_at,
    evidence_status: 'unverified', url: href,
    materials: [{ id: record.id, title: record.source_name, url: href, source_url: record.source_url, source_type: 'model_output', source_access: record.source_access }],
    topic_ids: [], coverage: null }
}

export function newsReadingItems(index: NewsIndex | undefined, producer: NewsProducer): ReadingItem[] {
  return (index?.records || []).map(record => {
    const card = newsCard(record, producer)
    return { id: record.id, kind: producer, domain: record.domain, topic: `${producer}-${record.domain}`, date: card.date,
      title: record.title, summary: record.summary, href: card.url, research: card }
  })
}

export function newsUpdateLabel(index: NewsIndex, producer: NewsProducer): string {
  const label = producer === 'grok' ? 'Grok Bot 直投' : NEWS_LABELS.chatgpt
  return `${label} · ${index.records.length} 条 · ${index.updated_at ? `最近收录 ${researchCalendarDate(index.updated_at)}` : '暂无资料'} · 搜索整理未经人工复核。`
}

export function newsDetail(record: NewsRecord, producer: NewsProducer): ResearchDetail {
  const p = (value: string) => ({ tag: 'p', children: [{ text: value }] })
  const h = (value: string) => ({ tag: 'h2', children: [{ text: value }] })
  const attribution = producer === 'grok' ? 'x-ai-digest' : 'ChatGPT'
  return { schema_version: 1, record: newsCard(record, producer), content: [h(`${NEWS_LABELS[producer]}${producer === 'grok' ? ' 整理' : ''}`), p(record.summary),
    ...(record.source_excerpt ? [h('原文摘录'), { tag: 'blockquote', children: [p(record.source_excerpt)] }] : []),
    ...(record.bot_analysis ? [h(producer === 'grok' ? 'Bot 分析与待核对事项' : 'ChatGPT 分析与待核对事项'), p(record.bot_analysis)] : []),
    p(`以上由 ${attribution} 搜索整理，未经人工复核。原文可访问不等于所述事实已证实。`)] }
}
