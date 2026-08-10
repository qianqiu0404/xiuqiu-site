import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parse } from 'yaml'

const source = readFileSync(new URL('../.github/workflows/daily-radar.yml', import.meta.url), 'utf8')
const workflow = parse(source)
const job = workflow.jobs['gate-and-merge']

test('daily learning radar only runs for its unique ready PR branch', () => {
  assert.match(String(job.if), /automation\/daily-radar-/)
  assert.match(String(job.if), /draft == false/)
  assert.equal(workflow.permissions.contents, 'write')
  assert.equal(workflow.permissions['pull-requests'], 'write')
})

test('verified daily radar requests auto-merge after protected checks pass', () => {
  const mergeStep = job.steps.find(step => step.name === 'Squash merge verified daily radar')
  assert.match(mergeStep.run, /gh pr merge/)
  assert.match(mergeStep.run, /--squash/)
  assert.match(mergeStep.run, /--delete-branch/)
  assert.match(mergeStep.run, /--auto/)
})
