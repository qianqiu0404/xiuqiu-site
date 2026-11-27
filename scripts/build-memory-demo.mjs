import { readDemoExport, writeDemoBundle } from './lib/demo-export.mjs'

const [sourcePath] = process.argv.slice(2)
if (!sourcePath) {
  console.error('用法：node scripts/build-memory-demo.mjs <support-memory 目录>')
  process.exit(1)
}

const bundle = readDemoExport(sourcePath, 'support-memory', 'supportmemory')
// The upstream export preserves the fictional input verbatim. Mask it before publishing.
const phone = /(?<![0-9０-９])(?:[+＋]?[8８][6６][ -]?)?[1１][3-9３-９](?:[ -]?[0-9０-９]){9}(?![0-9０-９])/gu
for (const { input } of bundle.steps) {
  if (input.command === 'chat') input.message = input.message.replace(phone, '[手机号已遮盖]')
}

writeDemoBundle(new URL('../public/memory-demo/data/', import.meta.url), bundle)
