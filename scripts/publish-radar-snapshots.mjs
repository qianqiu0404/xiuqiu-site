import { existsSync, readFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'
import { parseMarkdownFrontmatter } from './frontmatter.mjs'
import { validateMarketRadar } from './market-radar-contracts.mjs'
import { assertPublicRadarContent } from './radar-pipeline.mjs'
import { buildRadarPublication } from './radar-publication-boundary.mjs'
import { publishRadarSnapshot } from './radar-publication-store.mjs'
import { normalizeLearningEditionV2 } from './learning-radar-v2.mjs'
import { selectRadarPublicationPlan } from './radar-publication-selection.mjs'

const databaseUrl = process.env.MARKET_RADAR_DATABASE_URL
if (!databaseUrl) throw new Error('MARKET_RADAR_DATABASE_URL is required')
const { dates, kinds, byKind } = selectRadarPublicationPlan()
const sql = neon(databaseUrl)

function readPublication(path, kind, date) {
  if (!existsSync(path)) return null
  const { meta } = parseMarkdownFrontmatter(readFileSync(path, 'utf8'), path.pathname)
  if (meta.date !== date || meta.slug !== date || meta.publish !== true || meta.reviewStatus !== 'automated') {
    throw new Error(`${kind} radar ${date} is not an automated publishable daily page.`)
  }
  if (kind === 'learning') {
    assertPublicRadarContent(meta)
    return buildRadarPublication(kind, meta.schemaVersion === 2 ? normalizeLearningEditionV2(meta) : meta)
  }
  validateMarketRadar(meta, path.pathname)
  return buildRadarPublication(kind, meta)
}

const result = { dates, snapshots: [] }
for (const date of dates) {
  const publications = [
    ['learning', kinds.has('learning') && (!byKind || byKind.learning === date) ? readPublication(new URL(`../content/radar/${date}.md`, import.meta.url), 'learning', date) : null],
    ['market', kinds.has('market') && (!byKind || byKind.market === date) ? readPublication(new URL(`../content/market-radar/${date}.md`, import.meta.url), 'market', date) : null],
  ]
  for (const [kind, publication] of publications) {
    if (!publication) continue
    await publishRadarSnapshot(sql, kind, publication)
    result.snapshots.push({ date, kind, snapshotId: publication.snapshotId, asOf: publication.asOf })
  }
}
console.log(JSON.stringify(result))
