import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  aiEngineeringOutcomes,
  flagshipProjectSlug,
  homeCapabilities,
  homeEvidenceHighlights,
  homeProofMethods,
  homeSeo,
  homeServiceFlow,
  representativeProjectSlugs,
} from '../src/data/homePresentation.ts'
import { evidenceRecords } from '../src/data/generatedEvidence.ts'
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
  assert.equal(homeEvidenceHighlights.length, 3)
  assert.equal(aiEngineeringOutcomes.length, 8)
  assertUnique(homeCapabilities.map(item => item.id), 'capability ids')
  assertUnique(homeServiceFlow.map(item => item.name), 'service names')
  assertUnique(homeProofMethods.map(item => item.id), 'proof ids')
  assertUnique(homeEvidenceHighlights.map(item => item.evidenceSlug), 'evidence highlight slugs')
  assertUnique(aiEngineeringOutcomes, 'AI outcomes')
})

test('every homepage action has one type-safe destination', () => {
  const configuredActions = [...homeProofMethods, ...homeEvidenceHighlights]

  configuredActions.forEach(item => {
    if (item.destination.kind === 'external') {
      assert.match(item.destination.href, /^https:\/\//)
      return
    }
    assert.match(item.destination.to, /^\//)
  })
})

test('configured homepage projects are one flagship and three verified works', () => {
  const projectsBySlug = new Map(projects.map(project => [project.slug, project]))

  assert.equal(representativeProjectSlugs.length, 4)
  assert.deepEqual([...representativeProjectSlugs], [
    'exchange-wallet-system',
    'wallet-reliability-lab',
    'wallet-core',
    's78-market-services',
  ])
  assertUnique([...representativeProjectSlugs], 'homepage project slugs')
  assert.ok(!representativeProjectSlugs.includes('wallet-launchpad'))

  representativeProjectSlugs.forEach(slug =>
    assert.ok(projectsBySlug.has(slug), `Missing generated project: ${slug}`),
  )
  assert.equal(projectsBySlug.get(flagshipProjectSlug)?.portfolioTier, 'flagship')
  representativeProjectSlugs.slice(1).forEach(slug => {
    assert.equal(projectsBySlug.get(slug)?.portfolioTier, 'verified')
  })
})

test('homepage evidence highlights resolve to dated site evidence', () => {
  const evidenceBySlug = new Map(evidenceRecords.map(record => [record.slug, record]))

  assert.deepEqual(homeEvidenceHighlights.map(item => item.evidenceSlug), [
    'multichain-wallet-acceptance',
    'failure-playbook-public',
    'wallet-lab-demo',
  ])
  homeEvidenceHighlights.forEach(item => {
    const record = evidenceBySlug.get(item.evidenceSlug)
    assert.ok(record, `Missing generated evidence: ${item.evidenceSlug}`)
    assert.match(record.verifiedAt, /^\d{4}-\d{2}-\d{2}$/)
  })
})

test('homepage and primary navigation keep their structural contract', () => {
  assert.equal((homeSource.match(/<section(?:\s|>)/g) || []).length, 6)
  assert.match(homeSource, /class="value-home-ai-strip"/)
  assert.doesNotMatch(homeSource, /explorationProjectSlugs/)
  assert.doesNotMatch(homeSource, /v-for="project in explorationProjects"/)
  assert.match(homeSource, /to="\/projects">\s*查看工程探索与完整项目图谱/)
  assert.doesNotMatch(homeSource, /project\.knownLimits/)
  assert.doesNotMatch(homeSource, /project\.nextMilestone/)

  const primaryNavigation = appSource.match(/<div id="primary-navigation"[\s\S]*?<\/div>/)?.[0]
  assert.ok(primaryNavigation, 'Primary navigation markup is missing')

  const links = [...primaryNavigation.matchAll(/<router-link\s+to="([^"]+)"[^>]*>([^<]+)<\/router-link>/g)]
    .map(([, to, label]) => ({ to, label: label.trim() }))

  assert.equal(links.length, 5)
  assertUnique(links.map(link => link.to), 'primary navigation destinations')
  assertUnique(links.map(link => link.label), 'primary navigation labels')
  assert.deepEqual(links.map(link => link.to), [
    '/#capabilities',
    '/projects',
    '/engineering/evidence',
    '/radar',
    '/now',
  ])
})

test('static and runtime homepage SEO stay aligned', () => {
  const title = indexHtml.match(/<title>([^<]+)<\/title>/)?.[1]
  const description = indexHtml.match(/<meta name="description" content="([^"]+)"\s*\/>/)?.[1]

  assert.equal(title, homeSeo.title)
  assert.equal(description, homeSeo.description)
  assert.match(homeSource, /\.\.\.homeSeo/)
})
