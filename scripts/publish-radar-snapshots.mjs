import { existsSync, readFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'
import { parseMarkdownFrontmatter } from './frontmatter.mjs'
import { validateMarketRadar } from './market-radar-contracts.mjs'
import { assertPublicRadarContent } from './radar-pipeline.mjs'
import { buildRadarPublication } from './radar-publication-boundary.mjs'
import { publishRadarSnapshot } from './radar-publication-store.mjs'
import { shanghaiDate } from './radar-notification-contracts.mjs'

const databaseUrl = process.env.MARKET_RADAR_DATABASE_URL
if (!databaseUrl) throw new Error('MARKET_RADAR_DATABASE_URL is required')
const date = process.env.RADAR_PUBLICATION_DATE || shanghaiDate()
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('RADAR_PUBLICATION_DATE must use YYYY-MM-DD')
const sql = neon(databaseUrl)

function readPublication(path, kind) {
  if (!existsSync(path)) return null
  const { meta } = parseMarkdownFrontmatter(readFileSync(path, 'utf8'), path.pathname)
  if (meta.date !== date || meta.slug !== date || meta.publish !== true || meta.reviewStatus !== 'automated') {
    throw new Error(`${kind} radar ${date} is not an automated publishable daily page.`)
  }
  if (kind === 'learning') assertPublicRadarContent(meta)
  else validateMarketRadar(meta, path.pathname)
  return buildRadarPublication(kind, meta)
}

const publications = [
  ['learning', readPublication(new URL(`../content/radar/${date}.md`, import.meta.url), 'learning')],
  ['market', readPublication(new URL(`../content/market-radar/${date}.md`, import.meta.url), 'market')],
]
const result = { date, snapshots: [] }
for (const [kind, publication] of publications) {
  if (!publication) continue
  await publishRadarSnapshot(sql, kind, publication)
  result.snapshots.push({ kind, snapshotId: publication.snapshotId, asOf: publication.asOf })
}
console.log(JSON.stringify(result))
