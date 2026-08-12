import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMarketResearchPack } from './market-radar-contracts.mjs'
import { verifyDailyMarketResearch, verifyPublishedMarketResearch } from './verify-market-research-production.mjs'

const event = {
  id: 'official-event', priority: 'P0', status: 'released', category: 'macro', title: '官方事件',
  fact: '官方已发布可验证事实。', whyWatch: '该事实可能改变公开市场观察边界。', assets: ['SPY'],
  watchFor: '核对正式结果与跨资产反应。', invalidation: '官方修订后重新评估。',
  sourceName: 'Federal Reserve', sourceUrl: 'https://www.federalreserve.gov/example', sourcePublishedAt: '2026-08-13',
}
const publication = {
  snapshotId: 'market-2026-08-13-0000000000000000', asOf: '2026-08-12T23:50:00.000Z',
  origin: 'research', publicationState: 'published',
}
const entry = {
  date: '2026-08-13', schemaVersion: 2, events: [event],
  researchQuestions: [
    { id: '1', lens: 'transmission', shortQuestion: '事件通过哪些可验证环节影响相关资产？', focusEventIds: [event.id] },
    { id: '2', lens: 'falsification', shortQuestion: '哪些跨资产证据会推翻当前解释？', focusEventIds: [event.id] },
    { id: '3', lens: 'scenario', shortQuestion: '最强反方情景与失效条件是什么？', focusEventIds: [event.id] },
  ],
}

function productionFetch(pack, { snapshotId = publication.snapshotId, canonical = pack.pageUrl } = {}) {
  return async url => {
    if (url.pathname.startsWith('/data/market-radar-packs/')) {
      return new Response(JSON.stringify(pack), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(`<!doctype html><title>交易研究雷达 · ${entry.date}｜xiuqiu</title><link href="${canonical}" rel="canonical"><meta content="${snapshotId}" name="xiuqiu:market-radar-snapshot">`, {
      status: 200, headers: { 'content-type': 'text/html' },
    })
  }
}

test('production verifier binds page, JSON, snapshot and all prompt checksums', async () => {
  const pack = buildMarketResearchPack(entry, publication)
  const result = await verifyPublishedMarketResearch(entry, publication, { fetchImpl: productionFetch(pack) })
  assert.equal(result.status, 'verified')
  assert.equal(result.snapshotId, publication.snapshotId)
  assert.deepEqual(result.promptChecksums, pack.questions.map(({ id, promptChecksum }) => ({ id, promptChecksum })))
})

test('production verifier fails closed on pack, canonical and snapshot drift', async () => {
  const pack = buildMarketResearchPack(entry, publication)
  const drifted = structuredClone(pack)
  drifted.questions[0].promptChecksum = '0'.repeat(64)
  await assert.rejects(
    verifyPublishedMarketResearch(entry, publication, { fetchImpl: productionFetch(drifted) }),
    /differs from the exact release snapshot/,
  )
  await assert.rejects(
    verifyPublishedMarketResearch(entry, publication, { fetchImpl: productionFetch(pack, { canonical: 'https://xiuqiu-site.vercel.app/market-radar/other' }) }),
    /canonical differs/,
  )
  await assert.rejects(
    verifyPublishedMarketResearch(entry, publication, { fetchImpl: productionFetch(pack, { snapshotId: 'market-2026-08-13-badbadbadbadbadb' }) }),
    /snapshot differs/,
  )
})

test('production verifier retries bounded failures and treats absent daily content as no notification work', async () => {
  const missing = await verifyDailyMarketResearch({ date: '2099-12-31', fetchImpl: async () => { throw new Error('must not fetch') } })
  assert.deepEqual(missing, { status: 'missing', date: '2099-12-31' })
  await assert.rejects(
    verifyPublishedMarketResearch(entry, publication, {
      fetchImpl: async () => new Response('unavailable', { status: 503, headers: { 'content-type': 'text/plain' } }),
    }),
    /returned HTTP 503/,
  )
})
