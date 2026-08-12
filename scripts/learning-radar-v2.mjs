import { assertPublicHttpUrl } from './public-data-contracts.mjs'
import { assertResearchPublication } from './radar-publication-boundary.mjs'

export const LEARNING_SCHEMA_VERSION = 2
export const LEARNING_DOMAINS = ['ai', 'web3']
export const LEARNING_TOPICS = {
  ai: ['model_inference', 'agent', 'evaluation', 'safety', 'data', 'infrastructure'],
  web3: ['wallet_cex', 'mpc', 'security', 'protocol', 'l2', 'cross_chain', 'onchain_infrastructure'],
}

const SOURCE_TIERS = ['tier1', 'tier2']
const SOURCE_ROLES = ['event', 'mechanism']
const BLOCKED_FINAL_HOSTS = new Set([
  'aihot.virxact.com',
  'x.com',
  'twitter.com',
  'www.reddit.com',
  'reddit.com',
  'discord.com',
  'discord.gg',
])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function requiredString(value, label, minimum = 1) {
  if (typeof value !== 'string' || value.trim().length < minimum) {
    throw new Error(`${label} must contain at least ${minimum} characters.`)
  }
  return value.trim()
}

function requiredStringList(value, label) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must contain at least one item.`)
  return value.map((item, index) => requiredString(item, `${label}[${index}]`, 8))
}

function timestamp(value, label) {
  const normalized = requiredString(value, label)
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} must be an ISO timestamp.`)
  return parsed
}

function normalizedUrl(value) {
  const url = new URL(value)
  url.hash = ''
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/$/, '')
  return url.toString()
}

function validateSource(source, label, editionDate) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error(`${label} must be an object.`)
  if (!SOURCE_TIERS.includes(source.tier)) throw new Error(`${label}.tier must be tier1 or tier2.`)
  if (!SOURCE_ROLES.includes(source.role)) throw new Error(`${label}.role must be event or mechanism.`)
  const kind = requiredString(source.kind, `${label}.kind`, 3)
  const name = requiredString(source.name, `${label}.name`, 4)
  const url = requiredString(source.url, `${label}.url`)
  assertPublicHttpUrl(url, `${label}.url`)
  const host = new URL(url).hostname.toLowerCase()
  if (BLOCKED_FINAL_HOSTS.has(host)) throw new Error(`${label}.url is discovery-only and cannot be a final source.`)

  let publishedAt
  if (source.publishedAt != null) {
    publishedAt = timestamp(source.publishedAt, `${label}.publishedAt`).toISOString()
    const endOfEdition = new Date(`${editionDate}T23:59:59.999+08:00`)
    if (new Date(publishedAt) > endOfEdition) throw new Error(`${label}.publishedAt is later than the edition date.`)
  }
  if (source.role === 'event' && !publishedAt) throw new Error(`${label}.publishedAt is required for event evidence.`)
  return { tier: source.tier, role: source.role, kind, name, url, ...(publishedAt ? { publishedAt } : {}) }
}

function validateBrief(brief, label, editionDate) {
  if (!brief || typeof brief !== 'object' || Array.isArray(brief)) throw new Error(`${label} must be an object.`)
  const id = requiredString(brief.id, `${label}.id`, 4)
  if (!LEARNING_DOMAINS.includes(brief.domain)) throw new Error(`${label}.domain must be ai or web3.`)
  if (!LEARNING_TOPICS[brief.domain].includes(brief.topic)) throw new Error(`${label}.topic is not allowed for ${brief.domain}.`)
  const title = requiredString(brief.title, `${label}.title`, 8)
  const whatHappened = requiredString(brief.whatHappened, `${label}.whatHappened`, 24)
  const mechanism = requiredString(brief.mechanism, `${label}.mechanism`, 24)
  const workedExample = requiredString(brief.workedExample, `${label}.workedExample`, 24)
  const whyItMatters = requiredString(brief.whyItMatters, `${label}.whyItMatters`, 24)
  const risksAndLimits = requiredStringList(brief.risksAndLimits, `${label}.risksAndLimits`)
  const nextQuestions = requiredStringList(brief.nextQuestions, `${label}.nextQuestions`)
  if (!Array.isArray(brief.sources) || brief.sources.length === 0) throw new Error(`${label}.sources must contain at least one source.`)
  const sources = brief.sources.map((source, index) => validateSource(source, `${label}.sources[${index}]`, editionDate))
  const sourceKeys = sources.map(source => normalizedUrl(source.url))
  if (new Set(sourceKeys).size !== sourceKeys.length) throw new Error(`${label}.sources must not contain duplicate URLs.`)
  if (!sources.some(source => source.tier === 'tier1' && source.role === 'event' && source.publishedAt)) {
    throw new Error(`${label} requires a dated Tier 1 event source.`)
  }
  if (brief.discoveredVia != null) {
    assertPublicHttpUrl(brief.discoveredVia, `${label}.discoveredVia`)
    if (!BLOCKED_FINAL_HOSTS.has(new URL(brief.discoveredVia).hostname.toLowerCase())) {
      throw new Error(`${label}.discoveredVia must be a configured discovery-only source.`)
    }
  }
  return {
    id, domain: brief.domain, topic: brief.topic, title, whatHappened, mechanism, workedExample,
    whyItMatters, risksAndLimits, sources, nextQuestions,
  }
}

export function collectLearningSourceUrls(edition) {
  const sources = [...(edition.briefs || []).flatMap(brief => brief.sources || []), ...(edition.deepDive?.sources || [])]
  return [...new Set(sources.map(source => String(source.url)))]
}

export function validateLearningEditionV2(edition, label = 'learning edition v2') {
  assertResearchPublication(edition, label)
  const errors = []
  if (edition?.schemaVersion !== LEARNING_SCHEMA_VERSION) errors.push('schemaVersion must be 2.')
  if (!['daily', 'backfill'].includes(edition?.editionMode)) errors.push('editionMode must be daily or backfill.')
  if (!DATE_RE.test(edition?.date || '')) errors.push('date must use YYYY-MM-DD.')
  if (edition?.slug !== edition?.date) errors.push('slug must equal date.')
  if (edition?.publish !== true) errors.push('publish must be true.')
  if (edition?.reviewStatus !== 'automated') errors.push('reviewStatus must be automated.')
  try { timestamp(edition?.researchedAt, 'researchedAt') } catch (error) { errors.push(error.message) }
  if (!Array.isArray(edition?.briefs) || edition.briefs.length !== 4) errors.push('briefs must contain exactly 4 items.')
  if (errors.length) throw new Error(errors.join('\n'))

  const briefs = []
  for (let index = 0; index < edition.briefs.length; index += 1) {
    try { briefs.push(validateBrief(edition.briefs[index], `briefs[${index}]`, edition.date)) }
    catch (error) { errors.push(error instanceof Error ? error.message : String(error)) }
  }
  const ids = briefs.map(brief => brief.id)
  if (new Set(ids).size !== ids.length) errors.push('brief ids must be unique.')
  for (const domain of LEARNING_DOMAINS) {
    const domainBriefs = briefs.filter(brief => brief.domain === domain)
    if (domainBriefs.length !== 2) errors.push(`${domain} must contain exactly 2 briefs.`)
    if (new Set(domainBriefs.map(brief => brief.topic)).size !== domainBriefs.length) errors.push(`${domain} briefs must use different topics.`)
  }
  const briefSourceKeys = briefs.flatMap(brief => brief.sources.map(source => normalizedUrl(source.url)))
  if (new Set(briefSourceKeys).size !== briefSourceKeys.length) errors.push('brief event and mechanism sources must not duplicate across the edition.')

  let deepDive
  try {
    deepDive = validateBrief(edition.deepDive, 'deepDive', edition.date)
    const basedOn = requiredString(edition.deepDive.basedOnBriefId, 'deepDive.basedOnBriefId', 4)
    const parent = briefs.find(brief => brief.id === basedOn)
    if (!parent) errors.push('deepDive.basedOnBriefId must reference one of the four briefs.')
    else if (deepDive.domain !== parent.domain) errors.push('deepDive.domain must match its referenced brief.')
    if (deepDive.sources.length < 2) errors.push('deepDive must contain at least 2 sources.')
    if (!deepDive.sources.some(source => source.tier === 'tier1')) errors.push('deepDive must contain a Tier 1 source.')
    deepDive = { ...deepDive, basedOnBriefId: basedOn }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
  }
  if (errors.length) throw new Error(errors.join('\n'))
  return { briefs, deepDive }
}

export function normalizeLearningEditionV2(meta) {
  const { briefs, deepDive } = validateLearningEditionV2(meta)
  const normalized = {
    date: String(meta.date), slug: String(meta.slug), title: String(meta.title), summary: String(meta.summary),
    publish: true, reviewStatus: 'automated', schemaVersion: 2, editionMode: meta.editionMode,
    researchedAt: new Date(meta.researchedAt).toISOString(), generatedAt: new Date(meta.researchedAt).toISOString(),
    sourceSections: ['ai', 'web3', 'deepDive'], missingSections: [], briefs, deepDive,
    sourceUrls: collectLearningSourceUrls({ briefs, deepDive }),
    relatedProjectSlugs: Array.isArray(meta.relatedProjectSlugs) ? meta.relatedProjectSlugs.map(String) : [],
    marketSignals: [],
  }
  return normalized
}
