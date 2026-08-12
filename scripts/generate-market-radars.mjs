import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { parseMarkdownFrontmatter } from './frontmatter.mjs'
import { isPublishable } from './public-data-contracts.mjs'
import { assertMarketRadarArchive, buildMarketResearchPack, validateMarketRadar } from './market-radar-contracts.mjs'
import { buildRadarPublication } from './radar-publication-boundary.mjs'

const CONTENT_DIR = new URL('../content/market-radar/', import.meta.url)
const OUTPUT_URL = new URL('../src/data/generatedMarketRadars.ts', import.meta.url)
const OUTPUT_ALL_URL = new URL('../src/data/generatedMarketRadarAll.ts', import.meta.url)
const OUTPUT_LOADER_URL = new URL('../src/data/generatedMarketRadarLoader.ts', import.meta.url)
const OUTPUT_MONTH_DIR = new URL('../src/data/generatedMarketRadarMonths/', import.meta.url)
const PUBLIC_PACK_DIR = new URL('../public/data/market-radar-packs/', import.meta.url)
const PUBLIC_PACK_PREFIX = 'public/data/market-radar-packs/'

function committedPackPaths() {
  try {
    const output = execFileSync(
      'git', ['ls-tree', '-r', '--name-only', 'HEAD', '--', PUBLIC_PACK_PREFIX],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
    return new Set(output.split('\n').filter(value => value.startsWith(PUBLIC_PACK_PREFIX) && value.endsWith('.json')))
  } catch {
    throw new Error('Unable to verify committed research pack history; generation stopped closed.')
  }
}

function readCommittedPack(repositoryPath, committedPaths) {
  if (!committedPaths.has(repositoryPath)) return undefined
  try {
    return execFileSync('git', ['show', `HEAD:${repositoryPath}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch {
    throw new Error(`${repositoryPath}: unable to read committed research pack; generation stopped closed.`)
  }
}

if (!existsSync(CONTENT_DIR)) mkdirSync(CONTENT_DIR, { recursive: true })
if (!existsSync(OUTPUT_MONTH_DIR)) mkdirSync(OUTPUT_MONTH_DIR, { recursive: true })
if (!existsSync(PUBLIC_PACK_DIR)) mkdirSync(PUBLIC_PACK_DIR, { recursive: true })

const entries = readdirSync(CONTENT_DIR)
  .filter(fileName => fileName.endsWith('.md'))
  .sort()
  .map(fileName => {
    const { meta } = parseMarkdownFrontmatter(readFileSync(new URL(fileName, CONTENT_DIR), 'utf8'), fileName)
    if (!isPublishable(meta)) return undefined
    validateMarketRadar(meta, fileName)
    if (fileName !== `${meta.date}.md`) throw new Error(`${fileName}: filename must equal date.`)
    const publication = buildRadarPublication('market', meta)
    const generatedEntry = {
      date: String(meta.date), slug: String(meta.slug), title: String(meta.title), summary: String(meta.summary),
      snapshotId: publication.snapshotId, asOf: publication.asOf, origin: publication.origin, publicationState: publication.publicationState,
      reviewStatus: 'automated', generatedAt: String(meta.generatedAt),
      events: meta.events.map(event => ({
        id: String(event.id), priority: String(event.priority), status: String(event.status), category: String(event.category),
        eventAt: event.eventAt ? String(event.eventAt) : undefined, title: String(event.title), fact: String(event.fact),
        whyWatch: String(event.whyWatch), assets: event.assets.map(String), watchFor: String(event.watchFor),
        invalidation: String(event.invalidation), sourceName: String(event.sourceName), sourceUrl: String(event.sourceUrl),
        sourcePublishedAt: String(event.sourcePublishedAt),
      })),
      sourceUrls: meta.sourceUrls.map(String),
      quantStrategy: meta.quantStrategy ? {
        horizonTradingDays: Number(meta.quantStrategy.horizonTradingDays),
        status: String(meta.quantStrategy.status),
        methodology: String(meta.quantStrategy.methodology),
        assets: meta.quantStrategy.assets.map(asset => ({
          symbol: String(asset.symbol), group: String(asset.group),
          ...(meta.quantStrategy.status === 'heuristic_unbacktested'
            ? { up: Number(asset.up), sideways: Number(asset.sideways), down: Number(asset.down) }
            : { signalQuality: String(asset.signalQuality) }),
        })),
        sampleSize: meta.quantStrategy.sampleSize == null ? undefined : Number(meta.quantStrategy.sampleSize),
        rationale: String(meta.quantStrategy.rationale),
        nextValidation: String(meta.quantStrategy.nextValidation),
        invalidation: String(meta.quantStrategy.invalidation),
        sourceUrls: meta.quantStrategy.sourceUrls.map(String),
      } : undefined,
    }
    if (meta.schemaVersion === 2) {
      generatedEntry.schemaVersion = 2
      generatedEntry.researchQuestions = meta.researchQuestions.map(question => ({
        id: String(question.id), lens: String(question.lens), shortQuestion: String(question.shortQuestion),
        focusEventIds: question.focusEventIds.map(String),
      }))
      generatedEntry.researchPack = buildMarketResearchPack(meta, publication)
    }
    return generatedEntry
  })
  .filter(Boolean)
  .sort((a, b) => b.date.localeCompare(a.date))

assertMarketRadarArchive(entries)

const expectedPackFiles = new Set(entries.filter(item => item.schemaVersion === 2).map(item => `${item.date}.json`))
const committedPaths = committedPackPaths()
for (const repositoryPath of committedPaths) {
  const fileName = repositoryPath.slice(PUBLIC_PACK_PREFIX.length)
  if (!expectedPackFiles.has(fileName)) {
    throw new Error(`${repositoryPath}: published research packs are immutable and cannot be removed.`)
  }
}
for (const fileName of readdirSync(PUBLIC_PACK_DIR)) {
  if (!fileName.endsWith('.json') || expectedPackFiles.has(fileName)) continue
  unlinkSync(new URL(fileName, PUBLIC_PACK_DIR))
}
for (const entry of entries.filter(item => item.schemaVersion === 2)) {
  const fileName = `${entry.date}.json`
  const repositoryPath = `public/data/market-radar-packs/${fileName}`
  const serialized = `${JSON.stringify(entry.researchPack, null, 2)}\n`
  const committed = readCommittedPack(repositoryPath, committedPaths)
  if (committed != null && committed !== serialized) {
    throw new Error(`${repositoryPath}: published research packs are immutable; use a new schema version instead of rewriting history.`)
  }
  writeFileSync(new URL(fileName, PUBLIC_PACK_DIR), serialized)
}

const byMonth = new Map()
for (const entry of entries) {
  const month = entry.date.slice(0, 7)
  const monthlyEntries = byMonth.get(month) || []
  monthlyEntries.push(entry)
  byMonth.set(month, monthlyEntries)
}
const months = [...byMonth.keys()].sort().reverse()
const expectedFiles = new Set(months.map(month => `${month}.ts`))
for (const fileName of readdirSync(OUTPUT_MONTH_DIR)) {
  if (fileName.endsWith('.ts') && !expectedFiles.has(fileName)) unlinkSync(new URL(fileName, OUTPUT_MONTH_DIR))
}
for (const month of months) {
  writeFileSync(new URL(`${month}.ts`, OUTPUT_MONTH_DIR), `/* eslint-disable */\n// Generated by scripts/generate-market-radars.mjs.\nimport type { MarketRadarDaily } from '../generatedMarketRadars.ts'\nexport const monthlyMarketRadars: MarketRadarDaily[] = ${JSON.stringify(byMonth.get(month), null, 2)}\n`)
}

const index = entries.map(entry => ({
  date: entry.date, slug: entry.slug, title: entry.title, summary: entry.summary,
  snapshotId: entry.snapshotId, asOf: entry.asOf,
  eventCount: entry.events.length, assetCount: new Set(entry.events.flatMap(event => event.assets)).size,
  leadTitle: entry.events[0]?.title || entry.summary,
}))
writeFileSync(OUTPUT_URL, `/* eslint-disable */\n// Generated by scripts/generate-market-radars.mjs.\nexport type MarketRadarPriority = 'P0' | 'P1' | 'P2'\nexport type MarketRadarStatus = 'scheduled' | 'released' | 'monitoring'\nexport type MarketRadarCategory = 'macro' | 'crypto' | 'equity' | 'regulation'\nexport interface MarketRadarEvent { id: string; priority: MarketRadarPriority; status: MarketRadarStatus; category: MarketRadarCategory; eventAt?: string; title: string; fact: string; whyWatch: string; assets: string[]; watchFor: string; invalidation: string; sourceName: string; sourceUrl: string; sourcePublishedAt: string }\nexport type MarketResearchLens = 'transmission' | 'falsification' | 'scenario'\nexport interface MarketResearchQuestion { id: '1' | '2' | '3'; lens: MarketResearchLens; shortQuestion: string; focusEventIds: string[] }\nexport interface MarketResearchPrompt extends MarketResearchQuestion { prompt: string; promptChecksum: string; sourceUrls: string[] }\nexport interface MarketResearchPack { schemaVersion: 2; date: string; snapshotId: string; asOf: string; origin: 'research'; publicationState: 'published'; pageUrl: string; questions: MarketResearchPrompt[] }\nexport type MarketQuantAssetGroup = 'us_equity_etf' | 'crypto' | 'gold_etf'\nexport type MarketSignalQuality = 'strong' | 'medium' | 'weak'\nexport interface MarketQuantAsset { symbol: 'SPY' | 'QQQ' | 'BTC' | 'ETH' | 'GLD'; group: MarketQuantAssetGroup; up?: number; sideways?: number; down?: number; signalQuality?: MarketSignalQuality }\nexport interface MarketQuantStrategy { horizonTradingDays: number; status: 'heuristic_unbacktested' | 'historical_samples_insufficient'; methodology: string; assets: MarketQuantAsset[]; sampleSize?: number; rationale: string; nextValidation: string; invalidation: string; sourceUrls: string[] }\nexport interface MarketRadarDaily { schemaVersion?: 2; date: string; slug: string; snapshotId: string; asOf: string; origin: 'research'; publicationState: 'published'; title: string; summary: string; reviewStatus: 'automated'; generatedAt: string; events: MarketRadarEvent[]; sourceUrls: string[]; researchQuestions?: MarketResearchQuestion[]; researchPack?: MarketResearchPack; quantStrategy?: MarketQuantStrategy }\nexport interface MarketRadarIndexEntry { date: string; slug: string; snapshotId: string; asOf: string; title: string; summary: string; eventCount: number; assetCount: number; leadTitle: string }\nexport const marketRadarIndex: MarketRadarIndexEntry[] = ${JSON.stringify(index, null, 2)}\nexport const latestMarketRadars: MarketRadarDaily[] = ${JSON.stringify(entries.slice(0, 7), null, 2)}\n`)

const allImports = months.map((month, index) => `import { monthlyMarketRadars as month${index} } from './generatedMarketRadarMonths/${month}.ts'`).join('\n')
writeFileSync(OUTPUT_ALL_URL, `/* eslint-disable */\n// Generated build-time archive.\nimport type { MarketRadarDaily } from './generatedMarketRadars.ts'\n${allImports}\nexport const allMarketRadars: MarketRadarDaily[] = [${months.map((_, index) => `...month${index}`).join(', ')}]\n`)

const loaders = months.map(month => `  '${month}': () => import('./generatedMarketRadarMonths/${month}.ts'),`).join('\n')
writeFileSync(OUTPUT_LOADER_URL, `/* eslint-disable */\n// Generated by scripts/generate-market-radars.mjs.\nimport type { MarketRadarDaily } from './generatedMarketRadars.ts'\nconst loaders: Record<string, () => Promise<{ monthlyMarketRadars: MarketRadarDaily[] }>> = {\n${loaders}\n}\nexport async function loadMarketRadarBySlug(slug: string): Promise<MarketRadarDaily | undefined> {\n  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(slug)) return undefined\n  const load = loaders[slug.slice(0, 7)]\n  if (!load) return undefined\n  const { monthlyMarketRadars } = await load()\n  return monthlyMarketRadars.find(entry => entry.slug === slug)\n}\n`)

console.log(`Generated ${entries.length} static market radar entries across ${months.length} monthly chunks.`)
