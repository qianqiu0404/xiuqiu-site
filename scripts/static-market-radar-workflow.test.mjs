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
})

test('verified static market radar requests auto-merge after protected checks pass', () => {
  const mergeStep = job.steps.find(step => step.name === 'Squash merge verified static market radar')
  assert.match(mergeStep.run, /gh pr merge/)
  assert.match(mergeStep.run, /--squash/)
  assert.match(mergeStep.run, /--delete-branch/)
  assert.match(mergeStep.run, /--auto/)
})
