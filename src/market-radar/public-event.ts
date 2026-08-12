import type {
  MarketRadarAsset,
  MarketRadarEvent,
  MarketRadarReport,
  MarketRadarReaction,
} from './contracts.js'

export type PublicEventRow = Record<string, unknown>

export function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text ? text : null
}

function requiredText(value: unknown): string {
  return textOrNull(value) ?? ''
}

function isoOrEpoch(value: unknown): string {
  if (value === null || value === undefined || value === '') return new Date(0).toISOString()
  const date = value instanceof Date ? value : new Date(typeof value === 'string' || typeof value === 'number' ? value : '')
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString()
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseJson(value: unknown): unknown {
  if (value && typeof value === 'object') return value
  if (typeof value !== 'string') return null
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

function objectRows(value: unknown): PublicEventRow[] {
  const parsed = parseJson(value)
  return Array.isArray(parsed)
    ? parsed.filter((item): item is PublicEventRow => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : []
}

function mapSources(value: unknown): MarketRadarEvent['sources'] {
  return objectRows(value).flatMap((source) => {
    const name = textOrNull(source.name)
    const url = textOrNull(source.url)
    return name && url ? [{ name, url }] : []
  })
}

function mapAssets(value: unknown): MarketRadarAsset[] {
  return objectRows(value).flatMap((asset) => {
    const namespace = textOrNull(asset.namespace)
    const symbol = textOrNull(asset.symbol)
    const relevance = numberOrNull(asset.relevance)
    if (!symbol || relevance === null || !['crypto', 'us_equity', 'macro'].includes(namespace ?? '')) return []
    return [{ namespace: namespace as MarketRadarAsset['namespace'], symbol, relevance }]
  })
}

function mapReaction(value: unknown): MarketRadarReaction | null {
  const parsed = parseJson(value)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const reaction = parsed as PublicEventRow
  const status = textOrNull(reaction.status)
  if (!status || !['pending', 'confirmed', 'priced_in', 'ignored', 'contradicted'].includes(status)) return null
  return {
    status: status as MarketRadarReaction['status'],
    benchmark: textOrNull(reaction.benchmark),
    return5m: numberOrNull(reaction.return5m),
    return30m: numberOrNull(reaction.return30m),
    return4h: numberOrNull(reaction.return4h),
    excess5m: numberOrNull(reaction.excess5m),
    excess30m: numberOrNull(reaction.excess30m),
    excess4h: numberOrNull(reaction.excess4h),
  }
}

export function mapPublicEventRow(row: PublicEventRow): MarketRadarEvent {
  return {
    id: requiredText(row.id),
    slug: requiredText(row.slug),
    market: requiredText(row.market) as MarketRadarEvent['market'],
    priority: requiredText(row.priority) as MarketRadarEvent['priority'],
    titleZh: requiredText(row.title_zh),
    summaryZh: requiredText(row.summary_zh),
    whyItMattersZh: requiredText(row.why_it_matters_zh),
    watchFor: textOrNull(row.watch_for),
    invalidation: textOrNull(row.invalidation),
    eventType: requiredText(row.event_type),
    newsDirection: requiredText(row.news_direction) as MarketRadarEvent['newsDirection'],
    systemJudgment: requiredText(row.system_judgment),
    horizon: requiredText(row.horizon) as MarketRadarEvent['horizon'],
    occurredAt: isoOrEpoch(row.occurred_at),
    publishedAt: isoOrEpoch(row.published_at),
    sourceCount: numberOrNull(row.source_count) ?? 0,
    sources: mapSources(row.sources),
    assets: mapAssets(row.assets),
    reaction: mapReaction(row.reaction),
    snapshotId: requiredText(row.snapshot_id),
    snapshotAsOf: isoOrEpoch(row.snapshot_as_of),
  }
}

export function mapPublicEventReportRow(row: PublicEventRow): MarketRadarReport | null {
  const id = textOrNull(row.id)
  const sourceName = textOrNull(row.source_name)
  const sourceUrl = textOrNull(row.source_url)
  const title = textOrNull(row.title)
  if (!id || !sourceName || !sourceUrl) return null
  return {
    id,
    sourceName,
    sourceUrl,
    title,
    excerpt: textOrNull(row.excerpt),
    publishedAt: row.published_at ? isoOrEpoch(row.published_at) : null,
    isPrimary: row.is_primary === true,
  }
}
