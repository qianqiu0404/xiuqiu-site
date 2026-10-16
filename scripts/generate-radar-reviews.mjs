// Generates trend reviews (multi-week retrospectives) from content/radar-reviews.
// A review is a separate content type from daily editions and weeklies, so the
// frozen daily/weekly schemas stay untouched.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { parseMarkdownFrontmatter } from './frontmatter.mjs'
import { assertPublicHttpUrl } from './public-data-contracts.mjs'

const CONTENT_DIR = new URL('../content/radar-reviews/', import.meta.url)
const OUTPUT_URL = new URL('../src/data/generatedRadarReviews.ts', import.meta.url)
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DOMAINS = ['ai', 'web3']
const POLICY = JSON.parse(readFileSync(new URL('../config/researchops-learning-radar.json', import.meta.url), 'utf8'))
const BLOCKED_HOSTS = new Set(POLICY.blockedFinalSourceHosts)

function text(value, label, minimum = 8) {
  if (typeof value !== 'string' || value.trim().length < minimum || value !== value.trim()) {
    throw new Error(`${label} must be a trimmed string of at least ${minimum} characters.`)
  }
  return value
}

function date(value, label) {
  const normalized = value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '')
  if (!DATE_RE.test(normalized)) throw new Error(`${label} must use YYYY-MM-DD.`)
  return normalized
}

export function validateRadarReview(meta, fileName = 'review') {
  const slug = text(meta.slug, `${fileName}.slug`, 10)
  const periodStart = date(meta.periodStart, `${fileName}.periodStart`)
  const periodEnd = date(meta.periodEnd, `${fileName}.periodEnd`)
  if (slug !== `${periodStart}--${periodEnd}`) throw new Error(`${fileName}: slug must be periodStart--periodEnd.`)
  if (periodStart >= periodEnd) throw new Error(`${fileName}: periodStart must be before periodEnd.`)
  if (meta.reviewStatus !== 'automated') throw new Error(`${fileName}: reviewStatus must be automated.`)
  if (!Array.isArray(meta.trends) || meta.trends.length < 2) throw new Error(`${fileName}: trends must contain at least 2 items.`)

  const ids = new Set()
  const trends = meta.trends.map((trend, index) => {
    const label = `${fileName}.trends[${index}]`
    const id = text(trend.id, `${label}.id`, 4)
    if (ids.has(id)) throw new Error(`${label}.id must be unique.`)
    ids.add(id)
    if (!DOMAINS.includes(trend.domain)) throw new Error(`${label}.domain must be ai or web3.`)
    if (!POLICY.topics[trend.domain].includes(trend.topic)) throw new Error(`${label}.topic is not allowed for ${trend.domain}.`)
    if (!Array.isArray(trend.milestones) || trend.milestones.length === 0) throw new Error(`${label}.milestones must not be empty.`)
    const milestones = trend.milestones.map((milestone, milestoneIndex) => {
      const milestoneLabel = `${label}.milestones[${milestoneIndex}]`
      const milestoneDate = date(milestone.date, `${milestoneLabel}.date`)
      if (milestoneDate < periodStart || milestoneDate > periodEnd) throw new Error(`${milestoneLabel}.date is outside the review period.`)
      assertPublicHttpUrl(milestone.url, `${milestoneLabel}.url`)
      if (BLOCKED_HOSTS.has(new URL(milestone.url).hostname.toLowerCase())) throw new Error(`${milestoneLabel}.url is discovery-only.`)
      return { date: milestoneDate, text: text(milestone.text, `${milestoneLabel}.text`, 12), url: String(milestone.url) }
    })
    const sorted = [...milestones].sort((a, b) => a.date.localeCompare(b.date))
    if (sorted.some((milestone, i) => milestone !== milestones[i])) throw new Error(`${label}.milestones must be in date order.`)
    return {
      id, domain: trend.domain, topic: trend.topic,
      title: text(trend.title, `${label}.title`),
      thesis: text(trend.thesis, `${label}.thesis`, 24),
      signal: text(trend.signal, `${label}.signal`, 12),
      milestones,
      implication: text(trend.implication, `${label}.implication`, 16),
      falsifier: text(trend.falsifier, `${label}.falsifier`, 16),
    }
  })
  for (const domain of DOMAINS) {
    if (!trends.some(trend => trend.domain === domain)) throw new Error(`${fileName}: trends must cover ${domain}.`)
  }

  return {
    slug, periodStart, periodEnd,
    title: text(meta.title, `${fileName}.title`),
    summary: text(meta.summary, `${fileName}.summary`, 24),
    researchedAt: new Date(text(meta.researchedAt, `${fileName}.researchedAt`)).toISOString(),
    reviewStatus: 'automated',
    trends,
  }
}

export function loadRadarReviews(dir = CONTENT_DIR) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(name => name.endsWith('.md'))
    .map((name) => {
      const { meta } = parseMarkdownFrontmatter(readFileSync(new URL(name, dir), 'utf8'), name)
      if (meta.publish !== true) return undefined
      const review = validateRadarReview(meta, name)
      if (`${review.slug}.md` !== name) throw new Error(`${name}: file name must equal slug.`)
      return review
    })
    .filter(Boolean)
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!existsSync(CONTENT_DIR)) mkdirSync(CONTENT_DIR, { recursive: true })
  const reviews = loadRadarReviews()
  writeFileSync(OUTPUT_URL, `/* eslint-disable */
// Generated by scripts/generate-radar-reviews.mjs. Do not edit by hand.

export interface RadarReviewMilestone { date: string; text: string; url: string }
export interface RadarReviewTrend { id: string; domain: 'ai' | 'web3'; topic: string; title: string; thesis: string; signal: string; milestones: RadarReviewMilestone[]; implication: string; falsifier: string }
export interface RadarReview { slug: string; periodStart: string; periodEnd: string; title: string; summary: string; researchedAt: string; reviewStatus: 'automated'; trends: RadarReviewTrend[] }

export const radarReviews: RadarReview[] = ${JSON.stringify(reviews, null, 2)}
`)
  console.log(`Generated ${reviews.length} radar trend review(s).`)
}
