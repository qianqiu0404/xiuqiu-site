import type { DailyRadar, RadarItem } from '../data/generatedRadars'
import { parseLearningRadarCursor } from './contracts.ts'
import type {
  LearningRadarCategory,
  LearningRadarImportance,
  LearningRadarStory,
  LearningRadarSummary,
  LearningRadarTimelineItem,
  LearningRadarTimelineList,
} from './contracts'

export interface TimelineCardViewModel {
  id: string
  slug: string
  title: string
  summary: string
  whySelected: string
  category: LearningRadarCategory
  categoryLabel: string
  importance: LearningRadarImportance
  importanceLabel: string
  occurredAt: string
  occurredLabel: string
  publishedAt: string
  sourceCount: number
  sourceName: string
  sourceUrl: string | null
  detailHref: string
  isStaticSnapshot: boolean
}

export interface TimelineDateGroup {
  date: string
  label: string
  items: TimelineCardViewModel[]
}

export const learningCategoryOptions: Array<{ value: 'all' | LearningRadarCategory; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'ai', label: 'AI 工程' },
  { value: 'web3_wallet', label: 'Web3 钱包' },
  { value: 'engineering_tools', label: '工程工具' },
  { value: 'reading', label: '研究阅读' },
]

const categoryLabels: Record<LearningRadarCategory, string> = {
  ai: 'AI 工程',
  web3_wallet: 'Web3 钱包',
  engineering_tools: '工程工具',
  reading: '研究阅读',
}
const importanceLabels: Record<LearningRadarImportance, string> = {
  key: '重点情报',
  noteworthy: '值得关注',
  watch: '持续观察',
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value)
  if (!match) return false
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone, , offsetHourText, offsetMinuteText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)
  const offsetHour = Number(offsetHourText || 0)
  const offsetMinute = Number(offsetMinuteText || 0)
  const daysInMonth = month >= 1 && month <= 12 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 0
  return year >= 2000 && year <= 2100 && day >= 1 && day <= daysInMonth
    && hour <= 23 && minute <= 59 && second <= 59
    && (zone === 'Z' || (offsetHour <= 14 && offsetMinute <= 59 && (offsetHour < 14 || offsetMinute === 0)))
    && Number.isFinite(Date.parse(value))
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function isHttpUrl(value: unknown): value is string {
  if (!isText(value)) return false
  try {
    const url = new URL(value)
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) return false
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
    if (!hostname || (!hostname.includes('.') && !hostname.includes(':'))
      || hostname === 'localhost' || hostname.endsWith('.localhost')
      || hostname === 'metadata' || hostname === 'metadata.google.internal'
      || hostname.endsWith('.internal') || hostname.endsWith('.local')
      || hostname.endsWith('.localdomain') || hostname.endsWith('.home') || hostname.endsWith('.lan')
      || hostname.endsWith('.svc') || hostname.endsWith('.onion')
      || hostname.endsWith('.test') || hostname.endsWith('.invalid') || hostname.endsWith('.example')
      || /^(?:.+\.)?example\.(?:com|net|org)$/.test(hostname)) return false
    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname)
    if (ipv4) {
      const octets = ipv4.slice(1).map(Number)
      if (octets.some(octet => octet > 255)) return false
      const [a, b, c] = octets
      if (a === 0 || a === 10 || a === 127 || a >= 224
        || (a === 100 && b >= 64 && b <= 127)
        || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99)))
        || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
        || (a === 203 && b === 0 && c === 113)) return false
    }
    if (hostname.includes(':')) {
      const compact = hostname.replace(/^0+(?=[0-9a-f])/i, '')
      if (compact === '::' || compact === '::1' || compact.startsWith('fc') || compact.startsWith('fd')
        || /^fe[89ab]/i.test(compact) || compact.startsWith('fec') || compact.startsWith('fed')
        || compact.startsWith('fee') || compact.startsWith('fef') || compact.startsWith('ff')
        || compact.startsWith('2001:db8:') || compact.startsWith('::ffff:')) return false
    }
    return true
  } catch {
    return false
  }
}

function hasValidMessage(value: object): boolean {
  if (!Object.hasOwn(value, 'message')) return true
  const message = (value as { message?: unknown }).message
  return message === null || typeof message === 'string'
}

export function isLearningTimelineItem(value: unknown): value is LearningRadarTimelineItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<LearningRadarTimelineItem>
  const primary = item.primarySource
  return isText(item.id) && isText(item.slug)
    && isText(item.titleZh) && isText(item.summaryZh) && isText(item.whySelectedZh)
    && Object.hasOwn(categoryLabels, String(item.category))
    && Object.hasOwn(importanceLabels, String(item.importance))
    && isDate(item.occurredAt) && isDate(item.publishedAt)
    && Number.isInteger(item.sourceCount) && item.sourceCount >= 1
    && Boolean(primary && isText(primary.name)
      && isHttpUrl(primary.url) && isDate(primary.publishedAt))
}

export function parseLearningTimelineList(value: unknown): LearningRadarTimelineList | null {
  if (!value || typeof value !== 'object') return null
  const payload = value as Partial<LearningRadarTimelineList>
  const cursorSeparator = typeof payload.nextCursor === 'string' ? payload.nextCursor.indexOf('|') : -1
  const ids = Array.isArray(payload.items) ? payload.items.map(item => item?.id) : []
  if (!['healthy', 'degraded', 'unconfigured'].includes(String(payload.status)) || !hasValidMessage(payload)
    || !Array.isArray(payload.items) || !payload.items.every(isLearningTimelineItem)
    || new Set(ids).size !== ids.length
    || (payload.nextCursor !== null && (!isText(payload.nextCursor)
      || cursorSeparator < 1 || !isDate(payload.nextCursor.slice(0, cursorSeparator))
      || !parseLearningRadarCursor(payload.nextCursor)))) return null
  return payload as LearningRadarTimelineList
}

export function parseLearningSummary(value: unknown): LearningRadarSummary | null {
  if (!value || typeof value !== 'object') return null
  const summary = value as Partial<LearningRadarSummary>
  if (!['healthy', 'degraded', 'unconfigured'].includes(String(summary.status)) || !hasValidMessage(summary)
    || !isDate(summary.generatedAt)
    || (summary.latestStoryAt !== null && !isDate(summary.latestStoryAt))
    || (summary.freshnessMinutes !== null && (!Number.isInteger(summary.freshnessMinutes) || summary.freshnessMinutes < 0))
    || typeof summary.isDelayed !== 'boolean'
    || !Number.isInteger(summary.todayCount) || summary.todayCount < 0
    || !Number.isInteger(summary.keyCount) || summary.keyCount < 0
    || !Number.isInteger(summary.noteworthyCount) || summary.noteworthyCount < 0
    || !Array.isArray(summary.sources) || !summary.sources.every(source => source && hasValidMessage(source) && isText(source.source)
      && ['healthy', 'degraded', 'unconfigured'].includes(source.health)
      && (source.lastSuccessAt === null || isDate(source.lastSuccessAt)))) return null
  return summary as LearningRadarSummary
}

export function parseLearningStory(value: unknown): LearningRadarStory | null {
  if (!isLearningTimelineItem(value)) return null
  const story = value as Partial<LearningRadarStory>
  if (!Array.isArray(story.reports) || !story.reports.every(report => report && isText(report.id)
    && isText(report.sourceName) && isHttpUrl(report.sourceUrl) && isText(report.title)
    && (report.excerpt === null || typeof report.excerpt === 'string') && isDate(report.publishedAt)
    && typeof report.isPrimary === 'boolean')
    || !Array.isArray(story.updates) || !story.updates.every(update => update && isText(update.id)
      && isText(update.titleZh) && isText(update.bodyZh) && isDate(update.occurredAt))) return null
  return story as LearningRadarStory
}

function formatOccurredAt(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
}

export function toTimelineCardViewModel(item: LearningRadarTimelineItem): TimelineCardViewModel {
  return {
    id: item.id,
    slug: item.slug,
    title: item.titleZh,
    summary: item.summaryZh,
    whySelected: item.whySelectedZh,
    category: item.category,
    categoryLabel: categoryLabels[item.category],
    importance: item.importance,
    importanceLabel: importanceLabels[item.importance],
    occurredAt: item.occurredAt,
    occurredLabel: formatOccurredAt(item.occurredAt),
    publishedAt: item.publishedAt,
    sourceCount: item.sourceCount,
    sourceName: item.primarySource?.name || '公开来源',
    sourceUrl: item.primarySource?.url || null,
    detailHref: `/radar/stories/${encodeURIComponent(item.slug)}`,
    isStaticSnapshot: false,
  }
}

function staticItem(
  radar: DailyRadar,
  item: RadarItem,
  category: LearningRadarCategory,
  index: number,
): TimelineCardViewModel {
  const occurredAt = `${radar.date}T04:00:00+08:00`
  return {
    id: `static-${radar.slug}-${category}-${index}`,
    slug: radar.slug,
    title: item.title,
    summary: item.summary,
    whySelected: '静态日报未保存独立入选理由；此条因通过当日公开内容门禁而保留。',
    category,
    categoryLabel: categoryLabels[category],
    importance: 'watch',
    importanceLabel: '静态快照',
    occurredAt,
    occurredLabel: formatOccurredAt(occurredAt),
    publishedAt: radar.generatedAt,
    sourceCount: item.sourceUrl ? 1 : 0,
    sourceName: item.sourceUrl ? new URL(item.sourceUrl).hostname : '已提交静态日报',
    sourceUrl: item.sourceUrl || null,
    detailHref: `/radar/${radar.slug}`,
    isStaticSnapshot: true,
  }
}

export function buildStaticTimeline(radars: DailyRadar[]): TimelineCardViewModel[] {
  return radars.flatMap((radar) => {
    const cards: TimelineCardViewModel[] = []
    if (radar.aiTip) cards.push(staticItem(radar, radar.aiTip, 'ai', 0))
    if (radar.web3Design) cards.push(staticItem(radar, radar.web3Design, 'web3_wallet', 10))
    if (radar.vibeProject) cards.push(staticItem(radar, radar.vibeProject, 'engineering_tools', 0))
    if (radar.readingPick) cards.push(staticItem(radar, radar.readingPick, 'reading', 0))
    return cards
  }).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
}

export function rankFeaturedTimeline(items: TimelineCardViewModel[]): TimelineCardViewModel[] {
  if (items.every(item => item.isStaticSnapshot)) {
    return [...items].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, 3)
  }
  const weight: Record<LearningRadarImportance, number> = { key: 3, noteworthy: 2, watch: 1 }
  return [...items].sort((a, b) => weight[b.importance] - weight[a.importance]
    || Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).slice(0, 3)
}

export function partitionTimelineByOccurrence(items: TimelineCardViewModel[], now = new Date()) {
  const nowMs = now.getTime()
  return {
    future: items.filter(item => Date.parse(item.occurredAt) > nowMs)
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt)),
    historical: items.filter(item => Date.parse(item.occurredAt) <= nowMs)
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)),
  }
}

function shanghaiDay(value: Date): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function groupHistoricalTimeline(items: TimelineCardViewModel[]): TimelineDateGroup[] {
  const groups = new Map<string, TimelineCardViewModel[]>()
  for (const item of [...items].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))) {
    const date = shanghaiDay(new Date(item.occurredAt))
    const group = groups.get(date)
    if (group) group.push(item)
    else groups.set(date, [item])
  }
  return [...groups].map(([date, groupItems]) => ({
    date,
    label: new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
    }).format(new Date(groupItems[0].occurredAt)),
    items: groupItems,
  }))
}

export function countOccurredToday(items: TimelineCardViewModel[], now = new Date()): number {
  const nowMs = now.getTime()
  const today = shanghaiDay(now)
  return items.filter(item => Date.parse(item.occurredAt) <= nowMs
    && shanghaiDay(new Date(item.occurredAt)) === today).length
}
