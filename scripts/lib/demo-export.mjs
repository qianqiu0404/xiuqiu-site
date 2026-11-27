import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export function readDemoExport(sourcePath, repo, module, args = []) {
  const cwd = resolve(sourcePath)
  const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd, encoding: 'utf8' }).trim()
  const directory = mkdtempSync(join(tmpdir(), 'site-demo-'))
  const output = join(directory, 'export.json')
  try {
    execFileSync('python3', ['-B', '-m', module, 'export', ...args, '--out', output], { cwd })
    return { source: { repo, commit }, ...JSON.parse(readFileSync(output, 'utf8')) }
  } finally {
    rmSync(directory, { recursive: true })
  }
}

export function writeDemoBundle(output, bundle) {
  mkdirSync(output, { recursive: true })
  writeFileSync(new URL('bundle.json', output), `${JSON.stringify(bundle, null, 2)}\n`)
}
