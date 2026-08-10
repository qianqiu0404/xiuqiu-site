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
import { normalizeLearningItem } from '../learning-radar/worker/core.mjs'
import { persistLearningSourceBatch } from '../learning-radar/worker/persistence.mjs'
import { persistMarketItem } from '../market-radar/worker/persistence.mjs'
import { cleanupRetention as cleanupMarketRetention } from '../market-radar/worker/maintenance.mjs'
import { generateLearningDailyDigest } from '../learning-radar/worker/digests.mjs'
import { cleanupLearningRetention } from '../learning-radar/worker/maintenance.mjs'
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
  assert.deepEqual(Object.keys(learning.on), ['schedule', 'workflow_dispatch'])
  assert.deepEqual(learning.on.schedule.map(trigger => trigger.cron), ['0 * * * *', '0 0 * * *'])
  assert.deepEqual(learning.on.workflow_dispatch.inputs.mode.options, ['dry-run', 'ingest', 'daily'])
  assert.equal(learning.jobs.run.environment, undefined)
  assert.doesNotMatch(learningSource, /environment:\s*production-release/)
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
  assert.equal(mapPublicEventReportRow({ ...publicEventReportRow, title: null })?.title, null)
  assert.equal(mapPublicEventReportRow({ ...publicEventReportRow, source_url: null }), null)

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
  const contractIndex = migrations.findIndex(migration => migration.file === '005_dual_timeline_contracts.sql')
  const fingerprintIndex = migrations.findIndex(migration => migration.file === '008_raw_payload_fingerprints.sql')
  assert.ok(contractIndex >= 0)
  assert.ok(fingerprintIndex > contractIndex)
  const foundationMigrations = migrations.slice(0, contractIndex)
  const contractMigration = migrations[contractIndex]
  const pipelineMigrations = migrations.slice(contractIndex + 1, fingerprintIndex)
  const fingerprintMigration = migrations[fingerprintIndex]
  const postFingerprintMigrations = migrations.slice(fingerprintIndex + 1)
  const foundation = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    applyRadarMigrations((statement, values) => client.query(statement, values), foundationMigrations)
  ))
  assert.equal(foundation.value.appliedFiles, foundationMigrations.length)
  assert.equal(foundation.value.skippedFiles, 0)

  observer = new PgPool({ connectionString: databaseUrl })
  await observer.query('create view market_radar.public_events_dependency as select id, score from market_radar.public_events')
  await observer.query(`create role "${readerRole}" nologin`)
  roleCreated = true
  await observer.query(`grant usage on schema market_radar to "${readerRole}"`)
  await observer.query(`grant select on market_radar.public_events to "${readerRole}"`)

  const final = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    applyRadarMigrations((statement, values) => client.query(statement, values), [contractMigration])
  ))
  assert.equal(final.value.appliedFiles, 1)
  assert.equal(final.value.skippedFiles, 0)

  await observer.query('begin')
  try {
    for (const statement of contractMigration.statements) await observer.query(statement)
    await observer.query('commit')
  } catch (error) {
    await observer.query('rollback')
    throw error
  }

  await observer.query(`insert into market_radar.events
    (id, slug, cluster_key, market, status, priority, score, title_zh, summary_zh, why_it_matters_zh,
      event_type, news_direction, system_judgment, horizon, ai_schema_version, occurred_at, published_at,
      watch_for_zh, invalidation_zh)
    values ('legacy-source-event', 'legacy-source-event', 'legacy-source-event', 'macro', 'published', 'P1', 75,
      '历史报道字段回填', '公开摘要', '回填来源证据', 'policy', 'neutral', '等待验证', 'days', 'v2', now(), now(),
      '观察公开证据', '若证据撤回则失效')`)
  await observer.query(`insert into market_radar.raw_items
    (id, provider, provider_id, market, source_url, title, published_at, payload)
    values ('legacy-source-raw', 'federal_reserve', 'legacy-source-raw', 'macro',
      'https://www.federalreserve.gov/legacy-source', 'Historical Federal Reserve report',
      date_trunc('milliseconds', now() - interval '2 hours'), '{"private":"raw"}'::jsonb)`)
  await observer.query(`insert into market_radar.event_sources
    (event_id, raw_item_id, source_name, source_url, title, excerpt, published_at, is_primary)
    values ('legacy-source-event', 'legacy-source-raw', 'federal_reserve',
      'https://www.federalreserve.gov/legacy-source', null, null, null, false)`)
  await observer.query(`update market_radar.raw_items
    set payload = '{"retained":false}'::jsonb,
      payload_expires_at = now() - interval '1 day',
      payload_purged_at = now()
    where id = 'legacy-source-raw'`)

  const pipeline = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    applyRadarMigrations((statement, values) => client.query(statement, values), pipelineMigrations)
  ))
  assert.equal(pipeline.value.appliedFiles, pipelineMigrations.length)
  assert.equal(pipeline.value.skippedFiles, 0)

  const legacySource = await observer.query(`select title, excerpt, published_at, is_primary
    from market_radar.event_sources where event_id = 'legacy-source-event'`)
  assert.equal(legacySource.rows[0].title, 'Historical Federal Reserve report')
  assert.equal(legacySource.rows[0].excerpt, null)
  assert.ok(legacySource.rows[0].published_at instanceof Date)
  assert.equal(legacySource.rows[0].is_primary, true)
  const legacyPublic = await observer.query(`select id from market_radar.public_events
    where id = 'legacy-source-event'`)
  assert.equal(legacyPublic.rowCount, 1)

  await observer.query(`insert into learning_radar.raw_items
    (id, provider, provider_id, source_url, source_domain, title, excerpt, published_at, payload,
      payload_expires_at, payload_purged_at, normalized_at, origin_verified_at, is_official,
      discovered_via, verification_state)
    values ('legacy-learning-raw', 'openai_node_releases', 'legacy-learning',
      'https://github.com/openai/openai-node/releases/tag/legacy', 'github.com',
      'OpenAI Node legacy release', 'Official legacy release notes.',
      date_trunc('milliseconds', now() - interval '90 minutes'),
      '{"legacy":true,"details":{"alpha":1,"beta":2}}'::jsonb, now() - interval '1 day', null, now(), now(), true,
      'openai_node_releases', 'verified')`)
  await observer.query(`insert into learning_radar.stories
    (id, slug, cluster_key, category, status, importance, internal_score, title_zh, summary_zh,
      why_selected_zh, ai_schema_version, occurred_at, published_at, publication_basis,
      verification_state, has_conflict, conflict_evidence)
    values ('legacy-learning-story', 'legacy-learning-story', 'legacy-learning-story', 'ai',
      'published', 'key', 90, 'OpenAI Node 历史版本', '官方历史版本摘要。', '保留公开结构化证据。',
      'learning-v1', now() - interval '90 minutes', now() - interval '80 minutes',
      'official_primary', 'verified', false, '[]'::jsonb)`)
  await observer.query(`insert into learning_radar.story_sources
    (story_id, raw_item_id, source_name, source_url, title, excerpt, published_at, is_primary,
      origin_verified_at, source_domain, registrable_domain, is_official, discovered_via, verification_state)
    select 'legacy-learning-story', 'legacy-learning-raw', 'OpenAI SDK Releases', source_url,
      title, excerpt, published_at, true, origin_verified_at, source_domain, 'github.com', true,
      discovered_via, verification_state
    from learning_radar.raw_items where id = 'legacy-learning-raw'`)
  await observer.query(`update learning_radar.raw_items
    set payload = '{"retained":false}'::jsonb, payload_purged_at = now()
    where id = 'legacy-learning-raw'`)

  const fingerprint = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    applyRadarMigrations((statement, values) => client.query(statement, values), [
      fingerprintMigration,
      ...postFingerprintMigrations,
    ])
  ))
  assert.equal(fingerprint.value.appliedFiles, 1 + postFingerprintMigrations.length)
  assert.equal(fingerprint.value.skippedFiles, 0)
  const legacyFingerprints = await observer.query(`
    select 'market' as kind, payload_fingerprint from market_radar.raw_items where id = 'legacy-source-raw'
    union all
    select 'learning' as kind, payload_fingerprint from learning_radar.raw_items where id = 'legacy-learning-raw'
    order by kind`)
  assert.deepEqual(legacyFingerprints.rows, [
    { kind: 'learning', payload_fingerprint: null },
    { kind: 'market', payload_fingerprint: null },
  ])

  const legacyMarketMetadata = (await observer.query(`select source_url, title, published_at,
      payload_expires_at, payload_purged_at
    from market_radar.raw_items where id = 'legacy-source-raw'`)).rows[0]
  const legacyMarketBaselineAt = new Date(legacyMarketMetadata.published_at.getTime() + 5 * 60_000).toISOString()
  const legacyMarketItem = {
    provider: 'federal_reserve', providerId: 'legacy-source-raw', market: 'macro',
    sourceUrl: 'https://www.federalreserve.gov/legacy-source-corrected',
    title: 'Historical Federal Reserve report corrected',
    summary: 'Historical Federal Reserve report corrected on first reappearance.',
    sourceReport: {
      title: 'Historical Federal Reserve report corrected',
      excerpt: 'Corrected public legacy report.',
      publishedAt: legacyMarketBaselineAt,
    },
    publishedAt: legacyMarketBaselineAt,
    explicitSymbols: [], payload: { private: 'incoming-baseline', revision: 1 },
  }
  const legacyMarketClient = await observer.connect()
  try {
    const legacyMarketDiff = await legacyMarketClient.query(`select
        source_url is distinct from $1 as url_changed,
        title is distinct from $2 as title_changed,
        published_at is distinct from $3::timestamptz as time_changed,
        payload_fingerprint,
        payload_purged_at
      from market_radar.raw_items where id = 'legacy-source-raw'`, [
      legacyMarketItem.sourceUrl, legacyMarketItem.title, legacyMarketItem.publishedAt,
    ])
    assert.deepEqual({
      urlChanged: legacyMarketDiff.rows[0].url_changed,
      titleChanged: legacyMarketDiff.rows[0].title_changed,
      timeChanged: legacyMarketDiff.rows[0].time_changed,
    }, { urlChanged: true, titleChanged: true, timeChanged: true })
    const firstSeen = await persistMarketItem(legacyMarketClient, legacyMarketItem)
    assert.equal(firstSeen.revised, true)
    const firstBaseline = (await legacyMarketClient.query(`select source_url, title, published_at,
        payload, payload_fingerprint, payload_expires_at, payload_purged_at
      from market_radar.raw_items where id = 'legacy-source-raw'`)).rows[0]
    assert.equal(firstBaseline.source_url, legacyMarketItem.sourceUrl)
    assert.equal(firstBaseline.title, legacyMarketItem.title)
    assert.equal(firstBaseline.published_at.toISOString(), legacyMarketItem.publishedAt)
    assert.deepEqual(firstBaseline.payload, { retained: false })
    assert.match(firstBaseline.payload_fingerprint, /^[0-9a-f]{32}$/)
    assert.equal(firstBaseline.payload_expires_at.toISOString(), legacyMarketMetadata.payload_expires_at.toISOString())
    assert.equal(firstBaseline.payload_purged_at.toISOString(), legacyMarketMetadata.payload_purged_at.toISOString())
    const baselineReport = (await legacyMarketClient.query(`select source_url, title, excerpt, published_at
      from market_radar.event_sources where event_id = 'legacy-source-event'`)).rows[0]
    assert.deepEqual({
      sourceUrl: baselineReport.source_url,
      title: baselineReport.title,
      excerpt: baselineReport.excerpt,
      publishedAt: baselineReport.published_at.toISOString(),
    }, {
      sourceUrl: legacyMarketItem.sourceUrl,
      title: legacyMarketItem.sourceReport.title,
      excerpt: legacyMarketItem.sourceReport.excerpt,
      publishedAt: legacyMarketItem.sourceReport.publishedAt,
    })

    const repeated = await persistMarketItem(legacyMarketClient, legacyMarketItem)
    assert.equal(repeated.revised, false)
    const stillPurged = await legacyMarketClient.query(`select payload, payload_purged_at
      from market_radar.raw_items where id = 'legacy-source-raw'`)
    assert.deepEqual(stillPurged.rows[0].payload, { retained: false })
    assert.ok(stillPurged.rows[0].payload_purged_at instanceof Date)

    const restoredMarketItem = {
      ...legacyMarketItem,
      sourceUrl: 'https://www.federalreserve.gov/legacy-source-revision-2',
      title: 'Historical Federal Reserve report revision 2',
      summary: 'A subsequent identifiable report revision.',
      sourceReport: {
        title: 'Historical Federal Reserve report revision 2',
        excerpt: 'Second corrected public legacy report.',
        publishedAt: new Date(Date.parse(legacyMarketItem.publishedAt) + 5 * 60_000).toISOString(),
      },
      publishedAt: new Date(Date.parse(legacyMarketItem.publishedAt) + 5 * 60_000).toISOString(),
      payload: { private: 'raw', revision: 2 },
    }
    const restored = await persistMarketItem(legacyMarketClient, restoredMarketItem)
    assert.equal(restored.revised, true)
    const restoredRaw = (await legacyMarketClient.query(`select source_url, title, published_at,
        payload, payload_fingerprint, payload_expires_at, payload_purged_at
      from market_radar.raw_items where id = 'legacy-source-raw'`)).rows[0]
    assert.equal(restoredRaw.source_url, restoredMarketItem.sourceUrl)
    assert.equal(restoredRaw.title, restoredMarketItem.title)
    assert.equal(restoredRaw.published_at.toISOString(), restoredMarketItem.publishedAt)
    assert.deepEqual(restoredRaw.payload, { private: 'raw', revision: 2 })
    assert.equal(restoredRaw.payload_purged_at, null)
    assert.ok(restoredRaw.payload_expires_at.getTime() > Date.now() + 13 * 24 * 60 * 60_000)
    const restoredReport = (await legacyMarketClient.query(`select source_url, title, excerpt, published_at
      from market_radar.event_sources where event_id = 'legacy-source-event'`)).rows[0]
    assert.equal(restoredReport.source_url, restoredMarketItem.sourceUrl)
    assert.equal(restoredReport.title, restoredMarketItem.sourceReport.title)
    assert.equal(restoredReport.excerpt, restoredMarketItem.sourceReport.excerpt)
    assert.equal(restoredReport.published_at.toISOString(), restoredMarketItem.sourceReport.publishedAt)
    await legacyMarketClient.query(`update market_radar.raw_items
      set payload_fingerprint = null, payload_expires_at = now() - interval '1 minute'
      where id = 'legacy-source-raw'`)
    await cleanupMarketRetention({
      query: async (statement, values = []) => (await legacyMarketClient.query(statement, values)).rows,
    })
    const cleaned = (await legacyMarketClient.query(`select payload, payload_fingerprint
      from market_radar.raw_items where id = 'legacy-source-raw'`)).rows[0]
    assert.deepEqual(cleaned.payload, { retained: false })
    assert.match(cleaned.payload_fingerprint, /^[0-9a-f]{32}$/)
    const reportEvidence = await legacyMarketClient.query(`select count(*)::integer as reports
      from market_radar.event_sources where event_id = 'legacy-source-event'`)
    assert.equal(reportEvidence.rows[0].reports, 1)
  } finally {
    legacyMarketClient.release()
  }

  const legacyLearningMetadata = (await observer.query(`select source_url, source_domain, title, excerpt,
      published_at, origin_verified_at, payload_expires_at, payload_purged_at
    from learning_radar.raw_items where id = 'legacy-learning-raw'`)).rows[0]
  const legacyLearningBaselineAt = new Date(legacyLearningMetadata.published_at.getTime() + 5 * 60_000).toISOString()
  const legacyLearningItem = normalizeLearningItem({
    provider: 'openai_node_releases', providerId: 'legacy-learning', category: 'ai',
    title: 'OpenAI Node legacy release corrected', excerpt: 'Corrected official legacy release notes.',
    sourceUrl: 'https://github.com/openai/openai-node/releases/tag/legacy-corrected',
    publishedAt: legacyLearningBaselineAt,
    isOfficial: true, discoveredVia: 'openai_node_releases', sourceName: 'OpenAI SDK Releases',
    originVerifiedAt: legacyLearningMetadata.origin_verified_at.toISOString(), verificationState: 'verified',
    rawPayload: { details: { beta: 2, alpha: 1 }, legacy: 'incoming-baseline' },
  })
  const legacyLearningAnalysis = {
    titleZh: 'OpenAI Node 历史版本', summaryZh: '官方历史版本摘要。',
    whySelectedZh: '保留公开结构化证据。', importance: 'key', internalScore: 90, hasConflict: false,
  }
  for (const slot of ['legacy-learning-baseline', 'legacy-learning-repeat']) {
    const saved = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
      persistLearningSourceBatch(client, {
        source: legacyLearningItem.provider,
        groupKey: legacyLearningItem.category,
        slot,
        preparedItems: [{ item: legacyLearningItem, analysis: legacyLearningAnalysis }],
      })
    ))
    assert.equal(saved.value.failed, undefined)
    const retained = (await observer.query(`select source_url, title, excerpt, published_at,
        payload, payload_fingerprint, payload_expires_at, payload_purged_at
      from learning_radar.raw_items where id = 'legacy-learning-raw'`)).rows[0]
    assert.equal(retained.source_url, legacyLearningItem.sourceUrl)
    assert.equal(retained.title, legacyLearningItem.title)
    assert.equal(retained.excerpt, legacyLearningItem.excerpt)
    assert.equal(retained.published_at.toISOString(), legacyLearningItem.publishedAt)
    assert.deepEqual(retained.payload, { retained: false })
    assert.match(retained.payload_fingerprint, /^[0-9a-f]{32}$/)
    assert.equal(retained.payload_expires_at.toISOString(), legacyLearningMetadata.payload_expires_at.toISOString())
    assert.equal(retained.payload_purged_at.toISOString(), legacyLearningMetadata.payload_purged_at.toISOString())
  }
  const baselineLearningReport = (await observer.query(`select source_url, title, excerpt, published_at
    from learning_radar.story_sources where story_id = 'legacy-learning-story'`)).rows[0]
  assert.equal(baselineLearningReport.source_url, legacyLearningItem.sourceUrl)
  assert.equal(baselineLearningReport.title, legacyLearningItem.title)
  assert.equal(baselineLearningReport.excerpt, legacyLearningItem.excerpt)
  assert.equal(baselineLearningReport.published_at.toISOString(), legacyLearningItem.publishedAt)
  const revisedLegacyLearningItem = normalizeLearningItem({
    ...legacyLearningItem,
    title: 'OpenAI Node legacy release revision 2',
    excerpt: 'Second corrected official legacy release notes.',
    sourceUrl: 'https://github.com/openai/openai-node/releases/tag/legacy-revision-2',
    publishedAt: new Date(Date.parse(legacyLearningItem.publishedAt) + 5 * 60_000).toISOString(),
    rawPayload: { details: { alpha: 1, beta: 3 }, legacy: true, revision: 2 },
  })
  const restoredLearning = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    persistLearningSourceBatch(client, {
      source: revisedLegacyLearningItem.provider,
      groupKey: revisedLegacyLearningItem.category,
      slot: 'legacy-learning-revision',
      preparedItems: [{ item: revisedLegacyLearningItem, analysis: legacyLearningAnalysis }],
    })
  ))
  assert.equal(restoredLearning.value.failed, undefined)
  const restoredLegacyLearningRaw = (await observer.query(`select source_url, title, excerpt, published_at,
      payload, payload_expires_at, payload_purged_at
    from learning_radar.raw_items where id = 'legacy-learning-raw'`)).rows[0]
  assert.equal(restoredLegacyLearningRaw.source_url, revisedLegacyLearningItem.sourceUrl)
  assert.equal(restoredLegacyLearningRaw.title, revisedLegacyLearningItem.title)
  assert.equal(restoredLegacyLearningRaw.excerpt, revisedLegacyLearningItem.excerpt)
  assert.equal(restoredLegacyLearningRaw.published_at.toISOString(), revisedLegacyLearningItem.publishedAt)
  assert.deepEqual(restoredLegacyLearningRaw.payload, {
    details: { alpha: 1, beta: 3 }, legacy: true, revision: 2,
  })
  assert.equal(restoredLegacyLearningRaw.payload_purged_at, null)
  assert.ok(restoredLegacyLearningRaw.payload_expires_at.getTime() > Date.now() + 13 * 24 * 60 * 60_000)
  const restoredLearningReport = (await observer.query(`select source_url, title, excerpt, published_at
    from learning_radar.story_sources where story_id = 'legacy-learning-story'`)).rows[0]
  assert.equal(restoredLearningReport.source_url, revisedLegacyLearningItem.sourceUrl)
  assert.equal(restoredLearningReport.title, revisedLegacyLearningItem.title)
  assert.equal(restoredLearningReport.excerpt, revisedLegacyLearningItem.excerpt)
  assert.equal(restoredLearningReport.published_at.toISOString(), revisedLegacyLearningItem.publishedAt)
  await observer.query(`update learning_radar.raw_items
    set payload_fingerprint = null, payload_expires_at = now() - interval '1 minute'
    where id = 'legacy-learning-raw'`)
  await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => cleanupLearningRetention(client))
  const cleanedLearning = (await observer.query(`select payload, payload_fingerprint
    from learning_radar.raw_items where id = 'legacy-learning-raw'`)).rows[0]
  assert.deepEqual(cleanedLearning.payload, { retained: false })
  assert.match(cleanedLearning.payload_fingerprint, /^[0-9a-f]{32}$/)
  const storyEvidence = await observer.query(`select count(*)::integer as sources
    from learning_radar.story_sources where story_id = 'legacy-learning-story'`)
  assert.equal(storyEvidence.rows[0].sources, 1)

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
  await observer.query(`insert into market_radar.raw_items
    (id, provider, provider_id, market, source_url, title, published_at, payload)
    values ('score-private-raw', 'github_releases', 'score-private-raw', 'crypto',
      'https://github.com/bitcoin/bitcoin/releases/tag/score-private', 'Score privacy source', now(),
      '{"score":98,"private":true}'::jsonb)`)
  await observer.query(`insert into market_radar.event_sources
    (event_id, raw_item_id, source_name, source_url, title, published_at, is_primary)
    values ('score-private', 'score-private-raw', 'github_releases',
      'https://github.com/bitcoin/bitcoin/releases/tag/score-private', 'Score privacy source', now(), true)`)
  const publicMarketEvent = await observer.query("select * from market_radar.public_events where id = 'score-private'")
  assert.equal(publicMarketEvent.rows[0].score, null)
  const mappedMarketEvent = mapPublicEventRow(publicMarketEvent.rows[0])
  assert.equal(Object.hasOwn(mappedMarketEvent, 'score'), false)
  assert.doesNotMatch(JSON.stringify(mappedMarketEvent), /"score"/)

  assert.equal((await observer.query(`select has_function_privilege($1,
    'radar_system.meaningful_timeline_boundary(text)','execute') as allowed`, [readerRole])).rows[0].allowed, true)
  assert.equal((await observer.query(`select has_function_privilege($1,
    'radar_system.review_timeline(text,text,text,text,text,text,text,timestamp with time zone,text)',
    'execute') as allowed`, [readerRole])).rows[0].allowed, false)
  const readerClient = await observer.connect()
  await readerClient.query(`set role "${readerRole}"`)
  try {
    const readerEvent = await readerClient.query("select id from market_radar.public_events where id = 'score-private'")
    assert.deepEqual(readerEvent.rows, [{ id: 'score-private' }])
    await assert.rejects(readerClient.query('select payload from market_radar.raw_items limit 1'), /permission denied/)
    await assert.rejects(readerClient.query('select note from market_radar.review_decisions limit 1'), /permission denied/)
    await assert.rejects(readerClient.query(`select * from radar_system.review_timeline(
      'market','score-private','reject',null,'reader','reviewer','999999',now(),repeat('a',40))`),
    /permission denied/)
  } finally {
    await readerClient.query('reset role')
    readerClient.release()
  }

  await observer.query(`insert into market_radar.events
    (id, slug, cluster_key, market, status, priority, score, title_zh, summary_zh, why_it_matters_zh,
      event_type, news_direction, system_judgment, horizon, ai_schema_version, occurred_at, published_at,
      watch_for_zh, invalidation_zh)
    values ('zero-source-event', 'zero-source-event', 'zero-source-event', 'crypto', 'published', 'P1', 90,
      '零来源事件', '不应公开', '没有来源证据', 'test', 'neutral', '等待验证', 'days', 'v2', now(), now(),
      '观察公开证据', '若无公开证据则失效')`)
  const hiddenZeroSource = await observer.query(`select id from market_radar.public_events
    where id = 'zero-source-event'`)
  assert.equal(hiddenZeroSource.rowCount, 0)

  const marketNow = new Date()
  const midnight = Date.UTC(marketNow.getUTCFullYear(), marketNow.getUTCMonth(), marketNow.getUTCDate())
  const firstAt = new Date(midnight - 30_000).toISOString()
  const secondAt = new Date(midnight + 30_000).toISOString()
  const marketSummary = {
    titleZh: 'BTC 协议升级获得公开来源确认',
    summaryZh: '公开来源报道了协议升级。',
    whyItMattersZh: '协议变化可能影响节点运行。',
    eventType: 'protocol_upgrade', direction: 'neutral', horizon: 'days',
    systemJudgment: '等待节点运行反馈。',
    watchFor: '观察官方版本与节点运行反馈。',
    invalidation: '若官方撤回升级说明则当前判断失效。',
  }
  const firstMarketItem = {
    provider: 'qiu_market', providerId: 'cross-midnight-qiu', market: 'crypto',
    sourceUrl: 'https://qiu-market.example/reports/protocol-upgrade',
    title: 'BTC protocol upgrade announced', summary: 'A public report describes the protocol upgrade.',
    sourceReport: {
      title: 'Qiu Market protocol report', excerpt: 'Original public report text.', publishedAt: firstAt,
    },
    publishedAt: firstAt, explicitSymbols: ['BTC'], payload: { revision: 1, private: 'raw-only' },
  }
  const secondMarketItem = {
    ...firstMarketItem,
    provider: 'github_releases', providerId: 'cross-midnight-github',
    sourceUrl: 'https://github.com/bitcoin/bitcoin/releases/tag/t3-fixture',
    sourceReport: {
      title: 'Bitcoin Core official release', excerpt: 'Official public release notes.', publishedAt: secondAt,
    },
    publishedAt: secondAt, payload: { revision: 1, provider: 'github' },
  }
  const marketClient = await observer.connect()
  try {
    const firstResult = await persistMarketItem(marketClient, firstMarketItem, { summary: marketSummary, now: marketNow })
    const secondResult = await persistMarketItem(marketClient, secondMarketItem, { summary: marketSummary, now: marketNow })
    assert.equal(firstResult.inserted, true)
    assert.equal(secondResult.inserted, true)
    assert.equal(secondResult.eventId, firstResult.eventId)
    assert.equal(secondResult.sourceAdded, true)

    const revisedFirstItem = {
      ...firstMarketItem,
      sourceUrl: 'https://qiu-market.example/reports/protocol-upgrade-corrected',
      title: 'BTC protocol upgrade announced with corrected details',
      summary: 'The original public report corrected its details.',
      sourceReport: {
        title: 'Qiu Market protocol report corrected',
        excerpt: 'Corrected&#0; public&#x0; report &amp;#0; text.',
        publishedAt: new Date(Date.parse(secondAt) + 10 * 60_000).toISOString(),
      },
      publishedAt: new Date(Date.parse(secondAt) + 10 * 60_000).toISOString(),
      payload: { revision: 2, details: { alpha: 1, beta: 2 } },
    }
    const revision = await persistMarketItem(marketClient, revisedFirstItem, { now: marketNow })
    const replay = await persistMarketItem(marketClient, revisedFirstItem, { now: marketNow })
    assert.equal(revision.inserted, false)
    assert.equal(revision.revised, true)
    assert.equal(revision.eventId, firstResult.eventId)
    assert.equal(replay.inserted, false)
    assert.equal(replay.revised, false)
    assert.equal(replay.sourceAdded, false)

    const missingReportItem = {
      ...firstMarketItem,
      provider: 'qiu_market', providerId: 'missing-report-fields',
      sourceUrl: 'https://qiu-market.example/reports/protocol-upgrade-follow-up',
      sourceReport: {}, publishedAt: new Date(Date.parse(secondAt) + 20 * 60_000).toISOString(),
      payload: { missingReport: true },
    }
    const missing = await persistMarketItem(marketClient, missingReportItem, { now: marketNow })
    assert.equal(missing.eventId, firstResult.eventId)

    const reports = await observer.query(`select id, event_id, source_name, source_url, title, excerpt, published_at, is_primary
      from market_radar.public_event_reports where event_id = $1
      order by published_at desc nulls last, id desc`, [firstResult.eventId])
    assert.equal(reports.rowCount, 3)
    assert.equal(reports.rows[0].title, 'Qiu Market protocol report corrected')
    assert.equal(reports.rows[0].source_url, revisedFirstItem.sourceUrl)
    assert.equal(reports.rows[0].excerpt, 'Corrected public report text.')
    assert.doesNotMatch(reports.rows[0].excerpt, /\u0000/)
    assert.equal(reports.rows[1].title, 'Bitcoin Core official release')
    assert.deepEqual(
      reports.rows.filter(report => report.is_primary).map(report => report.source_name),
      ['github_releases'],
    )
    assert.equal(reports.rows[2].title, null)
    assert.equal(reports.rows[2].excerpt, null)
    assert.equal(reports.rows[2].published_at, null)
    const mappedRealReport = mapPublicEventReportRow(reports.rows[0])
    assert.equal(mappedRealReport?.title, 'Qiu Market protocol report corrected')
    assert.equal(mappedRealReport?.sourceUrl, revisedFirstItem.sourceUrl)
    assert.equal(mappedRealReport?.excerpt, 'Corrected public report text.')
    assert.equal(Object.hasOwn(mappedRealReport || {}, 'payload'), false)

    const sourceEvidence = await observer.query(`select count(*)::integer as sources,
        count(*) filter (where is_primary)::integer as primaries
      from market_radar.event_sources where event_id = $1`, [firstResult.eventId])
    assert.deepEqual(sourceEvidence.rows[0], { sources: 3, primaries: 1 })
    const storedRaw = await observer.query(`select title, payload from market_radar.raw_items
      where provider = 'qiu_market' and provider_id = 'cross-midnight-qiu'`)
    assert.equal(storedRaw.rows[0].title, revisedFirstItem.title)
    assert.deepEqual(storedRaw.rows[0].payload, { details: { alpha: 1, beta: 2 }, revision: 2 })
    const storedEvent = await observer.query(`select occurred_at, status from market_radar.events
      where id = $1`, [firstResult.eventId])
    assert.equal(storedEvent.rows[0].occurred_at.toISOString(), firstAt)
    assert.equal(storedEvent.rows[0].status, 'published')

    const marketSql = { query: async (statement, values = []) => (await marketClient.query(statement, values)).rows }
    await marketClient.query(`update market_radar.raw_items set payload_expires_at = now() - interval '1 minute'
      where provider = 'qiu_market' and provider_id = 'cross-midnight-qiu'`)
    await cleanupMarketRetention(marketSql)
    const purgedMarketRaw = await marketClient.query(`select payload, payload_purged_at
      from market_radar.raw_items where provider = 'qiu_market' and provider_id = 'cross-midnight-qiu'`)
    assert.deepEqual(purgedMarketRaw.rows[0].payload, { retained: false })
    assert.ok(purgedMarketRaw.rows[0].payload_purged_at instanceof Date)

    const semanticReplay = {
      ...revisedFirstItem,
      payload: { details: { beta: 2, alpha: 1 }, revision: 2 },
    }
    const replayAfterPurge = await persistMarketItem(marketClient, semanticReplay, { now: marketNow })
    assert.equal(replayAfterPurge.revised, false)
    const stillPurged = await marketClient.query(`select payload, payload_purged_at
      from market_radar.raw_items where provider = 'qiu_market' and provider_id = 'cross-midnight-qiu'`)
    assert.deepEqual(stillPurged.rows[0].payload, { retained: false })
    assert.ok(stillPurged.rows[0].payload_purged_at instanceof Date)

    const truePayloadRevision = {
      ...semanticReplay,
      payload: { details: { alpha: 1, beta: 3 }, revision: 3 },
    }
    const restoredRevision = await persistMarketItem(marketClient, truePayloadRevision, { now: marketNow })
    assert.equal(restoredRevision.revised, true)
    const restoredRaw = await marketClient.query(`select payload, payload_purged_at, payload_expires_at
      from market_radar.raw_items where provider = 'qiu_market' and provider_id = 'cross-midnight-qiu'`)
    assert.deepEqual(restoredRaw.rows[0].payload, { details: { alpha: 1, beta: 3 }, revision: 3 })
    assert.equal(restoredRaw.rows[0].payload_purged_at, null)
    assert.ok(restoredRaw.rows[0].payload_expires_at.getTime() > Date.now() + 13 * 24 * 60 * 60_000)

    await marketClient.query(`update market_radar.raw_items set payload_expires_at = now() - interval '1 minute'
      where provider = 'qiu_market' and provider_id = 'cross-midnight-qiu'`)
    await cleanupMarketRetention(marketSql)
    const repurgedRaw = await marketClient.query(`select payload from market_radar.raw_items
      where provider = 'qiu_market' and provider_id = 'cross-midnight-qiu'`)
    assert.deepEqual(repurgedRaw.rows[0].payload, { retained: false })
    const retainedMarketStructure = await marketClient.query(`select count(*)::integer as reports
      from market_radar.event_sources where event_id = $1`, [firstResult.eventId])
    assert.equal(retainedMarketStructure.rows[0].reports, 3)

    await assert.rejects(persistMarketItem(marketClient, {
      ...firstMarketItem, providerId: 'transaction-rollback', market: 'invalid_market',
    }, { summary: marketSummary, now: marketNow }), /raw_items_market_check/)
    const rolledBackRaw = await observer.query(`select id from market_radar.raw_items
      where provider = 'qiu_market' and provider_id = 'transaction-rollback'`)
    assert.equal(rolledBackRaw.rowCount, 0)
  } finally {
    marketClient.release()
  }

  const marketPublicColumns = await observer.query(`select table_name, column_name
    from information_schema.columns
    where table_schema = 'market_radar' and table_name in ('public_events', 'public_event_reports')`)
  for (const forbidden of ['payload', 'prompt', 'private_note', 'ai_schema_version', 'cluster_key']) {
    assert.equal(marketPublicColumns.rows.some(row => row.column_name === forbidden), false)
  }

  await observer.query(`insert into learning_radar.stories
    (id, slug, cluster_key, category, status, importance, internal_score, title_zh, summary_zh,
      why_selected_zh, occurred_at, published_at, publication_basis, verification_state, has_conflict)
    values
      ('story-zero', 'story-zero', 'story-zero', 'ai', 'published', 'watch', 40, '零来源', '零来源摘要', '测试', now(), now(), null, 'pending', false),
      ('story-unverified', 'story-unverified', 'story-unverified', 'reading', 'published', 'noteworthy', 60, '未验证来源', '未验证摘要', '测试', now(), now(), null, 'pending', false),
      ('story-verified', 'story-verified', 'story-verified', 'engineering_tools', 'published', 'key', 90, '已验证来源', '已验证摘要', '测试', now(), now(), 'official_primary', 'verified', false)`)
  await observer.query(`insert into learning_radar.raw_items
    (id, provider, provider_id, source_url, source_domain, title, published_at, payload, origin_verified_at)
    values
      ('raw-unverified', 'fixture', 'raw-unverified', 'https://example.com/unverified', 'example.com', '未验证', now(), '{}'::jsonb, null),
      ('raw-verified', 'fixture', 'raw-verified', 'https://www.postgresql.org/docs/current/explicit-locking.html', 'postgresql.org', '已验证', now(), '{}'::jsonb, now())`)
  await observer.query(`insert into learning_radar.story_sources
    (story_id, raw_item_id, source_name, source_url, title, published_at, is_primary, origin_verified_at,
      source_domain, registrable_domain, is_official, discovered_via, verification_state)
    values
      ('story-unverified', 'raw-unverified', 'Unverified', 'https://example.com/unverified', '未验证', now(), true, null,
        'example.com', 'example.com', false, 'fixture', 'unverified'),
      ('story-verified', 'raw-verified', 'PostgreSQL', 'https://www.postgresql.org/docs/current/explicit-locking.html', '已验证', now(), true, now(),
        'www.postgresql.org', 'postgresql.org', true, 'postgresql_news', 'verified')`)
  await observer.query(`insert into learning_radar.story_updates (id, story_id, title_zh, body_zh, occurred_at)
    values
      ('update-zero', 'story-zero', '零来源更新', '不应公开', now()),
      ('update-unverified', 'story-unverified', '未验证更新', '不应公开', now()),
      ('update-verified', 'story-verified', '已验证更新', '可以公开', now())`)
  const publicStories = await observer.query(`select id from learning_radar.public_timeline_items
    where id in ('story-zero', 'story-unverified', 'story-verified') order by id`)
  assert.deepEqual(publicStories.rows.map(row => row.id), ['story-verified'])
  const publicReports = await observer.query(`select story_id from learning_radar.public_story_reports
    where story_id in ('story-zero', 'story-unverified', 'story-verified') order by story_id`)
  assert.deepEqual(publicReports.rows.map(row => row.story_id), ['story-verified'])
  const publicUpdates = await observer.query(`select story_id from learning_radar.public_story_updates
    where story_id in ('story-zero', 'story-unverified', 'story-verified') order by story_id`)
  assert.deepEqual(publicUpdates.rows.map(row => row.story_id), ['story-verified'])
  const detailRoots = await observer.query(`select id from learning_radar.public_timeline_items
    where id in ('story-zero', 'story-unverified', 'story-verified') order by id`)
  assert.deepEqual(detailRoots.rows.map(row => row.id), ['story-verified'])

  const pipelineNow = new Date()
  const pipelineItem = normalizeLearningItem({
    provider: 'openai_node_releases', providerId: 'openai/openai-node:db-fixture', category: 'ai',
    title: 'OpenAI Node SDK database fixture release', excerpt: 'Official source-backed database fixture.',
    sourceUrl: 'https://github.com/openai/openai-node/releases/tag/db-fixture',
    publishedAt: new Date(pipelineNow.getTime() - 60_000).toISOString(),
    isOfficial: true, discoveredVia: 'openai_node_releases', sourceName: 'OpenAI SDK Releases',
    originVerifiedAt: pipelineNow.toISOString(), verificationState: 'verified',
    rawPayload: { fixture: true, metadata: { alpha: 1, beta: 2 } },
  }, { now: pipelineNow })
  const pipelineAnalysis = {
    titleZh: 'OpenAI Node SDK 数据库验证版本', summaryZh: '官方来源已验证的测试摘要。',
    whySelectedZh: '用于验证单一官方来源发布门。', importance: 'key', internalScore: 91, hasConflict: false,
  }
  const firstPipelineRun = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    persistLearningSourceBatch(client, {
      source: pipelineItem.provider, groupKey: pipelineItem.category, slot: 'db-slot-1',
      preparedItems: [{ item: pipelineItem, analysis: pipelineAnalysis }], now: pipelineNow,
    })
  ))
  assert.equal(firstPipelineRun.value.published, 1)
  const publishedPipelineStory = await observer.query(`select id, publication_basis, verification_state, has_conflict
    from learning_radar.stories where title_zh = $1`, [pipelineAnalysis.titleZh])
  assert.equal(publishedPipelineStory.rows[0].publication_basis, 'official_primary')
  assert.equal(publishedPipelineStory.rows[0].verification_state, 'verified')
  assert.equal(publishedPipelineStory.rows[0].has_conflict, false)
  const publicPipelineStory = await observer.query(`select id from learning_radar.public_timeline_items
    where id = $1`, [publishedPipelineStory.rows[0].id])
  assert.equal(publicPipelineStory.rowCount, 1)

  const duplicateSlot = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    persistLearningSourceBatch(client, {
      source: pipelineItem.provider, groupKey: pipelineItem.category, slot: 'db-slot-1',
      preparedItems: [{ item: pipelineItem, analysis: pipelineAnalysis }], now: pipelineNow,
    })
  ))
  assert.equal(duplicateSlot.value.skipped, true)

  const correctedItem = normalizeLearningItem({
    ...pipelineItem,
    title: 'OpenAI Node SDK database fixture release corrected',
    excerpt: 'Official source corrected its release description.',
    publishedAt: new Date(pipelineNow.getTime() - 30_000).toISOString(),
  }, { now: pipelineNow })
  const correctionRun = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    persistLearningSourceBatch(client, {
      source: correctedItem.provider, groupKey: correctedItem.category, slot: 'db-slot-2',
      preparedItems: [{ item: correctedItem, analysis: pipelineAnalysis }], now: pipelineNow,
    })
  ))
  assert.equal(correctionRun.value.failed, undefined)
  const updates = await observer.query(`select title_zh from learning_radar.story_updates
    where story_id = $1`, [publishedPipelineStory.rows[0].id])
  assert.deepEqual(updates.rows.map(row => row.title_zh), ['来源标题已修正'])
  const cursorState = await observer.query(`select cursor from learning_radar.source_cursors
    where source = $1 and group_key = $2`, [pipelineItem.provider, pipelineItem.category])
  assert.equal(JSON.parse(cursorState.rows[0].cursor).providerId, pipelineItem.providerId)

  const conflictAnalysis = {
    titleZh: '验证者协议费用更新', summaryZh: '两个独立来源报道协议费用调整。',
    whySelectedZh: '费用变化会影响验证者成本。', importance: 'noteworthy', internalScore: 72, hasConflict: false,
  }
  const conflictBase = {
    category: 'web3_wallet', title: 'Validator protocol fee update', isOfficial: false,
    publishedAt: new Date(pipelineNow.getTime() - 45_000).toISOString(),
    originVerifiedAt: pipelineNow.toISOString(), verificationState: 'verified', rawPayload: { fixture: true },
  }
  const conflictingItems = [
    normalizeLearningItem({
      ...conflictBase, provider: 'conflict_a', providerId: 'conflict-a', sourceName: 'Research A',
      sourceUrl: 'https://research.mozilla.org/validator-fee', discoveredVia: 'conflict_a',
      excerpt: 'The protocol fee will increase to 12% for validators.',
    }, { now: pipelineNow }),
    normalizeLearningItem({
      ...conflictBase, provider: 'conflict_b', providerId: 'conflict-b', sourceName: 'Research B',
      sourceUrl: 'https://news.apache.org/validator-fee', discoveredVia: 'conflict_b',
      excerpt: 'The protocol fee will increase to 15% for validators.',
    }, { now: pipelineNow }),
  ]
  for (const [index, conflictItem] of conflictingItems.entries()) {
    const result = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
      persistLearningSourceBatch(client, {
        source: conflictItem.provider, groupKey: conflictItem.category, slot: `db-slot-conflict-${index}`,
        preparedItems: [{ item: conflictItem, analysis: conflictAnalysis }], now: pipelineNow,
      })
    ))
    assert.equal(result.value.failed, undefined)
  }
  const conflictedStory = await observer.query(`select id, status, publication_basis, verification_state,
      has_conflict, conflict_evidence
    from learning_radar.stories where title_zh = $1`, [conflictAnalysis.titleZh])
  assert.equal(conflictedStory.rows[0].status, 'draft')
  assert.equal(conflictedStory.rows[0].publication_basis, null)
  assert.equal(conflictedStory.rows[0].verification_state, 'conflict')
  assert.equal(conflictedStory.rows[0].has_conflict, true)
  assert.equal(conflictedStory.rows[0].conflict_evidence.some(evidence => evidence.kind === 'key_number_mismatch'), true)
  const conflictedSourceFacts = await observer.query(`select count(distinct registrable_domain)::integer as domains
    from learning_radar.story_sources where story_id = $1 and verification_state = 'verified'`, [conflictedStory.rows[0].id])
  assert.equal(conflictedSourceFacts.rows[0].domains, 2)
  const hiddenConflictedStory = await observer.query(`select id from learning_radar.public_timeline_items where id = $1`,
    [conflictedStory.rows[0].id])
  assert.equal(hiddenConflictedStory.rowCount, 0)

  const aiInvalidItem = normalizeLearningItem({
    provider: 'ai_invalid_fixture', providerId: 'ai-invalid', category: 'reading',
    title: 'Unique source whose structured analysis failed', excerpt: 'Verified origin text remains stored as a draft.',
    sourceUrl: 'https://research.mozilla.org/ai-invalid', publishedAt: new Date(pipelineNow.getTime() - 25_000).toISOString(),
    isOfficial: false, discoveredVia: 'ai_invalid_fixture', sourceName: 'Research Fixture',
    originVerifiedAt: pipelineNow.toISOString(), verificationState: 'verified', rawPayload: { fixture: true },
  }, { now: pipelineNow })
  const partialRun = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    persistLearningSourceBatch(client, {
      source: aiInvalidItem.provider, groupKey: aiInvalidItem.category, slot: 'db-slot-ai-invalid',
      preparedItems: [{ item: aiInvalidItem, analysis: null, aiError: 'ai_json_invalid' }], now: pipelineNow,
    })
  ))
  assert.deepEqual(partialRun.value.partialErrors, ['ai_json_invalid'])
  const partialJob = await observer.query(`select status, error_code from learning_radar.job_runs
    where source = $1`, [aiInvalidItem.provider])
  assert.deepEqual(partialJob.rows[0], { status: 'succeeded', error_code: 'partial:ai_json_invalid' })
  const aiInvalidPublic = await observer.query(`select public_story.id from learning_radar.public_timeline_items public_story
    join learning_radar.stories story on story.id = public_story.id where story.title_zh = $1`, [aiInvalidItem.title.slice(0, 160)])
  assert.equal(aiInvalidPublic.rowCount, 0)

  const failingItem = normalizeLearningItem({
    ...pipelineItem,
    provider: 'failure_fixture', providerId: 'failure-fixture', rawPayload: { invalid: 1n },
  }, { now: pipelineNow })
  const failedPipelineRun = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    persistLearningSourceBatch(client, {
      source: failingItem.provider, groupKey: failingItem.category, slot: 'db-slot-failure',
      preparedItems: [{ item: failingItem, analysis: pipelineAnalysis }], now: pipelineNow,
    })
  ))
  assert.equal(failedPipelineRun.value.failed, true)
  assert.equal(failedPipelineRun.value.cursorAdvanced, false)
  const failedCursor = await observer.query(`select cursor from learning_radar.source_cursors
    where source = $1`, [failingItem.provider])
  assert.equal(failedCursor.rowCount, 0)
  const failedJob = await observer.query(`select status, error_code from learning_radar.job_runs
    where source = $1`, [failingItem.provider])
  assert.equal(failedJob.rows[0].status, 'failed')

  await observer.query(`update learning_radar.raw_items set payload_expires_at = now() - interval '1 minute'
    where provider = $1`, [pipelineItem.provider])
  const maintenanceResult = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    cleanupLearningRetention(client)
  ))
  assert.equal(maintenanceResult.value.purgedPayloads >= 1, true)
  const retainedEvidence = await observer.query(`select r.payload, count(ss.raw_item_id)::integer as source_count
    from learning_radar.raw_items r left join learning_radar.story_sources ss on ss.raw_item_id = r.id
    where r.provider = $1 group by r.id`, [pipelineItem.provider])
  assert.deepEqual(retainedEvidence.rows[0].payload, { retained: false })
  assert.equal(retainedEvidence.rows[0].source_count, 1)

  const semanticLearningReplay = normalizeLearningItem({
    ...correctedItem,
    rawPayload: { metadata: { beta: 2, alpha: 1 }, fixture: true },
  }, { now: pipelineNow })
  const learningReplayRun = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    persistLearningSourceBatch(client, {
      source: semanticLearningReplay.provider, groupKey: semanticLearningReplay.category,
      slot: 'db-slot-retention-replay',
      preparedItems: [{ item: semanticLearningReplay, analysis: pipelineAnalysis }], now: pipelineNow,
    })
  ))
  assert.equal(learningReplayRun.value.failed, undefined)
  const stillPurgedLearning = await observer.query(`select payload, payload_purged_at
    from learning_radar.raw_items where provider = $1 and provider_id = $2`, [pipelineItem.provider, pipelineItem.providerId])
  assert.deepEqual(stillPurgedLearning.rows[0].payload, { retained: false })
  assert.ok(stillPurgedLearning.rows[0].payload_purged_at instanceof Date)

  const trueLearningRevision = normalizeLearningItem({
    ...correctedItem,
    rawPayload: { fixture: true, metadata: { alpha: 1, beta: 3 }, revision: 2 },
  }, { now: pipelineNow })
  const learningRevisionRun = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    persistLearningSourceBatch(client, {
      source: trueLearningRevision.provider, groupKey: trueLearningRevision.category,
      slot: 'db-slot-retention-revision',
      preparedItems: [{ item: trueLearningRevision, analysis: pipelineAnalysis }], now: pipelineNow,
    })
  ))
  assert.equal(learningRevisionRun.value.failed, undefined)
  const restoredLearningRaw = await observer.query(`select payload, payload_purged_at, payload_expires_at
    from learning_radar.raw_items where provider = $1 and provider_id = $2`, [pipelineItem.provider, pipelineItem.providerId])
  assert.deepEqual(restoredLearningRaw.rows[0].payload, {
    fixture: true, metadata: { alpha: 1, beta: 3 }, revision: 2,
  })
  assert.equal(restoredLearningRaw.rows[0].payload_purged_at, null)
  assert.ok(restoredLearningRaw.rows[0].payload_expires_at.getTime() > Date.now() + 13 * 24 * 60 * 60_000)

  await observer.query(`update learning_radar.raw_items set payload_expires_at = now() - interval '1 minute'
    where provider = $1 and provider_id = $2`, [pipelineItem.provider, pipelineItem.providerId])
  await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => cleanupLearningRetention(client))
  const repurgedLearning = await observer.query(`select payload from learning_radar.raw_items
    where provider = $1 and provider_id = $2`, [pipelineItem.provider, pipelineItem.providerId])
  assert.deepEqual(repurgedLearning.rows[0].payload, { retained: false })
  const retainedLearningStructure = await observer.query(`select count(*)::integer as sources
    from learning_radar.story_sources where story_id = $1`, [publishedPipelineStory.rows[0].id])
  assert.equal(retainedLearningStructure.rows[0].sources, 1)

  const firstDigest = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    generateLearningDailyDigest(client, pipelineNow)
  ))
  const repeatedDigest = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    generateLearningDailyDigest(client, pipelineNow)
  ))
  assert.equal(firstDigest.value.created, true)
  assert.equal(repeatedDigest.value.created, false)

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
