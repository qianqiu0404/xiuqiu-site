import type { IntelDomain, IntelItem, IntelTopic } from './generatedIntelFeed.ts'
import { radarTopicLabel } from './radarPresentation.ts'
import { getSnapshotFreshness } from './snapshotFreshness.ts'

// Home page SEO; index.html carries the same values for the static document.
export const intelHomeSeo = {
  title: 'xiuqiu｜AI 与 Web3 工程情报流',
  description: '每天 2 条 AI、2 条 Web3 工程简报和市场事件，按主题筛选、搜索与订阅；每条都回到一手来源。',
} as const

export type IntelFilter = 'all' | 'ai' | 'web3' | 'market'

export const intelFilters: { key: IntelFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'ai', label: 'AI' },
  { key: 'web3', label: 'Web3' },
  { key: 'market', label: '市场' },
]

const marketTopicLabels: Record<string, string> = {
  market_macro: '宏观',
  market_crypto: '加密市场',
  market_equity: '股票',
  market_regulation: '监管',
  trend_review: '趋势回顾',
}

const domainLabels: Record<IntelDomain, string> = { ai: 'AI', web3: 'WEB3', market: '市场', review: '回顾' }

export function intelTopicLabel(topic: string): string {
  return marketTopicLabels[topic] || radarTopicLabel(topic)
}

export function intelDomainLabel(domain: IntelDomain): string {
  return domainLabels[domain]
}

// Reviews summarise every domain, so they stay visible under any domain filter.
export function filterIntel(items: readonly IntelItem[], query: { filter: IntelFilter; topic?: string; search?: string }): IntelItem[] {
  const needle = query.search?.trim().toLowerCase()
  return items.filter(item =>
    (query.filter === 'all' || item.domain === query.filter || item.kind === 'review')
    && (!query.topic || item.topic === query.topic)
    && (!needle || `${item.title} ${item.summary}`.toLowerCase().includes(needle)),
  )
}

export function groupIntelByDate(items: readonly IntelItem[]): { date: string; items: IntelItem[] }[] {
  const days = new Map<string, IntelItem[]>()
  for (const item of items) {
    const day = days.get(item.date)
    if (day) day.push(item)
    else days.set(item.date, [item])
  }
  return [...days.entries()].map(([date, dayItems]) => ({ date, items: dayItems }))
}

// "Continuing" means the topic recurred in at least two editions within the
// last `windowDays` calendar days before the newest item, so stale topics
// never carry the badge after a publishing gap.
export function continuingIntelTopics(items: readonly IntelItem[], windowDays = 30, minEditions = 2): Set<string> {
  const latest = items.reduce((max, item) => (item.date > max ? item.date : max), '')
  if (!latest) return new Set()
  const floor = new Date(`${latest}T00:00:00Z`)
  floor.setUTCDate(floor.getUTCDate() - (windowDays - 1))
  const floorDate = floor.toISOString().slice(0, 10)
  const editions = new Map<string, Set<string>>()
  for (const item of items) {
    if (item.kind === 'review' || item.date < floorDate) continue
    const set = editions.get(item.topic) ?? new Set<string>()
    set.add(item.date)
    editions.set(item.topic, set)
  }
  return new Set([...editions].filter(([, dates]) => dates.size >= minEditions).map(([topic]) => topic))
}

export interface IntelFreshness {
  state: 'today' | 'recent' | 'stale' | 'unknown'
  ageDays?: number
  label: string
}

// Freshness banner: explicit about gaps instead of presenting old items as today's.
export function getIntelFreshness(latestDate: string | null | undefined, now = new Date()): IntelFreshness {
  const freshness = getSnapshotFreshness(latestDate ?? undefined, now)
  if (freshness.state === 'unknown' || freshness.ageDays === undefined) return { state: 'unknown', label: '更新日期待核验' }
  if (freshness.ageDays === 0) return { state: 'today', ageDays: 0, label: `今日已更新 · ${latestDate}` }
  if (freshness.ageDays <= 2) return { state: 'recent', ageDays: freshness.ageDays, label: `最近更新 ${latestDate}（${freshness.ageDays} 天前）` }
  return { state: 'stale', ageDays: freshness.ageDays, label: `已 ${freshness.ageDays} 天未更新 · 最后一期 ${latestDate}` }
}

export function topicsForFilter(topics: readonly IntelTopic[], filter: IntelFilter): IntelTopic[] {
  return topics.filter(topic => filter === 'all' || topic.domain === filter)
}

export function intelSourceLabel(item: IntelItem): string | undefined {
  if (!item.source) return undefined
  const tier = item.source.tier === 'tier1' ? '一手来源' : item.source.tier === 'tier2' ? '研究解读' : '来源'
  return `${tier} · ${item.source.name}`
}
