import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parse } from 'yaml'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const controllerSource = read('.github/workflows/release-controller.yml')
const workerSource = read('.github/workflows/market-radar.yml')
const controller = parse(controllerSource)
const worker = parse(workerSource)
const vercel = JSON.parse(read('vercel.json'))

const productionJobs = [
  'production_migration',
  'stage_vercel_candidate',
  'verify_vercel_candidate',
  'promote_vercel_production',
  'mark_deployed_sha',
  'promote_market_radar_worker',
]

test('release controller is inert by default and binds every production step to one SHA', () => {
  assert.deepEqual(Object.keys(controller.on), ['workflow_dispatch'])
  assert.equal(controller.on.workflow_dispatch.inputs.operation.default, 'dry-run')
  assert.equal(controller.on.workflow_dispatch.inputs.release_sha.required, false)
  assert.match(controller.concurrency.group, /xiuqiu-production-release/)
  assert.equal(controller.concurrency['cancel-in-progress'], false)

  assert.equal(controller.jobs.preflight.environment, undefined)
  assert.doesNotMatch(JSON.stringify(controller.jobs.preflight), /secrets\./)
  assert.match(controllerSource, /release_sha must be a full lowercase 40-character commit SHA/)
  assert.match(controllerSource, /test "\$release_sha" = "\$remote_main"/)
  assert.match(controllerSource, /test "\$MARKET_RADAR_ENABLED" = 'true'/)

  for (const jobName of productionJobs) {
    assert.equal(controller.jobs[jobName].environment, 'production-release')
    assert.match(String(controller.jobs[jobName].if), /operation == 'release'/)
  }
})

test('release DAG is migration, staged Vercel promotion, worker smoke, then activation', () => {
  assert.equal(controller.jobs.production_migration.needs, 'preflight')
  assert.deepEqual(controller.jobs.stage_vercel_candidate.needs, ['preflight', 'production_migration'])
  assert.deepEqual(controller.jobs.verify_vercel_candidate.needs, ['preflight', 'stage_vercel_candidate'])
  assert.deepEqual(controller.jobs.promote_vercel_production.needs, ['preflight', 'verify_vercel_candidate'])
  assert.deepEqual(controller.jobs.mark_deployed_sha.needs, ['preflight', 'promote_vercel_production'])
  assert.deepEqual(controller.jobs.promote_market_radar_worker.needs, ['preflight', 'mark_deployed_sha'])

  assert.equal(controller.jobs.stage_vercel_candidate.steps.find(step => step.uses === 'actions/setup-node@v4')?.with['node-version'], 24)
  assert.match(controllerSource, /VERCEL_CLI_VERSION: 58\.9\.0/)
  assert.match(controllerSource, /vercel deploy --prebuilt --prod --skip-domain --yes --json/)
  assert.match(controllerSource, /value\.readyState === 'READY'/)
  assert.match(controllerSource, /value\.target === 'production'/)
  assert.match(controllerSource, /value\.meta\?\.githubCommitSha === process\.env\.RELEASE_SHA/)
  assert.match(controllerSource, /value\.aliasError == null/)
  assert.match(controllerSource, /vercel promote "\$DEPLOYMENT_URL" --yes/)
  assert.doesNotMatch(controllerSource, /--token|curl[^\n]*Authorization|Authorization: Bearer/)

  assert.equal(controller.jobs.mark_deployed_sha.permissions.deployments, 'write')
  assert.doesNotMatch(controllerSource, /actions\/variables|upsert_variable/)
})

test('manual and scheduled workers cannot bypass the deployed-SHA authorization boundary', () => {
  assert.equal(worker.on.workflow_dispatch.inputs.mode.default, 'dry-run')
  assert.deepEqual(worker.on.workflow_dispatch.inputs.mode.options, ['dry-run', 'ingest', 'daily', 'premarket'])
  assert.equal(worker.concurrency.group, 'xiuqiu-production-release')
  assert.match(String(worker.jobs.authorize.if), /workflow_dispatch.*MARKET_RADAR_ENABLED/)
  assert.equal(worker.jobs.authorize.environment, undefined)
  assert.doesNotMatch(JSON.stringify(worker.jobs.authorize), /secrets\./)
  assert.equal(worker.jobs.report_dry_run.environment, undefined)
  assert.equal(worker.jobs.run.environment, 'production-release')
  assert.match(workerSource, /MARKET_RADAR_ENABLED/)
  assert.doesNotMatch(workerSource, /MARKET_RADAR_DEPLOYED_SHA/)
  assert.match(workerSource, /market-radar-production-authorized/)
  assert.match(workerSource, /release-controller\.yml/)
  assert.doesNotMatch(workerSource, /options: \[[^\]]*migrate/)
})

test('Vercel keeps PR previews while main Git auto-production is disabled', () => {
  assert.deepEqual(vercel.git, { deploymentEnabled: { main: false } })
})
