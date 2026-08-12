import {
  parseLearningRadarCursor,
  type LearningRadarDigest,
  type LearningRadarDigestList,
  type LearningRadarHealth,
  type LearningRadarStory,
  type LearningRadarSummary,
  type LearningRadarTimelineList,
} from '../../src/learning-radar/contracts.js'
import {
  mapPublicStoryReportRow,
  mapPublicStoryUpdateRow,
  mapPublicTimelineItemRow,
} from '../../src/learning-radar/public-story.js'
import { getLearningRadarDb, isLearningRadarConfigured } from './db.js'

type QueryRow = Record<string, unknown>

function iso(value: unknown): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export async function getLearningRadarSummary(): Promise<LearningRadarSummary> {
  const generatedAt = new Date().toISOString()
  if (!isLearningRadarConfigured()) {
    return {
      status: 'unconfigured', generatedAt, latestStoryAt: null, freshnessMinutes: null, isDelayed: true,
      todayCount: 0, keyCount: 0, noteworthyCount: 0, sources: [],
      message: '学习雷达数据库尚未配置，当前只应使用已明确标注的静态快照。',
    }
  }

  const sql = getLearningRadarDb()
  const [countRows, sourceRows] = await Promise.all([
    sql.query(`select
      max(published_at) as latest_story_at,
      count(*) filter (where occurred_at >= date_trunc('day', now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai') as today_count,
      count(*) filter (where importance = 'key' and occurred_at >= now() - interval '24 hours') as key_count,
      count(*) filter (where importance = 'noteworthy' and occurred_at >= now() - interval '24 hours') as noteworthy_count
      from learning_radar.public_timeline_items`, []),
    sql.query(`select distinct on (source) source, status, finished_at, error_code
      from learning_radar.job_runs order by source, started_at desc`, []),
  ])
  const counts = (countRows[0] || {}) as QueryRow
  const latestStoryAt = iso(counts.latest_story_at)
  const sources = (sourceRows as QueryRow[]).map((row) => {
    const health: LearningRadarHealth = row.status === 'succeeded' ? 'healthy' : 'degraded'
    return {
      source: String(row.source),
      health,
      lastSuccessAt: health === 'healthy' ? iso(row.finished_at) : null,
      message: row.error_code ? String(row.error_code) : undefined,
    }
  })
  const latestSuccessAt = sources.reduce<string | null>((latest, source) => {
    if (!source.lastSuccessAt) return latest
    return !latest || source.lastSuccessAt > latest ? source.lastSuccessAt : latest
  }, null)
  const freshnessMinutes = latestSuccessAt
    ? Math.max(0, Math.round((Date.now() - new Date(latestSuccessAt).getTime()) / 60_000))
    : null
  const isDelayed = freshnessMinutes === null || freshnessMinutes > 120
  return {
    status: sources.some(source => source.health === 'healthy') ? (isDelayed ? 'degraded' : 'healthy') : 'degraded',
    generatedAt,
    latestStoryAt,
    freshnessMinutes,
    isDelayed,
    todayCount: Number(counts.today_count || 0),
    keyCount: Number(counts.key_count || 0),
    noteworthyCount: Number(counts.noteworthy_count || 0),
    sources,
    message: isDelayed ? '学习雷达超过两小时未成功更新，请把当前内容视为延迟数据。' : undefined,
  }
}

export interface LearningRadarFilters {
  category?: string
  windowHours: number
  cursor?: string
  limit: number
}

function encodeCursor(row: QueryRow | undefined): string | null {
  const occurredAt = iso(row?.occurred_at)
  return occurredAt && row?.id ? `${occurredAt}|${String(row.id)}` : null
}

export async function listLearningRadarItems(filters: LearningRadarFilters): Promise<LearningRadarTimelineList> {
  if (!isLearningRadarConfigured()) {
    return { status: 'unconfigured', items: [], nextCursor: null, message: '学习雷达数据库尚未配置。' }
  }
  const values: unknown[] = [filters.windowHours]
  const where = [`occurred_at >= now() - ($1::text || ' hours')::interval`]
  if (filters.category) {
    values.push(filters.category)
    where.push(`category = $${values.length}`)
  }
  const cursor = parseLearningRadarCursor(filters.cursor)
  if (cursor) {
    values.push(cursor.occurredAt, cursor.id)
    where.push(`(occurred_at, id) < ($${values.length - 1}::timestamptz, $${values.length}::text)`)
  }
  values.push(filters.limit + 1)
  const rows = await getLearningRadarDb().query(
    `select * from learning_radar.public_timeline_items where ${where.join(' and ')}
      order by occurred_at desc, id desc limit $${values.length}`,
    values,
  ) as QueryRow[]
  const hasMore = rows.length > filters.limit
  const selected = hasMore ? rows.slice(0, filters.limit) : rows
  return {
    status: 'healthy',
    items: selected.map(mapPublicTimelineItemRow),
    nextCursor: hasMore ? encodeCursor(selected[selected.length - 1]) : null,
  }
}

export async function getLearningRadarStory(id: string): Promise<LearningRadarStory | null> {
  if (!isLearningRadarConfigured()) return null
  const sql = getLearningRadarDb()
  const rows = await sql.query(`select * from learning_radar.public_timeline_items
    where id = $1 or slug = $1 limit 1`, [id]) as QueryRow[]
  if (!rows[0]) return null
  const [reportRows, updateRows] = await Promise.all([
    sql.query(`select * from learning_radar.public_story_reports
      where story_id = $1 order by published_at desc, id desc`, [rows[0].id]),
    sql.query(`select * from learning_radar.public_story_updates
      where story_id = $1 order by occurred_at desc, id desc`, [rows[0].id]),
  ])
  return {
    ...mapPublicTimelineItemRow(rows[0]),
    reports: (reportRows as QueryRow[]).flatMap((row) => {
      const report = mapPublicStoryReportRow(row)
      return report ? [report] : []
    }),
    updates: (updateRows as QueryRow[]).flatMap((row) => {
      const update = mapPublicStoryUpdateRow(row)
      return update ? [update] : []
    }),
  }
}

export async function listLearningRadarDigests(limit: number): Promise<LearningRadarDigestList> {
  if (!isLearningRadarConfigured()) {
    return { status: 'unconfigured', items: [], message: '学习雷达数据库尚未配置。' }
  }
  const rows = await getLearningRadarDb().query(`select * from learning_radar.public_digests
    order by published_at desc limit $1`, [limit]) as QueryRow[]
  const items: LearningRadarDigest[] = rows.map(row => ({
    id: String(row.id),
    kind: row.kind as LearningRadarDigest['kind'],
    title: String(row.title),
    bodyZh: String(row.body_zh),
    periodStart: iso(row.period_start) || new Date(0).toISOString(),
    periodEnd: iso(row.period_end) || new Date(0).toISOString(),
    publishedAt: iso(row.published_at) || new Date(0).toISOString(),
  }))
  return { status: 'healthy', items }
}
