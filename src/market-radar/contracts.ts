export type MarketRadarMarket = 'crypto' | 'us_equity' | 'macro'
export type MarketRadarPriority = 'P0' | 'P1' | 'P2'
export type MarketRadarReactionStatus = 'pending' | 'confirmed' | 'priced_in' | 'ignored' | 'contradicted'
export type MarketRadarHealth = 'healthy' | 'degraded' | 'unconfigured'

export interface MarketRadarSourceStatus {
  source: string
  health: MarketRadarHealth
  lastSuccessAt: string | null
  message?: string
}

export interface MarketRadarSummary {
  status: MarketRadarHealth
  generatedAt: string
  latestEventAt: string | null
  freshnessMinutes: number | null
  isDelayed: boolean
  eventCount24h: number
  p0Count24h: number
  p1Count24h: number
  sources: MarketRadarSourceStatus[]
  message?: string
}

export interface MarketRadarAsset {
  namespace: 'crypto' | 'us_equity' | 'macro'
  symbol: string
  relevance: number
}

export interface MarketRadarReaction {
  status: MarketRadarReactionStatus
  benchmark: string | null
  return5m: number | null
  return30m: number | null
  return4h: number | null
  excess5m: number | null
  excess30m: number | null
  excess4h: number | null
}

export interface MarketRadarEvent {
  id: string
  slug: string
  market: MarketRadarMarket
  priority: MarketRadarPriority
  score: number
  titleZh: string
  summaryZh: string
  whyItMattersZh: string
  eventType: string
  newsDirection: 'bullish' | 'bearish' | 'mixed' | 'neutral'
  systemJudgment: string
  horizon: 'intraday' | 'days' | 'weeks'
  occurredAt: string
  publishedAt: string
  sourceCount: number
  sources: Array<{ name: string; url: string }>
  assets: MarketRadarAsset[]
  reaction: MarketRadarReaction | null
}

export interface MarketRadarEventList {
  status: MarketRadarHealth
  items: MarketRadarEvent[]
  nextCursor: string | null
  message?: string
}

export function parseEventCursor(value: string | undefined): { publishedAt: string; id: string } | null {
  if (!value) return null
  const separator = value.indexOf('|')
  if (separator < 1) return null
  const publishedAt = value.slice(0, separator)
  const id = value.slice(separator + 1)
  if (!id || id.length > 160 || Number.isNaN(Date.parse(publishedAt))) return null
  return { publishedAt: new Date(publishedAt).toISOString(), id }
}

export interface MarketRadarDigest {
  id: string
  kind: 'daily' | 'us_premarket' | 'p1_batch' | 'trial_report'
  title: string
  bodyZh: string
  periodStart: string
  periodEnd: string
  publishedAt: string
}

export interface MarketRadarDigestList {
  status: MarketRadarHealth
  items: MarketRadarDigest[]
  message?: string
}
