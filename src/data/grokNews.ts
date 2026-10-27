import { NEWS_PRODUCERS, parseGrokIndex, parseNewsIndex } from '../../shared/grokNews.ts'
import type { GrokNewsIndex, GrokNewsRecord, NewsIndex, NewsProducer } from '../../shared/grokNews.ts'
import type { ReadingItem, ResearchCard, ResearchDetail } from './readingFeed.ts'
import { createExternalLoader } from './externalSourceStatus.ts'
import { newsCard, newsReadingItems, newsUpdateLabel, newsDetail } from './newsPresentation.ts'

export { newsDetailContext, newsReadingItems, newsUpdateLabel } from './newsPresentation.ts'

export function grokCard(record: GrokNewsRecord): ResearchCard {
  return newsCard(record, 'grok')
}
export function grokReadingItems(index?: GrokNewsIndex): ReadingItem[] {
  return newsReadingItems(index, 'grok')
}
export function grokUpdateLabel(index: GrokNewsIndex): string {
  return newsUpdateLabel(index, 'grok')
}
export function grokDetail(record: GrokNewsRecord): ResearchDetail {
  return newsDetail(record, 'grok')
}
export function createNewsClient<P extends NewsProducer>(producer: P, fetcher: typeof fetch = fetch, now = Date.now) {
  let cached: NewsIndex<P> | undefined, expires = 0, pending: Promise<NewsIndex<P>> | undefined
  function load(force = false): Promise<NewsIndex<P>> {
    if (!force && cached && now() < expires) return Promise.resolve(cached)
    if (pending) return pending
    pending = (async () => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000)
      try {
        const response = await fetcher(`${NEWS_PRODUCERS[producer].dataPath}?v=${Math.floor(now() / (force ? 1 : 60000))}`, { signal: controller.signal, credentials: 'omit', cache: 'no-store' })
        if (!response.ok) throw new Error(`${producer === 'grok' ? 'Grok Bot 资料' : 'ChatGPT推荐来源尚未接入或'}暂时无法读取`)
        if (Number(response.headers.get('content-length')) > 2 * 1024 * 1024) throw new Error('新闻索引过大')
        const text = await response.text()
        if (new TextEncoder().encode(text).length > 2 * 1024 * 1024) throw new Error('新闻索引过大')
        const value = parseNewsIndex(JSON.parse(text), producer)
        cached = value
        expires = now() + 60000
        return value
      } finally { clearTimeout(timer) }
    })().finally(() => { pending = undefined })
    return pending
  }
  return { load }
}
export function createGrokNewsClient(fetcher: typeof fetch = fetch, now = Date.now) {
  return createNewsClient('grok', fetcher, now)
}
const client = createGrokNewsClient()
export const loadGrokNews = client.load
// Live index first; the build-time snapshot only when the rewrite fails.
export const loadGrokNewsWithFallback = createExternalLoader('grok', loadGrokNews, parseGrokIndex)
const chatgptClient = createNewsClient('chatgpt')
export const loadChatGPTNewsWithFallback = createExternalLoader('chatgpt', chatgptClient.load, value => parseNewsIndex(value, 'chatgpt'))
export async function loadNewsDetail(producer: NewsProducer, id: string, force = false): Promise<ResearchDetail | undefined> {
  const load = producer === 'grok' ? await loadGrokNewsWithFallback(force) : await loadChatGPTNewsWithFallback(force)
  const record = load.value.records.find(record => record.id === id)
  return record ? newsDetail(record, producer) : undefined
}
export async function loadGrokDetail(id: string, force = false): Promise<ResearchDetail | undefined> {
  return loadNewsDetail('grok', id, force)
}
export type { GrokNewsIndex, NewsIndex }
