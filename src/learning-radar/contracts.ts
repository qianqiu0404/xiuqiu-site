export type LearningRadarCategory = 'ai' | 'web3_wallet' | 'engineering_tools' | 'reading'
export type LearningRadarImportance = 'key' | 'noteworthy' | 'watch'
export type LearningRadarHealth = 'healthy' | 'degraded' | 'unconfigured'

export interface LearningRadarSourceStatus {
  source: string
  health: LearningRadarHealth
  lastSuccessAt: string | null
  message?: string
}

export interface LearningRadarPrimarySource {
  name: string
  url: string
  publishedAt: string
}

export interface LearningRadarTimelineItem {
  id: string
  slug: string
  category: LearningRadarCategory
  importance: LearningRadarImportance
  titleZh: string
  summaryZh: string
  whySelectedZh: string
  occurredAt: string
  publishedAt: string
  sourceCount: number
  primarySource: LearningRadarPrimarySource | null
}

export interface LearningRadarReport {
  id: string
  sourceName: string
  sourceUrl: string
  title: string
  excerpt: string | null
  publishedAt: string
  isPrimary: boolean
}

export interface LearningRadarStoryUpdate {
  id: string
  titleZh: string
  bodyZh: string
  occurredAt: string
}

export interface LearningRadarStory extends LearningRadarTimelineItem {
  reports: LearningRadarReport[]
  updates: LearningRadarStoryUpdate[]
}

export interface LearningRadarSummary {
  status: LearningRadarHealth
  generatedAt: string
  latestStoryAt: string | null
  freshnessMinutes: number | null
  isDelayed: boolean
  todayCount: number
  keyCount: number
  noteworthyCount: number
  sources: LearningRadarSourceStatus[]
  message?: string
}

export interface LearningRadarTimelineList {
  status: LearningRadarHealth
  items: LearningRadarTimelineItem[]
  nextCursor: string | null
  message?: string
}

export interface LearningRadarDigest {
  id: string
  kind: 'daily' | 'weekly'
  title: string
  bodyZh: string
  periodStart: string
  periodEnd: string
  publishedAt: string
}

export interface LearningRadarDigestList {
  status: LearningRadarHealth
  items: LearningRadarDigest[]
  message?: string
}

export function parseLearningRadarCursor(value: string | undefined): { occurredAt: string; id: string } | null {
  if (!value) return null
  const separator = value.indexOf('|')
  if (separator < 1) return null
  const occurredAt = value.slice(0, separator)
  const id = value.slice(separator + 1)
  if (!id || id.length > 160 || Number.isNaN(Date.parse(occurredAt))) return null
  return { occurredAt: new Date(occurredAt).toISOString(), id }
}
