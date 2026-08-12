import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { MARKET_ASSET_IDS, canonicalJson, computeMarketSnapshotChecksum, parseMarketSnapshot } from '../lib/market-snapshot/contract.ts'
import { MARKET_SNAPSHOT_HEADERS, MARKET_SNAPSHOT_INGEST_PATH, verifyMarketSnapshotSignature } from '../lib/market-snapshot/auth.ts'
import { marketRoutePath } from '../lib/market-snapshot/routes.ts'

function snapshot(overrides = {}) {
  const value = {
    schemaVersion: 1,
    universeVersion: 'core-2026-08-v1',
    snapshotId: '',
    asOf: '2026-08-12T08:00:00Z',
    generatedAt: '2026-08-12T08:00:00Z',
    mode: 'mixed',
    quotes: [{ assetId: 'BTC-USDT', role: 'display', price: '120000.1', currency: 'USDT', observedAt: '2026-08-12T07:59:59Z', delaySeconds: 1, provider: 'binance_public', mode: 'live', displayScope: 'private' }],
    coverage: MARKET_ASSET_IDS.map((assetId, index) => index === 0
      ? { assetId, status: 'healthy', marketState: 'open' }
      : { assetId, status: 'unavailable', marketState: 'unknown', reason: 'provider_not_added_in_m2a' }),
    checksum: '',
    ...overrides,
  }
  value.checksum = computeMarketSnapshotChecksum(value)
  value.snapshotId = `market-2026-08-12-${value.checksum.slice(0, 16)}`
  return value
}

test('market snapshot contract accepts exactly 21 assets and deterministic identity', () => {
  const value = snapshot()
  assert.equal(parseMarketSnapshot(value).coverage.length, 21)
  assert.equal(computeMarketSnapshotChecksum(value), value.checksum)
  assert.equal(canonicalJson({ b: 2, a: 1 }), '{"a":1,"b":2}')
})

test('market snapshot contract rejects mutation, duplicates and partial coverage', () => {
  const mutated = snapshot()
  mutated.quotes[0].price = '1'
  assert.throws(() => parseMarketSnapshot(mutated), /checksum/)
  const partial = snapshot({ coverage: snapshot().coverage.slice(0, 20) })
  assert.throws(() => parseMarketSnapshot(partial), /exactly 21/)
  const duplicate = snapshot()
  duplicate.coverage[1].assetId = duplicate.coverage[0].assetId
  duplicate.checksum = computeMarketSnapshotChecksum(duplicate)
  duplicate.snapshotId = `market-2026-08-12-${duplicate.checksum.slice(0, 16)}`
  assert.throws(() => parseMarketSnapshot(duplicate), /duplicate/)

  const wrongScope = snapshot()
  wrongScope.quotes[0].role = 'analysis'
  wrongScope.checksum = computeMarketSnapshotChecksum(wrongScope)
  wrongScope.snapshotId = `market-2026-08-12-${wrongScope.checksum.slice(0, 16)}`
  assert.throws(() => parseMarketSnapshot(wrongScope), /display scope/)

  const unavailableWithQuote = snapshot()
  unavailableWithQuote.coverage[0] = { assetId: 'BTC-USDT', status: 'unavailable', marketState: 'open', reason: 'forced' }
  unavailableWithQuote.checksum = computeMarketSnapshotChecksum(unavailableWithQuote)
  unavailableWithQuote.snapshotId = `market-2026-08-12-${unavailableWithQuote.checksum.slice(0, 16)}`
  assert.throws(() => parseMarketSnapshot(unavailableWithQuote), /cannot contain/)

  const falseDelay = snapshot()
  falseDelay.quotes[0].delaySeconds = 30
  falseDelay.checksum = computeMarketSnapshotChecksum(falseDelay)
  falseDelay.snapshotId = `market-2026-08-12-${falseDelay.checksum.slice(0, 16)}`
  assert.throws(() => parseMarketSnapshot(falseDelay), /delay conflicts/)

  const staleAsHealthy = snapshot()
  staleAsHealthy.quotes[0].observedAt = '2026-08-12T07:50:00Z'
  staleAsHealthy.quotes[0].delaySeconds = 600
  staleAsHealthy.checksum = computeMarketSnapshotChecksum(staleAsHealthy)
  staleAsHealthy.snapshotId = `market-2026-08-12-${staleAsHealthy.checksum.slice(0, 16)}`
  assert.throws(() => parseMarketSnapshot(staleAsHealthy), /freshness conflicts/)

  const eodAsLive = snapshot()
  eodAsLive.quotes[0].mode = 'eod'
  eodAsLive.mode = 'live'
  eodAsLive.checksum = computeMarketSnapshotChecksum(eodAsLive)
  eodAsLive.snapshotId = `market-2026-08-12-${eodAsLive.checksum.slice(0, 16)}`
  assert.throws(() => parseMarketSnapshot(eodAsLive), /mode conflicts|requires mixed/)
})

test('HMAC verifies exact body, expires and rejects replay inputs before storage', () => {
  const body = JSON.stringify(snapshot())
  const secret = 's'.repeat(32)
  const keyId = 'm2-preview'
  const timestamp = 1786521600000
  const nonce = 'a'.repeat(32)
  const bodyHash = createHash('sha256').update(body).digest('hex')
  const canonical = ['market-snapshot-v1', keyId, 'POST', MARKET_SNAPSHOT_INGEST_PATH, String(timestamp), nonce, bodyHash].join('\n')
  const headers = {
    [MARKET_SNAPSHOT_HEADERS.keyId]: keyId,
    [MARKET_SNAPSHOT_HEADERS.timestamp]: String(timestamp),
    [MARKET_SNAPSHOT_HEADERS.nonce]: nonce,
    [MARKET_SNAPSHOT_HEADERS.bodyHash]: bodyHash,
    [MARKET_SNAPSHOT_HEADERS.signature]: createHmac('sha256', secret).update(canonical).digest('hex'),
  }
  assert.deepEqual(verifyMarketSnapshotSignature({ body, headers, keys: { [keyId]: secret }, now: timestamp }), { ok: true, keyId, nonce, timestamp })
  assert.equal(verifyMarketSnapshotSignature({ body: `${body} `, headers, keys: { [keyId]: secret }, now: timestamp }).ok, false)
  assert.deepEqual(verifyMarketSnapshotSignature({ body, headers, keys: { [keyId]: secret }, now: timestamp + 60_001 }), { ok: false, code: 'expired_signature' })
})

test('public contract and private projection fail closed against price leakage', async () => {
  const repository = await readFile(new URL('../lib/market-snapshot/repository.ts', import.meta.url), 'utf8')
  const api = await readFile(new URL('../api/[...m2].ts', import.meta.url), 'utf8')
  const migration = await readFile(new URL('../market-radar/migrations/013_market_snapshots.sql', import.meta.url), 'utf8')
  assert.match(repository, /public_current_coverage/)
  const publicProjection = repository.slice(repository.indexOf('export async function getPublicMarketStatus'), repository.indexOf('export async function getPrivateMarketSnapshot'))
  assert.doesNotMatch(publicProjection, /price|quotes|currency|provider/i)
  assert.match(repository, /display_scope = 'private'/)
  assert.match(repository, /q\.role = 'display'/)
  assert.match(repository, /with selected as materialized/)
  assert.match(api, /requirePrivateMarketSession/)
  assert.match(migration, /deliberately contains no quote price/)
})

test('GitHub login is pinned to the Preview callback and immutable numeric account', async () => {
  const oauth = await readFile(new URL('../lib/private-market/oauth.ts', import.meta.url), 'utf8')
  const callback = await readFile(new URL('../api/[...m2].ts', import.meta.url), 'utf8')
  assert.match(oauth, /xiuqiu-site-m2-preview\.vercel\.app\/api\/private-market\/auth\/github\/callback/)
  assert.match(oauth, /allowedUserId !== 155644811/)
  assert.match(callback, /code_verifier: verifier/)
  assert.match(callback, /user\.id !== config\.allowedUserId/)
  assert.match(callback, /tokenPayload\.scope/)
})

test('M2 stays within the existing Vercel function budget while preserving fixed routes', async () => {
  const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
  assert.equal(vercel.rewrites, undefined)
  const api = await readFile(new URL('../api/[...m2].ts', import.meta.url), 'utf8')
  assert.match(api, /path === 'private-market\/auth\/github\/callback'/)
  assert.match(api, /path === 'internal\/market-snapshots'/)
  assert.equal(marketRoutePath('/api/private-market/snapshot?m2=internal/market-snapshots'), 'private-market/snapshot')
  assert.equal(marketRoutePath('/api/internal/market-snapshots?action=status'), 'internal/market-snapshots')
  assert.equal(marketRoutePath('/api/market-radar/market-status'), 'market-radar/market-status')
})

test('public Trade Radar uses compact title and price-free market status', async () => {
  const page = await readFile(new URL('../src/pages/MarketRadarPage.vue', import.meta.url), 'utf8')
  const privatePage = await readFile(new URL('../src/pages/PrivateMarketPage.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles/market-radar.css', import.meta.url), 'utf8')
  assert.match(page, /<h1>交易雷达<\/h1>/)
  assert.match(page, /\/api\/market-radar\/market-status/)
  assert.match(page, /仅显示状态，不包含原始价格/)
  assert.match(privatePage, /data-snapshot-id/)
  assert.match(privatePage, /data-market-status/)
  assert.doesNotMatch(privatePage, /:data-status=/)
  assert.match(privatePage, /使用 GitHub 登录/)
  assert.match(styles, /font-size: clamp\(2\.35rem, 4vw, 3\.75rem\)/)
})
