#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve, relative, sep } from 'node:path'
import { gzipSync } from 'node:zlib'

const KIB = 1024
const DIST_DIR = resolve(process.cwd(), process.argv[2] ?? 'dist')
const ASSETS_DIR = resolve(DIST_DIR, 'assets')

// These limits leave roughly 14–20% headroom over the 2026-07-28 local Vite
// production-mode build. Keep them explicit so a deliberate architecture
// change updates the budget and its rationale in the same review.
const BUDGETS = {
  mainEntry: {
    raw: 110 * KIB,
    gzip: 43 * KIB,
  },
  javascriptChunk: {
    raw: 112 * KIB,
    gzip: 43 * KIB,
  },
  stylesheetChunk: {
    raw: 80 * KIB,
    gzip: 14 * KIB,
  },
}

function failEarly(message) {
  console.error(`Build budget check failed: ${message}`)
  process.exit(1)
}

function collectFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? collectFiles(path) : [path]
  })
}

function measure(path) {
  const contents = readFileSync(path)
  return {
    path,
    raw: contents.byteLength,
    gzip: gzipSync(contents, { level: 9 }).byteLength,
  }
}

function formatKiB(bytes) {
  return `${(bytes / KIB).toFixed(2)} KiB`
}

function displayPath(path) {
  return relative(DIST_DIR, path).split(sep).join('/')
}

function resolveLocalAsset(assetUrl) {
  const pathname = decodeURIComponent(assetUrl.split(/[?#]/, 1)[0])
  const path = resolve(DIST_DIR, pathname.replace(/^\/+/, ''))
  const relativePath = relative(DIST_DIR, path)

  if (relativePath.startsWith('..') || relativePath === '') {
    failEarly(`entry asset resolves outside dist: ${assetUrl}`)
  }

  return path
}

if (!existsSync(resolve(DIST_DIR, 'index.html')) || !existsSync(ASSETS_DIR)) {
  failEarly(`expected ${relative(process.cwd(), DIST_DIR) || 'dist'} output; run "npm run build" first`)
}

const indexHtml = readFileSync(resolve(DIST_DIR, 'index.html'), 'utf8')
const moduleScriptTags = indexHtml.match(/<script\b[^>]*\btype=["']module["'][^>]*>/gi) ?? []
const entryUrl = moduleScriptTags
  .map((tag) => tag.match(/\bsrc=["']([^"']+\.js(?:[?#][^"']*)?)["']/i)?.[1])
  .find(Boolean)

if (!entryUrl) {
  failEarly('could not locate the module entry script in dist/index.html')
}

const entryPath = resolveLocalAsset(entryUrl)
if (!existsSync(entryPath)) {
  failEarly(`module entry ${displayPath(entryPath)} does not exist`)
}

const assetPaths = collectFiles(ASSETS_DIR)
const javascript = assetPaths.filter((path) => path.endsWith('.js')).map(measure)
const stylesheets = assetPaths.filter((path) => path.endsWith('.css')).map(measure)

if (javascript.length === 0 || stylesheets.length === 0) {
  failEarly('expected at least one JavaScript and one CSS asset in dist/assets')
}

const mainEntry = measure(entryPath)
const largest = (assets, field) => assets.reduce((current, asset) => (
  asset[field] > current[field] ? asset : current
))
const largestJsRaw = largest(javascript, 'raw')
const largestJsGzip = largest(javascript, 'gzip')
const largestCssRaw = largest(stylesheets, 'raw')
const largestCssGzip = largest(stylesheets, 'gzip')

const checks = [
  {
    label: 'Main entry (raw)',
    asset: mainEntry,
    field: 'raw',
    limit: BUDGETS.mainEntry.raw,
    guidance: 'Keep app bootstrap dependencies small or move route-owned code behind a dynamic import.',
  },
  {
    label: 'Main entry (gzip)',
    asset: mainEntry,
    field: 'gzip',
    limit: BUDGETS.mainEntry.gzip,
    guidance: 'Inspect new shared imports and avoid moving page data into the application bootstrap.',
  },
  {
    label: 'Largest JS chunk (raw)',
    asset: largestJsRaw,
    field: 'raw',
    limit: BUDGETS.javascriptChunk.raw,
    guidance: 'Split route-owned code or generated data instead of increasing a shared chunk without review.',
  },
  {
    label: 'Largest JS chunk (gzip)',
    asset: largestJsGzip,
    field: 'gzip',
    limit: BUDGETS.javascriptChunk.gzip,
    guidance: 'Review the chunk import graph and lazy-load content that is not needed for first render.',
  },
  {
    label: 'Largest CSS chunk (raw)',
    asset: largestCssRaw,
    field: 'raw',
    limit: BUDGETS.stylesheetChunk.raw,
    guidance: 'Remove unused global rules or keep page-only styles scoped to their lazy route.',
  },
  {
    label: 'Largest CSS chunk (gzip)',
    asset: largestCssGzip,
    field: 'gzip',
    limit: BUDGETS.stylesheetChunk.gzip,
    guidance: 'Check for duplicated selectors and styles that escaped route-level chunks.',
  },
]

const labelWidth = Math.max(...checks.map(({ label }) => label.length))
const assetWidth = Math.max(...checks.map(({ asset }) => displayPath(asset.path).length))

console.log('Build size budget')
for (const check of checks) {
  const actual = check.asset[check.field]
  const status = actual <= check.limit ? 'PASS' : 'FAIL'
  console.log(
    `${status}  ${check.label.padEnd(labelWidth)}  ${displayPath(check.asset.path).padEnd(assetWidth)}  `
    + `${formatKiB(actual).padStart(10)} / ${formatKiB(check.limit).padStart(10)}`,
  )
}

const totals = [
  ['JavaScript', javascript],
  ['CSS', stylesheets],
].map(([label, assets]) => ({
  label,
  count: assets.length,
  raw: assets.reduce((sum, asset) => sum + asset.raw, 0),
  gzip: assets.reduce((sum, asset) => sum + asset.gzip, 0),
}))

console.log('')
for (const total of totals) {
  console.log(`${total.label}: ${total.count} chunks, ${formatKiB(total.raw)} raw, ${formatKiB(total.gzip)} gzip`)
}

const failures = checks.filter((check) => check.asset[check.field] > check.limit)
if (failures.length > 0) {
  console.error('')
  console.error('Build budget exceeded:')
  for (const failure of failures) {
    const overage = failure.asset[failure.field] - failure.limit
    console.error(
      `- ${failure.label}: ${displayPath(failure.asset.path)} is ${formatKiB(overage)} over. `
      + failure.guidance,
    )
  }
  console.error('If the increase is intentional, update the explicit budget and baseline comment with review evidence.')
  process.exit(1)
}

console.log('Build budget check passed.')
