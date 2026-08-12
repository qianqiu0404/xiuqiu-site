import assert from 'node:assert/strict'
import test from 'node:test'
import { assertResearchPublication, buildRadarPublication, selectRadarDataset } from './radar-publication-boundary.mjs'
import { readFileSync } from 'node:fs'

const research = {
  date: '2026-08-12',
  generatedAt: '2026-08-12T07:45:00+08:00',
  title: 'Anthropic 发布 Managed Agents 架构说明',
  sourceUrls: ['https://www.anthropic.com/engineering/managed-agents'],
}

test('research snapshots are deterministic and carry the publication boundary', () => {
  const first = buildRadarPublication('learning', research)
  const reordered = buildRadarPublication('learning', {
    sourceUrls: research.sourceUrls,
    title: research.title,
    generatedAt: research.generatedAt,
    date: research.date,
  })
  assert.equal(first.snapshotId, reordered.snapshotId)
  assert.equal(first.asOf, '2026-08-11T23:45:00.000Z')
  assert.equal(first.origin, 'research')
  assert.equal(first.publicationState, 'published')
  assert.match(first.payloadChecksum, /^[0-9a-f]{64}$/)
})

test('Preview fixtures and local engineering activity fail closed', () => {
  for (const title of [
    '[PREVIEW PR #81] Learning Radar 动态时间线验收',
    'Preview QA｜PostgreSQL advisory lock 的连接边界',
    'xiuqiu-site PR #81 Vercel Preview 部署通过',
  ]) {
    assert.throws(() => assertResearchPublication({ title }), /Preview|local PR/)
  }
})

test('static and API datasets are never merged across snapshot ids', () => {
  const staticDataset = { snapshotId: 'learning-a', items: ['static'] }
  const mismatchedApi = { snapshotId: 'learning-b', items: ['api'] }
  assert.equal(selectRadarDataset(staticDataset, mismatchedApi), staticDataset)
  assert.equal(selectRadarDataset(staticDataset, { ...mismatchedApi, snapshotId: 'learning-a' }).items[0], 'api')
})

test('snapshot publishing is separate from notification delivery', () => {
  const publisher = readFileSync(new URL('./publish-radar-snapshots.mjs', import.meta.url), 'utf8')
  const store = readFileSync(new URL('./radar-publication-store.mjs', import.meta.url), 'utf8')
  const notifications = readFileSync(new URL('./enqueue-radar-notifications.mjs', import.meta.url), 'utf8')
  assert.match(`${publisher}\n${store}`, /publication_snapshots/)
  assert.doesNotMatch(`${publisher}\n${store}`, /\.outbox|build\w*Notification|enqueue/i)
  assert.doesNotMatch(notifications, /publishRadarSnapshot|radar-publication-store/)
  assert.match(notifications, /requirePublishedSnapshot/)
  assert.match(notifications, /source_revision=\$6/)
  assert.match(notifications, /verifyExactGitPublication/)
})
