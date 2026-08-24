import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'

const sourceExtensions = new Set(['.html', '.js', '.mjs', '.ts', '.vue'])

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return sourceExtensions.has(extname(entry.name)) ? [path] : []
  })
}

function classIsReferenced(source, className) {
  if (source.includes(className)) return true

  // Preserve classes assembled from bounded template prefixes such as
  // `priority-${value}` or `tier-${value}`.
  const segments = className.split('-')
  while (segments.length > 1) {
    segments.pop()
    const prefix = `${segments.join('-')}-`
    if (prefix.length >= 7 && source.includes(prefix)) return true
  }
  return false
}

test('global CSS contains no class-only rules disconnected from application source', () => {
  const source = [
    readFileSync(new URL('../index.html', import.meta.url), 'utf8'),
    ...sourceFiles(fileURLToPath(new URL('../src', import.meta.url))).map(path => readFileSync(path, 'utf8')),
  ].join('\n')
  const stylesheet = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
  const root = postcss.parse(stylesheet)
  const unusedSelectors = []

  root.walkRules((rule) => {
    const removable = rule.selector.split(',').every((selector) => {
      const classes = [...selector.matchAll(/\.([A-Za-z_][\w-]*)/g)].map(match => match[1])
      return classes.length > 0 && classes.every(className => !classIsReferenced(source, className))
    })
    if (removable) unusedSelectors.push(rule.selector)
  })

  assert.deepEqual(unusedSelectors, [])
})
