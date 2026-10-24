import type { MarketRadarDaily, MarketRadarEvent } from './generatedMarketRadars'

export const marketCategoryOptions = [
  { key: 'all', label: '全部' },
  { key: 'macro', label: '宏观' },
  { key: 'crypto', label: '加密' },
  { key: 'equity', label: '美股' },
  { key: 'regulation', label: '政策' },
]
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
