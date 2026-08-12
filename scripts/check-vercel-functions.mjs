import { existsSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = new URL('../', import.meta.url)
const limit = 12
const requireOutput = process.argv.includes('--require-output')

function walk(directory, predicate) {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return predicate(path, entry) ? [path] : walk(path, predicate)
    return predicate(path, entry) ? [path] : []
  })
}

const apiDirectory = new URL('../api', import.meta.url).pathname
const sourceFunctions = walk(apiDirectory, (path, entry) => entry.isFile() && path.endsWith('.ts'))
  .map(path => relative(new URL('../', import.meta.url).pathname, path))
  .sort()

if (sourceFunctions.length > limit) {
  console.error(`Vercel source function gate failed: ${sourceFunctions.length}/${limit}\n${sourceFunctions.join('\n')}`)
  process.exit(1)
}

const outputDirectory = new URL('../.vercel/output/functions', import.meta.url).pathname
const outputFunctions = walk(outputDirectory, (path, entry) => entry.isDirectory() && path.endsWith('.func'))
  .map(path => relative(outputDirectory, path))
  .sort()

if (requireOutput && outputFunctions.length === 0) {
  console.error('Vercel output function gate failed: no .vercel/output/functions were found.')
  process.exit(1)
}
if (outputFunctions.length > limit) {
  console.error(`Vercel output function gate failed: ${outputFunctions.length}/${limit}\n${outputFunctions.join('\n')}`)
  process.exit(1)
}

console.log(`Vercel source functions: ${sourceFunctions.length}/${limit}`)
if (outputFunctions.length) console.log(`Vercel output functions: ${outputFunctions.length}/${limit}\n${outputFunctions.join('\n')}`)
