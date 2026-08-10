import { IMPACT_PATTERNS, SOURCE_WEIGHTS, WATCHLIST } from './config.mjs'

const aliases = new Map([
  ['BITCOIN', 'BTC'], ['ETHEREUM', 'ETH'], ['SOLANA', 'SOL'], ['HYPERLIQUID', 'HYPE'],
  ['RIPPLE', 'XRP'], ['ZCASH', 'ZEC'], ['NVIDIA', 'NVDA'], ['TESLA', 'TSLA'],
  ['COINBASE', 'COIN'], ['MICROSTRATEGY', 'MSTR'], ['STRATEGY', 'MSTR'], ['APPLE', 'AAPL'],
  ['MICROSOFT', 'MSFT'], ['FEDERAL RESERVE', 'FED'], ['INFLATION', 'CPI'], ['STABLECOIN', 'STABLECOIN_REGULATION'],
  ['ETF', 'CRYPTO_ETF'], ['ARTIFICIAL INTELLIGENCE', 'AI_INFRA'],
])

export function normalizeUrl(input) {
  try {
    const url = new URL(input)
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_)/i.test(key)) url.searchParams.delete(key)
    }
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(input || '').trim()
  }
}

export function normalizeTitle(input) {
  return String(input || '').toLowerCase().normalize('NFKC')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

const SOURCE_NAMED_ENTITIES = new Map([
  ['amp', '&'],
  ['apos', "'"],
  ['gt', '>'],
  ['lt', '<'],
  ['nbsp', ' '],
  ['quot', '"'],
])

function isStorableSourceCodePoint(codePoint) {
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return false
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) return false
  if (codePoint >= 0xfdd0 && codePoint <= 0xfdef) return false
  if ((codePoint & 0xffff) === 0xfffe || (codePoint & 0xffff) === 0xffff) return false
  if (codePoint <= 0x1f && ![0x09, 0x0a, 0x0d].includes(codePoint)) return false
  return !(codePoint >= 0x7f && codePoint <= 0x9f)
}

function decodeSourceEntitiesOnce(value) {
  return value.replace(/&(?:#(?:x[0-9a-f]+|[0-9]+)|[a-z]+);/gi, entity => {
    const token = entity.slice(1, -1)
    if (token[0] !== '#') return SOURCE_NAMED_ENTITIES.get(token.toLowerCase()) ?? entity
    const numeric = token[1]?.toLowerCase() === 'x'
      ? Number.parseInt(token.slice(2), 16)
      : Number.parseInt(token.slice(1), 10)
    if (!isStorableSourceCodePoint(numeric)) return ' '
    return String.fromCodePoint(numeric)
  })
}

function decodeSourceEntities(value) {
  let decoded = value
  for (let round = 0; round < 3; round += 1) {
    const next = decodeSourceEntitiesOnce(decoded)
    if (next === decoded) break
    decoded = next
  }
  return decoded
}

function removeUnsafeSourceCharacters(value) {
  return [...value].map(character => (
    isStorableSourceCodePoint(character.codePointAt(0)) ? character : ' '
  )).join('')
}

function compactSourceText(value, maxLength) {
  if (value === null || value === undefined) return null
  const text = removeUnsafeSourceCharacters(decodeSourceEntities(String(value)))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return null
  return [...text].slice(0, maxLength).join('')
}

export function normalizeMarketSourceReport(value, { now = new Date() } = {}) {
  const title = compactSourceText(value?.title, 500)
  const excerpt = compactSourceText(value?.excerpt, 4_000)
  const published = value?.publishedAt ? new Date(value.publishedAt) : null
  const publishedAt = published && Number.isFinite(published.getTime())
    && published.getTime() >= Date.UTC(2000, 0, 1)
    && published.getTime() <= now.getTime() + 60 * 60_000
    ? published.toISOString()
    : null
  return { title, excerpt, publishedAt }
}

export function parseMarketSourceCursor(value) {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    const publishedAt = new Date(parsed?.publishedAt)
    const providerId = typeof parsed?.providerId === 'string' ? parsed.providerId.trim() : ''
    if (!Number.isFinite(publishedAt.getTime()) || !providerId) return null
    return { publishedAt: publishedAt.toISOString(), providerId }
  } catch {
    const publishedAt = new Date(value)
    return Number.isFinite(publishedAt.getTime())
      ? { publishedAt: publishedAt.toISOString(), providerId: '' }
      : null
  }
}

export function encodeMarketSourceCursor(value) {
  return value ? JSON.stringify({ publishedAt: value.publishedAt, providerId: value.providerId }) : null
}

function compareMarketCursor(left, right) {
  const timestampDifference = Date.parse(left.publishedAt) - Date.parse(right.publishedAt)
  return timestampDifference || left.providerId.localeCompare(right.providerId)
}

export function newestMarketSourceCursor(items, previous = null) {
  return items.reduce((latest, item) => {
    const candidate = { publishedAt: item.publishedAt, providerId: String(item.providerId || '') }
    if (!Number.isFinite(Date.parse(candidate.publishedAt)) || !candidate.providerId) return latest
    return !latest || compareMarketCursor(candidate, latest) > 0 ? candidate : latest
  }, previous)
}

export function selectMarketItemsAfterCursor(items, cursor, overlapMs = 30 * 24 * 60 * 60_000) {
  if (!cursor) return items
  const floor = Date.parse(cursor.publishedAt) - overlapMs
  return items.filter(item => {
    const timestamp = Date.parse(item.publishedAt)
    return Number.isFinite(timestamp) && timestamp >= floor
  })
}

function tokens(input) {
  return new Set(normalizeTitle(input).split(' ').filter(token => token.length > 1).map(token => {
    if (/^[a-z]{5,}$/.test(token)) return token.replace(/(?:ed|es|s)$/, '')
    return token
  }))
}

export function titleSimilarity(left, right) {
  const a = tokens(left)
  const b = tokens(right)
  if (!a.size || !b.size) return 0
  const intersection = [...a].filter(token => b.has(token)).length
  return intersection / (a.size + b.size - intersection)
}

export function clusterKey(title, occurredAt) {
  const day = new Date(occurredAt).toISOString().slice(0, 10)
  return `${day}:${normalizeTitle(title).split(' ').slice(0, 8).join('-')}`.slice(0, 180)
}

export function mapAssets(text, explicitSymbols = []) {
  const normalized = ` ${String(text || '').toUpperCase()} `
  const selected = new Map()
  for (const namespace of Object.keys(WATCHLIST)) {
    for (const symbol of WATCHLIST[namespace]) {
      const pattern = new RegExp(`(^|[^A-Z0-9_])${symbol.replace('_', '[ _-]')}([^A-Z0-9_]|$)`, 'i')
      if (pattern.test(normalized) || explicitSymbols.map(String).map(value => value.toUpperCase()).includes(symbol)) {
        selected.set(`${namespace}:${symbol}`, { namespace, symbol, relevance: 100 })
      }
    }
  }
  for (const [alias, symbol] of aliases) {
    if (!normalized.includes(alias)) continue
    const namespace = Object.entries(WATCHLIST).find(([, symbols]) => symbols.includes(symbol))?.[0]
    if (namespace) selected.set(`${namespace}:${symbol}`, { namespace, symbol, relevance: 85 })
  }
  return [...selected.values()]
}

export function scoreEvent({ source, assets, occurredAt, sourceCount = 1, reactionStrength = 0, text = '' }) {
  const sourceQuality = SOURCE_WEIGHTS[source] ?? 8
  const relevance = assets.length ? Math.min(25, 12 + Math.max(...assets.map(asset => asset.relevance)) * 0.13) : 0
  const impact = IMPACT_PATTERNS.some(pattern => pattern.test(text)) ? 20 : 9
  const ageMinutes = Math.max(0, (Date.now() - new Date(occurredAt).getTime()) / 60_000)
  const freshness = ageMinutes <= 30 ? 10 : ageMinutes <= 180 ? 7 : ageMinutes <= 720 ? 4 : 1
  const confirmation = sourceCount >= 3 ? 10 : sourceCount === 2 ? 6 : 0
  const reaction = Math.min(15, Math.round(Math.abs(reactionStrength) * 300))
  const unconfirmedPenalty = sourceCount === 1 && sourceQuality < 16 ? 5 : 0
  return Math.max(0, Math.min(100, Math.round(sourceQuality + relevance + impact + freshness + confirmation + reaction - unconfirmedPenalty)))
}

export function priorityForScore(score) {
  if (score >= 85) return 'P0'
  if (score >= 70) return 'P1'
  if (score >= 50) return 'P2'
  if (score >= 30) return 'P3'
  return 'rejected'
}

export function isFreshForPublic(occurredAt, now = new Date(), maxAgeHours = 72) {
  const occurredMs = new Date(occurredAt).getTime()
  const nowMs = new Date(now).getTime()
  if (!Number.isFinite(occurredMs) || !Number.isFinite(nowMs)) return false
  const ageMs = nowMs - occurredMs
  return ageMs >= -60 * 60_000 && ageMs <= maxAgeHours * 60 * 60_000
}

const boundaryPlaceholders = new Set([
  'na', 'none', 'null', 'unknown',
  '无', '暂无', '未知', '待定', '待补充', '待观察', '等待结构化验证',
])
const boundaryPlaceholderPattern = /(?:待补充|占位|稍后补充|todo|tbd|placeholder)/i

function validateBoundary(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  const meaningful = normalized.replace(/[\p{White_Space}\p{Cf}\p{P}\p{S}]/gu, '').toLowerCase()
  if (!meaningful || [...normalized].length > 600
    || boundaryPlaceholders.has(meaningful) || boundaryPlaceholderPattern.test(meaningful)) return null
  return normalized
}

export function validateAiSummary(value) {
  if (!value || typeof value !== 'object') return null
  const enums = {
    direction: ['bullish', 'bearish', 'mixed', 'neutral'],
    horizon: ['intraday', 'days', 'weeks'],
  }
  const required = ['titleZh', 'summaryZh', 'whyItMattersZh', 'eventType', 'direction', 'horizon', 'systemJudgment']
  if (!required.every(key => typeof value[key] === 'string' && value[key].trim())) return null
  if (!enums.direction.includes(value.direction) || !enums.horizon.includes(value.horizon)) return null
  const watchFor = validateBoundary(value.watchFor)
  const invalidation = validateBoundary(value.invalidation)
  if (!watchFor || !invalidation) return null
  return {
    titleZh: value.titleZh.trim().slice(0, 160),
    summaryZh: value.summaryZh.trim().slice(0, 800),
    whyItMattersZh: value.whyItMattersZh.trim().slice(0, 600),
    eventType: value.eventType.trim().slice(0, 80),
    direction: value.direction,
    horizon: value.horizon,
    systemJudgment: value.systemJudgment.trim().slice(0, 400),
    watchFor,
    invalidation,
  }
}

export function hasCompleteAiV2Boundaries(value) {
  if (!value || value.ai_schema_version !== 'v2') return false
  return Boolean(validateBoundary(value.watch_for_zh) && validateBoundary(value.invalidation_zh))
}

export function calculateReturn(start, end) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0) return null
  return (end - start) / start
}

export function calculateExcess(assetReturn, benchmarkReturn) {
  if (!Number.isFinite(assetReturn) || !Number.isFinite(benchmarkReturn)) return null
  return assetReturn - benchmarkReturn
}

export function nearestPrice(series, target, toleranceMinutes = 8) {
  const targetMs = new Date(target).getTime()
  const toleranceMs = toleranceMinutes * 60_000
  const candidate = series.reduce((best, point) => {
    const distance = Math.abs(new Date(point.at).getTime() - targetMs)
    return !best || distance < best.distance ? { distance, close: point.close } : best
  }, null)
  return candidate && candidate.distance <= toleranceMs ? candidate.close : null
}
