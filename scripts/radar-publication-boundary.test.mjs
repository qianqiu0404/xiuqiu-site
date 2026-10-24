import assert from 'node:assert/strict'
import test from 'node:test'
import { assertResearchPublication, buildRadarPublication, selectRadarDataset } from './radar-publication-boundary.mjs'
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { selectRadarPublicationPlan } from './radar-publication-selection.mjs'

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
  assert.match(`${publisher}\n${store}`, /publication_snapshots/)
  assert.doesNotMatch(`${publisher}\n${store}`, /\.outbox|build\w*Notification|enqueue/i)
})

test('release selection uses latest published source per lane, including after midnight', () => {
  const directory = mkdtempSync(join(tmpdir(), 'radar-publication-'))
  const root = pathToFileURL(directory + '/')
  const write = (lane, date, overrides = {}) => {
    const folder = join(directory, 'content', lane)
    mkdirSync(folder, { recursive: true })
    writeFileSync(join(folder, date + '.md'), '---\n' + JSON.stringify({ date, slug: date, publish: true, reviewStatus: 'automated', ...overrides }) + '\n---\n')
  }
  try {
    write('radar', '2026-10-24')
    write('radar', '2026-10-25', { publish: false })
    write('radar', '2026-10-26', { publish: false })
    write('market-radar', '2026-10-23')
    const plan = selectRadarPublicationPlan({ root, today: '2026-10-25', env: { RADAR_PUBLICATION_SELECTION: 'latest' } })
    assert.deepEqual(plan.dates, ['2026-10-23', '2026-10-24'])
    assert.deepEqual(plan.byKind, { learning: '2026-10-24', market: '2026-10-23' })
    assert.deepEqual([...plan.kinds], ['learning', 'market'])
    write('radar', '2026-10-26')
    assert.throws(() => selectRadarPublicationPlan({ root, today: '2026-10-25', env: { RADAR_PUBLICATION_SELECTION: 'latest' } }), /Future published research/)
    write('radar', '2026-10-26', { publish: false })
    write('market-radar', '2026-10-24', { slug: '2026-10-23' })
    assert.throws(() => selectRadarPublicationPlan({ root, today: '2026-10-25', env: { RADAR_PUBLICATION_SELECTION: 'latest' } }), /must agree/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('publication selection retains explicit date mode and fails closed on ambiguous input', () => {
  assert.deepEqual(selectRadarPublicationPlan({ env: {}, today: '2026-10-24' }).dates, ['2026-10-24'])
  assert.deepEqual(selectRadarPublicationPlan({ env: { RADAR_PUBLICATION_DATES: '2026-10-23,2026-10-24' } }).dates, ['2026-10-23', '2026-10-24'])
  for (const env of [
    { RADAR_PUBLICATION_DATES: 'yesterday' },
    { RADAR_PUBLICATION_KINDS: 'unknown' },
    { RADAR_PUBLICATION_SELECTION: 'all' },
    { RADAR_PUBLICATION_SELECTION: 'latest', RADAR_PUBLICATION_DATE: '2026-10-24' },
  ]) assert.throws(() => selectRadarPublicationPlan({ env }))
})
