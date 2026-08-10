import { neon } from '@neondatabase/serverless'
import { MARKET_GROUPS } from './config.mjs'
import { clusterKey, hasCompleteAiV2Boundaries, isFreshForPublic, mapAssets, normalizeTitle, priorityForScore, scoreEvent, titleSimilarity, validateAiSummary } from './core.mjs'
import { checkQiuMarketHealth, fetchCryptoReleases, fetchFederalReserve, fetchSecCompanyFilings, fetchSecEdgar } from './providers.mjs'
import { enrichPendingReactions } from './reactions.mjs'
import { generateDailyDigest, generateP1Batch, generateUsPremarketDigest } from './digests.mjs'
import { isUsPremarketWindow } from './market-calendar.mjs'
import { cleanupRetention, recordDailyMetrics } from './maintenance.mjs'

const env = process.env
const databaseUrl = env.MARKET_RADAR_DATABASE_URL
if (!databaseUrl) throw new Error('MARKET_RADAR_DATABASE_URL is required')
const sql = neon(databaseUrl)

if (process.argv.includes('--digest=premarket') && !isUsPremarketWindow()) {
  console.log(JSON.stringify({ skipped: true, reason: 'outside_us_premarket_window' }))
  process.exit(0)
}

async function claimWorkerLease() {
  const token = crypto.randomUUID()
  const rows = await sql.query(`insert into market_radar.worker_locks (lock_key, lease_token, lease_until)
    values ('market-radar-worker', $1, now() + interval '15 minutes')
    on conflict (lock_key) do update set lease_token = excluded.lease_token,
      lease_until = excluded.lease_until, updated_at = now()
    where market_radar.worker_locks.lease_until <= now()
    returning lease_token`, [token])
  return rows[0]?.lease_token === token ? token : null
}

async function releaseWorkerLease(token) {
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

async function startRun(source, groupKey, slot) {
  const id = crypto.randomUUID()
  const rows = await sql.query(`insert into market_radar.job_runs
    (id, slot_key, source, group_key, status, started_at) values ($1, $2, $3, $4, 'running', now())
    on conflict (slot_key) do nothing returning id`, [id, `${source}:${groupKey}:${slot}`, source, groupKey])
  return rows[0]?.id || null
}

async function finishRun(id, status, itemCount, errorCode = null) {
  if (!id) return
  await sql.query(`update market_radar.job_runs set status = $2, item_count = $3, error_code = $4, finished_at = now() where id = $1`,
    [id, status, itemCount, errorCode])
}

async function summarizeWithAi(item, assets) {
  if (!env.DEEPSEEK_API_KEY) return null
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
  try { return validateAiSummary(JSON.parse(payload.choices?.[0]?.message?.content || '')) } catch { return null }
}

async function enqueueP0(eventId, payload) {
  await sql.query(`insert into market_radar.outbox
    (id, event_id, kind, idempotency_key, payload, available_at)
    values ($1,$2,'p0',$3,$4::jsonb,now()) on conflict (idempotency_key) do nothing`,
  [crypto.randomUUID(), eventId, `market:p0:${eventId}`, JSON.stringify({ ...payload, pageUrl: `/market-radar/events/${eventId}` })])
}

async function persistItem(item) {
  const rawId = crypto.randomUUID()
  const rawRows = await sql.query(`insert into market_radar.raw_items
    (id, provider, provider_id, market, source_url, title, published_at, payload)
    values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
    on conflict (provider, provider_id) do nothing returning id`,
    [rawId, item.provider, item.providerId, item.market, item.sourceUrl, item.title, item.publishedAt, JSON.stringify(item.payload)])
  if (!rawRows[0]) return { inserted: false, published: false }

  const assets = mapAssets(`${item.title} ${item.summary}`, item.explicitSymbols)
  const key = clusterKey(item.title, item.publishedAt)
  const candidates = await sql.query(`select id, title_zh, score, priority, status, ai_schema_version, watch_for_zh, invalidation_zh from market_radar.events
    where cluster_key = $1 and occurred_at >= $2::timestamptz - interval '12 hours' order by occurred_at desc limit 5`, [key, item.publishedAt])
  const existing = candidates.find(candidate => titleSimilarity(candidate.title_zh, item.title) >= 0.45) || candidates[0]
  if (existing) {
    await sql.query(`insert into market_radar.event_sources (event_id, raw_item_id, source_name, source_url)
      values ($1,$2,$3,$4) on conflict do nothing`, [existing.id, rawId, item.provider, item.sourceUrl])
    const countRows = await sql.query(`select count(*)::integer as count from market_radar.event_sources where event_id = $1`, [existing.id])
    const scored = scoreEvent({ source: item.provider, assets, occurredAt: item.publishedAt, sourceCount: countRows[0]?.count || 1, text: `${item.title} ${item.summary}` })
    const score = Math.max(Number(existing.score), scored)
    const priority = priorityForScore(score)
    const publishable = hasCompleteAiV2Boundaries(existing) && score >= 50 && isFreshForPublic(item.publishedAt)
    for (const asset of assets) {
      await sql.query(`insert into market_radar.event_assets (event_id, namespace, symbol, relevance)
        values ($1,$2,$3,$4) on conflict (event_id, namespace, symbol) do update
        set relevance = greatest(market_radar.event_assets.relevance, excluded.relevance)`,
      [existing.id, asset.namespace, asset.symbol, asset.relevance])
    }
    await sql.query(`update market_radar.events set score = $2, priority = $3,
      status = case when $4::boolean then 'published' else status end,
      published_at = case when $4::boolean then coalesce(published_at, now()) else published_at end,
      updated_at = now() where id = $1`, [existing.id, score, priority, publishable])
    if (publishable && priority === 'P0' && existing.priority !== 'P0') {
      await enqueueP0(existing.id, { eventId: existing.id, priority, title: existing.title_zh, summary: item.summary, sourceUrl: item.sourceUrl })
    }
    return { inserted: true, published: publishable }
  }

  const summary = await summarizeWithAi(item, assets)
  const score = scoreEvent({ source: item.provider, assets, occurredAt: item.publishedAt, text: `${item.title} ${item.summary}` })
  const priority = priorityForScore(score)
  const publishable = Boolean(summary) && score >= 50 && isFreshForPublic(item.publishedAt)
  const id = crypto.randomUUID()
  const slug = `${new Date(item.publishedAt).toISOString().slice(0, 10)}-${normalizeTitle(item.title).replace(/ /g, '-').slice(0, 90)}-${id.slice(0, 6)}`
  await sql.query(`insert into market_radar.events
    (id, slug, cluster_key, market, status, priority, score, title_zh, summary_zh, why_it_matters_zh,
     event_type, news_direction, system_judgment, horizon, ai_schema_version, occurred_at, published_at,
     watch_for_zh, invalidation_zh)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`, [
      id, slug, key, item.market, publishable ? 'published' : (score < 30 ? 'rejected' : 'draft'),
      priority === 'rejected' ? null : priority, score,
      summary?.titleZh || item.title.slice(0, 160), summary?.summaryZh || '', summary?.whyItMattersZh || '',
      summary?.eventType || 'unclassified', summary?.direction || 'neutral', summary?.systemJudgment || '等待结构化验证',
      summary?.horizon || 'days', summary ? 'v2' : null, item.publishedAt, publishable ? new Date().toISOString() : null,
      summary?.watchFor || null, summary?.invalidation || null,
    ])
  await sql.query(`insert into market_radar.event_sources (event_id, raw_item_id, source_name, source_url) values ($1,$2,$3,$4)`,
    [id, rawId, item.provider, item.sourceUrl])
  for (const asset of assets) {
    await sql.query(`insert into market_radar.event_assets (event_id, namespace, symbol, relevance) values ($1,$2,$3,$4)`,
      [id, asset.namespace, asset.symbol, asset.relevance])
  }
  await sql.query(`insert into market_radar.market_reactions (event_id, status) values ($1, 'pending')`, [id])
  if (publishable && priority === 'P0') {
    await enqueueP0(id, { eventId: id, priority, title: summary.titleZh, summary: summary.summaryZh, sourceUrl: item.sourceUrl })
  }
  return { inserted: true, published: publishable }
}

async function runSource(source, group, slot, fetcher) {
  const runId = await startRun(source, group.key, slot)
  if (!runId) return { source, skipped: true }
  try {
    const cursorRows = await sql.query(`select cursor from market_radar.source_cursors
      where source = $1 and group_key = $2`, [source, group.key])
    const cursor = cursorRows[0]?.cursor ? Date.parse(cursorRows[0].cursor) : null
    const fetchedItems = await fetcher()
    const items = fetchedItems.filter(item => !cursor || Date.parse(item.publishedAt) > cursor)
    let inserted = 0
    let published = 0
    for (const item of items) {
      const result = await persistItem(item)
      if (result.inserted) inserted += 1
      if (result.published) published += 1
    }
    const newest = fetchedItems.reduce((latest, item) => {
      const timestamp = Date.parse(item.publishedAt)
      return Number.isFinite(timestamp) && timestamp > latest ? timestamp : latest
    }, cursor || 0)
    await sql.query(`insert into market_radar.source_cursors (source, group_key, cursor, last_success_at)
      values ($1,$2,$3,now())
      on conflict (source, group_key) do update set
        cursor = excluded.cursor, last_success_at = excluded.last_success_at, updated_at = now()`,
    [source, group.key, newest ? new Date(newest).toISOString() : null])
    await finishRun(runId, 'succeeded', items.length)
    return { source, fetched: fetchedItems.length, items: items.length, inserted, published }
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 120) : 'unknown_error'
    await finishRun(runId, 'failed', 0, code)
    return { source, error: code }
  }
}

const workerLease = await claimWorkerLease()
if (!workerLease) {
  console.log(JSON.stringify({ skipped: true, reason: 'worker_lease_held' }))
  process.exit(0)
}

const slot = slotIndex()
const requestedGroupKey = requestedGroup()
const group = requestedGroupKey
  ? MARKET_GROUPS.find(candidate => candidate.key === requestedGroupKey)
  : MARKET_GROUPS[slot % MARKET_GROUPS.length]
const results = []
if (group.key === 'crypto') {
  results.push(await runSource('github_releases', group, slot, fetchCryptoReleases))
} else {
  results.push(await runSource('sec_edgar', group, slot, () => fetchSecCompanyFilings(env.SEC_USER_AGENT, group.symbols)))
}
if (slot % 9 === 0) {
  results.push(await runSource('sec_edgar', { key: 'macro' }, slot, () => fetchSecEdgar(env.SEC_USER_AGENT)))
  results.push(await runSource('federal_reserve', { key: 'macro' }, slot, fetchFederalReserve))
}
const qiuRun = await startRun('qiu_market', 'health', slot)
if (qiuRun) {
  const health = await checkQiuMarketHealth(env.QIU_MARKET_BASE_URL)
  await finishRun(qiuRun, health.healthy ? 'succeeded' : 'failed', 0, health.healthy ? null : `http_${health.status || 'unavailable'}`)
  results.push({ source: 'qiu_market', ...health })
}
let reactions = { checked: 0, updated: 0 }
const reactionRun = await startRun('binance_market_data', 'reactions', slot)
if (reactionRun) {
  try {
    reactions = await enrichPendingReactions(sql)
    await finishRun(reactionRun, 'succeeded', reactions.checked)
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 120) : 'unknown_error'
    await finishRun(reactionRun, 'failed', 0, code)
    reactions = { checked: 0, updated: 0, error: code }
  }
}
const digests = { p1: await generateP1Batch(sql) }
if (process.argv.includes('--digest=daily')) digests.daily = await generateDailyDigest(sql)
if (process.argv.includes('--digest=premarket')) digests.premarket = await generateUsPremarketDigest(sql)
const maintenance = slot % 72 === 0 ? await cleanupRetention(sql) : null
const metrics = await recordDailyMetrics(sql)
console.log(JSON.stringify({ slot, group: group.key, results, reactions, digests, maintenance, metrics }))
await releaseWorkerLease(workerLease)
