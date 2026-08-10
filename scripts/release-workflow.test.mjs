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
  'enqueue_radar_notifications',
  'promote_market_radar_worker',
]

const vercelCommandPattern = /\bvercel\s+(?:--token\s+"\$VERCEL_TOKEN"\s+)?(?:pull|build|deploy|promote|inspect|project\s+inspect|whoami|curl)\b/
const vercelCurlPattern = /\bvercel\s+(?:--token\s+"\$VERCEL_TOKEN"\s+)?curl\b/
const safeTokenFlag = '--token "$VERCEL_TOKEN"'

const assertSafeVercelRun = (run, { allowEnvTokenForCurl = false } = {}) => {
  assert.doesNotMatch(run, /\bset\s+(?:-[A-Za-z]*x[A-Za-z]*(?:\s|$)|-o\s+xtrace\b)/)
  assert.doesNotMatch(run, /\b(?:echo|printf|printenv)\b[^\n]*VERCEL_TOKEN/)
  for (const line of run.split('\n')) {
    if (/(^|\s)curl\b/.test(line) && !vercelCurlPattern.test(line)) {
      assert.doesNotMatch(line, /VERCEL_TOKEN|Authorization/)
    }
    if (!vercelCommandPattern.test(line)) continue
    if (vercelCurlPattern.test(line)) {
      assert.equal(allowEnvTokenForCurl, true, 'vercel curl must authenticate through the protected step environment')
      assert.match(line, /\bvercel\s+curl\b/)
      assert.doesNotMatch(line, /--token/)
      assert.match(line, /\bcurl\s+"[^"]+"\s+--yes\s+--\s/)
      continue
    }
    assert.equal(line.includes(safeTokenFlag), true, 'Vercel commands must use the safe shell token flag')
    assert.equal((line.match(/--token/g) || []).length, 1)
    assert.doesNotMatch(line, /--token(?:=|\s+)(?!"\$VERCEL_TOKEN"(?:\s|$))/)
    if (/\bvercel\s+project\s+inspect\b/.test(line)) {
      assert.doesNotMatch(line, /--scope(?:=|\s+)/)
    }
  }
}

const assertSafeProductionVercelCommands = () => {
  for (const jobName of productionJobs) {
    for (const step of controller.jobs[jobName].steps || []) {
      if (!step.run) continue
      const allowEnvTokenForCurl = step.name === 'Smoke the unaliased candidate before promotion'
        && step.env?.VERCEL_TOKEN === '${{ secrets.VERCEL_TOKEN }}'
      assertSafeVercelRun(step.run, { allowEnvTokenForCurl })
    }
  }
}

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
  assert.deepEqual(controller.jobs.enqueue_radar_notifications.needs, ['preflight', 'mark_deployed_sha'])
  assert.deepEqual(controller.jobs.promote_market_radar_worker.needs, ['preflight', 'mark_deployed_sha', 'enqueue_radar_notifications'])

  assert.equal(controller.jobs.stage_vercel_candidate.steps.find(step => step.uses === 'actions/setup-node@v4')?.with['node-version'], 24)
  assert.match(controllerSource, /VERCEL_CLI_VERSION: 58\.9\.0/)
  assert.match(controllerSource, /vercel deploy --prebuilt --prod --skip-domain --yes --json --token "\$VERCEL_TOKEN"/)
  assert.match(controllerSource, /value\.readyState === 'READY'/)
  assert.match(controllerSource, /value\.target === 'production'/)
  assert.match(controllerSource, /value\.meta\?\.githubCommitSha === process\.env\.RELEASE_SHA/)
  assert.match(controllerSource, /value\.aliasError == null/)
  assert.match(controllerSource, /vercel promote "\$DEPLOYMENT_URL" --yes --token "\$VERCEL_TOKEN"/)
  assert.match(controllerSource, /vercel whoami --token "\$VERCEL_TOKEN"/)
  assert.match(controllerSource, /vercel project inspect "\$VERCEL_PROJECT_ID" --token "\$VERCEL_TOKEN"/)
  assert.match(controllerSource, /vercel pull --yes --environment=production --token "\$VERCEL_TOKEN"/)
  assert.match(controllerSource, /vercel build --prod --token "\$VERCEL_TOKEN"/)
  const smokeStep = controller.jobs.verify_vercel_candidate.steps
    .find(step => step.name === 'Smoke the unaliased candidate before promotion')
  assert.ok(smokeStep)
  assert.equal(smokeStep.env.VERCEL_TOKEN, '${{ secrets.VERCEL_TOKEN }}')
  assert.equal((smokeStep.run.match(/vercel curl/g) || []).length, 3)
  assert.doesNotMatch(smokeStep.run, /(^|\n)\s*curl\b/)
  assert.match(smokeStep.run, /vercel curl "\$SMOKE_URL\/api\/market-radar\/events\?limit=1" --yes -- --fail/)
  for (const line of smokeStep.run.split('\n').filter(line => vercelCurlPattern.test(line))) {
    assert.match(line, /vercel curl [^\n]+ --yes -- --fail/)
  }
  assertSafeVercelRun(smokeStep.run, { allowEnvTokenForCurl: true })
  assertSafeProductionVercelCommands()
  assert.doesNotMatch(controllerSource, /curl[^\n]*Authorization|Authorization: Bearer/)

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

test('Vercel disables every Git-triggered deployment until guarded Preview restoration', () => {
  assert.deepEqual(vercel.git, { deploymentEnabled: false })
})

test('release token audit rejects missing, literal, expression and log-exposing token use', () => {
  const unsafeRuns = [
    'vercel pull --yes --environment=production',
    'vercel build --prod --token literal-value',
    'vercel deploy --prod --token "${{ secrets.VERCEL_TOKEN }}"',
    'set -x\nvercel promote "$DEPLOYMENT_URL" --token "$VERCEL_TOKEN"',
    'set -euxo pipefail\nvercel promote "$DEPLOYMENT_URL" --token "$VERCEL_TOKEN"',
    'echo "$VERCEL_TOKEN"',
    'printf "%s" "$VERCEL_TOKEN"',
    'vercel project inspect "$VERCEL_PROJECT_ID" --scope "$VERCEL_ORG_ID" --token "$VERCEL_TOKEN"',
    'vercel project inspect "$VERCEL_PROJECT_ID" --scope team_example --token "$VERCEL_TOKEN"',
    'vercel curl "$SMOKE_URL/api/health"',
    'vercel curl "$SMOKE_URL/api/health" --token "$VERCEL_TOKEN" -- --fail',
    'vercel --token "$VERCEL_TOKEN" curl "$SMOKE_URL/api/health" -- --fail',
    'curl -H "Authorization: Bearer $VERCEL_TOKEN" "$SMOKE_URL/api/health"',
  ]
  for (const run of unsafeRuns) assert.throws(() => assertSafeVercelRun(run))
})
