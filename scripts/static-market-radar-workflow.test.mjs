import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parse } from 'yaml'

const source = readFileSync(new URL('../.github/workflows/static-market-radar.yml', import.meta.url), 'utf8')
const workflow = parse(source)
const job = workflow.jobs['gate-and-merge']

test('static market radar only runs for its unique ready PR branch', () => {
  assert.match(String(job.if), /automation\/market-radar-/)
  assert.match(String(job.if), /draft == false/)
  assert.equal(workflow.permissions.contents, 'write')
  assert.equal(workflow.permissions['pull-requests'], 'write')
  const restrict = job.steps.find(step => step.name === 'Restrict changed files')
  assert.match(restrict.run, /RADAR_DATE="\$\{HEAD_REF#automation\/market-radar-\}"/)
  assert.match(restrict.run, /content\/market-radar\/\$RADAR_DATE\.md/)
  assert.match(restrict.run, /public\/data\/market-radar-packs\/\$RADAR_DATE\.json/)
  assert.match(restrict.run, /RADAR_MONTH="\$\{RADAR_DATE%\*-\*\}"/)
  assert.match(restrict.run, /generatedMarketRadarMonths\/\$RADAR_MONTH\.ts/)
  assert.match(restrict.run, /non-allowlisted or historical file/)
  assert.match(restrict.run, /grep -Fxq "public\/data\/market-radar-packs\/\$RADAR_DATE\.json"/)
})

test('verified static market radar requests auto-merge after protected checks pass', () => {
  const mergeStep = job.steps.find(step => step.name === 'Squash merge verified static market radar')
  assert.match(mergeStep.run, /gh pr merge/)
  assert.match(mergeStep.run, /--squash/)
  assert.match(mergeStep.run, /--delete-branch/)
  assert.match(mergeStep.run, /--auto/)
})

test('static generation must commit the public research pack directory', () => {
  const generated = job.steps.find(step => step.name === 'Ensure generated public data is committed')
  assert.match(generated.run, /public\/data\/market-radar-packs/)
})
