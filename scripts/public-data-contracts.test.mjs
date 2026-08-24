import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { parseMarkdownFrontmatter } from './frontmatter.mjs'
import {
  applyProjectPublicOverlay,
  assertProjectPublicOverlayMatches,
  assertProjectPublicStatus,
  assertProjectRepositoryVisibility,
  assertPublicHttpUrl,
  indexProjectPublicOverlays,
  isPublishable,
  PROJECT_PUBLIC_OVERLAY_SOURCE,
} from './public-data-contracts.mjs'
import { assertPublicRadarContent } from './radar-pipeline.mjs'

function projectOverlaySnapshot(projects = [], overrides = {}) {
  return {
    generatedAt: '2026-08-24T00:00:00.000Z',
    source: PROJECT_PUBLIC_OVERLAY_SOURCE,
    projects,
    ...overrides,
  }
}

test('only explicit publish true content enters public generators', () => {
  assert.equal(isPublishable({ publish: true }), true)
  assert.equal(isPublishable({ publish: false }), false)
  assert.equal(isPublishable({}), false)
  assert.equal(isPublishable(undefined), false)
})

test('public source URLs reject placeholders and malformed values', () => {
  assert.equal(
    assertPublicHttpUrl('https://github.com/vercel-labs/agent-browser'),
    'https://github.com/vercel-labs/agent-browser',
  )

  for (const value of [
    'https://example.com/source',
    'https://github.com/vercel-labs/agent-browser`',
    'https://github.com/vercel-labs/agent-browser、extra',
    'https://github.com/vercel-labs/agent browser',
    'github.com/vercel-labs/agent-browser',
    'ftp://github.com/vercel-labs/agent-browser',
    'https://',
    'http://127.0.0.1:43127/api/health',
    'http://localhost:43127/api/health',
    'http://192.168.1.20:43127/api/health',
    'http://wallet-staging.local/api/health',
    'https://research.internal/source',
    'http://[::1]:43127/api/health',
    'http://[fe80::1]:43127/api/health',
    'http://[fd00::1]:43127/api/health',
  ]) {
    assert.throws(() => assertPublicHttpUrl(value), undefined, value)
  }
})

test('repository visibility and repository URL remain a single invariant', () => {
  assert.doesNotThrow(() =>
    assertProjectRepositoryVisibility({
      visibility: 'public',
      repositoryUrl: 'https://github.com/qianqiu0404/wallet-core',
    }),
  )
  assert.doesNotThrow(() => assertProjectRepositoryVisibility({ visibility: 'private' }))
  assert.doesNotThrow(() => assertProjectRepositoryVisibility({ visibility: 'none' }))
  assert.throws(
    () => assertProjectRepositoryVisibility({ visibility: 'public' }),
    /requires repositoryUrl/,
  )
  assert.throws(
    () =>
      assertProjectRepositoryVisibility({
        visibility: 'private',
        repositoryUrl: 'https://github.com/qianqiu0404/wallet-core',
      }),
    /only allowed/,
  )
})

test('current radar public snapshot satisfies the contract', () => {
  const radar = parseMarkdownFrontmatter(
    readFileSync(new URL('../content/radar/2026-07-28.md', import.meta.url), 'utf8'),
    'content/radar/2026-07-28.md',
  ).meta
  assert.doesNotThrow(() => assertPublicRadarContent(radar))
})

test('reviewed project artifacts declare one product, one direction and six historical records', () => {
  const projects = readdirSync(new URL('../content/projects/', import.meta.url))
    .filter(fileName => fileName.endsWith('.md'))
    .sort()
    .map(fileName => parseMarkdownFrontmatter(
      readFileSync(new URL(`../content/projects/${fileName}`, import.meta.url), 'utf8'),
      `content/projects/${fileName}`,
    ).meta)

  projects.forEach(project => assert.doesNotThrow(() => assertProjectPublicStatus(project, project.slug)))
  assert.deepEqual(
    Object.fromEntries(projects.map(project => [project.slug, project.publicRole])),
    {
      'exchange-wallet-system': 'current-direction',
      'risk-server': 'historical-evidence',
      's78-market-services': 'current-product',
      stableflow: 'historical-evidence',
      'tss-mpc': 'historical-evidence',
      'wallet-core': 'historical-evidence',
      'wallet-reliability-lab': 'historical-evidence',
      'web3-wallet-engineer-lab': 'historical-evidence',
    },
  )
  assert.deepEqual(
    Object.fromEntries(projects.map(project => [project.slug, project.claimState])),
    {
      'exchange-wallet-system': 'locked',
      'risk-server': 'locked',
      's78-market-services': 'evidence-ready',
      stableflow: 'locked',
      'tss-mpc': 'locked',
      'wallet-core': 'publishable',
      'wallet-reliability-lab': 'publishable',
      'web3-wallet-engineer-lab': 'publishable',
    },
  )
  assert.deepEqual(
    Object.fromEntries(
      projects
        .filter(project => ['current-product', 'current-direction'].includes(project.publicRole))
        .map(project => [project.slug, project.sourceProjectId]),
    ),
    {
      'exchange-wallet-system': 'wallet-infra-mainline',
      's78-market-services': 'qiu-market',
    },
  )
  assert.equal(projects.filter(project => project.publicRole === 'current-product').length, 1)
  assert.equal(projects.filter(project => project.publicRole === 'current-direction').length, 1)
  assert.equal(projects.filter(project => project.publicRole === 'historical-evidence').length, 6)
  assert.equal(
    projects.filter(project => project.publicRole === 'historical-evidence' && project.claimState === 'publishable').length,
    3,
    'claim readiness is independent from whether a project is current',
  )
  assert.deepEqual(
    Object.fromEntries(projects.map(project => [project.slug, project.activityStatus])),
    {
      'exchange-wallet-system': 'active',
      'risk-server': 'paused',
      's78-market-services': 'active',
      stableflow: 'paused',
      'tss-mpc': 'paused',
      'wallet-core': 'paused',
      'wallet-reliability-lab': 'paused',
      'web3-wallet-engineer-lab': 'paused',
    },
  )
})

test('empty explicit-publish snapshot is valid and does not orphan reviewed project artifacts', () => {
  const snapshot = JSON.parse(
    readFileSync(new URL('../content/obsidian-public/projects.json', import.meta.url), 'utf8'),
  )
  const overlays = indexProjectPublicOverlays(snapshot, ['exchange-wallet-system', 's78-market-services'])
  const weeklySnapshot = JSON.parse(
    readFileSync(new URL('../content/obsidian-public/radar-weeklies.json', import.meta.url), 'utf8'),
  )

  assert.equal(snapshot.source, PROJECT_PUBLIC_OVERLAY_SOURCE)
  assert.equal(overlays.size, 0)
  assert.deepEqual(weeklySnapshot.radarWeeklies.map(weekly => weekly.slug), ['2026-W29'])
  assert.deepEqual(weeklySnapshot.radarWeeklies[0].relatedProjectSlugs, [
    'wallet-reliability-lab',
    'web3-wallet-engineer-lab',
  ])
})

test('current project overlays round-trip against reviewed canonical source identities', () => {
  const reviewedProjects = ['exchange-wallet-system', 's78-market-services'].map(slug =>
    parseMarkdownFrontmatter(
      readFileSync(new URL(`../content/projects/${slug}.md`, import.meta.url), 'utf8'),
      `content/projects/${slug}.md`,
    ).meta,
  )
  const reviewedSources = reviewedProjects.map(project => ({
    siteSlug: project.slug,
    projectId: project.sourceProjectId,
  }))
  const overlaySnapshot = projectOverlaySnapshot(reviewedProjects.map(project => ({
    projectId: project.sourceProjectId,
    siteSlug: project.slug,
    publicRole: project.publicRole,
    claimState: project.claimState,
    stage: project.stage,
    portfolioTier: project.portfolioTier,
    activityStatus: project.activityStatus,
    visibility: project.visibility,
    updatedAt: project.updatedAt,
    publicSummary: project.positioning,
    publicEvidence: project.verifiedEvidence,
    publicNextMilestone: project.nextMilestone,
  })))
  const indexed = indexProjectPublicOverlays(overlaySnapshot, reviewedSources)

  assert.deepEqual([...indexed.keys()].sort(), ['exchange-wallet-system', 's78-market-services'])
  reviewedProjects.forEach(project => {
    const overlay = indexed.get(project.slug)
    assert.doesNotThrow(() => assertProjectPublicOverlayMatches(project, overlay))
    assert.equal(applyProjectPublicOverlay(project, overlay).nextMilestone, project.nextMilestone)
  })
})

test('optional explicit-publish overlays apply per slug and preserve the public status contract', () => {
  const source = parseMarkdownFrontmatter(
    readFileSync(new URL('../content/projects/risk-server.md', import.meta.url), 'utf8'),
    'content/projects/risk-server.md',
  ).meta
  const overlay = {
    projectId: 'risk-server',
    siteSlug: 'risk-server',
    publicRole: 'historical-evidence',
    claimState: 'locked',
    stage: source.stage,
    portfolioTier: source.portfolioTier,
    activityStatus: 'paused',
    visibility: source.visibility,
    updatedAt: source.updatedAt,
    publicSummary: source.positioning,
    publicEvidence: source.verifiedEvidence.slice(0, 1),
    publicNextMilestone: source.nextMilestone,
  }
  const overlays = indexProjectPublicOverlays(
    projectOverlaySnapshot([overlay]),
    ['risk-server', 'wallet-core'],
  )
  const project = applyProjectPublicOverlay(source, overlays.get('risk-server'))

  assert.equal(overlays.size, 1)
  assert.equal(project.publicRole, 'historical-evidence')
  assert.equal(project.claimState, 'locked')
  assert.equal(project.visibility, source.visibility)
  assert.doesNotThrow(() => assertProjectRepositoryVisibility(project))
  assert.doesNotThrow(() => assertProjectPublicOverlayMatches(source, overlay))
})

test('unknown, duplicate or incomplete Obsidian project overlays fail closed', () => {
  const overlay = {
    projectId: 'risk-server',
    siteSlug: 'risk-server',
    publicRole: 'historical-evidence',
    claimState: 'locked',
    stage: 'verified-local',
    portfolioTier: 'exploration',
    activityStatus: 'paused',
    visibility: 'public',
    updatedAt: '2026-08-24',
    publicSummary: 'reviewed summary',
    publicEvidence: ['reviewed evidence'],
    publicNextMilestone: 'review next milestone',
  }

  assert.throws(
    () => indexProjectPublicOverlays(projectOverlaySnapshot([], { source: 'legacy' }), ['risk-server']),
    /source must be/,
  )
  assert.throws(
    () => indexProjectPublicOverlays(
      projectOverlaySnapshot([{ ...overlay, siteSlug: 'orphan' }]),
      ['risk-server'],
    ),
    /unknown project orphan/,
  )
  assert.throws(
    () => indexProjectPublicOverlays(
      projectOverlaySnapshot([overlay, overlay]),
      ['risk-server'],
    ),
    /duplicate project risk-server/,
  )
  assert.throws(
    () => indexProjectPublicOverlays(
      projectOverlaySnapshot([{ ...overlay, claimState: undefined }]),
      ['risk-server'],
    ),
    /missing claimState/,
  )
  assert.throws(
    () => indexProjectPublicOverlays(
      projectOverlaySnapshot([{ ...overlay, publicEvidence: [] }]),
      ['risk-server'],
    ),
    /publicEvidence must contain non-empty trimmed strings/,
  )
  assert.throws(
    () => indexProjectPublicOverlays(
      projectOverlaySnapshot([{ ...overlay, publicSummary: '  ' }]),
      ['risk-server'],
    ),
    /publicSummary must be a non-empty trimmed string/,
  )
  assert.throws(
    () => indexProjectPublicOverlays(
      projectOverlaySnapshot([overlay], { generatedAt: 'yesterday' }),
      ['risk-server'],
    ),
    /generatedAt must be an ISO timestamp/,
  )
  assert.throws(
    () => indexProjectPublicOverlays(
      projectOverlaySnapshot([overlay], { generatedAt: '2026-02-31T00:00:00.000Z' }),
      ['risk-server'],
    ),
    /generatedAt must be an ISO timestamp/,
  )
  assert.throws(
    () => indexProjectPublicOverlays(
      { ...projectOverlaySnapshot([overlay]), noteBody: '身份证 123' },
      ['risk-server'],
    ),
    /unexpected fields noteBody/,
  )
  assert.throws(
    () => indexProjectPublicOverlays(
      projectOverlaySnapshot([{ ...overlay, sourcePath: '/private/vault/secret.md' }]),
      ['risk-server'],
    ),
    /unexpected fields sourcePath/,
  )
  assert.throws(
    () => indexProjectPublicOverlays(
      projectOverlaySnapshot([{ ...overlay, publicSummary: '/Users/xiuqiu/private-note.md' }]),
      ['risk-server'],
    ),
    /private, local-only or credential-shaped text/,
  )
  assert.throws(
    () => indexProjectPublicOverlays(
      projectOverlaySnapshot([{ ...overlay, projectId: 'other-project' }]),
      ['risk-server'],
    ),
    /projectId must be risk-server/,
  )
  const walletOverlay = {
    ...overlay,
    projectId: 'wallet-infra-mainline',
    siteSlug: 'exchange-wallet-system',
    publicRole: 'current-direction',
    claimState: 'locked',
    stage: 'exploring',
    activityStatus: 'active',
  }
  assert.doesNotThrow(() => indexProjectPublicOverlays(
    projectOverlaySnapshot([walletOverlay]),
    [{ siteSlug: 'exchange-wallet-system', projectId: 'wallet-infra-mainline' }],
  ))
  assert.throws(
    () => indexProjectPublicOverlays(
      projectOverlaySnapshot([{ ...walletOverlay, stage: 'planned' }]),
      [{ siteSlug: 'exchange-wallet-system', projectId: 'wallet-infra-mainline' }],
    ),
    /stage: unknown value planned/,
  )
  assert.throws(
    () => indexProjectPublicOverlays(
      projectOverlaySnapshot([{ ...walletOverlay, projectId: 'exchange-wallet-infrastructure' }]),
      [{ siteSlug: 'exchange-wallet-system', projectId: 'wallet-infra-mainline' }],
    ),
    /projectId must be wallet-infra-mainline/,
  )
  const qiuOverlay = {
    ...overlay,
    projectId: 'qiu-market',
    siteSlug: 's78-market-services',
    publicRole: 'current-product',
    claimState: 'evidence-ready',
    stage: 'verified-local',
    portfolioTier: 'verified',
    activityStatus: 'active',
    visibility: 'private',
  }
  assert.doesNotThrow(() => indexProjectPublicOverlays(
    projectOverlaySnapshot([qiuOverlay]),
    [{ siteSlug: 's78-market-services', projectId: 'qiu-market' }],
  ))
  assert.throws(
    () => indexProjectPublicOverlays(
      projectOverlaySnapshot([{ ...qiuOverlay, projectId: 's78-market-services' }]),
      [{ siteSlug: 's78-market-services', projectId: 'qiu-market' }],
    ),
    /projectId must be qiu-market/,
  )
  assert.throws(
    () => assertProjectPublicStatus({ publicRole: 'historical-evidence', claimState: 'verified' }),
    /unknown claimState verified/,
  )
  assert.throws(
    () => assertProjectPublicStatus({ publicRole: 'historical-evidence', claimState: 'locked', activityStatus: 'active' }),
    /historical-evidence must not have activityStatus active/,
  )
  assert.throws(
    () => assertProjectPublicStatus({ publicRole: 'current-product', claimState: 'evidence-ready', activityStatus: 'paused' }),
    /current-product must have activityStatus active/,
  )
  assert.throws(
    () => assertProjectPublicOverlayMatches(
      { publicRole: 'historical-evidence', claimState: 'locked' },
      { publicRole: 'current-direction', claimState: 'locked' },
    ),
    /publicRole must match the reviewed release artifact/,
  )
  assert.throws(
    () => assertProjectPublicOverlayMatches(
      { publicRole: 'historical-evidence', claimState: 'locked', visibility: 'none' },
      { publicRole: 'historical-evidence', claimState: 'locked', visibility: 'public' },
    ),
    /visibility must match the reviewed release artifact/,
  )
})
