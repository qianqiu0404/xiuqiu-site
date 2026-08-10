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
import { createMarketEventsHandler } from '../api/market-radar/events-handler.ts'
import { allowMethods, clampInteger, preparePublicResponse, queryValue, sendPublicError } from '../lib/market-radar/http.ts'
import { withRadarDatabaseLock, RADAR_DATABASE_LOCK_KEY, RadarDatabaseLockTimeoutError } from '../market-radar/worker/advisory-lock.mjs'
import { applyRadarMigrations, loadRadarMigrations } from '../market-radar/worker/migrations.mjs'
import { mapPublicEventReportRow, mapPublicEventRow } from '../src/market-radar/public-event.ts'
import {
  mapPublicStoryReportRow,
  mapPublicStoryUpdateRow,
  mapPublicTimelineItemRow,
} from '../src/learning-radar/public-story.ts'
import { parseLearningRadarCursor } from '../src/learning-radar/contracts.ts'
import { parseEventCursor } from '../src/market-radar/contracts.ts'
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

test('market event validation errors are 400 no-store responses from the real handler', async () => {
  const marketEventsHandler = createMarketEventsHandler({
    listEvents: async () => { throw new Error('invalid filters must not query the repository') },
    parseEventCursor,
    allowMethods,
    clampInteger,
    preparePublicResponse,
    queryValue,
    sendPublicError,
  })
  const cases = [
    [{ market: 'commodities' }, 'invalid_market'],
    [{ priority: 'P9' }, 'invalid_priority'],
    [{ reaction: 'guaranteed' }, 'invalid_reaction'],
    [{ cursor: 'not-a-cursor' }, 'invalid_cursor'],
  ]
  for (const [query, expectedCode] of cases) {
    const headers = new Map()
    const result = { statusCode: 0, body: null }
    const res = {
      setHeader(name, value) { headers.set(name.toLowerCase(), String(value)) },
      status(statusCode) {
        result.statusCode = statusCode
        return {
          json(body) { result.body = body },
          end() {},
        }
      },
    }
    await marketEventsHandler({ method: 'GET', query, headers: {} }, res)
    assert.equal(result.statusCode, 400)
    assert.equal(result.body?.code, expectedCode)
    assert.equal(headers.get('cache-control'), 'no-store')
    assert.equal(headers.get('x-content-type-options'), 'nosniff')
  }
})

test('all public API failure paths are no-store and detail reports stay out of list queries', async () => {
  const [marketEvents, marketEventsHandler, marketSummary, marketDigests, marketDetail, marketRepository, learningRepository, learningItems] = await Promise.all([
    read('api/market-radar/events.ts'),
    read('api/market-radar/events-handler.ts'),
    read('api/market-radar/summary.ts'),
    read('api/market-radar/digests.ts'),
    read('api/market-radar/events/[id].ts'),
    read('lib/market-radar/repository.ts'),
    read('lib/learning-radar/repository.ts'),
    read('api/learning-radar/items.ts'),
  ])
  assert.match(marketEvents, /createMarketEventsHandler/)
  for (const source of [marketEventsHandler, marketSummary, marketDigests, marketDetail, learningItems]) {
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
  skip: process.env.RUN_RADAR_DB_TESTS !== 'true',
  timeout: 60_000,
}, async (t) => {
  let fixtureDir
  let dataDir
  let adminUrl = process.env.RADAR_TEST_DATABASE_URL
  if (!adminUrl) {
    assert.equal(commandAvailable('initdb') && commandAvailable('pg_ctl'), true,
      'test:radar-db requires RADAR_TEST_DATABASE_URL or local initdb/pg_ctl binaries')
    fixtureDir = mkdtempSync(join(tmpdir(), 'xiuqiu-radar-pg-'))
    dataDir = join(fixtureDir, 'data')
    const port = await openPort()
    const init = spawnSync('initdb', ['-D', dataDir, '-U', 'postgres', '--auth=trust', '--no-locale', '--encoding=UTF8', '--no-sync'], { encoding: 'utf8' })
    assert.equal(init.status, 0, init.stderr)
    const start = spawnSync('pg_ctl', ['-D', dataDir, '-o', `-F -h 127.0.0.1 -p ${port}`, '-w', 'start'], { stdio: 'ignore' })
    assert.equal(start.status, 0)
    adminUrl = `postgresql://postgres@127.0.0.1:${port}/postgres`
  }

  const testDatabase = `radar_test_${process.pid}_${Date.now()}`
  const readerRole = `radar_reader_${process.pid}_${Date.now()}`
  const admin = new PgPool({ connectionString: adminUrl })
  let observer
  let databaseCreated = false
  let roleCreated = false
  t.after(async () => {
    if (observer) await observer.end()
    try {
      if (databaseCreated) {
        await admin.query('select pg_terminate_backend(pid) from pg_stat_activity where datname = $1', [testDatabase])
        await admin.query(`drop database "${testDatabase}"`)
      }
      if (roleCreated) await admin.query(`drop role "${readerRole}"`)
    } finally {
      await admin.end()
      if (dataDir) spawnSync('pg_ctl', ['-D', dataDir, '-m', 'fast', '-w', 'stop'], { stdio: 'ignore' })
      if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true })
    }
  })

  await admin.query(`create database "${testDatabase}"`)
  databaseCreated = true
  const databaseUrlValue = new URL(adminUrl)
  databaseUrlValue.pathname = `/${testDatabase}`
  const databaseUrl = databaseUrlValue.toString()
  const createPool = config => new PgPool(config)
  const migrations = await loadRadarMigrations()
  const foundationMigrations = migrations.slice(0, -1)
  const finalMigration = migrations[migrations.length - 1]
  assert.equal(finalMigration.file, '005_dual_timeline_contracts.sql')
  const foundation = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    applyRadarMigrations((statement, values) => client.query(statement, values), foundationMigrations)
  ))
  assert.equal(foundation.value.appliedFiles, foundationMigrations.length)
  assert.equal(foundation.value.skippedFiles, 0)

  observer = new PgPool({ connectionString: databaseUrl })
  await observer.query('create view market_radar.public_events_dependency as select id, score from market_radar.public_events')
  await observer.query(`create role "${readerRole}" nologin`)
  roleCreated = true
  await observer.query(`grant select on market_radar.public_events to "${readerRole}"`)

  const final = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    applyRadarMigrations((statement, values) => client.query(statement, values), [finalMigration])
  ))
  assert.equal(final.value.appliedFiles, 1)
  assert.equal(final.value.skippedFiles, 0)

  await observer.query('begin')
  try {
    for (const statement of finalMigration.statements) await observer.query(statement)
    await observer.query('commit')
  } catch (error) {
    await observer.query('rollback')
    throw error
  }

  const second = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    applyRadarMigrations((statement, values) => client.query(statement, values), migrations)
  ))
  assert.equal(second.value.appliedFiles, 0)
  assert.equal(second.value.skippedFiles, migrations.length)

  const marketColumns = await observer.query(`select column_name from information_schema.columns
    where table_schema = 'market_radar' and table_name = 'public_events' order by ordinal_position`)
  assert.deepEqual(marketColumns.rows.map(row => row.column_name), [
    'id', 'slug', 'market', 'priority', 'score', 'title_zh', 'summary_zh', 'why_it_matters_zh',
    'event_type', 'news_direction', 'system_judgment', 'horizon', 'occurred_at', 'published_at',
    'source_count', 'sources', 'assets', 'reaction', 'watch_for', 'invalidation',
  ])
  const grants = await observer.query(`select privilege_type from information_schema.role_table_grants
    where grantee = $1 and table_schema = 'market_radar' and table_name = 'public_events'`, [readerRole])
  assert.deepEqual(grants.rows.map(row => row.privilege_type), ['SELECT'])
  const dependencyColumns = await observer.query(`select column_name from information_schema.columns
    where table_schema = 'market_radar' and table_name = 'public_events_dependency' order by ordinal_position`)
  assert.deepEqual(dependencyColumns.rows.map(row => row.column_name), ['id', 'score'])

  await observer.query(`insert into market_radar.events
    (id, slug, cluster_key, market, status, priority, score, title_zh, summary_zh, why_it_matters_zh,
      event_type, news_direction, system_judgment, horizon, ai_schema_version, occurred_at, published_at,
      watch_for_zh, invalidation_zh)
    values ('score-private', 'score-private', 'score-private', 'crypto', 'published', 'P1', 98,
      '内部评分不公开', '公开摘要', '公开原因', 'test', 'neutral', '等待验证', 'days', 'v2', now(), now(),
      '观察公开证据', '若公开证据撤回则失效')`)
  const publicMarketEvent = await observer.query("select * from market_radar.public_events where id = 'score-private'")
  assert.equal(publicMarketEvent.rows[0].score, null)
  const mappedMarketEvent = mapPublicEventRow(publicMarketEvent.rows[0])
  assert.equal(Object.hasOwn(mappedMarketEvent, 'score'), false)
  assert.doesNotMatch(JSON.stringify(mappedMarketEvent), /"score"/)

  await observer.query(`insert into learning_radar.stories
    (id, slug, cluster_key, category, status, importance, internal_score, title_zh, summary_zh,
      why_selected_zh, occurred_at, published_at)
    values
      ('story-zero', 'story-zero', 'story-zero', 'ai', 'published', 'watch', 40, '零来源', '零来源摘要', '测试', now(), now()),
      ('story-unverified', 'story-unverified', 'story-unverified', 'reading', 'published', 'noteworthy', 60, '未验证来源', '未验证摘要', '测试', now(), now()),
      ('story-verified', 'story-verified', 'story-verified', 'engineering_tools', 'published', 'key', 90, '已验证来源', '已验证摘要', '测试', now(), now())`)
  await observer.query(`insert into learning_radar.raw_items
    (id, provider, provider_id, source_url, source_domain, title, published_at, payload, origin_verified_at)
    values
      ('raw-unverified', 'fixture', 'raw-unverified', 'https://example.com/unverified', 'example.com', '未验证', now(), '{}'::jsonb, null),
      ('raw-verified', 'fixture', 'raw-verified', 'https://www.postgresql.org/docs/current/explicit-locking.html', 'postgresql.org', '已验证', now(), '{}'::jsonb, now())`)
  await observer.query(`insert into learning_radar.story_sources
    (story_id, raw_item_id, source_name, source_url, title, published_at, is_primary, origin_verified_at)
    values
      ('story-unverified', 'raw-unverified', 'Unverified', 'https://example.com/unverified', '未验证', now(), true, null),
      ('story-verified', 'raw-verified', 'PostgreSQL', 'https://www.postgresql.org/docs/current/explicit-locking.html', '已验证', now(), true, now())`)
  await observer.query(`insert into learning_radar.story_updates (id, story_id, title_zh, body_zh, occurred_at)
    values
      ('update-zero', 'story-zero', '零来源更新', '不应公开', now()),
      ('update-unverified', 'story-unverified', '未验证更新', '不应公开', now()),
      ('update-verified', 'story-verified', '已验证更新', '可以公开', now())`)
  const publicStories = await observer.query('select id from learning_radar.public_timeline_items order by id')
  assert.deepEqual(publicStories.rows.map(row => row.id), ['story-verified'])
  const publicReports = await observer.query('select story_id from learning_radar.public_story_reports order by story_id')
  assert.deepEqual(publicReports.rows.map(row => row.story_id), ['story-verified'])
  const publicUpdates = await observer.query('select story_id from learning_radar.public_story_updates order by story_id')
  assert.deepEqual(publicUpdates.rows.map(row => row.story_id), ['story-verified'])
  const detailRoots = await observer.query(`select id from learning_radar.public_timeline_items
    where id in ('story-zero', 'story-unverified', 'story-verified') order by id`)
  assert.deepEqual(detailRoots.rows.map(row => row.id), ['story-verified'])

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
