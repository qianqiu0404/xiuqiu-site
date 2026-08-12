import { existsSync, readFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'
import { parseMarkdownFrontmatter } from './frontmatter.mjs'
import { validateMarketRadar } from './market-radar-contracts.mjs'
import { assertPublicRadarContent } from './radar-pipeline.mjs'
import { buildLearningDailyNotification, buildMarketDailyNotification, shanghaiDate } from './radar-notification-contracts.mjs'
import { buildRadarPublication } from './radar-publication-boundary.mjs'
import { publishRadarSnapshot } from './radar-publication-store.mjs'
import { normalizeLearningEditionV2 } from './learning-radar-v2.mjs'

const databaseUrl = process.env.MARKET_RADAR_DATABASE_URL
if (!databaseUrl) throw new Error('MARKET_RADAR_DATABASE_URL is required')
const date = process.env.RADAR_NOTIFICATION_DATE || shanghaiDate()
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('RADAR_NOTIFICATION_DATE must use YYYY-MM-DD')
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

const learningPath = new URL(`../content/radar/${date}.md`, import.meta.url)
const marketPath = new URL(`../content/market-radar/${date}.md`, import.meta.url)
const result = { date, learning: 'missing', market: 'missing' }

const learning = readRadar(learningPath, 'learning')
if (learning) {
  assertPublicRadarContent(learning)
  if (learning.schemaVersion === 2) throw new Error('Learning Radar v2 notifications are disabled until M4.')
  const itemCount = (learning.marketSignals || []).length
    + [learning.aiTip, learning.web3Design, learning.vibeProject, learning.readingPick].filter(Boolean).length
  if (itemCount > 7) throw new Error(`Learning radar ${date} exceeds the seven-item notification boundary.`)
  const publication = buildRadarPublication('learning', learning.schemaVersion === 2 ? normalizeLearningEditionV2(learning) : learning)
  await publishRadarSnapshot(sql, 'learning', publication)
  const publishedLearning = { ...learning, ...publication, payload: undefined, payloadChecksum: undefined }
  result.learning = await enqueue('learning_radar', buildLearningDailyNotification(publishedLearning), publication)
}

const market = readRadar(marketPath, 'market')
if (market) {
  validateMarketRadar(market, marketPath.pathname)
  const publication = buildRadarPublication('market', market)
  await publishRadarSnapshot(sql, 'market', publication)
  const publishedMarket = { ...market, ...publication, payload: undefined, payloadChecksum: undefined }
  result.market = await enqueue('market_radar', buildMarketDailyNotification(publishedMarket), publication)
}

console.log(JSON.stringify(result))
