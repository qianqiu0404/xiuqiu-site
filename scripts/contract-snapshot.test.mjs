import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildManifest, SNAPSHOT_URL } from './contract-snapshot.mjs'

// Changing a frozen contract on purpose means re-running
// `node scripts/contract-snapshot.mjs --write`; the baseline diff is then part
// of the reviewed change instead of an accident.
const baseline = JSON.parse(readFileSync(SNAPSHOT_URL, 'utf8'))
const current = buildManifest()
const hint = 'Frozen contract changed. If intended and approved, run `node scripts/contract-snapshot.mjs --write`.'

test('API routes, workflows, migrations and validators match the frozen baseline', () => {
  assert.deepEqual(current.structure.apiRoutes, baseline.structure.apiRoutes, hint)
  assert.deepEqual(current.structure.workflows, baseline.structure.workflows, hint)
  assert.deepEqual(current.structure.migrations, baseline.structure.migrations, hint)
  assert.deepEqual(current.structure.validators, baseline.structure.validators, hint)
})

test('script names used by automation keep their commands', () => {
  assert.deepEqual(current.structure.frozenScripts, baseline.structure.frozenScripts, hint)
  for (const [name, command] of Object.entries(current.structure.frozenScripts)) {
    assert.ok(command, `package.json is missing frozen script ${name}`)
  }
})

test('generated outputs stay byte-identical for unchanged content', (t) => {
  if (current.contentHash !== baseline.contentHash) {
    t.skip('content/ changed since the baseline; outputs are verified by the generated-data checks instead')
    return
  }
  for (const [path, hash] of Object.entries(baseline.outputs)) {
    assert.ok(path in current.outputs, `generated output disappeared: ${path}. ${hint}`)
    assert.equal(current.outputs[path], hash, `generated output changed: ${path}. ${hint}`)
  }
})
