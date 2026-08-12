import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseMarkdownFrontmatter } from './frontmatter.mjs'
import { buildMarketResearchPack, validateMarketRadar } from './market-radar-contracts.mjs'
import { buildRadarPublication } from './radar-publication-boundary.mjs'
import { shanghaiDate } from './radar-notification-contracts.mjs'

const PRODUCTION_ORIGIN = 'https://xiuqiu-site.vercel.app'
const MAX_RESPONSE_BYTES = 512_000
const DEFAULT_ATTEMPTS = 12
const DEFAULT_RETRY_DELAY_MS = 10_000

function parseAttributes(tag) {
  const attributes = new Map()
  for (const match of tag.matchAll(/([^\s=<>]+)\s*=\s*(["'])(.*?)\2/g)) {
    attributes.set(match[1].toLowerCase(), match[3])
  }
  return attributes
}

function pageMetadata(html) {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || ''
  let canonical = ''
  let snapshotId = ''
  for (const tag of html.match(/<(?:link|meta)\b[^>]*>/gi) || []) {
    const attributes = parseAttributes(tag)
    if (tag.toLowerCase().startsWith('<link') && attributes.get('rel')?.toLowerCase() === 'canonical') {
      canonical = attributes.get('href') || ''
    }
    if (tag.toLowerCase().startsWith('<meta') && attributes.get('name')?.toLowerCase() === 'xiuqiu:market-radar-snapshot') {
      snapshotId = attributes.get('content') || ''
    }
  }
  return { title, canonical, snapshotId }
}

async function responseText(response, kind) {
  if (!response.ok) throw new Error(`${kind} returned HTTP ${response.status}`)
  const contentType = String(response.headers.get('content-type') || '').toLowerCase()
  if (kind === 'research pack' && !contentType.includes('json')) throw new Error('research pack content type is not JSON')
  if (kind === 'radar page' && !contentType.includes('html')) throw new Error('radar page content type is not HTML')
  const text = await response.text()
  if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) throw new Error(`${kind} exceeded the response limit`)
  return text
}

function fetchOptions(kind) {
  return {
    cache: 'no-store',
    redirect: 'error',
    headers: {
      Accept: kind === 'research pack' ? 'application/json' : 'text/html',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      'User-Agent': 'xiuqiu-release-controller-market-research/1.0',
    },
    signal: AbortSignal.timeout(30_000),
  }
}

export async function verifyPublishedMarketResearch(entry, publication, {
  fetchImpl = fetch,
  origin = PRODUCTION_ORIGIN,
  releaseSha = '',
} = {}) {
  if (origin !== PRODUCTION_ORIGIN) throw new Error('Market research production origin is not allowlisted.')
  const expected = buildMarketResearchPack(entry, publication)
  if (!expected) return { status: 'legacy', date: entry.date }

  const pageUrl = new URL(`/market-radar/${entry.date}`, origin)
  const packUrl = new URL(`/data/market-radar-packs/${entry.date}.json`, origin)
  if (/^[0-9a-f]{40}$/.test(releaseSha)) {
    pageUrl.searchParams.set('release_sha', releaseSha)
    packUrl.searchParams.set('release_sha', releaseSha)
  }

  const [packResponse, pageResponse] = await Promise.all([
    fetchImpl(packUrl, fetchOptions('research pack')),
    fetchImpl(pageUrl, fetchOptions('radar page')),
  ])
  const [packText, pageHtml] = await Promise.all([
    responseText(packResponse, 'research pack'),
    responseText(pageResponse, 'radar page'),
  ])

  let actual
  try {
    actual = JSON.parse(packText)
  } catch {
    throw new Error('research pack JSON is malformed')
  }
  assert.deepEqual(actual, expected, 'production research pack differs from the exact release snapshot')

  const metadata = pageMetadata(pageHtml)
  assert.match(metadata.title, new RegExp(entry.date.replaceAll('-', '\\-')), 'production page title has the wrong date')
  assert.equal(metadata.canonical, expected.pageUrl, 'production page canonical differs from the research pack')
  assert.equal(metadata.snapshotId, expected.snapshotId, 'production page snapshot differs from the research pack')
  return {
    status: 'verified',
    date: entry.date,
    snapshotId: expected.snapshotId,
    promptChecksums: expected.questions.map(question => ({ id: question.id, promptChecksum: question.promptChecksum })),
  }
}

export async function verifyDailyMarketResearch({
  date = shanghaiDate(),
  fetchImpl = fetch,
  attempts = DEFAULT_ATTEMPTS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  releaseSha = process.env.RELEASE_SHA || '',
} = {}) {
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : new Date(Number.NaN)
  if (Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== date) {
    throw new Error('Market research production date must use a valid YYYY-MM-DD value.')
  }
  const sourceUrl = new URL(`../content/market-radar/${date}.md`, import.meta.url)
  if (!existsSync(sourceUrl)) return { status: 'missing', date }
  const { meta } = parseMarkdownFrontmatter(readFileSync(sourceUrl, 'utf8'), fileURLToPath(sourceUrl))
  validateMarketRadar(meta, fileURLToPath(sourceUrl))
  if (meta.schemaVersion !== 2) return { status: 'legacy', date }
  const publication = buildRadarPublication('market', meta)

  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await verifyPublishedMarketResearch(meta, publication, { fetchImpl, releaseSha })
    } catch (error) {
      lastError = error
      if (attempt < attempts) await sleep(retryDelayMs)
    }
  }
  throw new Error(`Production Market Radar research handoff did not become consistent: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isCli) {
  verifyDailyMarketResearch({ date: process.env.RADAR_NOTIFICATION_DATE || shanghaiDate() })
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
