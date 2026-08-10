import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { Pool as PgPool } from 'pg'
import { parse } from 'yaml'
import { withRadarDatabaseLock, RADAR_DATABASE_LOCK_KEY, RadarDatabaseLockTimeoutError } from '../market-radar/worker/advisory-lock.mjs'
import { applyRadarMigrations, loadRadarMigrations } from '../market-radar/worker/migrations.mjs'
import { mapPublicEventReportRow, mapPublicEventRow } from '../src/market-radar/public-event.ts'
import {
  mapPublicStoryReportRow,
  mapPublicStoryUpdateRow,
  mapPublicTimelineItemRow,
} from '../src/learning-radar/public-story.ts'
import { parseLearningRadarCursor } from '../src/learning-radar/contracts.ts'
import { publicEventReportRow, publicEventRowV2 } from './fixtures/market-radar-public-event-row.mjs'
import {
  publicLearningReportRow,
  publicLearningTimelineRow,
  publicLearningUpdateRow,
} from './fixtures/learning-radar-public-story-row.mjs'

const root = new URL('../', import.meta.url)
const read = path => readFile(new URL(path, root), 'utf8')

test('timeline workflow concurrency domains cannot cancel one another', async () => {
  const [controllerSource, marketSource, learningSource] = await Promise.all([
    read('.github/workflows/release-controller.yml'),
    read('.github/workflows/market-radar.yml'),
    read('.github/workflows/learning-radar.yml'),
  ])
  const controller = parse(controllerSource)
  const market = parse(marketSource)
  const learning = parse(learningSource)
  assert.match(controller.concurrency.group, /xiuqiu-production-release/)
  assert.equal(market.concurrency.group, 'xiuqiu-market-radar-worker')
  assert.equal(learning.concurrency.group, 'xiuqiu-learning-radar-worker')
  assert.equal((`${marketSource}\n${learningSource}`.match(/xiuqiu-production-release/g) || []).length, 0)
  assert.deepEqual(Object.keys(learning.on), ['workflow_dispatch'])
  assert.deepEqual(learning.on.workflow_dispatch.inputs.mode.options, ['dry-run'])
  assert.doesNotMatch(learningSource, /secrets\.|schedule:/)
})

test('a fixed connection owns and always releases the advisory lock', async () => {
  const calls = []
  let releasedWith
  let ended = false
  const client = {
    async query(statement) {
      calls.push(statement)
      if (statement.includes('pg_try_advisory_lock')) return { rows: [{ acquired: true }] }
      return { rows: [] }
    },
    release(error) { releasedWith = error ?? null },
  }
  const pool = {
    async connect() { return client },
    async end() { ended = true },
  }
  const expected = new Error('work failed')
  await assert.rejects(withRadarDatabaseLock({
    databaseUrl: 'postgresql://fixture.invalid/db',
    createPool: () => pool,
  }, async ({ client: lockedClient }) => {
    assert.equal(lockedClient, client)
    throw expected
  }), expected)
  assert.deepEqual(calls.map(call => call.includes('unlock') ? 'unlock' : 'lock'), ['lock', 'unlock'])
  assert.equal(releasedWith, null)
  assert.equal(ended, true)
})

test('bounded lock waiting times out without running protected work', async () => {
  let ran = false
  const client = {
    async query() { return { rows: [{ acquired: false }] } },
    release() {},
  }
  const pool = { async connect() { return client }, async end() {} }
  await assert.rejects(withRadarDatabaseLock({
    databaseUrl: 'postgresql://fixture.invalid/db',
    wait: true,
    timeoutMs: 0,
    createPool: () => pool,
  }, async () => { ran = true }), RadarDatabaseLockTimeoutError)
  assert.equal(ran, false)
})

test('public mappers allowlist safe timeline fields and split list from detail reports', () => {
  const marketEvent = mapPublicEventRow({
    ...publicEventRowV2,
    score: 98,
    payload: { secret: true },
    prompt: 'private',
    private_note: 'private',
  })
  assert.equal(Object.hasOwn(marketEvent, 'score'), false)
  assert.equal(Object.hasOwn(marketEvent, 'reports'), false)
  assert.equal(mapPublicEventReportRow(publicEventReportRow)?.isPrimary, true)

  const timelineItem = mapPublicTimelineItemRow({
    ...publicLearningTimelineRow,
    internal_score: 99,
    payload: { secret: true },
    private_note: 'private',
  })
  assert.equal(timelineItem.primarySource?.name, 'PostgreSQL Documentation')
  assert.equal(Object.hasOwn(timelineItem, 'internal_score'), false)
  assert.equal(Object.hasOwn(timelineItem, 'reports'), false)
  assert.equal(mapPublicStoryReportRow(publicLearningReportRow)?.isPrimary, true)
  assert.equal(mapPublicStoryUpdateRow(publicLearningUpdateRow)?.titleZh, '补充固定连接边界')
  assert.deepEqual(parseLearningRadarCursor(`${timelineItem.occurredAt}|${timelineItem.id}`), {
    occurredAt: timelineItem.occurredAt,
    id: timelineItem.id,
  })
})

test('all public API failure paths are no-store and detail reports stay out of list queries', async () => {
  const [marketEvents, marketSummary, marketDigests, marketDetail, marketRepository, learningRepository, learningItems] = await Promise.all([
    read('api/market-radar/events.ts'),
    read('api/market-radar/summary.ts'),
    read('api/market-radar/digests.ts'),
    read('api/market-radar/events/[id].ts'),
    read('lib/market-radar/repository.ts'),
    read('lib/learning-radar/repository.ts'),
    read('api/learning-radar/items.ts'),
  ])
  for (const source of [marketEvents, marketSummary, marketDigests, marketDetail, learningItems]) {
    assert.match(source, /sendPublicError\(res, (?:400|404|503)/)
  }
  const marketList = marketRepository.slice(marketRepository.indexOf('export async function listEvents'), marketRepository.indexOf('export async function getEvent'))
  const learningList = learningRepository.slice(learningRepository.indexOf('export async function listLearningRadarItems'), learningRepository.indexOf('export async function getLearningRadarStory'))
  assert.doesNotMatch(marketList, /public_event_reports|reports:/)
  assert.doesNotMatch(learningList, /public_story_reports|reports:/)
  assert.match(marketRepository, /public_event_reports/)
  assert.match(learningRepository, /public_story_reports/)
})

function commandAvailable(command) {
  return spawnSync(command, ['--version'], { encoding: 'utf8' }).status === 0
}

async function openPort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(error => error ? reject(error) : resolve(port))
    })
  })
}

test('real PostgreSQL applies migrations twice, rolls back failures and enforces lock/checksum safety', {
  skip: !commandAvailable('initdb') || !commandAvailable('pg_ctl'),
  timeout: 60_000,
}, async (t) => {
  const fixtureDir = mkdtempSync(join(tmpdir(), 'xiuqiu-radar-pg-'))
  const dataDir = join(fixtureDir, 'data')
  const port = await openPort()
  const init = spawnSync('initdb', ['-D', dataDir, '-U', 'postgres', '--auth=trust', '--no-locale', '--encoding=UTF8', '--no-sync'], { encoding: 'utf8' })
  assert.equal(init.status, 0, init.stderr)
  const start = spawnSync('pg_ctl', ['-D', dataDir, '-o', `-F -h 127.0.0.1 -p ${port}`, '-w', 'start'], { stdio: 'ignore' })
  assert.equal(start.status, 0)
  let observer
  t.after(async () => {
    if (observer) await observer.end()
    spawnSync('pg_ctl', ['-D', dataDir, '-m', 'fast', '-w', 'stop'], { stdio: 'ignore' })
    rmSync(fixtureDir, { recursive: true, force: true })
  })

  const databaseUrl = `postgresql://postgres@127.0.0.1:${port}/postgres`
  const createPool = config => new PgPool(config)
  const migrations = await loadRadarMigrations()
  const first = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    applyRadarMigrations((statement, values) => client.query(statement, values), migrations)
  ))
  assert.equal(first.value.appliedFiles, migrations.length)
  assert.equal(first.value.skippedFiles, 0)

  const second = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    applyRadarMigrations((statement, values) => client.query(statement, values), migrations)
  ))
  assert.equal(second.value.appliedFiles, 0)
  assert.equal(second.value.skippedFiles, migrations.length)

  observer = new PgPool({ connectionString: databaseUrl })
  const marketColumns = await observer.query(`select column_name from information_schema.columns
    where table_schema = 'market_radar' and table_name = 'public_events' order by ordinal_position`)
  assert.equal(marketColumns.rows.some(row => row.column_name === 'score'), false)
  const learningColumns = await observer.query(`select table_name, column_name from information_schema.columns
    where table_schema = 'learning_radar' and table_name like 'public_%'`)
  for (const forbidden of ['payload', 'prompt', 'private_note', 'note', 'internal_score', 'ai_schema_version']) {
    assert.equal(learningColumns.rows.some(row => row.column_name === forbidden), false)
  }

  const lockEvidence = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, async ({ client }) => {
    const firstPid = await client.query('select pg_backend_pid() as pid')
    const secondPid = await client.query('select pg_backend_pid() as pid')
    const competing = await observer.query(
      'select pg_try_advisory_lock(hashtextextended($1, 0)) as acquired',
      [RADAR_DATABASE_LOCK_KEY],
    )
    assert.equal(competing.rows[0].acquired, false)
    return [firstPid.rows[0].pid, secondPid.rows[0].pid]
  })
  assert.equal(lockEvidence.value[0], lockEvidence.value[1])
  const reacquired = await observer.query(
    'select pg_try_advisory_lock(hashtextextended($1, 0)) as acquired',
    [RADAR_DATABASE_LOCK_KEY],
  )
  assert.equal(reacquired.rows[0].acquired, true)
  await observer.query('select pg_advisory_unlock(hashtextextended($1, 0))', [RADAR_DATABASE_LOCK_KEY])

  const failing = [{
    file: '900_failure_probe.sql', checksum: 'failure-probe-v1',
    statements: ['create table radar_system.rollback_probe (id integer)', 'select * from radar_system.missing_relation'],
  }]
  await assert.rejects(withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    applyRadarMigrations((statement, values) => client.query(statement, values), failing)
  )), /missing_relation/)
  const rolledBack = await observer.query("select to_regclass('radar_system.rollback_probe') as relation")
  assert.equal(rolledBack.rows[0].relation, null)
  const failedLedger = await observer.query("select 1 from radar_system.schema_migrations where file = '900_failure_probe.sql'")
  assert.equal(failedLedger.rowCount, 0)

  const checksumProbe = [{
    file: '901_checksum_probe.sql', checksum: 'checksum-v1',
    statements: ['create table radar_system.checksum_probe (id integer)'],
  }]
  await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    applyRadarMigrations((statement, values) => client.query(statement, values), checksumProbe)
  ))
  await assert.rejects(withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    applyRadarMigrations((statement, values) => client.query(statement, values), [{ ...checksumProbe[0], checksum: 'checksum-v2' }])
  )), /Migration checksum mismatch/)
})
