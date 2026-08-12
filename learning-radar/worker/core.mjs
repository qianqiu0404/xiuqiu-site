import { getDomain } from 'tldts'
import { LEARNING_CATEGORIES } from './config.mjs'

const placeholders = new Set([
  '', 'na', 'n/a', 'none', 'null', 'unknown', 'todo', 'tbd', 'placeholder',
  '无', '暂无', '未知', '待定', '待补充', '等待补充',
])
const placeholderPattern = /(?:placeholder|example\.(?:com|org|net)|\btodo\b|\btbd\b|待补充|占位|稍后补充)/i

export function compactText(value, max) {
  const text = String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return [...text].slice(0, max).join('')
}

export function isPlaceholder(value) {
  const normalized = compactText(value, 1_000).toLowerCase()
  return placeholders.has(normalized) || placeholderPattern.test(normalized)
}

export function normalizeLearningUrl(input) {
  const url = new URL(String(input || ''))
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('source_url_not_public_https')
  for (const key of [...url.searchParams.keys()]) {
    if (/^(?:utm_|fbclid$|gclid$|mc_(?:cid|eid)$)/i.test(key)) url.searchParams.delete(key)
  }
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

export function normalizeLearningTitle(input) {
  return compactText(input, 500).toLowerCase().normalize('NFKC')
    .replace(/\b(?:version|release|released|releases|announcing|announcement)\b/g, ' ')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .replace(/\b(?:the|a|an|and|for|with|from|of|to|in|on)\b/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function titleTokens(input) {
  return new Set(normalizeLearningTitle(input).split(' ').filter(token => token.length > 1))
}

export function learningTitleSimilarity(left, right) {
  const a = titleTokens(left)
  const b = titleTokens(right)
  if (!a.size || !b.size) return 0
  const intersection = [...a].filter(token => b.has(token)).length
  return intersection / (a.size + b.size - intersection)
}

export function areLearningItemsInSameCluster(left, right) {
  if (left.category !== right.category) return false
  const distance = Math.abs(Date.parse(left.publishedAt) - Date.parse(right.publishedAt))
  if (!Number.isFinite(distance) || distance > 48 * 60 * 60_000) return false
  return learningTitleSimilarity(left.title, right.title) >= 0.42
}

export function learningClusterKey(item) {
  return `${item.category}:${normalizeLearningTitle(item.title).split(' ').sort().slice(0, 10).join('-')}`.slice(0, 180)
}

export function registrableDomain(input) {
  const hostname = new URL(normalizeLearningUrl(input)).hostname.toLowerCase()
  const domain = getDomain(hostname, { allowPrivateDomains: false })
  if (!domain) throw new Error('source_domain_not_registrable')
  return domain.toLowerCase()
}

export function isAihotDiscovery(value) {
  try {
    const hostname = new URL(String(value || '')).hostname.toLowerCase()
    return hostname === 'aihot.virxact.com' || hostname.endsWith('.aihot.virxact.com')
  } catch {
    return false
  }
}

export function normalizeLearningItem(input, { now = new Date() } = {}) {
  if (!input || typeof input !== 'object') throw new Error('normalized_item_invalid')
  const category = String(input.category || '')
  if (!LEARNING_CATEGORIES.includes(category)) throw new Error('normalized_item_category_invalid')
  const provider = compactText(input.provider, 80)
  const providerId = compactText(input.providerId, 240)
  const title = compactText(input.title, 500)
  const excerpt = compactText(input.excerpt, 4_000)
  const sourceUrl = normalizeLearningUrl(input.sourceUrl)
  const publishedAt = new Date(input.publishedAt)
  const nowMs = new Date(now).getTime()
  if (!provider || !providerId || isPlaceholder(title)) throw new Error('normalized_item_required_field_missing')
  if (Number.isNaN(publishedAt.getTime())
    || publishedAt.getTime() > nowMs + 60 * 60_000
    || publishedAt.getTime() < nowMs - 30 * 24 * 60 * 60_000) {
    throw new Error('normalized_item_published_at_invalid')
  }
  return {
    provider,
    providerId,
    category,
    title,
    excerpt,
    sourceUrl,
    sourceDomain: new URL(sourceUrl).hostname.toLowerCase(),
    registrableDomain: registrableDomain(sourceUrl),
    publishedAt: publishedAt.toISOString(),
    isOfficial: input.isOfficial === true && !isAihotDiscovery(input.discoveredVia),
    discoveredVia: compactText(input.discoveredVia, 500) || provider,
    sourceName: compactText(input.sourceName, 160) || provider,
    originVerifiedAt: input.originVerifiedAt ? new Date(input.originVerifiedAt).toISOString() : null,
    verificationState: input.verificationState === 'verified' ? 'verified' : 'unverified',
    verificationError: compactText(input.verificationError, 160) || null,
    rawPayload: input.rawPayload && typeof input.rawPayload === 'object' ? input.rawPayload : {},
  }
}

function meaningful(value, max) {
  const text = compactText(value, max)
  return text && !isPlaceholder(text) ? text : null
}

export function validateLearningAiOutput(value) {
  if (!value || typeof value !== 'object') return null
  const titleZh = meaningful(value.titleZh, 160)
  const summaryZh = meaningful(value.summaryZh, 800)
  const whySelectedZh = meaningful(value.whySelectedZh, 600)
  const importance = ['key', 'noteworthy', 'watch'].includes(value.importance) ? value.importance : null
  const internalScore = Number(value.internalScore)
  if (!titleZh || !summaryZh || !whySelectedZh || !importance
    || !Number.isInteger(internalScore) || internalScore < 0 || internalScore > 100
    || typeof value.hasConflict !== 'boolean') return null
  return {
    titleZh,
    summaryZh,
    whySelectedZh,
    importance,
    internalScore,
    hasConflict: value.hasConflict,
  }
}

export function decideLearningPublication({ analysis, sources, now = new Date() }) {
  if (!analysis) return { publish: false, basis: null, reason: 'ai_invalid' }
  if (analysis.hasConflict) return { publish: false, basis: null, reason: 'source_conflict' }
  const nowMs = new Date(now).getTime()
  const verified = sources.filter(source => {
    const timestamp = Date.parse(source.publishedAt)
    return source.verificationState === 'verified' && source.originVerifiedAt
      && Number.isFinite(timestamp) && timestamp <= nowMs + 60 * 60_000
      && timestamp >= nowMs - 30 * 24 * 60 * 60_000
  })
  const official = verified.some(source => source.isOfficial && !isAihotDiscovery(source.discoveredVia))
  if (official) return { publish: true, basis: 'official_primary', reason: null }
  const domains = new Set(verified.map(source => source.registrableDomain).filter(Boolean))
  if (domains.size >= 2) return { publish: true, basis: 'independent_domains', reason: null }
  return { publish: false, basis: null, reason: verified.length ? 'insufficient_confirmation' : 'origin_unverified' }
}

function conflictText(source) {
  return compactText(`${source.title || ''} ${source.excerpt || ''}`, 4_000).normalize('NFKC').toLowerCase()
}

function normalizedDates(source) {
  const dates = new Set()
  const text = conflictText(source)
  const pattern = /\b(20\d{2})\s*[-/.年]\s*(0?[1-9]|1[0-2])\s*[-/.月]\s*(0?[1-9]|[12]\d|3[01])\s*日?\b/g
  for (const match of text.matchAll(pattern)) {
    const [, year, month, day] = match
    const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    const parsed = new Date(`${normalized}T00:00:00Z`)
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === normalized) dates.add(normalized)
  }
  return [...dates].sort()
}

function keyNumberFacts(source) {
  const text = conflictText(source)
  const facts = new Map()
  const patterns = [
    { kind: 'version', regex: /\bv(?:ersion)?\s*(\d+(?:\.\d+){1,3})\b/gi, unit: 'version' },
    { kind: 'percent', regex: /(-?\d+(?:\.\d+)?)\s*(%|percent|percentage points?|百分点)/gi, unit: 'percent' },
    { kind: 'money', regex: /(?:\b(?:usd|us\$|\$)\s*)(\d+(?:\.\d+)?)\s*(k|m|b|thousand|million|billion)?\b/gi, unit: 'usd' },
    { kind: 'count', regex: /\b(\d+(?:\.\d+)?)\s*(users?|developers?|wallets?|chains?|tokens?|days?|hours?|天|小时|用户|开发者|钱包|链)\b/gi },
  ]
  for (const definition of patterns) {
    for (const match of text.matchAll(definition.regex)) {
      const value = String(match[1]).toLowerCase()
      const unit = definition.unit || String(match[2]).toLowerCase()
      const start = Math.max(0, (match.index || 0) - 48)
      const end = Math.min(text.length, (match.index || 0) + match[0].length + 48)
      const context = normalizeLearningTitle(text.slice(start, end).replace(match[0], ' '))
        .split(' ').filter(Boolean).slice(0, 10).join(' ')
      if (!context) continue
      const key = `${definition.kind}:${unit}:${context}`
      if (!facts.has(key)) facts.set(key, new Set())
      facts.get(key).add(value)
    }
  }
  return facts
}

function propositionPolarity(source) {
  const text = conflictText(source)
  const negativePattern = /\b(?:will not|won't|does not|doesn't|did not|didn't|is not|isn't|are not|aren't|never|no longer|cancel(?:led|s)?)\b|(?:不会|不再|并未|未能|没有|取消|停止)/i
  const positivePattern = /\b(?:will|does|did|is|are|has|have|launch(?:es|ed)?|support(?:s|ed)?)\b|(?:将会|将|会|已经|已|支持|上线|推出)/i
  const negative = negativePattern.test(text)
  const positive = positivePattern.test(text)
  const proposition = text
    .replace(/\b(?:not|n't|never|no longer)\b|(?:不再|并未|未能|没有|不|未)/gi, ' ')
    .replace(/\s+/g, ' ').trim()
  return { negative, positive, proposition }
}

function evidenceKey(evidence) {
  return JSON.stringify([evidence.kind, evidence.leftSourceUrl, evidence.rightSourceUrl, evidence.left, evidence.right])
}

/**
 * Detect only source-to-source contradictions that can be explained without AI.
 * Any hit is deliberately fail-closed: the story remains non-public until a later
 * editorial milestone records a resolution.
 */
export function detectLearningSourceConflicts(sources) {
  const verified = sources.filter(source => source.verificationState === 'verified' && source.originVerifiedAt)
  const evidence = []
  for (let leftIndex = 0; leftIndex < verified.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < verified.length; rightIndex += 1) {
      const left = verified[leftIndex]
      const right = verified[rightIndex]
      if (left.sourceUrl === right.sourceUrl) continue

      const leftDates = normalizedDates(left)
      const rightDates = normalizedDates(right)
      if (leftDates.length && rightDates.length && !leftDates.some(date => rightDates.includes(date))) {
        evidence.push({
          kind: 'event_date_mismatch', leftSourceUrl: left.sourceUrl, rightSourceUrl: right.sourceUrl,
          left: leftDates, right: rightDates,
        })
      }

      const leftNumbers = keyNumberFacts(left)
      const rightNumbers = keyNumberFacts(right)
      for (const [key, leftValues] of leftNumbers) {
        const rightValues = rightNumbers.get(key)
        if (!rightValues || [...leftValues].some(value => rightValues.has(value))) continue
        evidence.push({
          kind: 'key_number_mismatch', leftSourceUrl: left.sourceUrl, rightSourceUrl: right.sourceUrl,
          factKey: key, left: [...leftValues].sort(), right: [...rightValues].sort(),
        })
      }

      const leftPolarity = propositionPolarity(left)
      const rightPolarity = propositionPolarity(right)
      if (leftPolarity.negative !== rightPolarity.negative
        && (leftPolarity.negative || rightPolarity.negative)
        && leftPolarity.positive && rightPolarity.positive
        && learningTitleSimilarity(leftPolarity.proposition, rightPolarity.proposition) >= 0.62) {
        evidence.push({
          kind: 'negated_conclusion', leftSourceUrl: left.sourceUrl, rightSourceUrl: right.sourceUrl,
          left: leftPolarity.negative ? 'negative' : 'affirmative',
          right: rightPolarity.negative ? 'negative' : 'affirmative',
        })
      }
    }
  }
  const unique = [...new Map(evidence.map(item => [evidenceKey(item), item])).values()].slice(0, 20)
  return { hasConflict: unique.length > 0, evidence: unique }
}

export function encodeLearningSourceCursor(item) {
  return JSON.stringify({ publishedAt: item.publishedAt, providerId: item.providerId })
}

export function parseLearningSourceCursor(value) {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    if (!parsed?.providerId || Number.isNaN(Date.parse(parsed.publishedAt))) return null
    return { publishedAt: new Date(parsed.publishedAt).toISOString(), providerId: String(parsed.providerId) }
  } catch {
    return null
  }
}

export function selectItemsAfterCursor(items, cursor, overlapMs = 2 * 60 * 60_000) {
  if (!cursor) return [...items]
  const floor = Date.parse(cursor.publishedAt) - overlapMs
  return items.filter(item => Date.parse(item.publishedAt) >= floor)
}

export function newestLearningCursor(items, previous = null) {
  return items.reduce((current, item) => {
    if (!current) return { publishedAt: item.publishedAt, providerId: item.providerId }
    const timestamp = Date.parse(item.publishedAt)
    const currentTimestamp = Date.parse(current.publishedAt)
    if (timestamp > currentTimestamp || (timestamp === currentTimestamp && item.providerId > current.providerId)) {
      return { publishedAt: item.publishedAt, providerId: item.providerId }
    }
    return current
  }, previous)
}

export function learningHourSlot(now = new Date()) {
  return new Date(Math.floor(new Date(now).getTime() / 3_600_000) * 3_600_000).toISOString()
}
