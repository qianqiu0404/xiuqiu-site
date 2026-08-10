import {
  parseEventCursor,
  type MarketRadarDigest,
  type MarketRadarDigestList,
  type MarketRadarEventDetail,
  type MarketRadarEventList,
  type MarketRadarHealth,
  type MarketRadarSummary,
} from '../../src/market-radar/contracts.js'
import { mapPublicEventReportRow, mapPublicEventRow } from '../../src/market-radar/public-event.js'
import { getMarketRadarDb, isMarketRadarConfigured } from './db.js'

type QueryRow = Record<string, unknown>

const knownSources = ['github_releases', 'sec_edgar', 'federal_reserve', 'binance_market_data', 'qiu_market']

function iso(value: unknown): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function getSummary(): Promise<MarketRadarSummary> {
  const generatedAt = new Date().toISOString()
  if (!isMarketRadarConfigured()) {
    return {
      status: 'unconfigured', generatedAt, latestEventAt: null, freshnessMinutes: null, isDelayed: true,
      eventCount24h: 0, p0Count24h: 0, p1Count24h: 0,
      sources: knownSources.map(source => ({ source, health: 'unconfigured', lastSuccessAt: null })),
      message: '交易雷达数据库尚未配置，当前没有可验证的实时数据。',
    }
  }

  const sql = getMarketRadarDb()
  const [counts, sourceRows] = await Promise.all([
    sql.query(`select max(occurred_at) as latest_event_at,
      count(*) filter (where occurred_at >= now() - interval '24 hours') as event_count_24h,
      count(*) filter (where occurred_at >= now() - interval '24 hours' and priority = 'P0') as p0_count_24h,
      count(*) filter (where occurred_at >= now() - interval '24 hours' and priority = 'P1') as p1_count_24h
      from market_radar.public_events`, []),
    sql.query(`select distinct on (source) source, status, finished_at, error_code
      from market_radar.job_runs order by source, started_at desc`, []),
  ])

  const first = (counts[0] || {}) as QueryRow
  const latestEventAt = iso(first.latest_event_at)
  const sourceByName = new Map((sourceRows as QueryRow[]).map(row => [String(row.source), row]))
  const sources = knownSources.map(source => {
    const row = sourceByName.get(source)
    const health: MarketRadarHealth = !row ? 'degraded' : row.status === 'succeeded' ? 'healthy' : 'degraded'
    return { source, health, lastSuccessAt: row?.status === 'succeeded' ? iso(row.finished_at) : null, message: row?.error_code ? String(row.error_code) : undefined }
  })
  const latestSourceSuccessAt = sources.reduce<string | null>((latest, source) => {
    if (!source.lastSuccessAt) return latest
    return !latest || source.lastSuccessAt > latest ? source.lastSuccessAt : latest
  }, null)
  const freshnessMinutes = latestSourceSuccessAt
    ? Math.max(0, Math.round((Date.now() - new Date(latestSourceSuccessAt).getTime()) / 60_000))
    : null
  const isDelayed = freshnessMinutes === null || freshnessMinutes > 90
  return {
    status: sources.some(source => source.health === 'healthy') ? (isDelayed ? 'degraded' : 'healthy') : 'degraded',
    generatedAt,
    latestEventAt,
    freshnessMinutes,
    isDelayed,
    eventCount24h: Number(first.event_count_24h || 0),
    p0Count24h: Number(first.p0_count_24h || 0),
    p1Count24h: Number(first.p1_count_24h || 0),
    sources,
    message: isDelayed ? '数据超过 90 分钟未更新，请把它视为延迟，而不是没有事件。' : undefined,
  }
}

export interface EventFilters {
  market?: string
  priority?: string
  reaction?: string
  asset?: string
  windowHours: number
  cursor?: string
  limit: number
}

function encodeEventCursor(row: QueryRow | undefined): string | null {
  const occurredAt = iso(row?.occurred_at)
  return occurredAt && row?.id ? `${occurredAt}|${String(row.id)}` : null
}

export async function listEvents(filters: EventFilters): Promise<MarketRadarEventList> {
  if (!isMarketRadarConfigured()) return { status: 'unconfigured', items: [], nextCursor: null, message: '交易雷达数据库尚未配置。' }
  const values: unknown[] = [filters.windowHours]
  const where = [`occurred_at >= now() - ($1::text || ' hours')::interval`]
  const add = (clause: string, value: unknown) => { values.push(value); where.push(clause.replace('?', `$${values.length}`)) }
  if (filters.market) add('market = ?', filters.market)
  if (filters.priority) add('priority = ?', filters.priority)
  if (filters.reaction) add(`coalesce(reaction->>'status', 'pending') = ?`, filters.reaction)
  if (filters.asset) add(`exists (select 1 from jsonb_array_elements(assets) asset where upper(asset->>'symbol') = upper(?))`, filters.asset)
  const cursor = parseEventCursor(filters.cursor)
  if (cursor) {
    values.push(cursor.publishedAt, cursor.id)
    where.push(`(occurred_at, id) < ($${values.length - 1}::timestamptz, $${values.length}::text)`)
  }
  values.push(filters.limit + 1)
  const rows = await getMarketRadarDb().query(
    `select * from market_radar.public_events where ${where.join(' and ')} order by occurred_at desc, id desc limit $${values.length}`,
    values,
  ) as QueryRow[]
  const hasMore = rows.length > filters.limit
  const selected = hasMore ? rows.slice(0, filters.limit) : rows
  return { status: 'healthy', items: selected.map(mapPublicEventRow), nextCursor: hasMore ? encodeEventCursor(selected[selected.length - 1]) : null }
}

export async function getEvent(id: string): Promise<MarketRadarEventDetail | null> {
  if (!isMarketRadarConfigured()) return null
  const rows = await getMarketRadarDb().query(`select * from market_radar.public_events where id = $1 or slug = $1 limit 1`, [id]) as QueryRow[]
  if (!rows[0]) return null
  const reports = await getMarketRadarDb().query(`select * from market_radar.public_event_reports
    where event_id = $1 order by published_at desc nulls last, id desc`, [rows[0].id]) as QueryRow[]
  return {
    ...mapPublicEventRow(rows[0]),
    reports: reports.flatMap(row => {
      const report = mapPublicEventReportRow(row)
      return report ? [report] : []
    }),
  }
}

export async function listDigests(limit: number): Promise<MarketRadarDigestList> {
  if (!isMarketRadarConfigured()) return { status: 'unconfigured', items: [], message: '交易雷达数据库尚未配置。' }
  const rows = await getMarketRadarDb().query(`select id, kind, title, body_zh, period_start, period_end, published_at
    from market_radar.digests where visibility = 'public' order by published_at desc limit $1`, [limit]) as QueryRow[]
  const items: MarketRadarDigest[] = rows.map(row => ({
    id: String(row.id), kind: row.kind as MarketRadarDigest['kind'], title: String(row.title), bodyZh: String(row.body_zh),
    periodStart: iso(row.period_start) || new Date(0).toISOString(), periodEnd: iso(row.period_end) || new Date(0).toISOString(),
    publishedAt: iso(row.published_at) || new Date(0).toISOString(),
  }))
  return { status: 'healthy', items }
}

export async function recordFeedback(input: { eventId: string; value: string; note?: string; idempotencyKey: string; clientHash: string }): Promise<void> {
  await getMarketRadarDb().query(`insert into market_radar.feedback
    (id, event_id, value, note, idempotency_key, client_hash, created_at)
    values ($1, $2, $3, $4, $5, $6, now()) on conflict (idempotency_key) do nothing`,
  [crypto.randomUUID(), input.eventId, input.value, input.note || null, input.idempotencyKey, input.clientHash])
}

export function numberFromRow(row: QueryRow, key: string): number | null {
  return numberOrNull(row[key])
}
