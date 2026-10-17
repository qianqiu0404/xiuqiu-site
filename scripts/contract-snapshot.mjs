// Fingerprints the frozen contracts listed in AGENTS.md so refactors cannot
// silently change what Codex, Hermes, GitHub Actions or Vercel depend on.
//
//   node scripts/contract-snapshot.mjs           print the current manifest
//   node scripts/contract-snapshot.mjs --write   update config/contract-snapshot.json
//
// Structural contracts (workflows, migrations, API routes, script names) are
// always compared. Generated outputs are compared only while content/ matches
// the baseline, so daily content PRs never trip this guard.

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const ROOT = new URL('../', import.meta.url)
export const SNAPSHOT_URL = new URL('config/contract-snapshot.json', ROOT)

// Scripts invoked by workflows, Codex ResearchOps or Hermes by name.
export const FROZEN_SCRIPTS = [
  'build', 'generate:content', 'generate:radar', 'generate:market-radar', 'generate:radar-weekly', 'generate:sitemap',
  'test:radar', 'test:market-radar', 'test:notifications', 'prepare:researchops', 'validate:radar',
  'radar:publish-snapshots', 'market-radar:migrate', 'market-radar:worker', 'notifications:enqueue',
  'verify:market-radar-production',
]

function trackedFiles(...patterns) {
  return execFileSync('git', ['ls-files', '-z', '--', ...patterns], { cwd: ROOT, encoding: 'utf8' })
    .split('\0').filter(Boolean).sort()
}

// Content changes must be seen before they are staged, otherwise a new daily
// edition would look like "unchanged content" with changed outputs.
function workingFiles(...patterns) {
  return execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...patterns], { cwd: ROOT, encoding: 'utf8' })
    .split('\0').filter(Boolean).filter(path => existsSync(new URL(path, ROOT))).sort()
}

function hashFile(path) {
  return createHash('sha256').update(readFileSync(new URL(path, ROOT))).digest('hex').slice(0, 16)
}

function hashFiles(paths) {
  return Object.fromEntries(paths.map(path => [path, hashFile(path)]))
}

function treeHash(paths) {
  const hash = createHash('sha256')
  for (const path of paths) hash.update(`${path}\0${hashFile(path)}\n`)
  return hash.digest('hex').slice(0, 16)
}

export function buildManifest() {
  const scripts = JSON.parse(readFileSync(new URL('package.json', ROOT), 'utf8')).scripts
  return {
    schemaVersion: 1,
    structure: {
      apiRoutes: trackedFiles('api/**/*.ts'),
      workflows: hashFiles(trackedFiles('.github/workflows/*.yml')),
      migrations: hashFiles(trackedFiles('market-radar/migrations/*')),
      validators: hashFiles(trackedFiles(
        'scripts/public-data-contracts.mjs', 'scripts/learning-radar-v2.mjs', 'scripts/market-radar-contracts.mjs',
        'scripts/radar-publication-boundary.mjs', 'scripts/radar-notification-contracts.mjs', 'scripts/frontmatter.mjs',
        'scripts/check-public.mjs', 'scripts/validate-knowledge.mjs',
      )),
      frozenScripts: Object.fromEntries(FROZEN_SCRIPTS.map(name => [name, scripts[name] ?? null])),
    },
    contentHash: treeHash(workingFiles('content/**')),
    // Working tree, not just tracked files, so a newly generated month chunk is
    // covered before it is committed. Write the baseline only after
    // `npm run generate:content`, or it records stale output hashes.
    outputs: hashFiles(workingFiles(
      'src/data/generated*.ts', 'src/data/generated*/**', 'public/sitemap.xml', 'public/llms.txt', 'public/radar/**', 'public/data/**',
    )),
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifest = buildManifest()
  if (process.argv.includes('--write')) {
    writeFileSync(SNAPSHOT_URL, `${JSON.stringify(manifest, null, 2)}\n`)
    console.log(`Wrote ${SNAPSHOT_URL.pathname.split('/').slice(-2).join('/')}`)
  } else {
    console.log(JSON.stringify(manifest, null, 2))
  }
}
