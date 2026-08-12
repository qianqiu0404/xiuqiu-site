import { createRadarPool } from './database-pool.mjs'
import { MARKET_GROUPS } from './config.mjs'
import {
  mapAssets,
  validateAiSummary,
} from './core.mjs'
import { checkQiuMarketHealth, fetchCryptoReleases, fetchFederalReserve, fetchSecCompanyFilings, fetchSecEdgar } from './providers.mjs'
import { collectReactionUpdates, loadPendingReactionInputs, persistReactionUpdates } from './reactions.mjs'
import { generateDailyDigest, generateP1Batch, generateUsPremarketDigest } from './digests.mjs'
import { isUsPremarketWindow } from './market-calendar.mjs'
import { cleanupRetention, recordDailyMetrics } from './maintenance.mjs'
import { withRadarDatabaseLock } from './advisory-lock.mjs'
import { findMarketEventCandidate, persistMarketItem } from './persistence.mjs'
import { qiuMarketEnabled } from './local-policy.mjs'
import {
  collectMarketSourceOutsideLock,
  persistCollectedWithLock,
  persistMarketSourceBatch,
  withMarketWorkerLease,
} from './orchestration.mjs'

const env = process.env
const databaseUrl = env.MARKET_RADAR_DATABASE_URL
if (!databaseUrl) throw new Error('MARKET_RADAR_DATABASE_URL is required')
const useQiuMarket = qiuMarketEnabled(env)

if (process.argv.includes('--digest=premarket') && !isUsPremarketWindow()) {
  console.log(JSON.stringify({ skipped: true, reason: 'outside_us_premarket_window' }))
  process.exit(0)
}

function asArraySql(client) {
  return { query: async (statement, values = []) => (await client.query(statement, values)).rows }
}

async function claimWorkerLease(sql) {
  const token = crypto.randomUUID()
  const rows = await sql.query(`insert into market_radar.worker_locks (lock_key, lease_token, lease_until)
    values ('market-radar-worker', $1, now() + interval '15 minutes')
    on conflict (lock_key) do update set lease_token = excluded.lease_token,
      lease_until = excluded.lease_until, updated_at = now()
    where market_radar.worker_locks.lease_until <= now()
    returning lease_token`, [token])
  return rows[0]?.lease_token === token ? token : null
}

async function releaseWorkerLease(sql, token) {
  await sql.query(`delete from market_radar.worker_locks
    where lock_key = 'market-radar-worker' and lease_token = $1`, [token])
}

function slotIndex(date = new Date()) {
  return Math.floor(date.getTime() / (20 * 60_000))
}

function requestedGroup() {
  const value = process.argv.find(argument => argument.startsWith('--group='))?.slice('--group='.length)
  if (!value) return null
  if (!MARKET_GROUPS.some(group => group.key === value)) throw new Error(`Unknown market radar group: ${value}`)
  return value
}

async function startRun(sql, source, groupKey, slot) {
  const id = crypto.randomUUID()
  const rows = await sql.query(`insert into market_radar.job_runs
    (id, slot_key, source, group_key, status, started_at) values ($1, $2, $3, $4, 'running', now())
    on conflict (slot_key) do nothing returning id`, [id, `${source}:${groupKey}:${slot}`, source, groupKey])
  return rows[0]?.id || null
}

async function finishRun(sql, id, status, itemCount, errorCode = null) {
  if (!id) return
  await sql.query(`update market_radar.job_runs set status = $2, item_count = $3, error_code = $4, finished_at = now() where id = $1`,
    [id, status, itemCount, errorCode])
}

async function summarizeWithAi(item, assets) {
  if (!env.DEEPSEEK_API_KEY) return null
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST', signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL || 'deepseek-v4-flash', thinking: { type: 'disabled' }, temperature: 0.1, max_tokens: 900,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: '你是交易事件结构化器，不提供投资建议。只输出 JSON：titleZh, summaryZh, whyItMattersZh, eventType, direction(bullish|bearish|mixed|neutral), horizon(intraday|days|weeks), systemJudgment, watchFor, invalidation。watchFor 写接下来需要观察的可验证信号，invalidation 写何种后续情况会使当前系统判断失效；它们都是系统观察边界，不是来源已陈述的事实。两个字段必须是具体的非占位文本，各不超过 600 字符。不得编造价格、来源或确定性。' },
          { role: 'user', content: JSON.stringify({ title: item.title, summary: item.summary, provider: item.provider, assets }) },
        ],
      }),
    })
    if (!response.ok) return null
    const payload = await response.json()
    return validateAiSummary(JSON.parse(payload.choices?.[0]?.message?.content || ''))
  } catch {
    return null
  }
}

async function persistCollectedSource(client, source, group, slot, collection) {
  const sql = asArraySql(client)
  return persistMarketSourceBatch({
    source,
    fetchedItems: collection.fetchedItems,
    preparedItems: collection.preparedItems,
    collectionError: collection.error,
    startRun: () => startRun(sql, source, group.key, slot),
    finishRun: (runId, status, itemCount, errorCode) => finishRun(sql, runId, status, itemCount, errorCode),
    loadCursor: async () => {
      const cursorRows = await sql.query(`select cursor from market_radar.source_cursors
        where source = $1 and group_key = $2`, [source, group.key])
      return cursorRows[0]?.cursor || null
    },
    persistItem: (item, summary) => persistMarketItem(client, item, { summary }),
    saveCursor: cursor => sql.query(`insert into market_radar.source_cursors (source, group_key, cursor, last_success_at)
      values ($1,$2,$3,now())
      on conflict (source, group_key) do update set
        cursor = excluded.cursor, last_success_at = excluded.last_success_at, updated_at = now()`,
    [source, group.key, cursor]),
  })
}

function marketSourceDefinitions(group, slot) {
  const definitions = group.key === 'crypto'
    ? [{ source: 'github_releases', group, fetcher: fetchCryptoReleases }]
    : [{ source: 'sec_edgar', group, fetcher: () => fetchSecCompanyFilings(env.SEC_USER_AGENT, group.symbols) }]
  if (slot % 9 === 0) {
    definitions.push(
      { source: 'sec_edgar', group: { key: 'macro' }, fetcher: () => fetchSecEdgar(env.SEC_USER_AGENT) },
      { source: 'federal_reserve', group: { key: 'macro' }, fetcher: fetchFederalReserve },
    )
  }
  return definitions
}

async function acquireWorkerLeaseState() {
  const result = await withRadarDatabaseLock({ databaseUrl }, async ({ client }) => {
    const sql = asArraySql(client)
    const token = await claimWorkerLease(sql)
    if (!token) return null
    try {
      return { token, reactionInputs: await loadPendingReactionInputs(sql) }
    } catch (error) {
      await releaseWorkerLease(sql, token)
      throw error
    }
  })
  return result.acquired ? result.value : null
}

async function releaseWorkerLeaseState(state) {
  const result = await withRadarDatabaseLock({ databaseUrl, wait: true }, ({ client }) => (
    releaseWorkerLease(asArraySql(client), state.token)
  ))
  if (!result.acquired) throw new Error('radar_database_lock_unavailable_for_lease_release')
}

async function withMarketReadClient(work) {
  const pool = createRadarPool({ connectionString: databaseUrl, max: 1 })
  let client
  try {
    client = await pool.connect()
    return await work(client)
  } finally {
    client?.release()
    await pool.end()
  }
}

async function collectSource(definition, slot) {
  try {
    const alreadyRan = await withMarketReadClient(async client => {
      const result = await client.query(`select 1 from market_radar.job_runs
        where slot_key = $1 limit 1`, [`${definition.source}:${definition.group.key}:${slot}`])
      return result.rows.length > 0
    })
    if (alreadyRan) return { fetchedItems: [], preparedItems: [], skipped: true }
    return await collectMarketSourceOutsideLock({
      fetchItems: definition.fetcher,
      preflightItems: fetchedItems => withMarketReadClient(async client => {
        const preparation = new Map()
        for (const item of fetchedItems) {
          const existing = await findMarketEventCandidate(client, item)
          preparation.set(`${item.provider}:${item.providerId}`, !existing)
        }
        return preparation
      }),
      prepareItem: item => summarizeWithAi(item, mapAssets(`${item.title} ${item.summary}`, item.explicitSymbols)),
    })
  } catch (error) {
    return {
      fetchedItems: [],
      preparedItems: [],
      error: error instanceof Error ? error.message.slice(0, 120) : 'collection_failed',
    }
  }
}

async function runWorker(state) {
  const slot = slotIndex()
  const requestedGroupKey = requestedGroup()
  const group = requestedGroupKey
    ? MARKET_GROUPS.find(candidate => candidate.key === requestedGroupKey)
    : MARKET_GROUPS[slot % MARKET_GROUPS.length]
  const definitions = marketSourceDefinitions(group, slot)

  // Provider, AI, health and price network calls deliberately happen without the shared database lock.
  const collections = []
  for (const definition of definitions) collections.push(await collectSource(definition, slot))
  const health = useQiuMarket ? await checkQiuMarketHealth(env.QIU_MARKET_BASE_URL) : null
  const collectedReactions = await collectReactionUpdates(state.reactionInputs)

  const results = []
  for (const [index, definition] of definitions.entries()) {
    results.push(await persistCollectedWithLock({
      withLock: work => withRadarDatabaseLock({ databaseUrl }, work),
      work: ({ client }) => persistCollectedSource(client, definition.source, definition.group, slot, collections[index]),
    }))
  }

  if (useQiuMarket) {
    results.push(await persistCollectedWithLock({
      withLock: work => withRadarDatabaseLock({ databaseUrl }, work),
      work: async ({ client }) => {
        const sql = asArraySql(client)
        const qiuRun = await startRun(sql, 'qiu_market', 'health', slot)
        if (!qiuRun) return { source: 'qiu_market', skipped: true }
        await finishRun(sql, qiuRun, health.healthy ? 'succeeded' : 'failed', 0,
          health.healthy ? null : `http_${health.status || 'unavailable'}`)
        return { source: 'qiu_market', ...health }
      },
    }))
  }

  const reactions = await persistCollectedWithLock({
    withLock: work => withRadarDatabaseLock({ databaseUrl }, work),
    work: async ({ client }) => {
      const sql = asArraySql(client)
      const reactionRun = await startRun(sql, 'binance_market_data', 'reactions', slot)
      if (!reactionRun) return { checked: 0, updated: 0, skipped: true }
      try {
        const saved = await persistReactionUpdates(sql, collectedReactions)
        await finishRun(sql, reactionRun, 'succeeded', saved.checked)
        return saved
      } catch (error) {
        const code = error instanceof Error ? error.message.slice(0, 120) : 'unknown_error'
        await finishRun(sql, reactionRun, 'failed', 0, code)
        return { checked: 0, updated: 0, error: code }
      }
    },
  })

  const databaseWork = await persistCollectedWithLock({
    withLock: work => withRadarDatabaseLock({ databaseUrl }, work),
    work: async ({ client }) => {
      const sql = asArraySql(client)
      const digests = { p1: await generateP1Batch(sql) }
      if (process.argv.includes('--digest=daily')) digests.daily = await generateDailyDigest(sql)
      if (process.argv.includes('--digest=premarket')) digests.premarket = await generateUsPremarketDigest(sql)
      const maintenance = slot % 72 === 0 ? await cleanupRetention(sql) : null
      const metrics = await recordDailyMetrics(sql)
      return { digests, maintenance, metrics }
    },
  })
  return { slot, group: group.key, results, reactions, ...databaseWork }
}

const result = await withMarketWorkerLease({
  claim: acquireWorkerLeaseState,
  release: releaseWorkerLeaseState,
  work: runWorker,
})
console.log(JSON.stringify(result))
