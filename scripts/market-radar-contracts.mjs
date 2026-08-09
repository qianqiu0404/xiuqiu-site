import { assertPublicHttpUrl } from './public-data-contracts.mjs'

export const MARKET_RADAR_CATEGORIES = ['macro', 'crypto', 'equity', 'regulation']
export const MARKET_RADAR_PRIORITIES = ['P0', 'P1', 'P2']
export const MARKET_RADAR_STATUSES = ['scheduled', 'released', 'monitoring']
const TRADE_CALL_RE = /(?:买入|卖出|做多|做空|止损|止盈|目标价|\b(?:buy|sell|long|short|entry|stop[- ]?loss|take[- ]?profit)\b)/i
const PLACEHOLDER_RE = /(?:待补充|占位|稍后补充|\b(?:todo|tbd|placeholder)\b)/i

function assertText(value, label) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
    throw new Error(`${label} must be a trimmed non-empty string.`)
  }
  if (PLACEHOLDER_RE.test(value)) throw new Error(`${label} contains placeholder text.`)
  if (TRADE_CALL_RE.test(value)) throw new Error(`${label} must not contain an actionable trade call.`)
}

function assertDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must use YYYY-MM-DD.`)
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`${label} must be a valid date.`)
}

function assertIsoDateTime(value, label) {
  if (value == null) return
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be an ISO datetime.`)
}

function assertUniqueTextList(value, label, { min = 1, max = 8 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error(`${label} must contain ${min}-${max} items.`)
  const seen = new Set()
  value.forEach((item, index) => {
    assertText(item, `${label}[${index}]`)
    if (seen.has(item)) throw new Error(`${label} must not contain duplicates.`)
    seen.add(item)
  })
}

export function validateMarketRadar(entry, fileName = 'market radar') {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`${fileName}: entry must be an object.`)
  assertDate(entry.date, `${fileName}: date`)
  if (entry.slug !== entry.date) throw new Error(`${fileName}: slug must equal date.`)
  assertText(entry.title, `${fileName}: title`)
  assertText(entry.summary, `${fileName}: summary`)
  if (entry.publish !== true) throw new Error(`${fileName}: publish must be true.`)
  if (entry.reviewStatus !== 'automated') throw new Error(`${fileName}: reviewStatus must be automated.`)
  assertIsoDateTime(entry.generatedAt, `${fileName}: generatedAt`)
  if (!Array.isArray(entry.events) || entry.events.length < 1 || entry.events.length > 5) throw new Error(`${fileName}: events must contain 1-5 items.`)

  const eventIds = new Set()
  const eventUrls = new Set()
  entry.events.forEach((event, index) => {
    const label = `${fileName}: events[${index}]`
    if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error(`${label} must be an object.`)
    if (typeof event.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(event.id)) throw new Error(`${label}.id must be a slug.`)
    if (eventIds.has(event.id)) throw new Error(`${fileName}: event ids must be unique.`)
    eventIds.add(event.id)
    if (!MARKET_RADAR_PRIORITIES.includes(event.priority)) throw new Error(`${label}.priority is invalid.`)
    if (!MARKET_RADAR_STATUSES.includes(event.status)) throw new Error(`${label}.status is invalid.`)
    if (!MARKET_RADAR_CATEGORIES.includes(event.category)) throw new Error(`${label}.category is invalid.`)
    assertIsoDateTime(event.eventAt, `${label}.eventAt`)
    for (const field of ['title', 'fact', 'whyWatch', 'watchFor', 'invalidation', 'sourceName']) assertText(event[field], `${label}.${field}`)
    assertUniqueTextList(event.assets, `${label}.assets`)
    assertDate(event.sourcePublishedAt, `${label}.sourcePublishedAt`)
    assertPublicHttpUrl(event.sourceUrl, `${label}.sourceUrl`)
    const normalizedUrl = new URL(event.sourceUrl).href
    if (eventUrls.has(normalizedUrl)) throw new Error(`${fileName}: each event must use a distinct primary source.`)
    eventUrls.add(normalizedUrl)
  })

  if (!Array.isArray(entry.sourceUrls) || entry.sourceUrls.length !== eventUrls.size) throw new Error(`${fileName}: sourceUrls must match event sources.`)
  const declaredUrls = new Set(entry.sourceUrls.map((url, index) => {
    assertPublicHttpUrl(url, `${fileName}: sourceUrls[${index}]`)
    return new URL(url).href
  }))
  if (declaredUrls.size !== eventUrls.size || [...eventUrls].some(url => !declaredUrls.has(url))) throw new Error(`${fileName}: sourceUrls must exactly match event sources.`)
  return entry
}

export function assertMarketRadarArchive(entries) {
  const ids = new Set()
  const urls = new Set()
  for (const entry of entries) {
    for (const event of entry.events) {
      if (ids.has(event.id)) throw new Error(`Duplicate market event id: ${event.id}`)
      ids.add(event.id)
      const url = new URL(event.sourceUrl).href
      if (urls.has(url)) throw new Error(`Duplicate market event source: ${url}`)
      urls.add(url)
    }
  }
}
