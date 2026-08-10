import type { MarketRadarDaily, MarketRadarEvent } from './generatedMarketRadars'

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
