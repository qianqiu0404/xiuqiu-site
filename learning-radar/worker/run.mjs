import { LEARNING_SOURCES, AIHOT_SOURCE } from './config.mjs'
import { learningHourSlot } from './core.mjs'
import { analyzeLearningItem, collectLearningSource } from './providers.mjs'
import {
  claimLearningWorkerLease,
  persistLearningSourceBatch,
  releaseLearningWorkerLease,
} from './persistence.mjs'
import { generateLearningDailyDigest } from './digests.mjs'
import { cleanupLearningRetention } from './maintenance.mjs'
import { withRadarDatabaseLock } from '../../market-radar/worker/advisory-lock.mjs'

const env = process.env
const databaseUrl = env.MARKET_RADAR_DATABASE_URL
if (!databaseUrl) throw new Error('MARKET_RADAR_DATABASE_URL is required')

const now = new Date()
const mode = process.argv.includes('--digest=daily') || env.REQUESTED_MODE === 'daily' ? 'daily' : 'ingest'
const slot = learningHourSlot(now)

function activeSources(date) {
  const hourIndex = Math.floor(date.getTime() / 3_600_000)
  const byCategory = new Map()
  for (const source of LEARNING_SOURCES) {
    const group = byCategory.get(source.category) || []
    group.push(source)
    byCategory.set(source.category, group)
  }
  const selected = [...byCategory.values()].map(group => group[hourIndex % group.length])
  let aihot = AIHOT_SOURCE
  if (env.AIHOT_DISCOVERY_URL) {
    const override = new URL(env.AIHOT_DISCOVERY_URL)
    if (override.protocol !== 'https:' || override.hostname !== 'aihot.virxact.com') {
      throw new Error('AIHOT_DISCOVERY_URL must use https://aihot.virxact.com')
    }
    aihot = { ...AIHOT_SOURCE, endpoint: override.toString() }
  }
  return [...selected, aihot]
}

async function collectOutsideLock() {
  const results = []
  for (const definition of activeSources(now)) {
    try {
      const items = await collectLearningSource(definition, { now })
      const preparedItems = []
      for (const item of items) {
        const analyzed = await analyzeLearningItem(item, {
          apiKey: env.DEEPSEEK_API_KEY,
          model: env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
        })
        preparedItems.push({ item, analysis: analyzed.analysis, aiError: analyzed.error })
      }
      results.push({ definition, preparedItems, collectionError: null })
    } catch (error) {
      results.push({
        definition,
        preparedItems: [],
        collectionError: error instanceof Error ? error.message.slice(0, 160) : 'collection_failed',
      })
    }
  }
  return results
}

async function runDailyDigest(client) {
  const digestSlot = `learning:digest:daily:${new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)}`
  await client.query('begin')
  try {
    const started = await client.query(`insert into learning_radar.job_runs
      (id, slot_key, source, group_key, status, started_at)
      values ($1,$2,'learning_digest','daily','running',now())
      on conflict (slot_key) do nothing returning id`, [crypto.randomUUID(), digestSlot])
    if (!started.rows[0]) {
      await client.query('rollback')
      return { created: false, reason: 'already_exists' }
    }
    const digest = await generateLearningDailyDigest(client, now)
    await client.query(`update learning_radar.job_runs set status = 'succeeded', item_count = $2,
      finished_at = now() where id = $1`, [started.rows[0].id, digest.count])
    await client.query('commit')
    return digest
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    const errorCode = error instanceof Error ? error.message.slice(0, 160) : 'digest_failed'
    await client.query('begin')
    try {
      await client.query(`insert into learning_radar.job_runs
        (id, slot_key, source, group_key, status, error_code, started_at, finished_at)
        values ($1,$2,'learning_digest','daily','failed',$3,now(),now())
        on conflict (slot_key) do nothing`,
      [crypto.randomUUID(), digestSlot, errorCode])
      await client.query('commit')
    } catch (recordError) {
      await client.query('rollback').catch(() => undefined)
      throw recordError
    }
    return { created: false, error: errorCode }
  }
}

const collected = await collectOutsideLock()
const lockResult = await withRadarDatabaseLock({ databaseUrl }, async ({ client }) => {
  const lease = await claimLearningWorkerLease(client)
  if (!lease) return { skipped: true, reason: 'learning_worker_lease_held' }
  try {
    const results = []
    for (const collection of collected) {
      results.push(await persistLearningSourceBatch(client, {
        source: collection.definition.key,
        groupKey: collection.definition.category,
        slot,
        preparedItems: collection.preparedItems,
        collectionError: collection.collectionError,
        now,
      }))
    }
    const digest = mode === 'daily' ? await runDailyDigest(client) : null
    const maintenance = now.getUTCHours() === 3 ? await cleanupLearningRetention(client) : null
    return { slot, mode, results, digest, maintenance }
  } finally {
    await releaseLearningWorkerLease(client, lease)
  }
})

console.log(JSON.stringify(lockResult.acquired
  ? lockResult.value
  : { skipped: true, reason: 'radar_database_lock_held' }))
