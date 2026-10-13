import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ackSql, claimSql } from '../lib/radar-notifications/outbox-sql.ts'

// The golden file holds the exact SQL the four Hermes routes sent before they
// were folded into one handler factory. Any drift is a frozen-contract change.
const golden = JSON.parse(readFileSync(new URL('./fixtures/outbox-sql.golden.json', import.meta.url), 'utf8'))

const learning = { schema: 'learning_radar', radarKind: 'learning', claimOrder: 'created_at' }
const market = {
  schema: 'market_radar',
  radarKind: 'market',
  claimFilter: "and kind <> 'test'",
  claimOrder: "case kind when 'p0' then 0 when 'p1_batch' then 1 else 2 end, created_at",
}

test('outbox SQL is byte-identical to the pre-refactor routes', () => {
  assert.equal(claimSql(learning), golden['learning.claim'])
  assert.equal(claimSql(market), golden['market.claim'])
  assert.equal(ackSql(learning), golden['learning.ack'])
  assert.equal(ackSql(market), golden['market.ack'])
})

test('route config keeps each outbox in its own schema with its own kinds', () => {
  const routes = readFileSync(new URL('../lib/radar-notifications/outbox-routes.ts', import.meta.url), 'utf8')
  assert.match(routes, /schema: 'learning_radar'[\s\S]*LEARNING_NOTIFICATION_KINDS[\s\S]*claimOrder: 'created_at'/)
  assert.match(routes, /schema: 'market_radar'[\s\S]*MARKET_NOTIFICATION_KINDS[\s\S]*claimFilter: "and kind <> 'test'"/)
  for (const [dir, name] of [['radar', 'learningOutbox'], ['market-radar', 'marketOutbox']]) {
    for (const route of ['claim', 'ack']) {
      const source = readFileSync(new URL(`../api/${dir}/outbox/${route}.ts`, import.meta.url), 'utf8')
      assert.match(source, new RegExp(`export default ${name}\\.${route}\\b`))
    }
  }
})
