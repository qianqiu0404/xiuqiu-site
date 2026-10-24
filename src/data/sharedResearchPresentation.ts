import type { ReadingDomain, ReadingItem, ReadingTopic, ResearchCard, ResearchIndex } from './readingFeed.ts'

const CATEGORIES: Record<string, { domain: ReadingDomain; topic: string; label: string }> = {
  'AI 与软件': { domain: 'ai', topic: 'research-ai', label: 'AI 与软件' },
  'Web3 与市场': { domain: 'web3', topic: 'research-web3', label: 'Web3 与市场' },
  '市场与经济': { domain: 'market', topic: 'research-market', label: '市场与经济' },
  '职业与机会': { domain: 'research', topic: 'research-career', label: '职业与机会' },
}
const OTHER = { domain: 'research' as const, topic: 'research-other', label: '其他资料' }
export const researchTopicKeys = [...Object.values(CATEGORIES).map(c => c.topic), OTHER.topic]
export const researchEntryRoutes = ['/research', ...researchTopicKeys.map(key => `/topics/${key}`)]
const EVIDENCE: Record<string, string> = { unverified: '未核实', source_checked: '指定陈述已核对原文', corroborated: '指定陈述有交叉证据', disputed: '存在分歧', refuted: '指定陈述已有反证' }
const ACCESS: Record<string, string> = { accessible: '采集时原文已读取', partial: '采集时仅读取部分原文', unavailable: '采集时原文无法访问', not_checked: '采集时未打开原文' }
const SOURCE: Record<string, string> = { primary: '一手材料', secondary: '转述材料', model_output: '模型输出', unknown: '类型待确认' }
const BASIS = { event: '事件日期', published: '原文发布日期', collected: '收录日期', brief: '简报日期' }

export function researchEvidenceLabel(status: string): string { return EVIDENCE[status] || '核实状态未知' }
export function researchAccessLabel(status: string): string { return ACCESS[status] || '原文状态未知' }
export function researchTypeLabel(type: string): string { return SOURCE[type] || '类型待确认' }
export function researchDateLabel(basis: ResearchCard['date_basis']): string { return BASIS[basis] }
export function researchCalendarDate(timestamp: string): string {
  const value = new Date(timestamp)
  if (!Number.isFinite(value.getTime())) return '日期未知'
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value)
}
export function researchTopicLabel(topic: string): string | undefined {
  return topic === OTHER.topic ? OTHER.label : Object.values(CATEGORIES).find(c => c.topic === topic)?.label
}
export function researchHref(id: string): string { return `/research?id=${encodeURIComponent(id)}` }
export function researchItems(index?: ResearchIndex): ReadingItem[] {
  return (index?.cards || []).map(card => {
    const category = CATEGORIES[card.category] || OTHER
    return { id: `research:${card.id}`, kind: 'research', date: card.date, domain: category.domain, topic: category.topic,
      title: card.title, summary: card.summary || '展开阅读原始输入、整理说明与来源。', href: researchHref(card.id), research: card }
  })
}
export function mergeReadingItems(native: readonly ReadingItem[], index?: ResearchIndex): ReadingItem[] {
  // Only the source's explicit event/exact-content groups collapse records.
  // Sharing a URL or a similar title across Radar and research proves no identity.
  const order = { review: 0, grok: 1, research: 2, learning: 3, market: 4 }
  return [...native, ...researchItems(index)].sort((a, b) => {
    const groupOrder = b.date.localeCompare(a.date) || order[a.kind] - order[b.kind]
    if (groupOrder || a.kind !== 'grok' || b.kind !== 'grok') return groupOrder
    const aTime = Date.parse(a.research?.collected_at || '')
    const bTime = Date.parse(b.research?.collected_at || '')
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0) || a.id.localeCompare(b.id)
  })
}
export function readingTopics(items: readonly ReadingItem[]): ReadingTopic[] {
  const topics = new Map<string, ReadingTopic>()
  for (const item of items) {
    const old = topics.get(item.topic)
    if (!old) topics.set(item.topic, { topic: item.topic, domain: item.domain, count: 1, firstSeen: item.date, lastSeen: item.date })
    else {
      old.count++
      old.firstSeen = old.firstSeen < item.date ? old.firstSeen : item.date
      old.lastSeen = old.lastSeen > item.date ? old.lastSeen : item.date
    }
  }
  return [...topics.values()].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen) || a.topic.localeCompare(b.topic))
}
export function researchCardLabel(card: ResearchCard): string {
  return `${researchDateLabel(card.date_basis)} · ${researchEvidenceLabel(card.evidence_status)} · ${card.materials.length} 条材料`
}
export function researchUpdateLabel(index: ResearchIndex): string {
  const latest = index.cards.map(c => c.collected_at ? researchCalendarDate(c.collected_at) : '').sort().slice(-1)[0]
  return latest ? `共享研究 · 最近收录 ${latest} · ${index.cards.length} 组资料` : '共享研究 · 暂无公开资料'
}
export function dailyRadarHref(items: readonly ReadingItem[]): string | undefined {
  const first = items.find(item => item.kind === 'learning')
  return first ? `/radar/${first.date}` : undefined
}
