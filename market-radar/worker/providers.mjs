import { normalizeMarketSourceReport, normalizeUrl } from './core.mjs'
import { CRYPTO_RELEASE_REPOSITORIES } from './config.mjs'

function ensureOk(response, source) {
  if (!response.ok) throw new Error(`${source}_http_${response.status}`)
  return response
}

function stripCdata(value) {
  return String(value || '').replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim()
}

function isoDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function publicUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? normalizeUrl(url.toString()) : null
  } catch {
    return null
  }
}

export function parseRss(xml, provider, market = 'macro') {
  const records = []
  for (const match of xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)) {
    const item = match[0]
    const read = name => stripCdata(item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1])
    const href = item.match(/<link[^>]+href=["']([^"']+)/i)?.[1] || read('link')
    const title = read('title').replace(/<[^>]+>/g, '')
    const published = read('published') || read('updated') || read('pubDate')
    const sourceUrl = publicUrl(href)
    const publishedAt = isoDate(published)
    if (!title || !sourceUrl || !publishedAt) continue
    const report = normalizeMarketSourceReport({
      title,
      excerpt: read('summary') || read('description'),
      publishedAt,
    })
    records.push({
      provider, providerId: read('id') || read('guid') || sourceUrl, market,
      sourceUrl, title, summary: report.excerpt || '', sourceReport: report,
      publishedAt, explicitSymbols: [], payload: { title, href, published, excerpt: report.excerpt },
    })
  }
  return records
}

export function parseGitHubReleasePayload(payload, symbol, repository) {
  if (!Array.isArray(payload)) throw new Error('github_releases_invalid_payload')
  return payload.flatMap(release => {
    const sourceUrl = publicUrl(release?.html_url)
    const publishedAt = isoDate(release?.published_at)
    const label = String(release?.name || release?.tag_name || '').trim()
    if (release?.draft || !release?.id || !label || !sourceUrl || !publishedAt) return []
    const sourceReport = normalizeMarketSourceReport({
      title: label,
      excerpt: release.body,
      publishedAt,
    })
    return [{
      provider: 'github_releases', providerId: `${repository}:${release.id}`, market: 'crypto',
      sourceUrl, title: `${symbol} ${label} released`, summary: sourceReport.excerpt || '', sourceReport, publishedAt,
      explicitSymbols: [symbol], payload: {
        repository, tagName: String(release.tag_name || ''), prerelease: release.prerelease === true,
        publishedAt, sourceUrl, excerpt: sourceReport.excerpt,
      },
    }]
  })
}

export function parseSecCompanyFeed(xml, symbol) {
  const significantForm = /\b(?:8-K|10-Q|10-K|6-K|20-F|S-1|S-3|DEF 14A)\b/i
  return parseRss(xml, 'sec_edgar', 'us_equity')
    .filter(item => significantForm.test(item.title))
    .map(item => ({ ...item, explicitSymbols: [symbol], title: `${symbol} ${item.title}` }))
}

export function parseBinanceKlines(payload) {
  if (!Array.isArray(payload)) throw new Error('binance_market_data_invalid_payload')
  return payload.flatMap(item => {
    const at = new Date(Number(item?.[0]))
    const close = Number(item?.[4])
    return Number.isNaN(at.getTime()) || !Number.isFinite(close) ? [] : [{ at, close }]
  }).sort((a, b) => a.at - b.at)
}

export async function fetchCryptoReleases(repositories = CRYPTO_RELEASE_REPOSITORIES) {
  const records = []
  for (const { symbol, repository } of repositories) {
    const response = ensureOk(await fetch(`https://api.github.com/repos/${repository}/releases?per_page=5`, {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'xiuqiu-market-radar' },
    }), 'github_releases')
    records.push(...parseGitHubReleasePayload(await response.json(), symbol, repository))
  }
  const oldestAccepted = Date.now() - 30 * 24 * 60 * 60_000
  return records.filter(item => Date.parse(item.publishedAt) >= oldestAccepted)
}

export async function fetchSecCompanyFilings(userAgent, symbols) {
  if (!userAgent) return []
  const records = []
  for (const symbol of symbols) {
    const url = new URL('https://www.sec.gov/cgi-bin/browse-edgar')
    url.searchParams.set('action', 'getcompany')
    url.searchParams.set('CIK', symbol)
    url.searchParams.set('owner', 'exclude')
    url.searchParams.set('count', '10')
    url.searchParams.set('output', 'atom')
    const response = ensureOk(await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': userAgent, Accept: 'application/atom+xml,application/rss+xml' },
    }), 'sec_edgar')
    records.push(...parseSecCompanyFeed(await response.text(), symbol))
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  const oldestAccepted = Date.now() - 30 * 24 * 60 * 60_000
  return records.filter(item => Date.parse(item.publishedAt) >= oldestAccepted)
}

export async function fetchSecEdgar(userAgent) {
  if (!userAgent) return []
  const response = ensureOk(await fetch('https://www.sec.gov/news/pressreleases.rss', { headers: { 'User-Agent': userAgent, Accept: 'application/rss+xml' } }), 'sec_edgar')
  return parseRss(await response.text(), 'sec_edgar', 'macro')
}

export async function fetchFederalReserve() {
  const response = ensureOk(await fetch('https://www.federalreserve.gov/feeds/press_all.xml'), 'federal_reserve')
  return parseRss(await response.text(), 'federal_reserve', 'macro')
}

export async function fetchBinanceSeries({ symbol, startTime, endTime, interval = '5m', limit = 120 }) {
  const url = new URL('https://data-api.binance.vision/api/v3/klines')
  url.searchParams.set('symbol', `${symbol}USDT`)
  url.searchParams.set('interval', interval)
  url.searchParams.set('limit', String(limit))
  if (startTime) url.searchParams.set('startTime', String(new Date(startTime).getTime()))
  if (endTime) url.searchParams.set('endTime', String(new Date(endTime).getTime()))
  const payload = await ensureOk(await fetch(url, { signal: AbortSignal.timeout(10_000) }), 'binance_market_data').json()
  return parseBinanceKlines(payload)
}

export async function checkQiuMarketHealth(baseUrl = 'https://qiu-market.vercel.app') {
  try {
    const response = await fetch(`${baseUrl}/api/v1/get_market_insights`, { signal: AbortSignal.timeout(8_000) })
    return { healthy: response.ok, status: response.status }
  } catch {
    return { healthy: false, status: 0 }
  }
}
