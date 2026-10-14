// Builds the unified intel feed (P5): Learning Radar briefs, Market Radar
// events and trend reviews normalised into one IntelItem shape for the home
// feed, topic pages and the public static API under public/data/intel/.
// Existing frozen outputs (generatedRadarFeed, RSS, JSON Feed) are untouched.

import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { dailyRadars } from '../src/data/generatedRadarAll.ts'
import { allMarketRadars } from '../src/data/generatedMarketRadarAll.ts'
import { radarReviews } from '../src/data/generatedRadarReviews.ts'
import { buildRadarFeedItems } from './radar-feed.mjs'
import { SITE_URL } from '../shared/site.ts'

const OUTPUT_URL = new URL('../src/data/generatedIntelFeed.ts', import.meta.url)
const PUBLIC_DIR = new URL('../public/data/intel/', import.meta.url)
const MONTH_DIR = new URL('../src/data/generatedIntelFeedMonths/', import.meta.url)
export const INTEL_SCHEMA_VERSION = 1
const LATEST_DAYS = 7

function truncate(value, limit = 120) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text
}

export function buildIntelItems({ radars = dailyRadars, marketRadars = allMarketRadars, reviews = radarReviews } = {}) {
  const learning = buildRadarFeedItems(radars).map(item => ({
    id: `learning:${item.id}`,
    kind: 'learning',
    date: item.date,
    domain: item.domain,
    topic: item.topic,
    title: item.title,
    summary: item.summary,
    href: `/radar/${item.date}#${item.anchor}`,
    ...(item.sourceUrl ? { source: { name: item.sourceName ?? '原始来源', ...(item.sourceTier ? { tier: item.sourceTier } : {}), url: item.sourceUrl } } : {}),
    ...(item.isDeepDive ? { flags: { deepDive: true } } : {}),
  }))
  const market = marketRadars.flatMap(radar => radar.events.map(event => ({
    id: `market:${radar.date}:${event.id}`,
    kind: 'market',
    date: radar.date,
    domain: 'market',
    topic: `market_${event.category}`,
    title: event.title,
    summary: truncate(event.whyWatch || event.fact),
    href: `/market-radar/${radar.date}#${event.id}`,
    source: { name: event.sourceName, url: event.sourceUrl },
    flags: { priority: event.priority },
  })))
  const review = reviews.map(item => ({
    id: `review:${item.slug}`,
    kind: 'review',
    date: item.periodEnd,
    domain: 'review',
    topic: 'trend_review',
    title: item.title,
    summary: truncate(item.summary),
    href: `/radar/review/${item.slug}`,
  }))
  // Newest day first; within a day: reviews, then learning, then market.
  const kindOrder = { review: 0, learning: 1, market: 2 }
  return [...learning, ...market, ...review]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.date.localeCompare(a.item.date) || kindOrder[a.item.kind] - kindOrder[b.item.kind] || a.index - b.index)
    .map(({ item }) => item)
}

export function buildIntelTopics(items) {
  const topics = new Map()
  for (const item of items) {
    if (item.kind === 'review') continue
    const entry = topics.get(item.topic) ?? { topic: item.topic, domain: item.domain, count: 0, lastSeen: item.date, firstSeen: item.date }
    entry.count += 1
    if (item.date > entry.lastSeen) entry.lastSeen = item.date
    if (item.date < entry.firstSeen) entry.firstSeen = item.date
    topics.set(item.topic, entry)
  }
  return [...topics.values()].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen) || b.count - a.count || a.topic.localeCompare(b.topic))
}

export function latestIntelItems(items, days = LATEST_DAYS) {
  const latest = items[0]?.date
  if (!latest) return []
  const cutoff = new Date(`${latest}T00:00:00Z`)
  cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1))
  const floor = cutoff.toISOString().slice(0, 10)
  return items.filter(item => item.date >= floor)
}

function absolute(item) {
  return { ...item, url: `${SITE_URL}${item.href}` }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR, { recursive: true })
  const items = buildIntelItems()
  const topics = buildIntelTopics(items)
  const latestDate = items[0]?.date ?? null
  const types = `export type IntelKind = 'learning' | 'market' | 'review'
export type IntelDomain = 'ai' | 'web3' | 'market' | 'review'
export interface IntelItem { id: string; kind: IntelKind; date: string; domain: IntelDomain; topic: string; title: string; summary: string; href: string; source?: { name: string; tier?: 'tier1' | 'tier2'; url: string }; flags?: { deepDive?: true; priority?: 'P0' | 'P1' | 'P2' } }
export interface IntelTopic { topic: string; domain: IntelDomain; count: number; firstSeen: string; lastSeen: string }`
  mkdirSync(MONTH_DIR, { recursive: true })
  const months = [...new Set(items.map(item => item.date.slice(0, 7)))].sort().reverse()
  for (const fileName of readdirSync(MONTH_DIR)) {
    if (fileName.endsWith('.ts') && !months.includes(fileName.slice(0, 7))) unlinkSync(new URL(fileName, MONTH_DIR))
  }
  for (const month of months) {
    writeFileSync(new URL(`${month}.ts`, MONTH_DIR), `/* eslint-disable */
// Generated by scripts/generate-intel-feed.mjs. Do not edit by hand.

import type { IntelItem } from '../generatedIntelFeed.ts'

export const monthlyIntelItems: IntelItem[] = ${JSON.stringify(items.filter(item => item.date.startsWith(month)), null, 2)}
`)
  }
  // The first screen renders from the index alone; older months load lazily.
  writeFileSync(OUTPUT_URL, `/* eslint-disable */
// Generated by scripts/generate-intel-feed.mjs. Do not edit by hand.

${types}

export const intelLatestDate: string | null = ${JSON.stringify(latestDate)}
export const intelItemCount = ${items.length}
export const intelLatestItems: IntelItem[] = ${JSON.stringify(latestIntelItems(items), null, 2)}
export const intelTopics: IntelTopic[] = ${JSON.stringify(topics, null, 2)}

// Newest month first; each month is its own lazy chunk.
const intelMonthLoaders: (() => Promise<{ monthlyIntelItems: IntelItem[] }>)[] = [
${months.map(month => `  () => import('./generatedIntelFeedMonths/${month}.ts'),`).join('\n')}
]

export async function loadIntelItems(): Promise<IntelItem[]> {
  const loaded = await Promise.all(intelMonthLoaders.map(load => load()))
  return loaded.flatMap(month => month.monthlyIntelItems)
}
`)
  mkdirSync(PUBLIC_DIR, { recursive: true })
  const meta = { schemaVersion: INTEL_SCHEMA_VERSION, latestDate, homePageUrl: `${SITE_URL}/` }
  writeFileSync(new URL('latest.json', PUBLIC_DIR), `${JSON.stringify({ ...meta, windowDays: LATEST_DAYS, items: latestIntelItems(items).map(absolute) }, null, 2)}\n`)
  writeFileSync(new URL('topics.json', PUBLIC_DIR), `${JSON.stringify({ ...meta, topics: topics.map(topic => ({ ...topic, url: `${SITE_URL}/topics/${topic.topic}` })) }, null, 2)}\n`)
  console.log(`Generated ${items.length} intel items across ${topics.length} topics; latest ${latestDate}.`)
}
