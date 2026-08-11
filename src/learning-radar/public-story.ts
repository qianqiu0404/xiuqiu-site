import type {
  LearningRadarPrimarySource,
  LearningRadarReport,
  LearningRadarStoryUpdate,
  LearningRadarTimelineItem,
} from './contracts.js'

export type PublicLearningRadarRow = Record<string, unknown>

function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text ? text : null
}

function requiredText(value: unknown): string {
  return textOrNull(value) ?? ''
}

function isoOrEpoch(value: unknown): string {
  if (value === null || value === undefined || value === '') return new Date(0).toISOString()
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString()
}

function isoOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date
    ? value
    : typeof value === 'string' || typeof value === 'number'
      ? new Date(value)
      : null
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null
}

function parseObject(value: unknown): PublicLearningRadarRow | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as PublicLearningRadarRow
  if (typeof value !== 'string') return null
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as PublicLearningRadarRow
      : null
  } catch {
    return null
  }
}

function mapPrimarySource(value: unknown): LearningRadarPrimarySource | null {
  const source = parseObject(value)
  if (!source) return null
  const name = textOrNull(source.name)
  const url = textOrNull(source.url)
  const publishedAt = textOrNull(source.publishedAt)
  if (!name || !url || !publishedAt) return null
  return { name, url, publishedAt: isoOrEpoch(publishedAt) }
}

export function mapPublicTimelineItemRow(row: PublicLearningRadarRow): LearningRadarTimelineItem {
  return {
    id: requiredText(row.id),
    slug: requiredText(row.slug),
    category: requiredText(row.category) as LearningRadarTimelineItem['category'],
    importance: requiredText(row.importance) as LearningRadarTimelineItem['importance'],
    titleZh: requiredText(row.title_zh),
    summaryZh: requiredText(row.summary_zh),
    whySelectedZh: requiredText(row.why_selected_zh),
    occurredAt: isoOrEpoch(row.occurred_at),
    publishedAt: isoOrEpoch(row.published_at),
    sourceCount: Number.isFinite(Number(row.source_count)) ? Number(row.source_count) : 0,
    primarySource: mapPrimarySource(row.primary_source),
  }
}

export function mapPublicStoryReportRow(row: PublicLearningRadarRow): LearningRadarReport | null {
  const id = textOrNull(row.id)
  const sourceName = textOrNull(row.source_name)
  const sourceUrl = textOrNull(row.source_url)
  const title = textOrNull(row.title)
  const publishedAt = isoOrNull(row.published_at)
  if (!id || !sourceName || !sourceUrl || !title || !publishedAt) return null
  return {
    id,
    sourceName,
    sourceUrl,
    title,
    excerpt: textOrNull(row.excerpt),
    publishedAt,
    isPrimary: row.is_primary === true,
  }
}

export function mapPublicStoryUpdateRow(row: PublicLearningRadarRow): LearningRadarStoryUpdate | null {
  const id = textOrNull(row.id)
  const titleZh = textOrNull(row.title_zh)
  const bodyZh = textOrNull(row.body_zh)
  const occurredAt = textOrNull(row.occurred_at)
  if (!id || !titleZh || !bodyZh || !occurredAt) return null
  return { id, titleZh, bodyZh, occurredAt: isoOrEpoch(occurredAt) }
}
