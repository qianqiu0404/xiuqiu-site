import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { listObsidianPublicSourceFiles } from './obsidian-public-source-roots.mjs'

function writeFixture(root, relativePath) {
  const absolutePath = join(root, relativePath)
  mkdirSync(join(absolutePath, '..'), { recursive: true })
  writeFileSync(absolutePath, '---\npublish: true\n---\nprivate fixture body\n')
  return absolutePath
}

test('Obsidian export reads only the two reviewed public source roots', t => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'xiuqiu-public-roots-'))
  t.after(() => rmSync(fixtureRoot, { recursive: true, force: true }))

  writeFixture(fixtureRoot, '20-项目做证据/Qiu-Market/00-Qiu-Market项目台.md')
  writeFixture(fixtureRoot, '50-复盘看变化/每周/2026-W29-研究收敛.md')
  for (const privatePath of [
    '10-面试拿结果/01-今日结果卡.md',
    '40-证据查事实/原始面试记录/private.md',
    '50-复盘看变化/个人成长/private.md',
    '50-复盘看变化/每日/private.md',
  ]) {
    writeFixture(fixtureRoot, privatePath)
  }

  assert.deepEqual(
    listObsidianPublicSourceFiles(fixtureRoot).map(file => [file.sourceKind, file.relativePath]),
    [
      ['project', '20-项目做证据/Qiu-Market/00-Qiu-Market项目台.md'],
      ['weekly', '50-复盘看变化/每周/2026-W29-研究收敛.md'],
    ],
  )
})

test('Obsidian export rejects missing roots and symlink escapes', t => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'xiuqiu-public-roots-'))
  t.after(() => rmSync(fixtureRoot, { recursive: true, force: true }))

  mkdirSync(join(fixtureRoot, '20-项目做证据'), { recursive: true })
  assert.throws(
    () => listObsidianPublicSourceFiles(fixtureRoot),
    /Missing required public source roots: 50-复盘看变化\/每周/,
  )

  mkdirSync(join(fixtureRoot, '50-复盘看变化/每周'), { recursive: true })
  const privateFile = writeFixture(fixtureRoot, '10-面试拿结果/private.md')
  symlinkSync(privateFile, join(fixtureRoot, '20-项目做证据/escaped.md'))
  assert.throws(
    () => listObsidianPublicSourceFiles(fixtureRoot),
    /symbolic links are not allowed/,
  )
})
