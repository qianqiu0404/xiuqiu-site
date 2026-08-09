import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { mapPublicEventRow } from '../src/market-radar/public-event.ts'
import { publicEventRowLegacy, publicEventRowV2 } from './fixtures/market-radar-public-event-row.mjs'

test('a public_events row is mapped through the production allowlist into the v2 DTO', () => {
  const event = mapPublicEventRow({
    ...publicEventRowV2,
    payload: { secret: true }, prompt: 'internal', private_note: 'internal', ai_schema_version: 'v2', cluster_key: 'internal', status: 'published',
  })
  assert.equal(event.watchFor, publicEventRowV2.watch_for)
  assert.equal(event.invalidation, publicEventRowV2.invalidation)
  assert.equal(event.sources[0]?.url, publicEventRowV2.sources[0].url)
  assert.equal(event.assets[0]?.symbol, 'BTC')
  for (const key of ['payload', 'prompt', 'private_note', 'ai_schema_version', 'cluster_key', 'status']) {
    assert.equal(Object.hasOwn(event, key), false)
  }
  assert.equal(Object.hasOwn(publicEventRowV2, 'watchFor'), false)
  assert.equal(Object.hasOwn(publicEventRowV2, 'watch_for'), true)
})

test('legacy, missing and blank boundary columns map to explicit nulls', () => {
  const legacy = mapPublicEventRow(publicEventRowLegacy)
  const missingRow = { ...publicEventRowV2 }
  delete missingRow.watch_for
  delete missingRow.invalidation
  const missing = mapPublicEventRow(missingRow)
  const blank = mapPublicEventRow({ ...publicEventRowV2, watch_for: '  ', invalidation: '\n' })
  assert.deepEqual([legacy.watchFor, legacy.invalidation], [null, null])
  assert.deepEqual([missing.watchFor, missing.invalidation], [null, null])
  assert.deepEqual([blank.watchFor, blank.invalidation], [null, null])
})

test('the event reader keeps source, observation and invalidation visible without raw HTML', async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL('../src/pages/MarketRadarEventPage.vue', import.meta.url), 'utf8'),
    readFile(new URL('../src/styles/market-radar.css', import.meta.url), 'utf8'),
  ])
  assert.match(page, /<dt>原始来源<\/dt>/)
  assert.match(page, /<dt>接下来观察<\/dt>/)
  assert.match(page, /<dt>何时失效<\/dt>/)
  assert.match(page, /event\.watchFor \|\| legacyWatchFor/)
  assert.match(page, /event\.invalidation \|\| legacyInvalidation/)
  assert.match(page, /历史记录未提供独立观察条件。/)
  assert.match(page, /历史记录未提供独立失效条件。/)
  assert.match(page, /target="_blank" rel="noopener"/)
  assert.match(page, /class="trade-radar-source-name"/)
  assert.doesNotMatch(page, /v-html|innerHTML/)
  assert.match(styles, /\.trade-radar-event-boundaries dl \{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(styles, /\.trade-radar-event-boundaries a \{[\s\S]*min-height: 3\.25rem/)
  assert.match(styles, /\.trade-radar-source-name \{[\s\S]*overflow-wrap: anywhere/)
  assert.match(styles, /@media \(max-width: 980px\)[\s\S]*\.trade-radar-event-boundaries dl \{ grid-template-columns: minmax\(0, 1fr\); \}/)
})

test('event detail errors are no-store while successful public responses retain CDN caching', async () => {
  const [handler, http, repository] = await Promise.all([
    readFile(new URL('../api/market-radar/events/[id].ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/market-radar/http.ts', import.meta.url), 'utf8'),
    readFile(new URL('../lib/market-radar/repository.ts', import.meta.url), 'utf8'),
  ])
  assert.match(handler, /preparePublicResponse\(res\)/)
  assert.match(handler, /sendPublicError\(res, 400/)
  assert.match(handler, /sendPublicError\(res, 404/)
  assert.match(handler, /sendPublicError\(res, 503/)
  assert.match(http, /public, s-maxage=60, stale-while-revalidate=300/)
  assert.match(http, /prepareNoStoreResponse\(res\)/)
  assert.match(repository, /select \* from market_radar\.public_events/)
  assert.doesNotMatch(repository, /raw_items\.payload|prompt|private_note|ai_schema_version|cluster_key/i)
})
