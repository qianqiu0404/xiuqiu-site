import { SITE_URL } from '../../shared/site'

const DEFAULT_TITLE = 'xiuqiu｜AI 与 Web3 工程情报流'
const DEFAULT_DESCRIPTION =
  '每天 2 条 AI、2 条 Web3 工程简报和市场事件，按主题筛选、搜索与订阅；每条都回到一手来源。'

interface SeoOptions {
  title?: string
  description?: string
  path?: string
  type?: 'website' | 'article'
  indexable?: boolean
  marketRadarSnapshotId?: string
}

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)

  if (!el) {
    el = document.createElement('meta')
    document.head.appendChild(el)
  }

  Object.entries(attrs).forEach(([key, value]) => el?.setAttribute(key, value))
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')

  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }

  el.setAttribute('href', href)
}

export function setSeoMeta(options: SeoOptions = {}) {
  const title = options.title || DEFAULT_TITLE
  const description = options.description || DEFAULT_DESCRIPTION
  const url = SITE_URL + (options.path || window.location.pathname)
  const type = options.type || 'website'
  const robots = options.indexable === false ? 'noindex, nofollow' : 'index, follow'

  document.title = title

  upsertMeta('meta[name="description"]', { name: 'description', content: description })
  upsertMeta('meta[name="robots"]', { name: 'robots', content: robots })
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title })
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description })
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: type })
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: url })
  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary' })
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title })
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description })
  const snapshotMeta = document.head.querySelector<HTMLMetaElement>('meta[name="xiuqiu:market-radar-snapshot"]')
  if (options.marketRadarSnapshotId) {
    upsertMeta('meta[name="xiuqiu:market-radar-snapshot"]', {
      name: 'xiuqiu:market-radar-snapshot',
      content: options.marketRadarSnapshotId,
    })
  } else {
    snapshotMeta?.remove()
  }
  upsertCanonical(url)
}
