import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// P4 boundary (AGENTS.md): feature pages and components read data only through
// their own feature's data.ts, and never reach into another feature.
const SRC = fileURLToPath(new URL('../src/', import.meta.url))
const FEATURES = join(SRC, 'features')

function vueFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return vueFiles(path)
    return entry.name.endsWith('.vue') ? [path] : []
  })
}

function importSpecifiers(source) {
  return [...source.matchAll(/(?:from|import\()\s*['"]([^'"]+)['"]/g)].map(match => match[1])
}

test('src/pages is gone and every routed page lives under a feature', () => {
  assert.ok(!existsSync(join(SRC, 'pages')), 'src/pages should be empty after P4')
  const router = readFileSync(join(SRC, 'router/index.ts'), 'utf8')
  for (const specifier of [...router.matchAll(/import\('([^']+)'\)/g)].map(match => match[1])) {
    assert.match(specifier, /^\.\.\/features\/[a-z-]+\/pages\/[A-Za-z]+\.vue$/, specifier)
    assert.ok(existsSync(join(SRC, 'router', specifier)), `${specifier} must exist`)
  }
})

test('feature files import data only through their own data.ts', () => {
  for (const feature of readdirSync(FEATURES)) {
    const dataEntry = join(FEATURES, feature, 'data.ts')
    for (const file of vueFiles(join(FEATURES, feature))) {
      const label = relative(SRC, file)
      for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
        if (!specifier.startsWith('.')) continue
        const target = join(file, '..', specifier)
        assert.ok(!relative(join(SRC, 'data'), target).match(/^[^.]/), `${label} imports src/data directly: ${specifier}`)
        const otherFeature = relative(FEATURES, target).split('/')[0]
        if (!relative(FEATURES, target).startsWith('..')) {
          assert.equal(otherFeature, feature, `${label} reaches into feature ${otherFeature}: ${specifier}`)
        }
        if (/\/data$/.test(specifier)) assert.equal(target, dataEntry.replace(/\.ts$/, ''), `${label} must use its own data.ts`)
      }
    }
  }
})
