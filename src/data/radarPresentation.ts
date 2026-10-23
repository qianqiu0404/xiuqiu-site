import type { DailyRadar, LearningBrief, RadarItem } from './generatedRadars'

export type RadarPresentationKey = 'industry' | 'ai' | 'web3' | 'tools' | 'reading'

export interface RadarPresentationItem extends RadarItem {
  key: RadarPresentationKey
  label: string
  evidenceLabel: string
}

export interface RadarDetailSection {
  id: string
  label: string
  evidenceLabel: string
  items: RadarItem[]
}

export interface RadarReviewBoundary {
  lastReviewedLabel: string
  statusLabel: string
  nextReviewLabel: string
}

function presentationItem(
  key: RadarPresentationKey,
  label: string,
  evidenceLabel: string,
  item?: RadarItem,
): RadarPresentationItem | undefined {
  return item ? { key, label, evidenceLabel, ...item } : undefined
}

export function getFeaturedRadarItem(radar: DailyRadar): RadarPresentationItem | undefined {
  return (
    presentationItem('web3', 'Web3 Design', '设计推断', radar.web3Design)
    || presentationItem('ai', 'AI Engineering', '工程推断', radar.aiTip)
    || presentationItem('industry', 'Industry Signal', '公开事实与待验证边界', radar.marketSignals[0])
  )
}

export function getSupportingRadarItems(
  radar: DailyRadar,
  featuredKey?: RadarPresentationKey,
): RadarPresentationItem[] {
  return [
    presentationItem('ai', 'AI Engineering', '工程推断', radar.aiTip),
    presentationItem('web3', 'Web3 Design', '设计推断', radar.web3Design),
    presentationItem('tools', 'Tools', '工具观察', radar.vibeProject),
    presentationItem('reading', 'Reading', '阅读问题', radar.readingPick),
  ].filter((item): item is RadarPresentationItem => Boolean(item && item.key !== featuredKey))
}

export function getIndustryRadarItems(
  radar: DailyRadar,
  featuredKey?: RadarPresentationKey,
): DailyRadar['marketSignals'] {
  return featuredKey === 'industry'
    ? radar.marketSignals.slice(1)
    : [...radar.marketSignals]
}

export function getRadarDetailSections(radar: DailyRadar): RadarDetailSection[] {
  return [
    radar.marketSignals.length
      ? {
          id: 'industry-signals',
          label: '市场与行业信号',
          evidenceLabel: '公开事实与待验证边界',
          items: radar.marketSignals,
        }
      : undefined,
    radar.aiTip
      ? { id: 'ai-engineering', label: 'AI Engineering', evidenceLabel: '工程推断', items: [radar.aiTip] }
      : undefined,
    radar.web3Design
      ? { id: 'web3-design', label: 'Web3 Design', evidenceLabel: '设计推断', items: [radar.web3Design] }
      : undefined,
    radar.vibeProject
      ? { id: 'tools', label: 'Tools', evidenceLabel: '工具观察', items: [radar.vibeProject] }
      : undefined,
    radar.readingPick
      ? { id: 'reading', label: 'Reading', evidenceLabel: '阅读问题', items: [radar.readingPick] }
      : undefined,
  ].filter((section): section is RadarDetailSection => Boolean(section))
}

export function isLearningEditionV2(radar: DailyRadar): boolean {
  return radar.schemaVersion === 2 && Array.isArray(radar.briefs) && Boolean(radar.deepDive)
}

export function getLearningBriefs(radar: DailyRadar, domain?: LearningBrief['domain']): LearningBrief[] {
  const briefs = isLearningEditionV2(radar) ? [...(radar.briefs || [])] : []
  return domain ? briefs.filter(brief => brief.domain === domain) : briefs
}

export function learningBriefSummary(brief: LearningBrief): string {
  return brief.mechanism
}

export function getVisibleRadarArchive<T>(radars: readonly T[], expanded: boolean, limit = 7): T[] {
  return expanded ? [...radars] : radars.slice(0, limit)
}

export function radarSourceStatus(radar: DailyRadar): string {
  const links = new Set(radar.sourceUrls).size
  if (isLearningEditionV2(radar)) return `${links} 个原始链接（去重） · 2 AI / 2 Web3 / 1 专题`
  return `研究输入 ${radar.sourceSections.length}/4 类已汇总 · ${links} 个原始链接（去重）`
}

export function radarSignalCountLabel(count: number): string {
  const normalizedCount = Math.max(0, Math.floor(count))
  if (normalizedCount === 0) return '今天暂无公开行业信号。'
  if (normalizedCount === 1) return '今天值得留下的一条信号。'
  if (normalizedCount === 2) return '今天值得留下的两条信号。'
  if (normalizedCount === 3) return '今天值得留下的三条信号。'
  return `今天值得留下的 ${normalizedCount} 条信号。`
}

export function getRadarReviewBoundary(
  reviewedAt: string,
  latestDailyDate?: string,
): RadarReviewBoundary {
  const hasNewerDailyBrief = Boolean(latestDailyDate && latestDailyDate > reviewedAt)
  return {
    lastReviewedLabel: `最后人工复核 ${reviewedAt}`,
    statusLabel: hasNewerDailyBrief
      ? `截至最新日报 ${latestDailyDate}，尚无更新周报。`
      : '这是当前公开的最近一次人工复核。',
    nextReviewLabel: '下一次复核时间未在公开数据中排期。',
  }
}

export type RadarFeedDomain = 'all' | 'ai' | 'web3'

export interface RadarFeedQuery {
  domain: RadarFeedDomain
  topic?: string
  search?: string
}

export interface RadarFeedDay<T> {
  date: string
  items: T[]
}

interface FeedEntry {
  date: string
  domain: 'ai' | 'web3'
  topic: string
  title: string
  summary: string
}

const legacyTopicLabels: Record<string, string> = {
  market_signal: '市场信号',
  ai_engineering: 'AI 工程',
  web3_design: 'Web3 设计',
  tools: '工具',
  reading: '阅读',
}

export function radarTopicLabel(topic: string): string {
  return legacyTopicLabels[topic] || topic.replaceAll('_', ' ')
}

export function filterRadarFeed<T extends FeedEntry>(items: readonly T[], query: RadarFeedQuery): T[] {
  const needle = query.search?.trim().toLowerCase()
  return items.filter(item =>
    (query.domain === 'all' || item.domain === query.domain)
    && (!query.topic || item.topic === query.topic)
    && (!needle || `${item.title} ${item.summary}`.toLowerCase().includes(needle)),
  )
}

export function groupRadarFeedByDate<T extends FeedEntry>(items: readonly T[]): RadarFeedDay<T>[] {
  const days = new Map<string, T[]>()
  for (const item of items) {
    const day = days.get(item.date)
    if (day) day.push(item)
    else days.set(item.date, [item])
  }
  return [...days.entries()].map(([date, dayItems]) => ({ date, items: dayItems }))
}

export function countRadarFeedTopics<T extends FeedEntry>(items: readonly T[]): { topic: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(item.topic, (counts.get(item.topic) || 0) + 1)
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic))
}

// A topic is "continuing" when it appears in at least `minEditions` of the
// latest `window` editions; it stands in for AIHOT-style heat without a model.
export function continuingRadarTopics<T extends FeedEntry>(items: readonly T[], window = 5, minEditions = 2): Set<string> {
  const recentDates = [...new Set(items.map(item => item.date))].sort().reverse().slice(0, window)
  const editionsByTopic = new Map<string, Set<string>>()
  for (const item of items) {
    if (!recentDates.includes(item.date)) continue
    const editions = editionsByTopic.get(item.topic) || new Set<string>()
    editions.add(item.date)
    editionsByTopic.set(item.topic, editions)
  }
  return new Set([...editionsByTopic.entries()].filter(([, editions]) => editions.size >= minEditions).map(([topic]) => topic))
}
