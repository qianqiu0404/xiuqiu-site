import { readDemoExport, writeDemoBundle } from './lib/demo-export.mjs'

const [sourcePath] = process.argv.slice(2)
if (!sourcePath) {
  console.error('用法：node scripts/build-watch-demo.mjs <agent-watch 目录>')
  process.exit(1)
}

const bundle = readDemoExport(sourcePath, 'agent-watch', 'agentwatch', [
  '--log', 'data/sample.jsonl', '--config', 'config.json',
])

writeDemoBundle(new URL('../public/watch-demo/data/', import.meta.url), bundle)
