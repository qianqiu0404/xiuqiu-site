import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { neon } from '@neondatabase/serverless'
import { parseMarkdownFrontmatter } from './frontmatter.mjs'
import { validateMarketRadar } from './market-radar-contracts.mjs'
import { assertPublicRadarContent } from './radar-pipeline.mjs'
import { buildLearningDailyNotification, buildMarketDailyNotification, shanghaiDate } from './radar-notification-contracts.mjs'
import { buildRadarPublication } from './radar-publication-boundary.mjs'
import { publishRadarSnapshot } from './radar-publication-store.mjs'

function readRadar(path, kind, date) {
  if (!existsSync(path)) return null
  const { meta } = parseMarkdownFrontmatter(readFileSync(path, 'utf8'), path.pathname)
  if (meta.date !== date || meta.slug !== date || meta.publish !== true || meta.reviewStatus !== 'automated') {
    throw new Error(`${kind} radar ${date} is not an automated publishable daily page.`)
  }
  return meta
}

async function enqueue(sql, schema, notification, publication) {
  const rows = await sql.query(`insert into ${schema}.outbox
    (id, kind, idempotency_key, payload, available_at, origin, publication_state, snapshot_id)
    values ($1,$2,$3,$4::jsonb,now(),$5,$6,$7) on conflict (idempotency_key) do nothing returning id`, [
    crypto.randomUUID(), notification.kind, notification.idempotencyKey, JSON.stringify(notification.payload),
    publication.origin, publication.publicationState, publication.snapshotId,
  ])
  return rows[0] ? 'enqueued' : 'already_exists'
}

export function learningNotificationSkipStatus(learning) {
  if (learning?.editionMode === 'backfill') return 'skipped_backfill'
  return null
}

export function parseNotificationKinds(value = 'learning,market') {
  const kinds = new Set(String(value).split(',').map(kind => kind.trim()).filter(Boolean))
  if (!kinds.size || [...kinds].some(kind => !['learning', 'market'].includes(kind))) {
    throw new Error('RADAR_NOTIFICATION_KINDS only supports learning and market')
  }
  return kinds
}

export function databaseUrlForNotificationKinds(kinds, env = process.env) {
  if (!(kinds instanceof Set) || kinds.size !== 1) {
    throw new Error('Notification enqueue requires exactly one isolated radar lane.')
  }
  const [kind] = kinds
  const envName = kind === 'learning' ? 'LEARNING_RADAR_DATABASE_URL' : 'MARKET_RADAR_DATABASE_URL'
  const databaseUrl = env[envName]
  if (!databaseUrl) throw new Error(`${envName} is required for the ${kind} notification lane`)
  return databaseUrl
}

export async function enqueueRadarNotifications({ date, sql, learningPath, marketPath, kinds = parseNotificationKinds() }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('RADAR_NOTIFICATION_DATE must use YYYY-MM-DD')
  const resolvedLearningPath = learningPath || new URL(`../content/radar/${date}.md`, import.meta.url)
  const resolvedMarketPath = marketPath || new URL(`../content/market-radar/${date}.md`, import.meta.url)
  const result = {
    date,
    learning: kinds.has('learning') ? 'missing' : 'not_requested',
    market: kinds.has('market') ? 'missing' : 'not_requested',
  }

  const learning = kinds.has('learning') ? readRadar(resolvedLearningPath, 'learning', date) : null
  if (learning) {
    assertPublicRadarContent(learning)
    if (learning.schemaVersion === 2) throw new Error('Learning Radar v2 notifications are disabled until M4.')
    const skipStatus = learningNotificationSkipStatus(learning)
    if (skipStatus) {
      // Historical v1 backfills never enter the delivery lane. Learning v2 is
      // rejected above so an unfinished M4 remains a visible lane failure.
      result.learning = skipStatus
    } else {
      const itemCount = (learning.marketSignals || []).length
        + [learning.aiTip, learning.web3Design, learning.vibeProject, learning.readingPick].filter(Boolean).length
      if (itemCount > 7) throw new Error(`Learning radar ${date} exceeds the seven-item notification boundary.`)
      const publication = buildRadarPublication('learning', learning)
      await publishRadarSnapshot(sql, 'learning', publication)
      const publishedLearning = { ...learning, ...publication, payload: undefined, payloadChecksum: undefined }
      result.learning = await enqueue(sql, 'learning_radar', buildLearningDailyNotification(publishedLearning), publication)
    }
  }

  const market = kinds.has('market') ? readRadar(resolvedMarketPath, 'market', date) : null
  if (market) {
    validateMarketRadar(market, resolvedMarketPath.pathname)
    const publication = buildRadarPublication('market', market)
    await publishRadarSnapshot(sql, 'market', publication)
    const publishedMarket = { ...market, ...publication, payload: undefined, payloadChecksum: undefined }
    result.market = await enqueue(sql, 'market_radar', buildMarketDailyNotification(publishedMarket), publication)
  }

  return result
}

export async function main() {
  const date = process.env.RADAR_NOTIFICATION_DATE || shanghaiDate()
  const kinds = parseNotificationKinds(process.env.RADAR_NOTIFICATION_KINDS)
  const databaseUrl = databaseUrlForNotificationKinds(kinds)
  const result = await enqueueRadarNotifications({ date, sql: neon(databaseUrl), kinds })
  console.log(JSON.stringify(result))
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await main()
