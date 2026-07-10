const DEFAULT_TITLE = 'xiuqiu｜Web3 钱包后端学习档案'
const DEFAULT_DESCRIPTION =
  '记录交易所钱包后端、多链 RPC、独立签名、TypeScript 离线钱包与 Go 数据服务的代码实践、验证证据和工程边界。'
const SITE_URL = 'https://xiuqiu-site.vercel.app'

interface SeoOptions {
  title?: string
  description?: string
  path?: string
  type?: 'website' | 'article'
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

  document.title = title

  upsertMeta('meta[name="description"]', { name: 'description', content: description })
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title })
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description })
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: type })
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: url })
  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary' })
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title })
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description })
  upsertCanonical(url)
}
