import { readDemoExport, writeDemoBundle } from './lib/demo-export.mjs'

const [sourcePath] = process.argv.slice(2)
if (!sourcePath) {
  console.error('用法：node scripts/build-retrieval-demo.mjs <kb-retrieval-eval 目录>')
  process.exit(1)
}

const bundle = readDemoExport(sourcePath, 'kb-retrieval-eval', 'kbeval')
writeDemoBundle(new URL('../public/retrieval-demo/data/', import.meta.url), bundle)
