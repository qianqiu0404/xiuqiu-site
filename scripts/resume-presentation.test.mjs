import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { filterResumeProjects, normalizeCategory, projectIdFromHash, adjacentProjectId } from '../src/features/resume/presentation.ts'

const records = JSON.parse(readFileSync(new URL('../src/features/resume/records.json', import.meta.url)))
const notes = JSON.parse(readFileSync(new URL('../src/features/resume/notes.json', import.meta.url)))

test('reviewed catalog is complete and every record has a public summary', () => {
  assert.equal(records.length, 29)
  assert.equal(new Set(records.map(project => project.id)).size, 29)
  assert.deepEqual(Object.keys(notes).sort(), records.map(project => project.id).sort())
  assert.deepEqual(records.filter(project => project.kind === 'team').map(project => project.id).sort(), ['saas', 'theai'])
})

test('category, historical visibility and search compose without changing catalog order', () => {
  assert.deepEqual(filterResumeProjects(records, 'all', true, ''), records)
  const engineering = filterResumeProjects(records, 'engineering', false, '')
  assert.ok(engineering.length > 0)
  assert.ok(engineering.every(project => project.category === 'engineering' && !project.history))
  assert.deepEqual(filterResumeProjects(records, 'all', true, '私有').map(project => project.id), ['wildheart'])
  assert.deepEqual(filterResumeProjects(records, 'all', true, '团队业务').map(project => project.id).sort(), ['saas', 'theai'])
  assert.ok(filterResumeProjects(records, 'all', true, ' TYPESCRIPT ').length > 0)
  assert.deepEqual(filterResumeProjects(records, 'engineering', true, '知识地图'), [])
  assert.deepEqual(filterResumeProjects(records, 'all', true, 'unmatched-search-query'), [])
})

test('shared filters and detail hashes accept only known keys, including malformed encodings', () => {
  assert.equal(normalizeCategory('engineering', records), 'engineering')
  for (const category of [undefined, ['engineering'], 'unknown', '<script>']) assert.equal(normalizeCategory(category, records), 'all')
  assert.equal(projectIdFromHash('#project/wildheart', records), 'wildheart')
  assert.equal(projectIdFromHash('#project/%73aas', records), 'saas')
  for (const hash of ['#catalog', '#project/missing', '#project/%zz', '#project/__proto__']) assert.equal(projectIdFromHash(hash, records), null)
})

test('detail navigation wraps in the same order as the complete catalog', () => {
  assert.equal(adjacentProjectId(records, records[0].id, -1), records.at(-1).id)
  assert.equal(adjacentProjectId(records, records.at(-1).id, 1), records[0].id)
  assert.equal(adjacentProjectId(records, records[2].id, 1), records[3].id)
  assert.equal(adjacentProjectId([], '', 1), '')
})

test('knowledge map remains a private project with only a fictional public illustration', () => {
  const map = records.find(project => project.id === 'wildheart')
  assert.equal(map.title, '知识地图')
  assert.equal(map.visibility, 'private')
  assert.equal(map.openSource, false)
  assert.match(notes.wildheart, /虚构/)
  assert.match(notes.wildheart, /私有项目/)
  assert.doesNotMatch(notes.wildheart, /<a\b|download|kuangye-heart|localhost|file:\/\//i)
  for (const html of Object.values(notes)) assert.doesNotMatch(html, /<script\b|\son\w+\s*=|javascript:|file:\/\/|\/Volumes\/|\/Users\//i)
})
