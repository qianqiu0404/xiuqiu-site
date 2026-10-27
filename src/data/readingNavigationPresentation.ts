import { SITE_URL } from '../../shared/site.ts'
import { filterIntel, intelFilters, intelTopicLabel } from './intelPresentation.ts'
import type { IntelFilter } from './intelPresentation.ts'
import type { ReadingItem } from './readingFeed.ts'
import { readMarketQuery, marketListHref, marketCategoryLabel } from './marketRadarPresentation.ts'

export interface IntelQuery {
  filter: IntelFilter
  topic?: string
  search: string
  expanded: boolean
}

export function readIntelQuery(query: Record<string, unknown>): IntelQuery {
  return {
    filter: intelFilters.some(option => option.key === query.domain) ? query.domain as IntelFilter : 'all',
    topic: typeof query.topic === 'string' && /^[a-z0-9_-]+$/i.test(query.topic) ? query.topic : undefined,
    search: typeof query.q === 'string' ? query.q : '',
    expanded: query.expanded === '1',
  }
}

export function intelQueryParams(query: IntelQuery): Record<string, string> {
  return {
    ...(query.filter !== 'all' ? { domain: query.filter } : {}),
    ...(query.topic ? { topic: query.topic } : {}),
    ...(query.search.trim() ? { q: query.search } : {}),
    ...(query.expanded ? { expanded: '1' } : {}),
  }
}

export function intelQueryLabel(query: IntelQuery): string {
  return [intelFilters.find(option => option.key === query.filter)?.label || '全部',
    query.topic ? intelTopicLabel(query.topic) : '', query.search.trim() ? `“${query.search.trim()}”` : ''].filter(Boolean).join(' · ')
}

export function intelResultLabel(total: number, shown: number, states: readonly string[]): string {
  if (states.includes('loading')) return total ? `正在载入资料，已匹配 ${total} 条` : '正在载入资料'
  if (!total && states.includes('error')) return '资料源暂不可读，无法确认匹配数量'
  const count = states.includes('error') ? `已载入资料中匹配 ${total} 条` : `找到 ${total} 条`
  return shown < total ? `${count} · 当前显示 ${shown} 条` : count
}

export type IntelLoadState = 'loading' | 'ready' | 'error'

/** Only a successful read can establish an empty source. */
export function intelFeedStates(filter: IntelFilter, states: { archive: IntelLoadState; research: IntelLoadState; grok: IntelLoadState; chatgpt: IntelLoadState }): IntelLoadState[] {
  return filter === 'grok' || filter === 'chatgpt' || filter === 'research'
    ? [states[filter]] : [states.archive, states.research, states.grok, states.chatgpt]
}

export function intelCanShowEmpty(states: readonly IntelLoadState[]): boolean {
  return states.every(state => state === 'ready')
}

/** Finished errors also settle the list, so return anchors can regain focus. */
export function intelReadingReady(states: readonly IntelLoadState[]): boolean {
  return !states.includes('loading')
}

export function intelFilterOptions(items: readonly ReadingItem[], states: { research: IntelLoadState; grok: IntelLoadState; chatgpt: IntelLoadState }) {
  return intelFilters.map(option => ({ ...option, count: (option.key === 'research' || option.key === 'grok' || option.key === 'chatgpt') && states[option.key] !== 'ready'
    ? undefined : filterIntel(items, { filter: option.key }).filter(item => item.kind !== 'review').length }))
}

export function intelItemId(id: string): string { return `intel-item-${id}` }

// Only the allowlisted list readers are valid return destinations. Query and fragment
// are reconstructed so a shared detail URL cannot become an open redirect.
export function readingReturnLink(from: unknown): { href: string; label: string } {
  const fallback = { href: '/', label: '← 情报流' }
  if (typeof from !== 'string' || from.length > 5000 || !from.startsWith('/') || from.startsWith('//') || from.includes('\\')) return fallback
  try {
    const url = new URL(from, SITE_URL)
    if (url.origin !== new URL(SITE_URL).origin) return fallback
    if (url.pathname === '/market-radar') {
      if (from.split(/[?#]/)[0] !== '/market-radar') return fallback
      const query = readMarketQuery({ category: url.searchParams.get('category'), q: url.searchParams.get('q') })
      const context = [marketCategoryLabel(query.category), query.query.trim() ? `“${query.query.trim()}”` : ''].filter(Boolean).join(' · ')
      return { href: marketListHref(query, url.hash), label: `← 返回 ${context} 市场雷达` }
    }
    const topicPath = /^\/topics\/[a-z0-9_-]+$/i.test(url.pathname)
    if (url.pathname !== '/' && !topicPath) return fallback
    const query = readIntelQuery({ domain: url.searchParams.get('domain'), topic: url.searchParams.get('topic'), q: url.searchParams.get('q'), expanded: url.searchParams.get('expanded') })
    const params = new URLSearchParams(topicPath ? {} : intelQueryParams(query)).toString()
    const hash = /^#intel-item-[a-z0-9%:_.-]+$/i.test(url.hash) ? url.hash : ''
    const label = topicPath ? `← 返回 ${intelTopicLabel(url.pathname.split('/').pop()!)} 主题` : query.search.trim()
      ? `← 返回 ${intelQueryLabel(query)} 搜索结果` : `← 返回 ${intelQueryLabel(query)} 情报流`
    return { href: `${url.pathname}${params ? `?${params}` : ''}${hash}`, label }
  } catch { return fallback }
}

export function intelReadingHref(item: ReadingItem, listPath: string): string {
  const from = readingReturnLink(`${listPath.split('#')[0]}#${encodeURIComponent(intelItemId(item.id))}`).href
  return withReadingReturn(item.href, from)
}

export function intelReadingLabel(kind: ReadingItem['kind']): string {
  return kind === 'learning' ? '阅读当期日报 →' : kind === 'market' ? '阅读当期市场快照 →' : kind === 'review' ? '阅读趋势回顾 →' : kind === 'grok' ? '阅读 Bot 新闻与来源 →' : kind === 'chatgpt' ? '阅读推荐与来源 →' : '阅读研究资料 →'
}

export function withReadingReturn(href: string, from: unknown): string {
  const url = new URL(href, SITE_URL)
  if (typeof from === 'string') url.searchParams.set('from', readingReturnLink(from).href)
  return `${url.pathname}${url.search}${url.hash}`
}


export function marketReadingHref(href: string, listPath: string, eventId?: string): string {
  const from = eventId ? `${listPath.split('#')[0]}#queue-${eventId}` : listPath
  return withReadingReturn(href, from)
}
