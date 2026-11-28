import { execFileSync } from 'node:child_process'
import { readDemoExport, writeDemoBundle } from './lib/demo-export.mjs'

const [sourcePath] = process.argv.slice(2)
if (!sourcePath) {
  console.error('用法：node scripts/build-retrieval-demo.mjs <kb-retrieval-eval 目录>')
  process.exit(1)
}

// export supplies the public chunk text. eval --expand supplies the M2 rankings.
const { source, questions, chunks } = readDemoExport(sourcePath, 'kb-retrieval-eval', 'kbeval')
const { configs, expansion_weight, held_out, recommendation } = readDemoExport(
  sourcePath, 'kb-retrieval-eval', 'kbeval', ['--expand'], {}, { command: 'eval' },
)
const bundle = { source, questions, chunks, configs, expansion_weight, held_out, recommendation }
// Apply the export's path check to the added evaluation data before making it public.
execFileSync('python3', ['-B', '-c', `
import json
import sys
from kbeval.__main__ import export_has_path

if export_has_path(json.load(sys.stdin)):
    sys.exit("演示数据含有本机绝对路径")
`], { cwd: sourcePath, input: JSON.stringify(bundle) })
writeDemoBundle(new URL('../public/retrieval-demo/data/', import.meta.url), bundle)
