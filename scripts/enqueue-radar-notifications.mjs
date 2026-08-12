import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'
import { parseMarkdownFrontmatter } from './frontmatter.mjs'
import { validateMarketRadar } from './market-radar-contracts.mjs'
import { assertPublicRadarContent } from './radar-pipeline.mjs'
import { buildLearningDailyNotification, buildMarketDailyNotification, shanghaiDate } from './radar-notification-contracts.mjs'
import { buildRadarPublication } from './radar-publication-boundary.mjs'
import { verifyExactGitPublication } from './exact-git-publication.mjs'
import { normalizeLearningEditionV2 } from './learning-radar-v2.mjs'

const databaseUrl = process.env.MARKET_RADAR_DATABASE_URL
if (!databaseUrl) throw new Error('MARKET_RADAR_DATABASE_URL is required')
const date = process.env.RADAR_NOTIFICATION_DATE || shanghaiDate()
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('RADAR_NOTIFICATION_DATE must use YYYY-MM-DD')
const expectedSha = process.env.GITHUB_SHA
if (!/^[0-9a-f]{40}$/.test(expectedSha || '')) throw new Error('GITHUB_SHA must be the exact lowercase publication commit')
const repo = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '')
const sql = neon(databaseUrl)

function readRadar(path, kind) {
  if (!existsSync(path)) return null
  const { meta } = parseMarkdownFrontmatter(readFileSync(path, 'utf8'), path.pathname)
  if (meta.date !== date || meta.slug !== date || meta.publish !== true || meta.reviewStatus !== 'automated') {
    throw new Error(`${kind} radar ${date} is not an automated publishable daily page.`)
  }
  return meta
}

async function enqueue(schema, notification, publication) {
  const rows = await sql.query(`insert into ${schema}.outbox
    (id, kind, idempotency_key, payload, available_at, origin, publication_state, snapshot_id)
    values ($1,$2,$3,$4::jsonb,now(),$5,$6,$7) on conflict (idempotency_key) do nothing returning id`, [
    crypto.randomUUID(), notification.kind, notification.idempotencyKey, JSON.stringify(notification.payload),
    publication.origin, publication.publicationState, publication.snapshotId,
  ])
  return rows[0] ? 'enqueued' : 'already_exists'
}

async function requirePublishedSnapshot(kind, publication) {
  const rows = await sql.query(`select snapshot_id from radar_system.publication_snapshots
    where snapshot_id=$1 and radar_kind=$2 and as_of=$3::timestamptz and origin='research'
      and publication_state='published' and payload_checksum=$4 and payload=$5::jsonb and source_revision=$6`, [
    publication.snapshotId, kind, publication.asOf, publication.payloadChecksum,
    JSON.stringify(publication.payload), expectedSha,
  ])
  if (!rows[0]) throw new Error(`${kind}_exact_published_snapshot_missing`)
}

const learningPath = new URL(`../content/radar/${date}.md`, import.meta.url)
const marketPath = new URL(`../content/market-radar/${date}.md`, import.meta.url)
const result = { date, learning: 'missing', market: 'missing' }

const learning = readRadar(learningPath, 'learning')
const market = readRadar(marketPath, 'market')
const trackedFiles = [learning && `content/radar/${date}.md`, market && `content/market-radar/${date}.md`].filter(Boolean)
await verifyExactGitPublication({ repo, expectedSha, trackedFiles })

if (learning) {
  assertPublicRadarContent(learning)
  if (learning.schemaVersion === 2) throw new Error('Learning Radar v2 notifications are disabled until M4.')
  const itemCount = (learning.marketSignals || []).length
    + [learning.aiTip, learning.web3Design, learning.vibeProject, learning.readingPick].filter(Boolean).length
  if (itemCount > 7) throw new Error(`Learning radar ${date} exceeds the seven-item notification boundary.`)
  const publication = buildRadarPublication('learning', learning.schemaVersion === 2 ? normalizeLearningEditionV2(learning) : learning)
  await requirePublishedSnapshot('learning', publication)
  const publishedLearning = { ...learning, ...publication, payload: undefined, payloadChecksum: undefined }
  result.learning = await enqueue('learning_radar', buildLearningDailyNotification(publishedLearning), publication)
}

if (market) {
  validateMarketRadar(market, marketPath.pathname)
  const publication = buildRadarPublication('market', market)
  await requirePublishedSnapshot('market', publication)
  const publishedMarket = { ...market, ...publication, payload: undefined, payloadChecksum: undefined }
  result.market = await enqueue('market_radar', buildMarketDailyNotification(publishedMarket), publication)
}

console.log(JSON.stringify(result))
