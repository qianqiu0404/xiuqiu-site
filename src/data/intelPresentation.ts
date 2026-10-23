import type { ReadingDomain as IntelDomain, ReadingItem as IntelItem, ReadingTopic as IntelTopic } from './readingFeed.ts'
import { radarTopicLabel } from './radarPresentation.ts'
import { getSnapshotFreshness } from './snapshotFreshness.ts'
import { researchCardLabel, researchTopicLabel } from './sharedResearchPresentation.ts'
import { sourceDisplayLabel } from './sourcePresentation.ts'

// Home page SEO; index.html carries the same values for the static document.
export const intelHomeSeo = {
  title: 'xiuqiu｜AI 与 Web3 工程情报流',
  description: '每天 2 条 AI、2 条 Web3 工程简报和市场事件，按主题筛选、搜索与订阅；每条都回到一手来源。',
} as const

export type IntelFilter = 'all' | 'ai' | 'web3' | 'market' | 'research' | 'grok'

export const intelFilters: { key: IntelFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'ai', label: 'AI' },
  { key: 'web3', label: 'Web3' },
  { key: 'market', label: '市场' },
  { key: 'research', label: '共享研究' },
  { key: 'grok', label: 'Grok Bot' },
]

const marketTopicLabels: Record<string, string> = {
  market_macro: '宏观',
  market_crypto: '加密市场',
  market_equity: '股票',
  market_regulation: '监管',
  trend_review: '趋势回顾',
}

const domainLabels: Record<IntelDomain, string> = { ai: 'AI', web3: 'WEB3', market: '市场', review: '回顾', research: '资料' }

export function intelTopicLabel(topic: string): string {
  const grokTopics: Record<string, string> = { 'grok-ai': 'AI 新闻', 'grok-web3': 'Web3 新闻', 'grok-market': '市场新闻', 'grok-research': '其他新闻资料' }
  if (grokTopics[topic]) return grokTopics[topic]
  return researchTopicLabel(topic) || marketTopicLabels[topic] || radarTopicLabel(topic)
}

export function intelDomainLabel(domain: IntelDomain): string {
  return domainLabels[domain]
}

export function intelTopicHref(topic: string): string {
  return topic.startsWith('grok-') ? `/?domain=grok&topic=${encodeURIComponent(topic)}` : `/topics/${encodeURIComponent(topic)}`
}

// Reviews summarise every domain, so they stay visible under any domain filter.
export function filterIntel(items: readonly IntelItem[], query: { filter: IntelFilter; topic?: string; search?: string }): IntelItem[] {
  const needle = query.search?.trim().toLowerCase()
  return items.filter(item =>
    (query.filter === 'all' || (query.filter === 'research' || query.filter === 'grok' ? item.kind === query.filter : item.domain === query.filter || item.kind === 'review'))
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
  return topics.filter(topic => filter === 'all' || (filter === 'research' || filter === 'grok' ? topic.topic.startsWith(`${filter}-`) : topic.domain === filter))
}

export function intelSourceLabel(item: IntelItem): string | undefined {
  if (item.kind === 'grok' && item.research) {
    const material = item.research.materials[0]
    return `Grok Bot 搜索整理 · ${researchCardLabel(item.research)}${material?.source_url ? ` · ${sourceDisplayLabel(material.source_url, material.title)}` : ''}`
  }
  if (item.research) return researchCardLabel(item.research)
  if (!item.source) return undefined
  const tier = item.source.tier === 'tier1' ? '一手来源' : item.source.tier === 'tier2' ? '研究解读' : '来源'
  return `${tier} · ${sourceDisplayLabel(item.source.url, item.source.name)}`
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

// "10月15日 周四" for a YYYY-MM-DD calendar date (no timezone shift).
export function intelDayLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return date
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return `${month}月${day}日 ${weekday}`
}

// Today's date in Asia/Shanghai, used for the masthead dateline.
export function shanghaiToday(now = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(now)
      .map(part => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

const KIND_LABELS: Record<IntelItem['kind'], string> = { learning: '学习雷达', market: '市场雷达', review: '趋势回顾', research: '共享研究', grok: 'Grok Bot' }

export function intelKindLabel(kind: IntelItem['kind']): string {
  return KIND_LABELS[kind]
}
