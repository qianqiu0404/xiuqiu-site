import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  aiEngineeringOutcomes,
  explorationProjectSlugs,
  flagshipProjectSlug,
  homeCapabilities,
  homeProofMethods,
  homeSeo,
  homeServiceFlow,
  representativeProjectSlugs,
} from '../src/data/homePresentation.ts'
import { projects } from '../src/data/generatedProjects.ts'

const homeSource = readFileSync(new URL('../src/pages/HomePage.vue', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} must be unique`)
}

test('homepage presentation keeps the intended cardinalities', () => {
  assert.equal(homeCapabilities.length, 4)
  assert.equal(homeServiceFlow.length, 4)
  assert.equal(homeProofMethods.length, 5)
  assert.equal(aiEngineeringOutcomes.length, 8)
  assertUnique(homeCapabilities.map(item => item.id), 'capability ids')
  assertUnique(homeServiceFlow.map(item => item.name), 'service names')
  assertUnique(homeProofMethods.map(item => item.id), 'proof ids')
  assertUnique(aiEngineeringOutcomes, 'AI outcomes')
})

test('every proof method has one type-safe destination', () => {
  homeProofMethods.forEach(proof => {
    if (proof.destination.kind === 'external') {
      assert.match(proof.destination.href, /^https:\/\//)
      return
    }
    assert.match(proof.destination.to, /^\//)
  })
})

test('configured homepage projects resolve to the expected portfolio tiers', () => {
  const projectsBySlug = new Map(projects.map(project => [project.slug, project]))
  const configuredSlugs = [...representativeProjectSlugs, ...explorationProjectSlugs]

  assert.equal(representativeProjectSlugs.length, 4)
  assert.equal(explorationProjectSlugs.length, 3)
  assertUnique(configuredSlugs, 'homepage project slugs')

  configuredSlugs.forEach(slug => assert.ok(projectsBySlug.has(slug), `Missing generated project: ${slug}`))
  assert.equal(projectsBySlug.get(flagshipProjectSlug)?.portfolioTier, 'flagship')
  explorationProjectSlugs.forEach(slug => {
    assert.equal(projectsBySlug.get(slug)?.portfolioTier, 'exploration')
  })
})

test('homepage and primary navigation keep their structural contract', () => {
  assert.equal((homeSource.match(/<section(?:\s|>)/g) || []).length, 8)

  const primaryNavigation = appSource.match(/<div id="primary-navigation"[\s\S]*?<\/div>/)?.[0]
  assert.ok(primaryNavigation, 'Primary navigation markup is missing')

  const links = [...primaryNavigation.matchAll(/<router-link\s+to="([^"]+)"[^>]*>([^<]+)<\/router-link>/g)]
    .map(([, to, label]) => ({ to, label: label.trim() }))

  assert.deepEqual(links, [
    { to: '/#capabilities', label: '能力' },
    { to: '/projects', label: '项目' },
    { to: '/engineering', label: '验证证据' },
    { to: '/radar', label: '工程判断' },
    { to: '/now', label: '关于我' },
  ])
})

test('static and runtime homepage SEO stay aligned', () => {
  const title = indexHtml.match(/<title>([^<]+)<\/title>/)?.[1]
  const description = indexHtml.match(/<meta name="description" content="([^"]+)"\s*\/>/)?.[1]

  assert.equal(title, homeSeo.title)
  assert.equal(description, homeSeo.description)
  assert.match(homeSource, /\.\.\.homeSeo/)
})
