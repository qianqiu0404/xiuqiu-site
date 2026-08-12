import { LEARNING_SOURCES, AIHOT_SOURCE } from './config.mjs'
import { learningHourSlot } from './core.mjs'
import { analyzeLearningItem, collectLearningSource } from './providers.mjs'
import {
  claimLearningWorkerLease,
  persistLearningSourceBatch,
  releaseLearningWorkerLease,
} from './persistence.mjs'
import { runLearningDailyDigest } from './digests.mjs'
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
    const digest = mode === 'daily' ? await runLearningDailyDigest(client, now) : null
    if (digest?.error) throw new Error(digest.error)
    const maintenance = now.getUTCHours() === 3 ? await cleanupLearningRetention(client) : null
    return { slot, mode, results, digest, maintenance }
  } finally {
    await releaseLearningWorkerLease(client, lease)
  }
})

console.log(JSON.stringify(lockResult.acquired
  ? lockResult.value
  : { skipped: true, reason: 'radar_database_lock_held' }))
