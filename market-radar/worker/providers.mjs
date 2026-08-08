import { normalizeUrl } from './core.mjs'

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
    records.push({
      provider, providerId: read('id') || read('guid') || sourceUrl, market,
      sourceUrl, title, summary: read('summary') || read('description'),
      publishedAt, explicitSymbols: [], payload: { title, href, published },
    })
  }
  return records
}

export function parseMarketauxPayload(payload, market) {
  if (!Array.isArray(payload?.data)) throw new Error('marketaux_invalid_payload')
  return payload.data.flatMap(item => {
    const sourceUrl = publicUrl(item?.url)
    const publishedAt = isoDate(item?.published_at)
    if (!item?.title || !sourceUrl || !publishedAt) return []
    return [{
      provider: 'marketaux', providerId: String(item.uuid || sourceUrl), market,
      sourceUrl, title: String(item.title), summary: String(item.description || item.snippet || ''), publishedAt,
      explicitSymbols: (item.entities || []).map(entity => entity.symbol).filter(Boolean), payload: item,
    }]
  })
}

export function parseAlphaVantagePayload(payload, market) {
  if (!Array.isArray(payload?.feed)) throw new Error('alpha_vantage_invalid_payload')
  return payload.feed.flatMap(item => {
    const sourceUrl = publicUrl(item?.url)
    const timestamp = String(item?.time_published || '').replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3T$4:$5:$6Z')
    const publishedAt = isoDate(timestamp)
    if (!item?.title || !sourceUrl || !publishedAt) return []
    return [{
      provider: 'alpha_vantage', providerId: sourceUrl, market,
      sourceUrl, title: String(item.title), summary: String(item.summary || ''), publishedAt,
      explicitSymbols: (item.ticker_sentiment || []).map(entry => entry.ticker).filter(Boolean), payload: item,
    }]
  })
}

export async function fetchMarketaux({ token, market, symbols }) {
  if (!token) return []
  const url = new URL('https://api.marketaux.com/v1/news/all')
  url.searchParams.set('api_token', token)
  url.searchParams.set('symbols', symbols.join(','))
  url.searchParams.set('filter_entities', 'true')
  url.searchParams.set('language', 'en')
  url.searchParams.set('limit', '50')
  const payload = await ensureOk(await fetch(url), 'marketaux').json()
  return parseMarketauxPayload(payload, market)
}

export async function fetchAlphaVantage({ apiKey, symbols, market }) {
  if (!apiKey) return []
  const url = new URL('https://www.alphavantage.co/query')
  url.searchParams.set('function', 'NEWS_SENTIMENT')
  url.searchParams.set('tickers', symbols.join(','))
  url.searchParams.set('limit', '50')
  url.searchParams.set('apikey', apiKey)
  const payload = await ensureOk(await fetch(url), 'alpha_vantage').json()
  return parseAlphaVantagePayload(payload, market)
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

export async function fetchTwelveDataSeries({ apiKey, symbol, interval = '5min', outputsize = 60 }) {
  if (!apiKey) return []
  const url = new URL('https://api.twelvedata.com/time_series')
  url.searchParams.set('symbol', symbol)
  url.searchParams.set('interval', interval)
  url.searchParams.set('outputsize', String(outputsize))
  url.searchParams.set('timezone', 'UTC')
  url.searchParams.set('apikey', apiKey)
  const payload = await ensureOk(await fetch(url), 'twelve_data').json()
  if (payload.status === 'error') throw new Error(`twelve_data_${payload.code || 'error'}`)
  return (payload.values || []).map(item => ({ at: new Date(`${item.datetime}Z`), close: Number(item.close) }))
    .filter(item => !Number.isNaN(item.at.getTime()) && Number.isFinite(item.close)).sort((a, b) => a.at - b.at)
}

export async function checkQiuMarketHealth(baseUrl = 'https://qiu-market.vercel.app') {
  try {
    const response = await fetch(`${baseUrl}/api/v1/get_market_insights`, { signal: AbortSignal.timeout(8_000) })
    return { healthy: response.ok, status: response.status }
  } catch {
    return { healthy: false, status: 0 }
  }
}
