import assert from 'node:assert/strict'
import test from 'node:test'
import { articleReadingRows, filterArticleRows } from '../src/data/articlePresentation.ts'
import { aboutEvidenceRows, aboutReadingLinks } from '../src/data/aboutPresentation.ts'
import { filterMarketEvents, formatMarketTime, marketSnapshotSummary } from '../src/data/marketRadarPresentation.ts'
import { getSnapshotFreshness } from '../src/data/snapshotFreshness.ts'
import { evidenceRecords } from '../src/data/generatedEvidence.ts'
import { deliveryRecords } from '../src/data/generatedDeliveries.ts'
import { projects } from '../src/data/generatedProjects.ts'
import { latestMarketRadars } from '../src/data/generatedMarketRadars.ts'

test('note index preserves publication, update, series and evidence independently', () => {
  const article = { id: 1, slug: 'one', date: '2026-01-01', updatedAt: '2026-10-01', title: 'Nonce 恢复', summary: '签名边界', kind: 'research', tags: ['EVM'], conceptTags: ['wallet'], suggestedQuestions: ['广播结果未知怎么办'], relatedProjectIds: [3], evidenceLevel: 'local-verified', difficulty: '进阶', series: '恢复', seriesOrder: 1 }
  const second = { ...article, id: 2, slug: 'two', date: '2026-02-01', kind: 'engineering-note', seriesOrder: 2 }
  const rows = articleReadingRows([article, second], [{ id: 3, name: '项目 A' }])
  assert.deepEqual(rows.map(row => row.article.slug), ['two', 'one'])
  assert.equal(rows[1].article.date, '2026-01-01')
  assert.equal(rows[1].article.updatedAt, '2026-10-01')
  assert.equal(rows[1].seriesLabel, '恢复 · 1/2')
  assert.equal(rows[1].evidenceLabel, '本地已验证')
  assert.deepEqual(rows[1].projectNames, ['项目 A'])
  assert.equal(filterArticleRows(rows, { kind: 'research', query: '  evm  ' })[0], rows[1])
  assert.equal(filterArticleRows(rows, { query: '广播结果未知' }).length, 2)
  assert.deepEqual(filterArticleRows(rows, { query: '不存在' }), [])
  assert.deepEqual(articleReadingRows([], []), [])
})

test('about evidence uses original records and does not invent missing proof or dates', () => {
  const rows = aboutEvidenceRows(evidenceRecords, deliveryRecords)
  assert.deepEqual(rows.map(row => row.id), ['market', 'wallet', 'ai'])
  for (const row of rows) assert.match(row.date, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(rows.find(row => row.id === 'wallet').date, evidenceRecords.find(record => record.slug === 'wallet-lab-demo').verifiedAt)
  assert.match(rows.find(row => row.id === 'wallet').label, /历史模拟/)
  assert.match(rows.find(row => row.id === 'ai').label, /历史交付/)
  assert.deepEqual(aboutEvidenceRows([], []), [])
  assert.deepEqual(aboutReadingLinks.map(link => link.to), ['/', '/radar', '/articles', '/engineering/evidence'])
  assert.equal(projects.filter(project => project.publicRole === 'current-product').length, 1)
  assert.equal(projects.find(project => project.publicRole === 'current-product').slug, 's78-market-services')
  assert.equal(projects.filter(project => project.publicRole === 'current-direction').length, 1)
})

test('market filtering retains immutable snapshot facts, provenance and invalidation', () => {
  const snapshot = structuredClone(latestMarketRadars[0])
  const before = structuredClone(snapshot)
  const first = snapshot.events[0]
  assert.equal(filterMarketEvents(snapshot.events, { category: first.category, query: first.title })[0], first)
  assert.equal(filterMarketEvents(snapshot.events, { query: first.assets[0].toLowerCase() }).includes(first), true)
  assert.deepEqual(filterMarketEvents(snapshot.events, { query: 'no-such-event-123' }), [])
  assert.equal(marketSnapshotSummary(snapshot).eventCount, snapshot.events.length)
  assert.equal(marketSnapshotSummary(snapshot).assetCount, new Set(snapshot.events.flatMap(event => event.assets)).size)
  assert.deepEqual(snapshot, before)
  assert.ok(first.sourceUrl && first.sourcePublishedAt && first.watchFor && first.invalidation)
  const twoDaysAfterSnapshot = new Date(snapshot.date + 'T04:00:00Z')
  twoDaysAfterSnapshot.setUTCDate(twoDaysAfterSnapshot.getUTCDate() + 2)
  assert.equal(getSnapshotFreshness(snapshot.date, twoDaysAfterSnapshot).isArchive, true)
  assert.deepEqual(marketSnapshotSummary(), { eventCount: 0, highPriorityCount: 0, assetCount: 0 })
  assert.equal(formatMarketTime(), '持续观察')
  assert.equal(formatMarketTime('bad-date'), '时间待核对')
  assert.equal(formatMarketTime('2026-10-23T00:00:00Z'), '10/23 08:00')
})
