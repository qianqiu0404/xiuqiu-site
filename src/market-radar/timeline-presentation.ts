import type { MarketRadarDaily, MarketRadarEvent as StaticMarketEvent } from '../data/generatedMarketRadars'
import { parseEventCursor } from './contracts.ts'
import type {
  MarketRadarEvent,
  MarketRadarEventDetail,
  MarketRadarEventList,
  MarketRadarSummary,
} from './contracts'

export interface TradeTimelineCardViewModel {
  origin: 'api' | 'static'
  id: string
  title: string
  priority: MarketRadarEvent['priority']
  categoryLabel: string
  statusLabel: string
  occurredAt: string
  publishedAt: string
  summary: string
  whyItMatters: string
  watchFor: string
  invalidation: string
  assets: string[]
  sourceCount: number
  sourceName: string
  sourceUrl: string | null
  detailHref: string
  snapshotSlug?: string
}

export interface TradeTimelineDateGroup {
  date: string
  label: string
  items: TradeTimelineCardViewModel[]
}

export interface TradeTimelinePaginationState {
  cards: TradeTimelineCardViewModel[]
  nextCursor: string | null
  requestedCursors: string[]
  stopped: boolean
}

const marketLabels = { crypto: '加密', us_equity: '美股', macro: '宏观' } as const
const staticCategoryLabels = { macro: '宏观', crypto: '加密', equity: '美股', regulation: '政策' } as const
const priorityValues = new Set(['P0', 'P1', 'P2'])
const marketValues = new Set(['crypto', 'us_equity', 'macro'])
const directionValues = new Set(['bullish', 'bearish', 'mixed', 'neutral'])
const horizonValues = new Set(['intraday', 'days', 'weeks'])
const healthValues = new Set(['healthy', 'degraded', 'unconfigured'])
const reactionValues = new Set(['pending', 'confirmed', 'priced_in', 'ignored', 'contradicted'])

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

export function isStrictMarketIso(value: unknown): value is string {
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

export function isSafePublicMarketUrl(value: unknown): value is string {
  if (!isText(value)) return false
  try {
    const url = new URL(value)
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) return false
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
    if (!hostname || (!hostname.includes('.') && !hostname.includes(':'))
      || hostname === 'localhost' || hostname.endsWith('.localhost')
      || hostname === 'metadata' || hostname === 'metadata.google.internal'
      || hostname.endsWith('.internal') || hostname.endsWith('.local') || hostname.endsWith('.localdomain')
      || hostname.endsWith('.home') || hostname.endsWith('.lan') || hostname.endsWith('.svc')
      || hostname.endsWith('.onion') || hostname.endsWith('.test') || hostname.endsWith('.invalid')
      || hostname.endsWith('.example') || /^(?:.+\.)?example\.(?:com|net|org)$/.test(hostname)) return false
    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname)
    if (ipv4) {
      const octets = ipv4.slice(1).map(Number)
      if (octets.some(octet => octet > 255)) return false
      const [a, b, c] = octets
      if (a === 0 || a === 10 || a === 127 || a >= 224
        || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99)))
        || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
        || (a === 203 && b === 0 && c === 113)) return false
    }
    if (hostname.includes(':')) {
      const compact = hostname.replace(/^0+(?=[0-9a-f])/i, '')
      if (compact === '::' || compact === '::1' || compact.startsWith('fc') || compact.startsWith('fd')
        || /^fe[89ab]/i.test(compact) || /^fe[c-f]/i.test(compact) || compact.startsWith('ff')
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

function isNullableText(value: unknown): boolean {
  return value === null || value === undefined || isText(value)
}

function isNullableNumber(value: unknown): boolean {
  return value === null || typeof value === 'number' && Number.isFinite(value)
}

function isMarketEvent(value: unknown, allowReports: boolean): value is MarketRadarEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const event = value as Partial<MarketRadarEventDetail>
  if (!allowReports && Object.hasOwn(event, 'reports')) return false
  if (!isText(event.id) || !isText(event.slug) || !marketValues.has(String(event.market))
    || !priorityValues.has(String(event.priority)) || !isText(event.titleZh) || !isText(event.summaryZh)
    || !isText(event.whyItMattersZh) || !isNullableText(event.watchFor) || !isNullableText(event.invalidation)
    || !isText(event.eventType) || !directionValues.has(String(event.newsDirection))
    || !isText(event.systemJudgment) || !horizonValues.has(String(event.horizon))
    || !isStrictMarketIso(event.occurredAt) || !isStrictMarketIso(event.publishedAt)
    || !isText(event.snapshotId) || !/^market-\d{4}-\d{2}-\d{2}-[0-9a-f]{16}$/.test(event.snapshotId)
    || !isStrictMarketIso(event.snapshotAsOf)
    || !Number.isInteger(event.sourceCount) || Number(event.sourceCount) < 1
    || !Array.isArray(event.sources) || event.sources.length < 1
    || !event.sources.every(source => source && isText(source.name) && isSafePublicMarketUrl(source.url))
    || new Set(event.sources.map(source => source.url)).size !== event.sources.length
    || Number(event.sourceCount) < event.sources.length
    || !Array.isArray(event.assets) || event.assets.length < 1
    || !event.assets.every(asset => asset && ['crypto', 'us_equity', 'macro'].includes(asset.namespace)
      && isText(asset.symbol) && typeof asset.relevance === 'number' && Number.isFinite(asset.relevance)
      && asset.relevance >= 0 && asset.relevance <= 100)) return false
  if (event.reaction !== null) {
    const reaction = event.reaction
    if (!reaction || !reactionValues.has(String(reaction.status)) || !isNullableText(reaction.benchmark)
      || !isNullableNumber(reaction.return5m) || !isNullableNumber(reaction.return30m)
      || !isNullableNumber(reaction.return4h) || !isNullableNumber(reaction.excess5m)
      || !isNullableNumber(reaction.excess30m) || !isNullableNumber(reaction.excess4h)) return false
  }
  return true
}

export function parseMarketTimelineList(value: unknown): MarketRadarEventList | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const payload = value as Partial<MarketRadarEventList>
  const cursorSeparator = typeof payload.nextCursor === 'string' ? payload.nextCursor.indexOf('|') : -1
  const ids = Array.isArray(payload.items) ? payload.items.map(item => item?.id) : []
  if (!healthValues.has(String(payload.status)) || !hasValidMessage(payload)
    || !Array.isArray(payload.items) || !payload.items.every(item => isMarketEvent(item, false))
    || (payload.snapshotId === null ? payload.asOf !== null || payload.items.length > 0
      : !isText(payload.snapshotId) || !/^market-\d{4}-\d{2}-\d{2}-[0-9a-f]{16}$/.test(payload.snapshotId)
        || !isStrictMarketIso(payload.asOf) || payload.items.some(item => item.snapshotId !== payload.snapshotId))
    || new Set(ids).size !== ids.length
    || (payload.nextCursor !== null && (!isText(payload.nextCursor) || cursorSeparator < 1
      || !isStrictMarketIso(payload.nextCursor.slice(0, cursorSeparator))
      || !parseEventCursor(payload.nextCursor)))) return null
  return payload as MarketRadarEventList
}

export function parseMarketTimelineSummary(value: unknown): MarketRadarSummary | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const summary = value as Partial<MarketRadarSummary>
  if (!healthValues.has(String(summary.status)) || !hasValidMessage(summary)
    || (summary.snapshotId === null ? summary.asOf !== null
      : !isText(summary.snapshotId) || !/^market-\d{4}-\d{2}-\d{2}-[0-9a-f]{16}$/.test(summary.snapshotId)
        || !isStrictMarketIso(summary.asOf))
    || !isStrictMarketIso(summary.generatedAt)
    || (summary.latestEventAt !== null && !isStrictMarketIso(summary.latestEventAt))
    || (summary.freshnessMinutes !== null && (!Number.isInteger(summary.freshnessMinutes) || Number(summary.freshnessMinutes) < 0))
    || typeof summary.isDelayed !== 'boolean'
    || !Number.isInteger(summary.eventCount24h) || Number(summary.eventCount24h) < 0
    || !Number.isInteger(summary.p0Count24h) || Number(summary.p0Count24h) < 0
    || !Number.isInteger(summary.p1Count24h) || Number(summary.p1Count24h) < 0
    || Number(summary.p0Count24h) + Number(summary.p1Count24h) > Number(summary.eventCount24h)
    || !Array.isArray(summary.sources) || !summary.sources.every(source => source && hasValidMessage(source)
      && isText(source.source) && healthValues.has(String(source.health))
      && (source.lastSuccessAt === null || isStrictMarketIso(source.lastSuccessAt)))) return null
  return summary as MarketRadarSummary
}

export function parseMarketEventDetail(value: unknown): MarketRadarEventDetail | null {
  if (!isMarketEvent(value, true)) return null
  const detail = value as MarketRadarEventDetail
  if (!Array.isArray(detail.reports) || !detail.reports.every(report => report && isText(report.id)
    && isText(report.sourceName) && isSafePublicMarketUrl(report.sourceUrl)
    && (report.title === null || isText(report.title)) && (report.excerpt === null || typeof report.excerpt === 'string')
    && (report.publishedAt === null || isStrictMarketIso(report.publishedAt)) && typeof report.isPrimary === 'boolean')
    || new Set(detail.reports.map(report => report.id)).size !== detail.reports.length
    || (detail.reports.length > 0 && detail.reports.filter(report => report.isPrimary).length !== 1)) return null
  return detail
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
}

export function toTradeTimelineCard(event: MarketRadarEvent): TradeTimelineCardViewModel {
  const source = event.sources[0]
  return {
    origin: 'api', id: event.id, title: event.titleZh, priority: event.priority,
    categoryLabel: marketLabels[event.market], statusLabel: event.horizon === 'intraday' ? '日内' : event.horizon === 'days' ? '数日' : '数周',
    occurredAt: event.occurredAt, publishedAt: event.publishedAt, summary: event.summaryZh,
    whyItMatters: event.whyItMattersZh, watchFor: event.watchFor || '当前数据库记录尚未提供独立观察条件。',
    invalidation: event.invalidation || '当前数据库记录尚未提供独立失效条件。',
    assets: event.assets.map(asset => asset.symbol), sourceCount: event.sourceCount,
    sourceName: source.name, sourceUrl: source.url, detailHref: `/market-radar/events/${encodeURIComponent(event.id)}`,
  }
}

function cursorMovesBackward(nextCursor: string, requestedCursor: string): boolean {
  const next = parseEventCursor(nextCursor)
  const requested = parseEventCursor(requestedCursor)
  if (!next || !requested) return false
  const nextTime = Date.parse(next.publishedAt)
  const requestedTime = Date.parse(requested.publishedAt)
  return nextTime < requestedTime || nextTime === requestedTime && next.id < requested.id
}

export function mergeTradeTimelinePage(
  cards: TradeTimelineCardViewModel[],
  page: MarketRadarEventList,
  requestedCursor: string | null,
  requestedCursors: string[],
): TradeTimelinePaginationState {
  const completedCursors = requestedCursor && !requestedCursors.includes(requestedCursor)
    ? [...requestedCursors, requestedCursor] : [...requestedCursors]
  const repeated = page.nextCursor !== null && (page.nextCursor === requestedCursor || completedCursors.includes(page.nextCursor))
  const failedToAdvance = page.nextCursor !== null && requestedCursor !== null
    && !cursorMovesBackward(page.nextCursor, requestedCursor)
  if (repeated || failedToAdvance) {
    return { cards: [...cards], nextCursor: null, requestedCursors: completedCursors, stopped: true }
  }
  const seenIds = new Set(cards.map(card => card.id))
  const merged = [...cards]
  for (const event of page.items) {
    if (seenIds.has(event.id)) continue
    seenIds.add(event.id)
    merged.push(toTradeTimelineCard(event))
  }
  return {
    cards: merged,
    nextCursor: page.nextCursor,
    requestedCursors: completedCursors,
    stopped: false,
  }
}

function staticOccurrence(event: StaticMarketEvent): string {
  return event.eventAt || `${event.sourcePublishedAt}T12:00:00+08:00`
}

export function buildStaticTradeTimeline(radar: MarketRadarDaily | undefined): TradeTimelineCardViewModel[] {
  if (!radar) return []
  return radar.events.map(event => ({
    origin: 'static', id: event.id, title: event.title, priority: event.priority,
    categoryLabel: staticCategoryLabels[event.category],
    statusLabel: event.status === 'scheduled' ? '已排期' : event.status === 'released' ? '已发布' : '观察中',
    occurredAt: staticOccurrence(event), publishedAt: radar.generatedAt, summary: event.fact,
    whyItMatters: event.whyWatch, watchFor: event.watchFor, invalidation: event.invalidation,
    assets: [...event.assets], sourceCount: 1, sourceName: event.sourceName,
    sourceUrl: isSafePublicMarketUrl(event.sourceUrl) ? event.sourceUrl : null,
    detailHref: `/market-radar/events/${encodeURIComponent(event.id)}`, snapshotSlug: radar.slug,
  }))
}

export function partitionTradeTimeline(items: TradeTimelineCardViewModel[], now = new Date()) {
  const nowMs = now.getTime()
  return {
    future: items.filter(item => Date.parse(item.occurredAt) > nowMs)
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt)),
    historical: items.filter(item => Date.parse(item.occurredAt) <= nowMs)
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)),
  }
}

function shanghaiDay(value: Date): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function groupHistoricalTradeTimeline(items: TradeTimelineCardViewModel[]): TradeTimelineDateGroup[] {
  const groups = new Map<string, TradeTimelineCardViewModel[]>()
  for (const item of [...items].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))) {
    const date = shanghaiDay(new Date(item.occurredAt))
    const group = groups.get(date)
    if (group) group.push(item)
    else groups.set(date, [item])
  }
  return [...groups].map(([date, itemsInGroup]) => ({
    date,
    label: new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
      .format(new Date(itemsInGroup[0].occurredAt)),
    items: itemsInGroup,
  }))
}

export function countOccurredTradeToday(items: TradeTimelineCardViewModel[], now = new Date()): number {
  const today = shanghaiDay(now)
  const nowMs = now.getTime()
  return items.filter(item => Date.parse(item.occurredAt) <= nowMs && shanghaiDay(new Date(item.occurredAt)) === today).length
}

export function formatTradeTimelineTime(value: string): string {
  return formatTime(value)
}
