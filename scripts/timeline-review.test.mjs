import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { Pool as PgPool } from 'pg'
import { parse } from 'yaml'
import { normalizeLearningItem } from '../learning-radar/worker/core.mjs'
import { persistPreparedLearningItem } from '../learning-radar/worker/persistence.mjs'
import { withRadarDatabaseLock } from '../market-radar/worker/advisory-lock.mjs'
import { applyRadarMigrations, loadRadarMigrations } from '../market-radar/worker/migrations.mjs'
import { persistMarketItem } from '../market-radar/worker/persistence.mjs'
import {
  reviewTimelineTarget,
  sanitizeTimelineReviewNote,
  validateTimelineReviewInput,
} from '../timeline-review/command.mjs'

const root = new URL('../', import.meta.url)
const read = path => readFile(new URL(path, root), 'utf8')
const releaseSha = 'a'.repeat(40)
const isPublicTimelineView = statement => /create or replace view\s+(?:learning_radar\.public_timeline_items|market_radar\.public_events)\s+as/i.test(statement)
const isLearningPublicView = statement => /create or replace view\s+learning_radar\.public_timeline_items\s+as/i.test(statement)
const isMarketPublicView = statement => /create or replace view\s+market_radar\.public_events\s+as/i.test(statement)
const isReviewFunction = statement => /create or replace function\s+radar_system\.review_timeline/i.test(statement)

function selectTimelineReviewReplayStatements(reviewMigration, compatibilityMigration, publicationMigration, candidateMigration) {
  return {
    reviewStatements: [
      ...reviewMigration.statements.filter(statement => !isPublicTimelineView(statement)),
      ...candidateMigration.statements.filter(isReviewFunction),
    ],
    compatibilityStatements: compatibilityMigration.statements.filter(statement => !isPublicTimelineView(statement)),
    currentPublicViewStatements: [
      ...publicationMigration.statements.filter(isLearningPublicView),
      ...candidateMigration.statements.filter(isMarketPublicView),
    ],
  }
}

test('timeline review workflow is manual, exact-SHA bound and protected by the real approver', async () => {
  const [source, runCommand, command, migration, safetyMigration, compatibilityMigration, guide] = await Promise.all([
    read('.github/workflows/timeline-review.yml'),
    read('timeline-review/run.mjs'),
    read('timeline-review/command.mjs'),
    read('market-radar/migrations/009_timeline_review.sql'),
    read('market-radar/migrations/010_timeline_review_safety.sql'),
    read('market-radar/migrations/011_public_boundary_predicate.sql'),
    read('docs/timeline-review.md'),
  ])
  const workflow = parse(source)
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch'])
  assert.deepEqual(Object.keys(workflow.on.workflow_dispatch.inputs),
    ['domain', 'target_id', 'decision', 'expected_version', 'note'])
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.domain.options, ['learning', 'market'])
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.decision.options, ['approve', 'reject'])
  assert.equal(workflow.jobs.review.environment, 'timeline-review')
  assert.deepEqual(workflow.jobs.review.permissions, { actions: 'read', contents: 'read', deployments: 'read' })
  assert.deepEqual(workflow.permissions, { contents: 'read' })
  assert.equal(workflow.concurrency['cancel-in-progress'], false)
  assert.equal(workflow.jobs.review.steps.some(step => step.uses === 'actions/checkout@v4'), true)
  for (const step of workflow.jobs.review.steps) {
    if (step.run) assert.doesNotMatch(step.run, /\$\{\{\s*inputs\./)
  }
  assert.match(source, /REQUESTED_RELEASE_SHA: \$\{\{ github\.sha \}\}/)
  assert.match(source, /actions\/runs\/\$\{GITHUB_RUN_ID\}\/approvals/)
  assert.match(source, /\.state == "approved"/)
  assert.match(source, /\.name == "timeline-review"/)
  assert.doesNotMatch(source, /submitted_at/)
  assert.match(source, /approved_by=\$approved_by/)
  assert.match(source, /test "\$\{approved_by,,\}" != "\$\{GITHUB_ACTOR,,\}"/)
  const mutationStep = workflow.jobs.review.steps.find(step => step.name === 'Apply protected timeline review')
  assert.match(mutationStep.run, /revalidate_authorization\s+npm run timeline-review\s+revalidate_authorization/)
  assert.match(source, /release-controller-authorized/)
  assert.match(source, /release-controller\.yml/)
  assert.match(source, /TIMELINE_REVIEW_DATABASE_URL: \$\{\{ secrets\.TIMELINE_REVIEW_DATABASE_URL \}\}/)
  assert.doesNotMatch(source, /MARKET_RADAR_DATABASE_URL/)
  assert.doesNotMatch(source, /GITHUB_STEP_SUMMARY|echo[^\n]*(?:REVIEW_NOTE|REVIEW_TARGET_ID|REVIEW_DECISION)/)
  assert.match(runCommand, /process\.env\.TIMELINE_REVIEW_DATABASE_URL/)
  assert.doesNotMatch(runCommand, /MARKET_RADAR_DATABASE_URL|REVIEW_NOTE.*console|JSON\.stringify/)
  assert.match(command, /from radar_system\.review_timeline/)
  assert.doesNotMatch(command, /from learning_radar|from market_radar|update learning_radar|update market_radar/i)
  assert.match(migration, /security definer\s+set search_path = pg_catalog/i)
  assert.match(migration, /revoke all on function radar_system\.review_timeline[\s\S]*from public/i)
  assert.match(safetyMigration, /create table if not exists radar_system\.timeline_review_runs/i)
  assert.match(safetyMigration, /meaningful_timeline_boundary\(e\.watch_for_zh\)/i)
  assert.match(safetyMigration, /ss\.published_at >= v_now - interval '30 days'/i)
  assert.match(safetyMigration, /pg_advisory_xact_lock\(hashtextextended\('timeline-review-run:'/i)
  assert.match(compatibilityMigration,
    /grant execute on function radar_system\.meaningful_timeline_boundary\(text\) to public/i)
  assert.doesNotMatch(compatibilityMigration,
    /manual_source\.published_at\s*[<>]=?\s*statement_timestamp/i)
  assert.doesNotMatch(compatibilityMigration, /review_timeline/i)
  assert.match(guide, /same Neon database/)
  assert.match(guide, /must have no direct access/)
  assert.doesNotMatch(guide, /postgres(?:ql)?:\/\//i)
})

test('timeline review validates identities, versions and private notes before SQL', () => {
  const sanitized = sanitizeTimelineReviewNote(`safe\u0000\u0001\n'; drop table stories; --`)
  assert.equal(sanitized, "safe '; drop table stories; --")
  assert.equal([...sanitizeTimelineReviewNote('x'.repeat(1_100))].length, 1_000)
  const valid = {
    domain: 'learning', targetId: 'story-1', decision: 'approve', note: sanitized,
    requestedBy: 'requester-1', approvedBy: 'reviewer-2', workflowRunId: '123456789',
    expectedVersion: '2026-08-11T03:04:05.123456Z', releaseSha,
  }
  assert.deepEqual(validateTimelineReviewInput(valid), valid)
  assert.throws(() => validateTimelineReviewInput({ ...valid, targetId: "x' or 1=1 --" }), /target ID/i)
  assert.throws(() => validateTimelineReviewInput({ ...valid, approvedBy: '' }), /approving GitHub reviewer/i)
  assert.throws(() => validateTimelineReviewInput({ ...valid, approvedBy: valid.requestedBy }), /must be different users/i)
  assert.throws(() => validateTimelineReviewInput({ ...valid, requestedBy: 'CaseUser', approvedBy: 'caseuser' }), /must be different users/i)
  assert.throws(() => validateTimelineReviewInput({ ...valid, expectedVersion: 'yesterday' }), /Expected version/i)
  assert.throws(() => validateTimelineReviewInput({ ...valid, releaseSha: releaseSha.toUpperCase() }), /lowercase/i)
})

test('timeline review replays 010/011 functions with the current 013 review and public views', async () => {
  const migrations = await loadRadarMigrations()
  const reviewMigration = migrations.find(migration => migration.file === '010_timeline_review_safety.sql')
  const compatibilityMigration = migrations.find(migration => migration.file === '011_public_boundary_predicate.sql')
  const publicationMigration = migrations.find(migration => migration.file === '012_publication_content_boundary.sql')
  const candidateMigration = migrations.find(migration => migration.file === '013_candidate_publication_state.sql')
  assert.ok(reviewMigration)
  assert.ok(compatibilityMigration)
  assert.ok(publicationMigration)
  assert.ok(candidateMigration)

  const { reviewStatements, compatibilityStatements, currentPublicViewStatements } =
    selectTimelineReviewReplayStatements(reviewMigration, compatibilityMigration, publicationMigration, candidateMigration)
  assert.equal(reviewMigration.statements.length + 1 - reviewStatements.length, 2)
  assert.equal(compatibilityMigration.statements.length - compatibilityStatements.length, 1)
  assert.equal(reviewStatements.some(statement => statement.includes('create or replace function radar_system.review_timeline')), true)
  assert.equal(compatibilityStatements.some(statement => /grant execute on function radar_system\.meaningful_timeline_boundary\(text\) to public/i.test(statement)), true)
  assert.equal([...reviewStatements, ...compatibilityStatements].some(isPublicTimelineView), false)
  assert.equal(currentPublicViewStatements.length, 2)
  assert.equal(currentPublicViewStatements.every(statement => /snapshot_id[\s\S]*snapshot_as_of/i.test(statement)), true)
})

function commandAvailable(command) {
  return spawnSync(command, ['--version'], { encoding: 'utf8' }).status === 0
}

async function insertLearningFixture(database, id, {
  status = 'draft', verified = true, conflict = false, source = true, aiSchema = 'learning-v1',
  publicationBasis = null, sourceUrl = 'https://example.com/source', discoveredVia = 'fixture',
  sourceHoursAgo = 1,
} = {}) {
  const updated = (await database.query(`insert into learning_radar.stories
    (id, slug, cluster_key, category, status, importance, internal_score, title_zh, summary_zh,
      why_selected_zh, ai_schema_version, occurred_at, published_at, updated_at,
      publication_basis, verification_state, has_conflict, conflict_evidence)
    values ($1,$1,$1,'ai',$2,'noteworthy',70,'结构化标题','结构化摘要','可解释的入选理由',$3,
      now() - interval '1 hour',case when $2 = 'published' then now() else null end,
      date_trunc('milliseconds', now() - interval '1 minute'),$4,
      case when $5::boolean then 'conflict' else 'pending' end,$5,
      case when $5::boolean then '[{"kind":"fixture"}]'::jsonb else '[]'::jsonb end)
    returning updated_at`, [id, status, aiSchema, publicationBasis, conflict])).rows[0].updated_at.toISOString()
  if (source) {
    const sourceDomain = new URL(sourceUrl).hostname
    await database.query(`insert into learning_radar.raw_items
      (id,provider,provider_id,source_url,source_domain,title,excerpt,published_at,payload,
        origin_verified_at,is_official,discovered_via,verification_state)
      values ($1,'fixture',$1,$3,$4,'Fixture source','Fixture excerpt',
        now() - ($6::text || ' hours')::interval,'{}'::jsonb,case when $2 then now() else null end,false,$5,
        case when $2 then 'verified' else 'unverified' end)`, [
      `${id}-raw`, verified, sourceUrl, sourceDomain, discoveredVia, sourceHoursAgo,
    ])
    await database.query(`insert into learning_radar.story_sources
      (story_id,raw_item_id,source_name,source_url,title,excerpt,published_at,is_primary,
        origin_verified_at,source_domain,registrable_domain,is_official,discovered_via,verification_state)
      select $1,id,'Fixture source',source_url,title,excerpt,published_at,true,origin_verified_at,
        source_domain,$3,false,discovered_via,verification_state
      from learning_radar.raw_items where id = $2`, [id, `${id}-raw`, sourceDomain])
  }
  return updated
}

async function insertMarketFixture(database, id, {
  status = 'draft', priority = 'P1', aiSchema = 'v2', occurredHoursAgo = 1,
  source = true, primary = true, watch = '观察成交量与后续官方确认', invalidation = '若官方撤回则失效',
} = {}) {
  const updated = (await database.query(`insert into market_radar.events
    (id,slug,cluster_key,market,status,priority,score,title_zh,summary_zh,why_it_matters_zh,
      event_type,news_direction,system_judgment,horizon,ai_schema_version,occurred_at,published_at,
      watch_for_zh,invalidation_zh,updated_at)
    values ($1,$1,$1,'crypto',$2,$3,75,'市场事件标题','市场事件摘要','市场事件的重要性',
      'protocol','neutral','等待价格与来源继续验证','days',$4,
      now() - ($5::text || ' hours')::interval,case when $2 = 'published' then now() else null end,
      $6,$7,date_trunc('milliseconds', now() - interval '1 minute')) returning updated_at`, [
      id, status, priority, aiSchema, occurredHoursAgo, watch, invalidation,
    ])).rows[0].updated_at.toISOString()
  if (source) {
    await database.query(`insert into market_radar.raw_items
      (id,provider,provider_id,market,source_url,title,published_at,payload)
      values ($1,'fixture',$1,'crypto','https://example.com/report','Fixture market report',
        now() - interval '1 hour','{}'::jsonb)`, [`${id}-raw`])
    await database.query(`insert into market_radar.event_sources
      (event_id,raw_item_id,source_name,source_url,title,excerpt,published_at,is_primary)
      select $1,id,'fixture',source_url,title,'Original public report',published_at,$3
      from market_radar.raw_items where id = $2`, [id, `${id}-raw`, primary])
  }
  return updated
}

function reviewInput(domain, targetId, expectedVersion, workflowRunId, decision = 'approve', note = null) {
  return {
    domain, targetId, decision, note, expectedVersion, workflowRunId, releaseSha,
    requestedBy: 'requester-1', approvedBy: 'reviewer-2',
  }
}

test('real PostgreSQL protects timeline review transitions, audit privacy and executor scope', {
  skip: process.env.RUN_RADAR_DB_TESTS !== 'true',
  timeout: 90_000,
}, async (t) => {
  let fixtureDir
  let dataDir
  let adminUrl = process.env.RADAR_TEST_DATABASE_URL
  if (!adminUrl) {
    assert.equal(commandAvailable('initdb') && commandAvailable('pg_ctl'), true,
      'test:radar-db requires RADAR_TEST_DATABASE_URL or local initdb/pg_ctl binaries')
    fixtureDir = mkdtempSync(join(tmpdir(), 'xiuqiu-review-pg-'))
    dataDir = join(fixtureDir, 'data')
    const port = 5432
    const init = spawnSync('initdb', [
      '-D', dataDir, '-U', 'postgres', '--auth=trust', '--no-locale', '--encoding=UTF8', '--no-sync',
      '--set', 'shared_memory_type=mmap', '--set', 'dynamic_shared_memory_type=mmap',
    ], { encoding: 'utf8' })
    assert.equal(init.status, 0, init.stderr)
    const startOptions = `-F -c listen_addresses='' -c shared_memory_type=mmap -c dynamic_shared_memory_type=mmap -c unix_socket_directories='${fixtureDir}' -p ${port}`
    const start = spawnSync('pg_ctl', ['-D', dataDir, '-o', startOptions, '-w', 'start'], { stdio: 'ignore' })
    assert.equal(start.status, 0)
    adminUrl = `postgresql://postgres@localhost:${port}/postgres?host=${encodeURIComponent(fixtureDir)}`
  }

  const suffix = `${process.pid}_${Date.now()}`
  const testDatabase = `review_test_${suffix}`
  const executorRole = `review_executor_${suffix}`
  const admin = new PgPool({ connectionString: adminUrl })
  let database
  let databaseCreated = false
  let roleCreated = false
  const borrowedClients = new Set()
  const borrowClient = async () => {
    const client = await database.connect()
    borrowedClients.add(client)
    return client
  }
  const releaseClient = client => {
    if (borrowedClients.delete(client)) client.release()
  }
  t.after(async () => {
    for (const client of borrowedClients) client.release()
    borrowedClients.clear()
    if (database) await database.end()
    try {
      if (databaseCreated) {
        await admin.query('select pg_terminate_backend(pid) from pg_stat_activity where datname = $1', [testDatabase])
        await admin.query(`drop database "${testDatabase}"`)
      }
      if (roleCreated) await admin.query(`drop role "${executorRole}"`)
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
  const migrated = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    applyRadarMigrations((statement, values) => client.query(statement, values), migrations)
  ))
  assert.equal(migrated.value.appliedFiles, migrations.length)
  const replayedMigrations = await withRadarDatabaseLock({ databaseUrl, wait: true, createPool }, ({ client }) => (
    applyRadarMigrations((statement, values) => client.query(statement, values), migrations)
  ))
  assert.equal(replayedMigrations.value.appliedFiles, 0)
  assert.equal(replayedMigrations.value.skippedFiles, migrations.length)
  database = new PgPool({ connectionString: databaseUrl })

  const reviewMigration = migrations.find(migration => migration.file === '010_timeline_review_safety.sql')
  const compatibilityMigration = migrations.find(migration => migration.file === '011_public_boundary_predicate.sql')
  const publicationMigration = migrations.find(migration => migration.file === '012_publication_content_boundary.sql')
  const candidateMigration = migrations.find(migration => migration.file === '013_candidate_publication_state.sql')
  assert.ok(reviewMigration)
  assert.ok(compatibilityMigration)
  assert.ok(publicationMigration)
  assert.ok(candidateMigration)
  assert.equal(reviewMigration.statements.filter(statement => statement.includes('create or replace function radar_system.review_timeline')).length, 1)
  const { reviewStatements, compatibilityStatements, currentPublicViewStatements } =
    selectTimelineReviewReplayStatements(reviewMigration, compatibilityMigration, publicationMigration, candidateMigration)
  assert.equal(reviewMigration.statements.length + 1 - reviewStatements.length, 2)
  assert.equal(compatibilityMigration.statements.length - compatibilityStatements.length, 1)
  assert.equal(currentPublicViewStatements.length, 2)
  assert.ok(currentPublicViewStatements.every(statement => /snapshot_id[\s\S]*snapshot_as_of/i.test(statement)))
  await database.query('create view learning_radar.timeline_review_dependency as select id from learning_radar.public_timeline_items')
  await database.query('create view market_radar.timeline_review_dependency as select id from market_radar.public_events')
  await database.query('grant select on learning_radar.public_timeline_items to pg_monitor')
  await database.query('grant select on market_radar.public_events to pg_monitor')
  await database.query('grant execute on function radar_system.meaningful_timeline_boundary(text) to pg_monitor')
  await database.query(`grant execute on function radar_system.review_timeline(text,text,text,text,text,text,text,timestamptz,text) to pg_monitor`)
  for (let replay = 0; replay < 2; replay += 1) {
    await database.query('begin')
    try {
      for (const statement of reviewStatements) await database.query(statement)
      for (const statement of compatibilityStatements) await database.query(statement)
      for (const statement of currentPublicViewStatements) await database.query(statement)
      await database.query('commit')
    } catch (error) {
      await database.query('rollback')
      throw error
    }
  }
  assert.equal((await database.query('select count(*)::integer as count from learning_radar.timeline_review_dependency')).rows[0].count, 0)
  assert.equal((await database.query('select count(*)::integer as count from market_radar.timeline_review_dependency')).rows[0].count, 0)
  assert.equal((await database.query(`select has_table_privilege('pg_monitor','learning_radar.public_timeline_items','select') as allowed`)).rows[0].allowed, true)
  assert.equal((await database.query(`select has_table_privilege('pg_monitor','market_radar.public_events','select') as allowed`)).rows[0].allowed, true)
  assert.equal((await database.query(`select has_function_privilege('pg_monitor',
    'radar_system.meaningful_timeline_boundary(text)','execute') as allowed`)).rows[0].allowed, true)
  assert.equal((await database.query(`select has_function_privilege('pg_monitor',
    'radar_system.review_timeline(text,text,text,text,text,text,text,timestamp with time zone,text)','execute') as allowed`)).rows[0].allowed, true)

  await admin.query(`create role "${executorRole}" nologin`)
  roleCreated = true
  await database.query(`grant usage on schema radar_system to "${executorRole}"`)
  await database.query(`grant execute on function radar_system.review_timeline(text,text,text,text,text,text,text,timestamptz,text) to "${executorRole}"`)
  const executor = await borrowClient()
  await executor.query(`set role "${executorRole}"`)

  const selfApprovalVersion = await insertLearningFixture(database, 'learning-self-approve')
  await assert.rejects(executor.query(`select * from radar_system.review_timeline(
      'learning','learning-self-approve','approve',null,'same-user','same-user','999',
      $1::timestamptz,$2)`, [selfApprovalVersion, releaseSha]), /requester_cannot_approve/)
  assert.equal((await database.query(`select status from learning_radar.stories
    where id = 'learning-self-approve'`)).rows[0].status, 'draft')
  const caseSelfApprovalVersion = await insertLearningFixture(database, 'learning-case-self-approve')
  await assert.rejects(executor.query(`select * from radar_system.review_timeline(
      'learning','learning-case-self-approve','approve',null,'CaseUser','caseuser','998',
      $1::timestamptz,$2)`, [caseSelfApprovalVersion, releaseSha]), /requester_cannot_approve/)
  const caseConstraintVersion = await insertLearningFixture(database, 'learning-case-constraint')
  await assert.rejects(database.query(`insert into learning_radar.review_decisions
    (id,story_id,decision,actor,requested_by,approved_by,note,workflow_run_id,release_sha,input_hash,
      expected_version,previous_status,new_status)
    values ('case-constraint','learning-case-constraint','reject','CaseUser','CaseUser','caseuser',null,
      '997',$1,repeat('c',64),$2,'draft','rejected')`, [releaseSha, caseConstraintVersion]),
  /learning_review_identity_check/)

  const learningVersion = await insertLearningFixture(database, 'learning-approve', {
    discoveredVia: 'https://aihot.virxact.com/items/discovery-only',
    sourceHoursAgo: 20 * 24,
  })
  const learningReview = reviewInput('learning', 'learning-approve', learningVersion, '1001', 'approve',
    `Reviewed\u0000 safely; '; drop table learning_radar.stories; --`)
  const approvedLearning = await reviewTimelineTarget(executor, learningReview)
  assert.equal(approvedLearning.newStatus, 'approved')
  assert.equal(approvedLearning.replayed, false)
  const learningReplay = await reviewTimelineTarget(executor, learningReview)
  assert.equal(learningReplay.replayed, true)
  await assert.rejects(reviewTimelineTarget(executor, { ...learningReview, note: 'different' }), /workflow_run_reused/)
  const learningAudit = (await database.query(`select requested_by, approved_by, note, input_hash,
      previous_status, new_status from learning_radar.review_decisions where workflow_run_id = '1001'`)).rows[0]
  assert.equal(learningAudit.requested_by, 'requester-1')
  assert.equal(learningAudit.approved_by, 'reviewer-2')
  assert.equal(learningAudit.note, "Reviewed safely; '; drop table learning_radar.stories; --")
  assert.match(learningAudit.input_hash, /^[0-9a-f]{64}$/)
  assert.deepEqual([learningAudit.previous_status, learningAudit.new_status], ['draft', 'approved'])
  assert.equal((await database.query(`select count(*)::integer as count from learning_radar.public_timeline_items
    where id = 'learning-approve'`)).rows[0].count, 0)
  await database.query(`update learning_radar.story_sources
    set published_at = statement_timestamp() - interval '40 days'
    where story_id = 'learning-approve'`)
  await database.query(`update learning_radar.raw_items
    set payload = '{"retained":false}'::jsonb, payload_purged_at = statement_timestamp()
    where id = 'learning-approve-raw'`)
  assert.equal((await database.query(`select count(*)::integer as count from learning_radar.public_timeline_items
    where id = 'learning-approve'`)).rows[0].count, 0)
  assert.equal((await database.query(`select count(*)::integer as count from learning_radar.public_story_reports
    where story_id = 'learning-approve'`)).rows[0].count, 0)
  assert.equal(learningAudit.requested_by, learningAudit.requested_by.toLowerCase())
  assert.equal(learningAudit.approved_by, learningAudit.approved_by.toLowerCase())
  await assert.rejects(executor.query('select payload from learning_radar.raw_items limit 1'), /permission denied/)
  await assert.rejects(executor.query('select note from learning_radar.review_decisions limit 1'), /permission denied/)

  const hiddenManualVersion = await insertLearningFixture(database, 'learning-manual-no-audit', {
    status: 'published', publicationBasis: 'manual_review',
  })
  void hiddenManualVersion
  assert.equal((await database.query(`select count(*)::integer as count from learning_radar.public_timeline_items
    where id = 'learning-manual-no-audit'`)).rows[0].count, 0)

  const unverifiedVersion = await insertLearningFixture(database, 'learning-unverified', { verified: false })
  await assert.rejects(reviewTimelineTarget(executor,
    reviewInput('learning', 'learning-unverified', unverifiedVersion, '1002')), /unsafe_learning_draft/)
  const conflictVersion = await insertLearningFixture(database, 'learning-conflict', { conflict: true })
  await assert.rejects(reviewTimelineTarget(executor,
    reviewInput('learning', 'learning-conflict', conflictVersion, '1003')), /unsafe_learning_draft/)
  const aihotVersion = await insertLearningFixture(database, 'learning-aihot-only', {
    sourceUrl: 'https://news.aihot.virxact.com/item/blocked',
  })
  await assert.rejects(reviewTimelineTarget(executor,
    reviewInput('learning', 'learning-aihot-only', aihotVersion, '1005')), /unsafe_learning_draft/)

  for (const [id, sourceHoursAgo, run] of [
    ['learning-source-too-old', 31 * 24, '1007'],
    ['learning-source-too-future', -2, '1008'],
  ]) {
    const version = await insertLearningFixture(database, id, { sourceHoursAgo })
    await assert.rejects(reviewTimelineTarget(executor, reviewInput('learning', id, version, run)),
      /unsafe_learning_draft/)
    assert.deepEqual((await database.query(`select status, published_at from learning_radar.stories
      where id = $1`, [id])).rows[0], { status: 'draft', published_at: null })
    assert.equal((await database.query(`select count(*)::integer as count from learning_radar.review_decisions
      where story_id = $1`, [id])).rows[0].count, 0)
    assert.equal((await database.query(`select count(*)::integer as count from learning_radar.public_timeline_items
      where id = $1`, [id])).rows[0].count, 0)
  }

  await insertLearningFixture(database, 'learning-aihot-public', {
    status: 'published', publicationBasis: 'manual_review',
    sourceUrl: 'https://aihot.virxact.com/item/blocked',
  })
  await database.query(`insert into learning_radar.review_decisions
    (id,story_id,decision,actor,requested_by,approved_by,note,workflow_run_id,release_sha,input_hash,
      expected_version,previous_status,new_status)
    select 'forged-aihot-audit',id,'approve','requester-1','requester-1','reviewer-2',null,'1006',$1,
      repeat('b',64),updated_at,'draft','published'
    from learning_radar.stories where id = 'learning-aihot-public'`, [releaseSha])
  assert.equal((await database.query(`select count(*)::integer as count from learning_radar.public_timeline_items
    where id = 'learning-aihot-public'`)).rows[0].count, 0)

  const rejectLearningVersion = await insertLearningFixture(database, 'learning-reject')
  const rejectedLearning = await reviewTimelineTarget(executor,
    reviewInput('learning', 'learning-reject', rejectLearningVersion, '1004', 'reject'))
  assert.equal(rejectedLearning.newStatus, 'rejected')
  const rejectedLearningItem = normalizeLearningItem({
    provider: 'fixture', providerId: 'learning-reject-raw', category: 'ai',
    title: 'Fixture source', excerpt: 'Fixture excerpt', sourceUrl: 'https://example.com/source',
    publishedAt: new Date().toISOString(), isOfficial: true, discoveredVia: 'fixture',
    sourceName: 'Fixture source', originVerifiedAt: new Date().toISOString(),
    verificationState: 'verified', rawPayload: { replay: true },
  })
  const learningWorkerClient = await borrowClient()
  try {
    const workerResult = await persistPreparedLearningItem(learningWorkerClient, {
      item: rejectedLearningItem,
      analysis: {
        titleZh: '结构化标题', summaryZh: '结构化摘要', whySelectedZh: '可解释的入选理由',
        importance: 'key', internalScore: 90, hasConflict: false,
      },
    })
    assert.equal(workerResult.published, false)
  } finally {
    releaseClient(learningWorkerClient)
  }
  const rejectedLearningState = (await database.query(`select status, published_at from learning_radar.stories
    where id = 'learning-reject'`)).rows[0]
  assert.deepEqual(rejectedLearningState, { status: 'rejected', published_at: null })

  const marketVersion = await insertMarketFixture(database, 'market-approve')
  const approvedMarket = await reviewTimelineTarget(executor,
    reviewInput('market', 'market-approve', marketVersion, '2001'))
  assert.equal(approvedMarket.newStatus, 'approved')
  assert.equal((await database.query(`select count(*)::integer as count from market_radar.public_events
    where id = 'market-approve'`)).rows[0].count, 0)

  for (const [id, boundary, run] of [
    ['market-boundary-placeholder', '待补充', '2010'],
    ['market-boundary-punctuation', '。！？--', '2011'],
    ['market-boundary-arabic-punctuation', '،؛', '2017'],
    ['market-boundary-emoji', '😀🚀', '2012'],
    ['market-boundary-zero-width', '\u200b\u200d', '2013'],
    ['market-boundary-entity', '&#24453;&#34917;&#20805;', '2014'],
    ['market-boundary-double-entity', '&amp;#24453;&amp;#34917;&amp;#20805;', '2015'],
    ['market-boundary-too-long', '界'.repeat(601), '2016'],
  ]) {
    const version = await insertMarketFixture(database, id, { watch: boundary })
    await assert.rejects(reviewTimelineTarget(executor, reviewInput('market', id, version, run)),
      /unsafe_market_draft/)
    assert.equal((await database.query(`select count(*)::integer as count from market_radar.public_events
      where id = $1`, [id])).rows[0].count, 0)
    await insertMarketFixture(database, `${id}-public`, { status: 'published', watch: boundary })
    assert.equal((await database.query(`select count(*)::integer as count from market_radar.public_events
      where id = $1`, [`${id}-public`])).rows[0].count, 0)
  }
  const sixDayVersion = await insertMarketFixture(database, 'market-six-days', { occurredHoursAgo: 144 })
  assert.equal((await reviewTimelineTarget(executor,
    reviewInput('market', 'market-six-days', sixDayVersion, '2008'))).newStatus, 'approved')

  const marketRejectVersion = await insertMarketFixture(database, 'market-reject')
  await reviewTimelineTarget(executor, reviewInput('market', 'market-reject', marketRejectVersion, '2002', 'reject'))
  const marketWorkerClient = await borrowClient()
  try {
    const workerResult = await persistMarketItem(marketWorkerClient, {
      provider: 'fixture', providerId: 'market-reject-raw', market: 'crypto',
      sourceUrl: 'https://example.com/report', title: 'Fixture market report', summary: 'Fixture market report',
      sourceReport: { title: 'Fixture market report', excerpt: 'Updated report', publishedAt: new Date().toISOString() },
      publishedAt: new Date().toISOString(), explicitSymbols: ['BTC'], payload: { replay: true },
    })
    assert.equal(workerResult.published, false)
  } finally {
    releaseClient(marketWorkerClient)
  }
  const rejectedMarketState = (await database.query(`select status, published_at from market_radar.events
    where id = 'market-reject'`)).rows[0]
  assert.deepEqual(rejectedMarketState, { status: 'rejected', published_at: null })

  const reusedRunLearningVersion = await insertLearningFixture(database, 'learning-global-run')
  const reusedRunMarketVersion = await insertMarketFixture(database, 'market-global-run')
  await reviewTimelineTarget(executor,
    reviewInput('learning', 'learning-global-run', reusedRunLearningVersion, '2099', 'reject'))
  await assert.rejects(reviewTimelineTarget(executor,
    reviewInput('market', 'market-global-run', reusedRunMarketVersion, '2099', 'reject')),
  /workflow_run_reused/)
  assert.equal((await database.query(`select status from market_radar.events
    where id = 'market-global-run'`)).rows[0].status, 'draft')
  assert.equal((await database.query(`select count(*)::integer as count from market_radar.review_decisions
    where event_id = 'market-global-run'`)).rows[0].count, 0)
  assert.equal((await database.query(`select count(*)::integer as count from radar_system.timeline_review_runs
    where workflow_run_id = '2099'`)).rows[0].count, 1)

  for (const [id, options, run] of [
    ['market-p3', { priority: 'P3' }, '2003'],
    ['market-expired', { occurredHoursAgo: 192 }, '2004'],
    ['market-no-primary', { primary: false }, '2005'],
    ['market-no-ai', { aiSchema: null }, '2006'],
  ]) {
    const version = await insertMarketFixture(database, id, options)
    await assert.rejects(reviewTimelineTarget(executor, reviewInput('market', id, version, run)),
      /unsafe_market_draft/)
  }

  await insertMarketFixture(database, 'market-placeholder-public', {
    status: 'published', watch: '待补充', invalidation: '若官方撤回则失效',
  })
  assert.equal((await database.query(`select count(*)::integer as count from market_radar.public_events
    where id = 'market-placeholder-public'`)).rows[0].count, 0)
  await insertMarketFixture(database, 'market-no-ai-public', { status: 'published', aiSchema: null })
  assert.equal((await database.query(`select count(*)::integer as count from market_radar.public_events
    where id = 'market-no-ai-public'`)).rows[0].count, 0)

  const staleVersion = await insertMarketFixture(database, 'market-stale')
  await assert.rejects(reviewTimelineTarget(executor,
    reviewInput('market', 'market-stale', new Date(Date.parse(staleVersion) - 1_000).toISOString(), '2007')),
  /version_changed/)

  const concurrentVersion = await insertLearningFixture(database, 'learning-concurrent')
  const concurrentA = await borrowClient()
  const concurrentB = await borrowClient()
  const outcomes = await Promise.allSettled([
    reviewTimelineTarget(concurrentA, reviewInput('learning', 'learning-concurrent', concurrentVersion, '3001', 'approve')),
    reviewTimelineTarget(concurrentB, reviewInput('learning', 'learning-concurrent', concurrentVersion, '3002', 'reject')),
  ])
  releaseClient(concurrentA)
  releaseClient(concurrentB)
  assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1)
  assert.equal(outcomes.filter(outcome => outcome.status === 'rejected').length, 1)
  assert.match(String(outcomes.find(outcome => outcome.status === 'rejected').reason), /status_changed/)
  assert.equal((await database.query(`select count(*)::integer as count from learning_radar.review_decisions
    where story_id = 'learning-concurrent'`)).rows[0].count, 1)

  const rollbackVersion = await insertMarketFixture(database, 'market-rollback')
  await database.query(`alter table market_radar.review_decisions add constraint review_rollback_fixture
    check (note is distinct from 'force rollback')`)
  await assert.rejects(reviewTimelineTarget(executor,
    reviewInput('market', 'market-rollback', rollbackVersion, '4001', 'reject', 'force rollback')),
  /review_rollback_fixture/)
  await database.query('alter table market_radar.review_decisions drop constraint review_rollback_fixture')
  assert.equal((await database.query(`select status from market_radar.events where id = 'market-rollback'`)).rows[0].status, 'draft')
  assert.equal((await database.query(`select count(*)::integer as count from market_radar.review_decisions
    where workflow_run_id = '4001'`)).rows[0].count, 0)

  const leakedAuditColumns = await database.query(`select table_schema, table_name, column_name
    from information_schema.columns
    where table_schema in ('learning_radar','market_radar')
      and table_name like 'public_%'
      and column_name in ('note','actor','requested_by','approved_by','workflow_run_id','release_sha',
        'input_hash','expected_version','internal_score','payload')`)
  assert.equal(leakedAuditColumns.rowCount, 0)

  await executor.query('reset role')
  releaseClient(executor)
})
