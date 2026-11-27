import { readDemoExport, writeDemoBundle } from './lib/demo-export.mjs'

const [sourcePath] = process.argv.slice(2)
if (!sourcePath) {
  console.error('用法：node scripts/build-actions-demo.mjs <support-actions 目录>')
  process.exit(1)
}

const bundle = readDemoExport(sourcePath, 'support-actions', 'supportactions', [], {}, { command: 'demo' })
writeDemoBundle(new URL('../public/actions-demo/data/', import.meta.url), bundle)
