import type { MarketRadarDaily, MarketRadarEvent } from './generatedMarketRadars'

export const marketCategoryOptions = [
  { key: 'all', label: '全部' },
  { key: 'macro', label: '宏观' },
  { key: 'crypto', label: '加密' },
  { key: 'equity', label: '美股' },
  { key: 'regulation', label: '政策' },
]
export interface MarketQuery {
  category: string
  query: string
}

export function readMarketQuery(query: Record<string, unknown>): MarketQuery {
  return {
    category: marketCategoryOptions.some(option => option.key === query.category) ? query.category as string : 'all',
    query: typeof query.q === 'string' ? query.q : '',
  }
}

export function marketQueryParams(query: MarketQuery): Record<string, string> {
  const normalized = readMarketQuery({ category: query.category, q: query.query })
  return {
    ...(normalized.category !== 'all' ? { category: normalized.category } : {}),
    ...(normalized.query.trim() ? { q: normalized.query } : {}),
  }
}

export function marketQueueHash(hash: unknown): string {
  return typeof hash === 'string' && /^#queue-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(hash) ? hash : ''
}

export function marketListHref(query: MarketQuery, hash?: unknown): string {
  const params = new URLSearchParams(marketQueryParams(query)).toString()
  return `/market-radar${params ? `?${params}` : ''}${marketQueueHash(hash)}`
}

export const marketStatusLabels = { scheduled: '已排期', released: '已发布', monitoring: '观察中' }
export const marketPriorityLabels = { P0: '关键', P1: '重要', P2: '跟踪' }

export function marketCategoryLabel(category: string) {
  return marketCategoryOptions.find(option => option.key === category)?.label ?? category
}

export function filterMarketEvents(events: readonly MarketRadarEvent[], { category = 'all', query = '' } = {}) {
  const keyword = query.trim().toLocaleLowerCase()
  return events.filter(event => (category === 'all' || event.category === category)
    && (!keyword || [event.title, event.fact, event.sourceName, ...event.assets].join(' ').toLocaleLowerCase().includes(keyword)))
}

export function formatMarketTime(value?: string) {
  if (!value) return '持续观察'
  const date = new Date(value)
  if (!Number.isFinite(date.valueOf())) return '时间待核对'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
}

export function marketSnapshotSummary(snapshot?: MarketRadarDaily) {
  const events = snapshot?.events ?? []
  return {
    eventCount: events.length,
    highPriorityCount: events.filter(event => event.priority === 'P0' || event.priority === 'P1').length,
    assetCount: new Set(events.flatMap(event => event.assets)).size,
  }
}

export interface StaticMarketRadarEventMatch {
  snapshotDate: string
  snapshotSlug: string
  generatedAt: string
  event: MarketRadarEvent
}

export function findStaticMarketRadarEvent(
  entries: readonly MarketRadarDaily[],
  eventId: string,
): StaticMarketRadarEventMatch | undefined {
  for (const entry of entries) {
    const event = entry.events.find(candidate => candidate.id === eventId)
    if (event) {
      return {
        snapshotDate: entry.date,
        snapshotSlug: entry.slug,
        generatedAt: entry.generatedAt,
        event,
      }
    }
  }
  return undefined
}
