import assert from 'node:assert/strict'
import test from 'node:test'
import { buildProfileProjects } from '../src/data/profilePresentation.ts'
import { projects } from '../src/data/generatedProjects.ts'

test('profile presents the product and learning direction before historical work', () => {
  const result = buildProfileProjects(projects)
  assert.deepEqual(result.current.map(project => [project.slug, project.roleLabel]), [
    ['s78-market-services', '当前产品'],
    ['exchange-wallet-system', '当前学习方向'],
  ])
  assert.deepEqual(result.historical.map(project => project.slug), ['wallet-reliability-lab', 'wallet-core'])
  assert.ok(result.historical.every(project => project.role === 'historical-evidence'))
  for (const project of [...result.current, ...result.historical]) {
    const source = projects.find(item => item.slug === project.slug)
    assert.equal(project.summary, source.engineering.overviewSummary)
    assert.equal(project.updatedAt, source.updatedAt)
    assert.equal(project.to, `/projects/${source.slug}`)
    assert.deepEqual(project.techStack, source.techStack)
  }
})

test('missing and unpublished records remain absent without relabelling old work', () => {
  assert.deepEqual(buildProfileProjects([]), { current: [], historical: [] })
  const records = projects.map(project => ({ ...project, publish: project.publicRole === 'historical-evidence' }))
  assert.equal(buildProfileProjects(records).current.length, 0)
  const noHistorical = projects.map(project => ({ ...project, publish: project.publicRole !== 'historical-evidence' }))
  assert.equal(buildProfileProjects(noHistorical).historical.length, 0)
})

test('profile excludes private repository details and does not mutate project data', () => {
  const snapshot = structuredClone(projects)
  const result = buildProfileProjects(projects)
  assert.ok(result.current.some(project => project.slug === 'exchange-wallet-system'))
  for (const project of [...result.current, ...result.historical]) {
    assert.ok(!('repositoryUrl' in project))
    assert.ok(!('visibility' in project))
  }
  result.current[0].techStack.push('test-only')
  assert.deepEqual(projects, snapshot)
})
