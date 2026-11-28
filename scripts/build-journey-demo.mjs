import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { readDemoExport, writeDemoBundle } from './lib/demo-export.mjs'

const [sourcePath] = process.argv.slice(2)
if (!sourcePath) {
  console.error('用法：node scripts/build-journey-demo.mjs <support-journey 目录>')
  process.exit(1)
}

const tempRoot = fileURLToPath(new URL('../tmp/', import.meta.url))
mkdirSync(tempRoot, { recursive: true })
const bundle = readDemoExport(sourcePath, 'support-journey', 'supportjourney', [], {}, { tempRoot })

// Export records contain passage IDs, so resolve just those IDs using the same
// versioned policy loader as the journey.
const passageIds = [...new Set(bundle.scenarios.flatMap(scenario =>
  scenario.steps.flatMap(step => step.hits?.map(hit => hit.passage_id) ?? [])))].sort()
const passages = JSON.parse(execFileSync('python3', ['-B', '-c', `
import json
import sys
from supportjourney.policy import Policy

export = json.load(sys.stdin)
policy = Policy()
if policy.version != export["version"]:
    sys.exit("政策版本与场景导出不一致")
print(json.dumps({key: policy.passages[key] for key in export["ids"]}, ensure_ascii=False))
`], { cwd: sourcePath, input: JSON.stringify({ version: bundle.policy_version, ids: passageIds }), encoding: 'utf8' }))

writeDemoBundle(new URL('../public/journey-demo/data/', import.meta.url), { ...bundle, passages })
