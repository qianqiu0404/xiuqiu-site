import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  calculateExcess, calculateReturn, clusterKey, mapAssets, nearestPrice, normalizeUrl,
  priorityForScore, scoreEvent, titleSimilarity, validateAiSummary,
} from '../market-radar/worker/core.mjs'
import { isUsPremarketWindow, newYorkParts } from '../market-radar/worker/market-calendar.mjs'
import { parseAlphaVantagePayload, parseMarketauxPayload, parseRss } from '../market-radar/worker/providers.mjs'
import { parseEventCursor } from '../lib/market-radar/repository.ts'

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

test('AI summaries fail closed unless every public field and enum is valid', () => {
  const valid = validateAiSummary({
    titleZh: '监管事件', summaryZh: '公开摘要', whyItMattersZh: '影响关注资产', eventType: 'regulation',
    direction: 'mixed', horizon: 'days', systemJudgment: '等待行情确认',
  })
  assert.equal(valid?.direction, 'mixed')
  assert.equal(validateAiSummary({ titleZh: '缺字段' }), null)
  assert.equal(validateAiSummary({ ...valid, direction: 'buy_now' }), null)
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
})

test('provider payload parsers fail closed and discard malformed records', () => {
  assert.throws(() => parseMarketauxPayload({ error: 'quota' }, 'crypto'), /invalid_payload/)
  assert.throws(() => parseAlphaVantagePayload({ Information: 'rate limit' }, 'us_equity'), /invalid_payload/)
  assert.equal(parseMarketauxPayload({ data: [{ title: 'missing URL', published_at: '2026-08-08' }] }, 'crypto').length, 0)
  assert.equal(parseAlphaVantagePayload({ feed: [{ title: 'bad date', url: 'https://example.com', time_published: 'bad' }] }, 'us_equity').length, 0)
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

test('worker uses durable cursors and purges payload without deleting source evidence', () => {
  const worker = read('market-radar/worker/run.mjs')
  const maintenance = read('market-radar/worker/maintenance.mjs')
  assert.match(worker, /source_cursors/)
  assert.match(worker, /Date\.parse\(item\.publishedAt\) > cursor/)
  assert.match(maintenance, /payload = '\{"retained":false\}'::jsonb/)
  assert.match(maintenance, /payload_purged_at = now\(\)/)
  assert.doesNotMatch(maintenance, /delete from market_radar\.raw_items[\s\S]{0,120}payload_expires_at/)
})

test('event pagination cursor keeps timestamp and id together', () => {
  const parsed = parseEventCursor('2026-08-08T10:00:00.000Z|event-2')
  assert.deepEqual(parsed, { publishedAt: '2026-08-08T10:00:00.000Z', id: 'event-2' })
  assert.equal(parseEventCursor('2026-08-08T10:00:00.000Z'), null)
  assert.equal(parseEventCursor('not-a-date|event-2'), null)
  const repository = read('lib/market-radar/repository.ts')
  assert.match(repository, /\(published_at, id\) < /)
})

test('a confirmed draft can publish and enqueue P0 exactly once', () => {
  const worker = read('market-radar/worker/run.mjs')
  assert.match(worker, /Boolean\(existing\.ai_schema_version\) && score >= 50/)
  assert.match(worker, /published_at = case when \$4::boolean then coalesce\(published_at, now\(\)\)/)
  assert.match(worker, /existing\.priority !== 'P0'/)
  assert.match(worker, /on conflict \(idempotency_key\) do nothing/)
})

test('all worker modes share a crash-safe database lease', () => {
  const worker = read('market-radar/worker/run.mjs')
  const migration = read('market-radar/migrations/001_initial.sql')
  assert.match(migration, /create table if not exists market_radar\.worker_locks/)
  assert.match(worker, /on conflict \(lock_key\) do update/)
  assert.match(worker, /worker_locks\.lease_until <= now\(\)/)
  assert.match(worker, /reason: 'worker_lease_held'/)
})

test('Alpha Vantage cross-check alternates groups across four daily runs', () => {
  const worker = read('market-radar/worker/run.mjs')
  assert.match(worker, /slot % 18 === 0/)
  assert.match(worker, /Math\.floor\(slot \/ 18\) % MARKET_GROUPS\.length/)
})

test('the duplicate DST premarket trigger exits before claiming quota', () => {
  const worker = read('market-radar/worker/run.mjs')
  assert.ok(worker.indexOf("reason: 'outside_us_premarket_window'") < worker.indexOf('claimWorkerLease()'))
})
