import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  calculateExcess, calculateReturn, clusterKey, encodeMarketSourceCursor, mapAssets, nearestPrice,
  newestMarketSourceCursor, normalizeMarketSourceReport, normalizeUrl, parseMarketSourceCursor,
  selectMarketItemsAfterCursor,
  hasCompleteAiV2Boundaries, isFreshForPublic, priorityForScore, scoreEvent, titleSimilarity, validateAiSummary,
} from '../market-radar/worker/core.mjs'
import { buildDigestBody, summarizeAttentionAssets } from '../market-radar/worker/digests.mjs'
import { isUsPremarketWindow, newYorkParts } from '../market-radar/worker/market-calendar.mjs'
import { parseBinanceKlines, parseGitHubReleasePayload, parseRss, parseSecCompanyFeed } from '../market-radar/worker/providers.mjs'
import {
  collectMarketSourceOutsideLock,
  persistCollectedWithLock,
  persistMarketSourceBatch,
  withMarketWorkerLease,
} from '../market-radar/worker/orchestration.mjs'
import { parseEventCursor } from '../src/market-radar/contracts.ts'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('provider URLs and titles normalize for deterministic duplicate detection', () => {
  assert.equal(normalizeUrl('https://example.com/news/?utm_source=x&gclid=y#top'), 'https://example.com/news')
  assert.ok(titleSimilarity('SEC approves spot Crypto ETF for Bitcoin', 'Bitcoin spot crypto ETF approved by SEC') >= 0.7)
  assert.ok(titleSimilarity('NVIDIA reports quarterly earnings', 'Federal Reserve keeps rates unchanged') < 0.2)
  assert.match(clusterKey('SEC approves Bitcoin ETF', '2026-08-08T01:00:00Z'), /^2026-08-08:/)
})

test('asset mapping preserves explicit namespaces and aliases', () => {
  const assets = mapAssets('Federal Reserve rates decision affects Bitcoin, NVIDIA and stablecoin rules')
  assert.ok(assets.some(asset => asset.namespace === 'crypto' && asset.symbol === 'BTC'))
  assert.ok(assets.some(asset => asset.namespace === 'us_equity' && asset.symbol === 'NVDA'))
  assert.ok(assets.some(asset => asset.namespace === 'macro' && asset.symbol === 'FED'))
  assert.ok(assets.some(asset => asset.namespace === 'macro' && asset.symbol === 'STABLECOIN_REGULATION'))
})

test('rule scoring and priority boundaries remain deterministic', () => {
  assert.equal(priorityForScore(85), 'P0')
  assert.equal(priorityForScore(84), 'P1')
  assert.equal(priorityForScore(70), 'P1')
  assert.equal(priorityForScore(50), 'P2')
  assert.equal(priorityForScore(30), 'P3')
  assert.equal(priorityForScore(29), 'rejected')
  const official = scoreEvent({ source: 'sec_edgar', assets: [{ relevance: 100 }], occurredAt: new Date().toISOString(), sourceCount: 3, reactionStrength: 0.03, text: 'SEC approved an ETF' })
  const weak = scoreEvent({ source: 'qiu_market', assets: [], occurredAt: '2025-01-01T00:00:00Z', sourceCount: 1, text: 'unclear rumor' })
  assert.ok(official > weak)
})

test('public freshness uses occurrence time instead of ingestion time', () => {
  const now = new Date('2026-08-09T12:00:00Z')
  assert.equal(isFreshForPublic('2026-08-09T11:00:00Z', now), true)
  assert.equal(isFreshForPublic('2026-08-06T12:00:00Z', now), true)
  assert.equal(isFreshForPublic('2026-08-06T11:59:59Z', now), false)
  assert.equal(isFreshForPublic('not-a-date', now), false)
})

test('digest leads with grouped asset direction and a fixed attention summary', () => {
  const events = [
    {
      priority: 'P1', score: 78, title_zh: 'BTC ETF 获得监管批准', summary_zh: '测试摘要',
      news_direction: 'bullish', horizon: 'days', source_count: 2,
      assets: [{ namespace: 'crypto', symbol: 'BTC', relevance: 100 }],
      reaction: { status: 'confirmed', excess4h: 0.02 },
    },
    {
      priority: 'P2', score: 61, title_zh: 'BTC 资金流继续改善', summary_zh: '测试摘要',
      news_direction: 'bullish', horizon: 'days', source_count: 1,
      assets: [{ namespace: 'crypto', symbol: 'BTC', relevance: 90 }],
      reaction: { status: 'pending' },
    },
    {
      priority: 'P2', score: 55, title_zh: 'ETH 常规维护版本发布', summary_zh: '测试摘要',
      news_direction: 'neutral', horizon: 'days', source_count: 1,
      assets: [{ namespace: 'crypto', symbol: 'ETH', relevance: 100 }],
      reaction: { status: 'ignored' },
    },
  ]
  const attention = summarizeAttentionAssets(events)
  assert.deepEqual(attention.map(asset => asset.symbol), ['BTC'])
  assert.equal(attention[0].direction, 'bullish')
  assert.equal(attention[0].confidence, '中')
  const digest = buildDigestBody(events)
  assert.deepEqual(digest.attentionAssets, ['BTC'])
  assert.match(digest.body, /【结论先行】/)
  assert.match(digest.body, /特别关注：BTC/)
  assert.match(digest.body, /BTC · 偏多观察 · 天级 · 置信度中/)
  assert.match(digest.body, /确认：行情已确认/)
  assert.match(digest.body, /失效：若 4 小时相对基准收益不为正/)
  assert.doesNotMatch(digest.body, /特别关注：.*ETH/)
})

test('digest states that no asset qualifies instead of forcing a direction', () => {
  const digest = buildDigestBody([{
    priority: 'P2', score: 52, title_zh: '常规监管公告', news_direction: 'neutral', horizon: 'weeks',
    source_count: 1, assets: [{ namespace: 'macro', symbol: 'FED', relevance: 85 }], reaction: { status: 'pending' },
  }])
  assert.deepEqual(digest.attentionAssets, [])
  assert.match(digest.body, /特别关注：暂无/)
  assert.match(digest.body, /不为凑结论而强行指定资产/)
})

test('AI summaries fail closed unless every public field and enum is valid', () => {
  const valid = validateAiSummary({
    titleZh: '监管事件', summaryZh: '公开摘要', whyItMattersZh: '影响关注资产', eventType: 'regulation',
    direction: 'mixed', horizon: 'days', systemJudgment: '等待行情确认',
    watchFor: '  观察监管方是否公布具体执行时间表  ',
    invalidation: '  若后续公告明确取消该执行计划，则当前判断失效  ',
  })
  assert.equal(valid?.direction, 'mixed')
  assert.equal(valid?.watchFor, '观察监管方是否公布具体执行时间表')
  assert.equal(valid?.invalidation, '若后续公告明确取消该执行计划，则当前判断失效')
  assert.equal(validateAiSummary({ titleZh: '缺字段' }), null)
  assert.equal(validateAiSummary({ ...valid, direction: 'buy_now' }), null)
  assert.equal(validateAiSummary({ ...valid, watchFor: '暂无' }), null)
  assert.equal(validateAiSummary({ ...valid, watchFor: '暂无。' }), null)
  assert.equal(validateAiSummary({ ...valid, watchFor: 'N/A.' }), null)
  assert.equal(validateAiSummary({ ...valid, watchFor: '后续待补充具体数据' }), null)
  assert.equal(validateAiSummary({ ...valid, watchFor: 'TODO later' }), null)
  assert.equal(validateAiSummary({ ...valid, watchFor: '这是占位文本' }), null)
  assert.equal(validateAiSummary({ ...valid, watchFor: '。！--' }), null)
  assert.equal(validateAiSummary({ ...valid, watchFor: '،؛' }), null)
  assert.equal(validateAiSummary({ ...valid, watchFor: '😀🚀' }), null)
  assert.equal(validateAiSummary({ ...valid, watchFor: '\u200b\u200d' }), null)
  assert.equal(validateAiSummary({ ...valid, watchFor: '&#24453;&#34917;&#20805;' }), null)
  assert.equal(validateAiSummary({ ...valid, watchFor: '&amp;#24453;&amp;#34917;&amp;#20805;' }), null)
  assert.equal(validateAiSummary({ ...valid, invalidation: 'x'.repeat(601) }), null)
  assert.equal(validateAiSummary({ ...valid, invalidation: '   ' }), null)
  assert.equal(validateAiSummary({ ...valid, invalidation: '界'.repeat(600) })?.invalidation.length, 600)
})

test('only complete v2 event boundaries satisfy the publish gate', () => {
  const complete = {
    ai_schema_version: 'v2',
    watch_for_zh: '观察公开文件的后续更新',
    invalidation_zh: '若公开文件撤回该计划则失效',
  }
  assert.equal(hasCompleteAiV2Boundaries(complete), true)
  assert.equal(hasCompleteAiV2Boundaries({ ...complete, ai_schema_version: 'v1' }), false)
  assert.equal(hasCompleteAiV2Boundaries({ ...complete, watch_for_zh: null }), false)
  assert.equal(hasCompleteAiV2Boundaries({ ...complete, invalidation_zh: '待补充' }), false)
})

test('reaction alignment and excess returns use bounded 5-minute observations', () => {
  const series = [
    { at: new Date('2026-08-08T10:00:00Z'), close: 100 },
    { at: new Date('2026-08-08T10:05:00Z'), close: 102 },
  ]
  assert.equal(nearestPrice(series, '2026-08-08T10:04:00Z'), 102)
  assert.equal(nearestPrice(series, '2026-08-08T11:00:00Z'), null)
  assert.equal(calculateReturn(100, 102), 0.02)
  assert.equal(calculateExcess(0.02, 0.005), 0.015)
})

test('official RSS normalization rejects incomplete entries', () => {
  const items = parseRss(`<?xml version="1.0"?><rss><channel>
    <item><guid>a</guid><title>Federal Reserve statement</title><link>https://federalreserve.gov/a</link><pubDate>Sat, 08 Aug 2026 10:00:00 GMT</pubDate></item>
    <item><title>Missing URL</title><pubDate>Sat, 08 Aug 2026 10:00:00 GMT</pubDate></item>
  </channel></rss>`, 'federal_reserve')
  assert.equal(items.length, 1)
  assert.equal(items[0].market, 'macro')
  assert.equal(items[0].sourceReport.title, 'Federal Reserve statement')
  assert.equal(items[0].sourceReport.excerpt, null)
})

test('source reports strip markup, bound text and fail closed on missing or invalid dates', () => {
  const now = new Date('2026-08-10T12:00:00Z')
  const report = normalizeMarketSourceReport({
    title: `<b>${'T'.repeat(550)}</b>`,
    excerpt: `<p>Public &amp; original</p><script>secret()</script>${'x'.repeat(4_100)}`,
    publishedAt: '2026-08-10T11:00:00Z',
  }, { now })
  assert.equal([...report.title].length, 500)
  assert.equal([...report.excerpt].length, 4_000)
  assert.doesNotMatch(report.excerpt, /<|secret/)
  assert.equal(report.publishedAt, '2026-08-10T11:00:00.000Z')
  assert.deepEqual(normalizeMarketSourceReport({}, { now }), { title: null, excerpt: null, publishedAt: null })
  assert.equal(normalizeMarketSourceReport({ publishedAt: 'not-a-date' }, { now }).publishedAt, null)

  const encodedMarkup = normalizeMarketSourceReport({
    excerpt: 'Plain &AMP; stable &lt;script&gt;bad()&lt;/script&gt; <StYlE>hidden{}</sTyLe> '
      + '&#60;img src=x&#62; &#x3C;script&#x3E;alsoBad()&#x3C;/script&#x3E; '
      + '&amp;lt;b&amp;gt;Double encoded&amp;lt;/b&amp;gt;',
  }, { now })
  assert.equal(encodedMarkup.excerpt, 'Plain & stable Double encoded')
  assert.doesNotMatch(encodedMarkup.excerpt, /<|>|script|style|img|bad|hidden/i)
  assert.equal(normalizeMarketSourceReport({ excerpt: 'Ordinary text stays stable.' }, { now }).excerpt,
    'Ordinary text stays stable.')

  const controls = normalizeMarketSourceReport({
    excerpt: 'A&#0;B&#x0;C&amp;#0;D&#1;E&#x1f;F&#127;G&#x80;H&#xD800;I&#xFDD0;J&#x10FFFF;K '
      + ['L', String.fromCodePoint(1), String.fromCodePoint(9), 'M', String.fromCodePoint(10), 'N'].join(''),
  }, { now })
  assert.equal(controls.excerpt, 'A B C D E F G H I J K L M N')
  assert.doesNotMatch(controls.excerpt, /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uD800-\uDFFF]/)
})

test('registration-free provider parsers fail closed and discard malformed records', () => {
  assert.throws(() => parseGitHubReleasePayload({ error: 'quota' }, 'BTC', 'bitcoin/bitcoin'), /invalid_payload/)
  assert.throws(() => parseBinanceKlines({ code: -1121 }), /invalid_payload/)
  assert.equal(parseGitHubReleasePayload([{ id: 1, name: 'missing URL', published_at: '2026-08-08' }], 'BTC', 'bitcoin/bitcoin').length, 0)
  assert.deepEqual(parseBinanceKlines([[1786275300000, '1', '2', '1', '64990.45']]).map(item => item.close), [64990.45])
})

test('SEC company feeds keep significant forms and bind the requested symbol', () => {
  const items = parseSecCompanyFeed(`<?xml version="1.0"?><feed>
    <entry><title>8-K - Apple Inc.</title><link href="https://www.sec.gov/Archives/a"/><updated>2026-08-08T10:00:00Z</updated><id>a</id></entry>
    <entry><title>4 - Apple Inc.</title><link href="https://www.sec.gov/Archives/b"/><updated>2026-08-08T10:00:00Z</updated><id>b</id></entry>
  </feed>`, 'AAPL')
  assert.equal(items.length, 1)
  assert.equal(items[0].explicitSymbols[0], 'AAPL')
  assert.match(items[0].title, /^AAPL 8-K/)
})

test('US premarket scheduling follows New York wall time and excludes weekends', () => {
  assert.equal(newYorkParts(new Date('2026-08-10T12:45:00Z')).hour, '08')
  assert.equal(isUsPremarketWindow(new Date('2026-08-10T12:45:00Z')), true)
  assert.equal(isUsPremarketWindow(new Date('2026-08-08T12:45:00Z')), false)
})

test('public SQL view and APIs preserve privacy and outbox delivery semantics', () => {
  const migration = read('market-radar/migrations/001_initial.sql')
  const claim = read('api/market-radar/outbox/claim.ts')
  const ack = read('api/market-radar/outbox/ack.ts')
  const repository = read('lib/market-radar/repository.ts')
  const publicView = migration.slice(migration.indexOf('create or replace view market_radar.public_events'))
  assert.doesNotMatch(publicView, /payload|prompt|private_note/i)
  assert.match(claim, /for update skip locked/i)
  assert.match(claim, /lease_until/i)
  assert.match(ack, /attempts \+ 1 >= 5/i)
  assert.match(ack, /dead_letter/i)
  assert.match(ack, /power\(2, attempts \+ 1\)/i)
  assert.doesNotMatch(repository, /raw_items\.payload|ai_response|prompt/i)
})

test('worker uses composite overlap cursors and purges payload without deleting source evidence', () => {
  const worker = read('market-radar/worker/run.mjs')
  const maintenance = read('market-radar/worker/maintenance.mjs')
  assert.match(worker, /source_cursors/)
  const cursor = parseMarketSourceCursor(encodeMarketSourceCursor({
    publishedAt: '2026-08-10T10:00:00.000Z', providerId: 'provider-b',
  }))
  const items = [
    { providerId: 'provider-a', publishedAt: '2026-08-10T10:00:00.000Z' },
    { providerId: 'provider-c', publishedAt: '2026-08-10T10:00:00.000Z' },
    { providerId: 'late-item', publishedAt: '2026-08-09T10:00:00.000Z' },
    { providerId: 'expired-overlap', publishedAt: '2026-07-01T10:00:00.000Z' },
  ]
  assert.deepEqual(selectMarketItemsAfterCursor(items, cursor).map(item => item.providerId), [
    'provider-a', 'provider-c', 'late-item',
  ])
  assert.deepEqual(newestMarketSourceCursor(items, cursor), {
    publishedAt: '2026-08-10T10:00:00.000Z', providerId: 'provider-c',
  })
  assert.match(maintenance, /payload = '\{"retained":false\}'::jsonb/)
  assert.match(maintenance, /payload_purged_at = now\(\)/)
  assert.doesNotMatch(maintenance, /delete from market_radar\.raw_items[\s\S]{0,120}payload_expires_at/)
})

test('slow collection leaves the shared lock free and write contention cannot advance work', async () => {
  let releaseFetch
  let prepareCalls = 0
  const collecting = collectMarketSourceOutsideLock({
    fetchItems: () => new Promise(resolve => { releaseFetch = resolve }),
    prepareItem: async () => { prepareCalls += 1; return null },
  })
  await Promise.resolve()

  let lockHeld = false
  const withLock = async (work) => {
    if (lockHeld) return { acquired: false }
    lockHeld = true
    try { return { acquired: true, value: await work() } } finally { lockHeld = false }
  }
  const migration = await withLock(async () => 'migration-acquired-during-fetch')
  assert.deepEqual(migration, { acquired: true, value: 'migration-acquired-during-fetch' })
  assert.equal(prepareCalls, 0)

  releaseFetch([{ provider: 'fixture', providerId: 'same-second', publishedAt: '2026-08-10T10:00:00Z' }])
  const collected = await collecting
  assert.equal(collected.preparedItems.length, 1)
  lockHeld = true
  let wrote = false
  const competed = await persistCollectedWithLock({
    withLock,
    work: async () => { wrote = true },
  })
  lockHeld = false
  assert.deepEqual(competed, { skipped: true, reason: 'radar_database_lock_held' })
  assert.equal(wrote, false)
})

test('a failed market batch persistence cannot advance its cursor', async () => {
  const finishCalls = []
  let cursorWrites = 0
  const item = {
    provider: 'fixture', providerId: 'write-failure', publishedAt: '2026-08-10T10:00:00Z',
  }
  const result = await persistMarketSourceBatch({
    source: 'fixture',
    fetchedItems: [item],
    preparedItems: [{ item, summary: null }],
    startRun: async () => 'run-1',
    finishRun: async (...args) => { finishCalls.push(args) },
    loadCursor: async () => null,
    persistItem: async () => { throw new Error('fixture_write_failed') },
    saveCursor: async () => { cursorWrites += 1 },
  })
  assert.deepEqual(result, { source: 'fixture', error: 'fixture_write_failed' })
  assert.equal(cursorWrites, 0)
  assert.deepEqual(finishCalls, [['run-1', 'failed', 0, 'fixture_write_failed']])
})

test('overlap replays and raw revisions do not repeat AI preparation', async () => {
  const known = new Set()
  let aiCalls = 0
  const item = { provider: 'github_releases', providerId: 'repo:1', publishedAt: '2026-08-10T10:00:00Z' }
  const collect = currentItem => collectMarketSourceOutsideLock({
    fetchItems: async () => [currentItem],
    preflightItems: async items => new Map(items.map(candidate => [
      `${candidate.provider}:${candidate.providerId}`,
      !known.has(`${candidate.provider}:${candidate.providerId}`),
    ])),
    prepareItem: async candidate => {
      aiCalls += 1
      known.add(`${candidate.provider}:${candidate.providerId}`)
      return { titleZh: 'fixture' }
    },
  })
  const first = await collect(item)
  const replay = await collect(item)
  const revision = await collect({ ...item, title: 'corrected source title' })
  assert.equal(first.preparedItems[0].summary.titleZh, 'fixture')
  assert.equal(replay.preparedItems[0].summary, null)
  assert.equal(revision.preparedItems[0].summary, null)
  assert.equal(aiCalls, 1)
})

test('worker lease releases after collection or persistence throws', async () => {
  const calls = []
  await assert.rejects(withMarketWorkerLease({
    claim: async () => ({ token: 'lease-token' }),
    release: async state => { calls.push(`release:${state.token}`) },
    work: async () => { calls.push('work'); throw new Error('fixture_failure') },
  }), /fixture_failure/)
  assert.deepEqual(calls, ['work', 'release:lease-token'])
})

test('event pagination cursor keeps timestamp and id together', () => {
  const parsed = parseEventCursor('2026-08-08T10:00:00.000Z|event-2')
  assert.deepEqual(parsed, { publishedAt: '2026-08-08T10:00:00.000Z', id: 'event-2' })
  assert.equal(parseEventCursor('2026-08-08T10:00:00.000Z'), null)
  assert.equal(parseEventCursor('not-a-date|event-2'), null)
  const repository = read('lib/market-radar/repository.ts')
  assert.match(repository, /\(occurred_at, id\) < /)
  assert.match(repository, /occurred_at >= now\(\) - /)
})

test('a confirmed draft can publish and enqueue P0 exactly once', () => {
  const persistence = read('market-radar/worker/persistence.mjs')
  assert.match(persistence, /existing\.status !== 'rejected'[\s\S]*hasCompleteAiV2Boundaries\(existing\) && score >= 50 && isFreshForPublic/)
  assert.match(persistence, /when status = 'rejected' then 'rejected'[\s\S]*when \$4::boolean then 'published'/)
  assert.match(persistence, /published_at = case[\s\S]*when status = 'rejected' then null[\s\S]*when \$4::boolean then coalesce\(published_at, now\(\)\)/)
  assert.match(persistence, /existing\.priority !== 'P0'/)
  assert.match(persistence, /on conflict \(idempotency_key\) do nothing/)
})

test('new events publish only with complete AI v2 verification boundaries', () => {
  const worker = read('market-radar/worker/run.mjs')
  const persistence = read('market-radar/worker/persistence.mjs')
  const summarizer = worker.slice(worker.indexOf('async function summarizeWithAi'), worker.indexOf('async function persistCollectedSource'))
  assert.match(worker, /watchFor, invalidation/)
  assert.match(worker, /系统观察边界，不是来源已陈述的事实/)
  assert.match(summarizer, /max_tokens: 900/)
  assert.match(summarizer, /JSON\.stringify\(\{ title: item\.title, summary: item\.summary, provider: item\.provider, assets \}\)/)
  assert.doesNotMatch(summarizer, /item\.(?:payload|sourceUrl|providerId|explicitSymbols)/)
  assert.match(persistence, /const publishable = Boolean\(summary\) && score >= 50 && isFreshForPublic/)
  assert.match(persistence, /summary \? 'v2' : null/)
  assert.match(persistence, /summary\?\.watchFor \|\| null, summary\?\.invalidation \|\| null/)
  assert.doesNotMatch(persistence, /summary \? 'v1' : null/)
})

test('migrations hide stale backlog and the runner applies every numbered file', () => {
  const migration = read('market-radar/migrations/002_freshness_gate.sql')
  const runner = read('market-radar/worker/migrate.mjs')
  const migrationLibrary = read('market-radar/worker/migrations.mjs')
  assert.match(migration, /occurred_at < now\(\) - interval '7 days'/)
  assert.match(migration, /id not like '%-v2-%'/)
  assert.match(migration, /occurred_at >= now\(\) - interval '7 days'/)
  assert.match(migrationLibrary, /readdir\(migrationsUrl\)/)
  assert.match(runner, /result\.value\.appliedFiles/)
})

test('verification-boundary migration is repeatable, private by default and preserves freshness', () => {
  for (const file of ['001_initial.sql', '002_freshness_gate.sql']) {
    const earlierMigration = read(`market-radar/migrations/${file}`)
    const earlierPublicView = earlierMigration.slice(earlierMigration.indexOf('create or replace view market_radar.public_events'))
    assert.match(earlierPublicView, /null::text as watch_for[\s\S]*null::text as invalidation/i)
  }
  const migration = read('market-radar/migrations/003_event_verification_boundaries.sql')
  const publicView = migration.slice(migration.indexOf('create or replace view market_radar.public_events'))
  assert.match(migration, /add column if not exists watch_for_zh text/i)
  assert.match(migration, /add column if not exists invalidation_zh text/i)
  assert.match(migration, /create or replace view market_radar\.public_events/i)
  assert.match(publicView, /e\.watch_for_zh as watch_for[\s\S]*e\.invalidation_zh as invalidation/i)
  assert.match(publicView, /occurred_at >= now\(\) - interval '7 days'/i)
  assert.doesNotMatch(publicView, /ai_schema_version|raw_items\.payload|prompt|private_note/i)
  assert.doesNotMatch(migration, /update market_radar\.events|insert into market_radar\.events/i)
})

test('all worker modes share a crash-safe database lease', () => {
  const worker = read('market-radar/worker/run.mjs')
  const orchestration = read('market-radar/worker/orchestration.mjs')
  const migration = read('market-radar/migrations/001_initial.sql')
  assert.match(migration, /create table if not exists market_radar\.worker_locks/)
  assert.match(worker, /on conflict \(lock_key\) do update/)
  assert.match(worker, /worker_locks\.lease_until <= now\(\)/)
  assert.match(orchestration, /reason: 'worker_lease_held'/)
  assert.match(orchestration, /finally \{[\s\S]*await release\(token\)/)
  assert.match(worker, /withRadarDatabaseLock/)
  assert.match(orchestration, /reason: 'radar_database_lock_held'/)
})

test('worker uses only registration-free upstream market sources', () => {
  const worker = read('market-radar/worker/run.mjs')
  const workflow = read('.github/workflows/market-radar.yml')
  const reactions = read('market-radar/worker/reactions.mjs')
  assert.match(worker, /fetchCryptoReleases/)
  assert.match(worker, /fetchSecCompanyFilings/)
  assert.match(reactions, /fetchBinanceSeries/)
  assert.match(reactions, /ea\.namespace = 'crypto'/)
  assert.doesNotMatch(`${worker}\n${workflow}`, /MARKETAUX|ALPHAVANTAGE|TWELVE_DATA/)
})

test('manual smoke runs can select one bounded market group', () => {
  const worker = read('market-radar/worker/run.mjs')
  assert.match(worker, /--group=/)
  assert.match(worker, /Unknown market radar group/)
  assert.match(worker, /MARKET_GROUPS\.find/)
})

test('the duplicate DST premarket trigger exits before claiming quota', () => {
  const worker = read('market-radar/worker/run.mjs')
  assert.ok(worker.indexOf("reason: 'outside_us_premarket_window'") < worker.indexOf('claimWorkerLease(sql)'))
})
