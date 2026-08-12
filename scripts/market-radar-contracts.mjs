import { createHash } from 'node:crypto'
import { assertPublicHttpUrl } from './public-data-contracts.mjs'
import { assertResearchPublication } from './radar-publication-boundary.mjs'

export const MARKET_RADAR_CATEGORIES = ['macro', 'crypto', 'equity', 'regulation']
export const MARKET_RADAR_PRIORITIES = ['P0', 'P1', 'P2']
export const MARKET_RADAR_STATUSES = ['scheduled', 'released', 'monitoring']
export const MARKET_QUANT_SYMBOLS = ['SPY', 'QQQ', 'BTC', 'ETH', 'GLD']
export const MARKET_QUANT_STATUSES = ['heuristic_unbacktested', 'historical_samples_insufficient']
export const MARKET_RESEARCH_LENSES = ['transmission', 'falsification', 'scenario']
const MARKET_QUANT_REQUIRED_FROM = '2026-08-10'
const MARKET_QUANT_SAMPLE_GATE_FROM = '2026-08-11'
const MARKET_RESEARCH_REQUIRED_FROM = '2026-08-13'
const MARKET_SIGNAL_QUALITIES = ['strong', 'medium', 'weak']
const MARKET_QUANT_GROUPS = {
  SPY: 'us_equity_etf',
  QQQ: 'us_equity_etf',
  BTC: 'crypto',
  ETH: 'crypto',
  GLD: 'gold_etf',
}
const TRADE_CALL_RE = /(?:买入|卖出|做多|做空|止损|止盈|目标价|\b(?:buy|sell|long|short|entry|stop[- ]?loss|take[- ]?profit)\b)/i
const PLACEHOLDER_RE = /(?:待补充|占位|稍后补充|\b(?:todo|tbd|placeholder)\b)/i
const RESEARCH_QUESTION_IDS = ['1', '2', '3']
const RESEARCH_PROMPT_MAX_LENGTH = 1500
const SITE_URL = 'https://xiuqiu-site.vercel.app'

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

function validateQuantStrategy(strategy, entry, fileName) {
  const label = `${fileName}: quantStrategy`
  if (!strategy || typeof strategy !== 'object' || Array.isArray(strategy)) {
    throw new Error(`${label} must be an object.`)
  }
  if (!Number.isInteger(strategy.horizonTradingDays) || strategy.horizonTradingDays < 1 || strategy.horizonTradingDays > 10) {
    throw new Error(`${label}.horizonTradingDays must be an integer between 1 and 10.`)
  }
  if (!MARKET_QUANT_STATUSES.includes(strategy.status)) {
    throw new Error(`${label}.status is unsupported.`)
  }
  if (entry.date >= MARKET_QUANT_SAMPLE_GATE_FROM && strategy.status !== 'historical_samples_insufficient') {
    throw new Error(`${label}.status must be historical_samples_insufficient until backtested evidence is available.`)
  }
  for (const field of ['methodology', 'rationale', 'nextValidation', 'invalidation']) {
    assertText(strategy[field], `${label}.${field}`)
  }
  if (!Array.isArray(strategy.assets) || strategy.assets.length !== MARKET_QUANT_SYMBOLS.length) {
    throw new Error(`${label}.assets must contain ${MARKET_QUANT_SYMBOLS.length} required assets.`)
  }
  const symbols = new Set()
  strategy.assets.forEach((asset, index) => {
    const assetLabel = `${label}.assets[${index}]`
    if (!asset || typeof asset !== 'object' || Array.isArray(asset)) throw new Error(`${assetLabel} must be an object.`)
    if (!MARKET_QUANT_SYMBOLS.includes(asset.symbol)) throw new Error(`${assetLabel}.symbol is unsupported.`)
    if (symbols.has(asset.symbol)) throw new Error(`${label}.assets must not repeat symbols.`)
    symbols.add(asset.symbol)
    if (asset.group !== MARKET_QUANT_GROUPS[asset.symbol]) throw new Error(`${assetLabel}.group is invalid for ${asset.symbol}.`)
    if (strategy.status === 'heuristic_unbacktested') {
      for (const field of ['up', 'sideways', 'down']) {
        if (!Number.isInteger(asset[field]) || asset[field] < 0 || asset[field] > 100) {
          throw new Error(`${assetLabel}.${field} must be an integer from 0 to 100.`)
        }
      }
      if (asset.up + asset.sideways + asset.down !== 100) {
        throw new Error(`${assetLabel} probabilities must sum to 100.`)
      }
    } else {
      if (!MARKET_SIGNAL_QUALITIES.includes(asset.signalQuality)) throw new Error(`${assetLabel}.signalQuality is invalid.`)
      if (['up', 'sideways', 'down'].some(field => Object.hasOwn(asset, field))) {
        throw new Error(`${assetLabel} must not publish exact probabilities without backtested evidence.`)
      }
    }
  })
  if (symbols.size !== MARKET_QUANT_SYMBOLS.length || MARKET_QUANT_SYMBOLS.some(symbol => !symbols.has(symbol))) {
    throw new Error(`${label}.assets must include ${MARKET_QUANT_SYMBOLS.join(', ')}.`)
  }
  if (strategy.status === 'historical_samples_insufficient') {
    if (!Number.isInteger(strategy.sampleSize) || strategy.sampleSize < 0 || strategy.sampleSize >= 50) {
      throw new Error(`${label}.sampleSize must be an integer from 0 to 49 while evidence is insufficient.`)
    }
  }
  if (!Array.isArray(strategy.sourceUrls) || strategy.sourceUrls.length < 1 || strategy.sourceUrls.length > 8) {
    throw new Error(`${label}.sourceUrls must contain 1-8 items.`)
  }
  const entrySources = new Set(entry.sourceUrls.map(url => new URL(url).href))
  const strategySources = new Set(strategy.sourceUrls.map((url, index) => {
    assertPublicHttpUrl(url, `${label}.sourceUrls[${index}]`)
    return new URL(url).href
  }))
  if (strategySources.size !== strategy.sourceUrls.length) throw new Error(`${label}.sourceUrls must not contain duplicates.`)
  if ([...strategySources].some(url => !entrySources.has(url))) {
    throw new Error(`${label}.sourceUrls must be a subset of the daily radar sources.`)
  }
}

function validateResearchQuestions(entry, eventIds, fileName) {
  if (entry.date >= MARKET_RESEARCH_REQUIRED_FROM && entry.schemaVersion !== 2) {
    throw new Error(`${fileName}: schemaVersion 2 researchQuestions are required from ${MARKET_RESEARCH_REQUIRED_FROM}.`)
  }
  if (entry.schemaVersion == null || entry.schemaVersion === 1) {
    if (entry.researchQuestions != null) throw new Error(`${fileName}: researchQuestions require schemaVersion 2.`)
    return
  }
  if (entry.schemaVersion !== 2) throw new Error(`${fileName}: schemaVersion must be 1 or 2.`)
  if (!Array.isArray(entry.researchQuestions) || entry.researchQuestions.length !== 3) {
    throw new Error(`${fileName}: schemaVersion 2 requires exactly 3 researchQuestions.`)
  }

  const shortQuestions = new Set()
  entry.researchQuestions.forEach((question, index) => {
    const label = `${fileName}: researchQuestions[${index}]`
    if (!question || typeof question !== 'object' || Array.isArray(question)) throw new Error(`${label} must be an object.`)
    if (question.id !== RESEARCH_QUESTION_IDS[index]) throw new Error(`${label}.id must be ${RESEARCH_QUESTION_IDS[index]}.`)
    if (question.lens !== MARKET_RESEARCH_LENSES[index]) throw new Error(`${label}.lens must be ${MARKET_RESEARCH_LENSES[index]}.`)
    assertText(question.shortQuestion, `${label}.shortQuestion`)
    if (question.shortQuestion.length > 180) throw new Error(`${label}.shortQuestion must not exceed 180 characters.`)
    if (shortQuestions.has(question.shortQuestion)) throw new Error(`${fileName}: researchQuestions must use distinct shortQuestion values.`)
    shortQuestions.add(question.shortQuestion)
    if (!Array.isArray(question.focusEventIds) || question.focusEventIds.length < 1 || question.focusEventIds.length > 2) {
      throw new Error(`${label}.focusEventIds must contain 1-2 event ids.`)
    }
    const focused = new Set(question.focusEventIds)
    if (focused.size !== question.focusEventIds.length) throw new Error(`${label}.focusEventIds must not contain duplicates.`)
    for (const eventId of focused) {
      if (typeof eventId !== 'string' || !eventIds.has(eventId)) throw new Error(`${label}.focusEventIds must reference a daily event.`)
      const focusedEvent = entry.events.find(event => event.id === eventId)
      if (new URL(focusedEvent.sourceUrl).protocol !== 'https:') {
        throw new Error(`${label}.focusEventIds must reference HTTPS primary sources.`)
      }
    }
  })
}

function lensInstruction(lens) {
  if (lens === 'transmission') return '解释事件到相关资产的传导链，逐步指出每一环需要什么公开证据。'
  if (lens === 'falsification') return '提出最有力的反证，并列出可支持或推翻当前解释的跨资产验证指标。'
  return '建立基准、上行与下行情景，说明触发条件、待验证事项和判断失效条件。'
}

export function buildMarketResearchPack(entry, publication = entry) {
  const eventIds = new Set((entry.events || []).map(event => event.id))
  validateResearchQuestions(entry, eventIds, 'market research pack')
  if (entry.schemaVersion !== 2) return undefined
  if (typeof publication.snapshotId !== 'string' || !publication.snapshotId.startsWith(`market-${entry.date}-`)) {
    throw new Error('market research pack requires the matching market snapshotId.')
  }
  if (typeof publication.asOf !== 'string' || Number.isNaN(Date.parse(publication.asOf))) {
    throw new Error('market research pack requires a valid asOf.')
  }
  if (publication.origin !== 'research' || publication.publicationState !== 'published') {
    throw new Error('market research pack requires a published research snapshot.')
  }

  const questions = entry.researchQuestions.map(question => {
    const focusedEvents = question.focusEventIds.map(eventId => entry.events.find(event => event.id === eventId))
    const evidence = focusedEvents.map((event, index) => [
      `材料 ${index + 1}｜${event.title}`,
      `已确认事实：${event.fact}`,
      `关注机制：${event.whyWatch}`,
      `接下来验证：${event.watchFor}`,
      `失效条件：${event.invalidation}`,
      `一手来源：${event.sourceUrl}`,
    ].join('\n')).join('\n\n')
    const prompt = [
      `研究任务：${question.shortQuestion}`,
      `证据快照：${entry.date}；asOf=${new Date(publication.asOf).toISOString()}；snapshotId=${publication.snapshotId}`,
      '',
      evidence,
      '',
      `分析镜头：${lensInstruction(question.lens)}`,
      '输出顺序：结论；已确认事实；因果链；最强反证；验证指标；失效条件；仍未知。',
      '证据契约：所有新增数字必须附公开来源与 asOf；晚于本快照的信息单独列出；无法浏览来源时明确说明。事实、推断与待验证事项必须分开。',
      '边界：不得编造概率、价格或机构观点；不得给出买卖、仓位、止损、目标价或收益承诺；量化样本门禁关闭时不得自行补精确概率。',
    ].join('\n')
    if (prompt.length > RESEARCH_PROMPT_MAX_LENGTH) {
      throw new Error(`market research question ${question.id} prompt exceeds ${RESEARCH_PROMPT_MAX_LENGTH} characters.`)
    }
    return {
      id: question.id,
      lens: question.lens,
      shortQuestion: question.shortQuestion,
      focusEventIds: [...question.focusEventIds],
      prompt,
      promptChecksum: createHash('sha256').update(prompt).digest('hex'),
      sourceUrls: focusedEvents.map(event => event.sourceUrl),
    }
  })

  return {
    schemaVersion: 2,
    date: entry.date,
    snapshotId: publication.snapshotId,
    asOf: new Date(publication.asOf).toISOString(),
    origin: 'research',
    publicationState: 'published',
    pageUrl: `${SITE_URL}/market-radar/${entry.date}`,
    questions,
  }
}

export function validateMarketRadar(entry, fileName = 'market radar') {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`${fileName}: entry must be an object.`)
  assertResearchPublication(entry, fileName)
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
  validateResearchQuestions(entry, eventIds, fileName)
  if (entry.date >= MARKET_QUANT_REQUIRED_FROM && !entry.quantStrategy) {
    throw new Error(`${fileName}: quantStrategy is required from ${MARKET_QUANT_REQUIRED_FROM}.`)
  }
  if (entry.quantStrategy) validateQuantStrategy(entry.quantStrategy, entry, fileName)
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
