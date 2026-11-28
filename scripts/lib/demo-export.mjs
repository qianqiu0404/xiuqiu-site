import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export function readDemoExport(sourcePath, repo, module, args = [], companions = {}, {
  command = 'export', tempRoot = tmpdir(),
} = {}) {
  const cwd = resolve(sourcePath)
  const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd, encoding: 'utf8' }).trim()
  const directory = mkdtempSync(join(tempRoot, 'site-demo-'))
  const output = join(directory, 'export.json')
  try {
    execFileSync('python3', ['-B', '-m', module, command, ...args, '--out', output], { cwd })
    const additional = Object.fromEntries(Object.entries(companions).map(([key, file]) =>
      [key, JSON.parse(readFileSync(join(directory, file), 'utf8'))]))
    return { source: { repo, commit }, ...JSON.parse(readFileSync(output, 'utf8')), ...additional }
  } finally {
    rmSync(directory, { recursive: true })
  }
}

export function writeDemoBundle(output, bundle) {
  mkdirSync(output, { recursive: true })
  writeFileSync(new URL('bundle.json', output), `${JSON.stringify(bundle, null, 2)}\n`)
}
