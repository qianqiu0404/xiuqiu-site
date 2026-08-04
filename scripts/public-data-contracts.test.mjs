import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parseMarkdownFrontmatter } from './frontmatter.mjs'
import {
  applyProjectPublicOverlay,
  assertProjectRepositoryVisibility,
  assertPublicHttpUrl,
  isPublishable,
} from './public-data-contracts.mjs'
import { assertPublicRadarContent } from './radar-pipeline.mjs'

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

test('current radar and risk-server public snapshots satisfy the contracts', () => {
  const radar = parseMarkdownFrontmatter(
    readFileSync(new URL('../content/radar/2026-07-28.md', import.meta.url), 'utf8'),
    'content/radar/2026-07-28.md',
  ).meta
  assert.doesNotThrow(() => assertPublicRadarContent(radar))

  const snapshot = JSON.parse(
    readFileSync(new URL('../content/obsidian-public/projects.json', import.meta.url), 'utf8'),
  )
  const riskServerSource = parseMarkdownFrontmatter(
    readFileSync(new URL('../content/projects/risk-server.md', import.meta.url), 'utf8'),
    'content/projects/risk-server.md',
  ).meta
  const riskServerOverlay = snapshot.projects.find(project => project.siteSlug === 'risk-server')
  const riskServer = applyProjectPublicOverlay(riskServerSource, riskServerOverlay)

  assert.equal(riskServerOverlay?.visibility, 'public')
  assert.equal(riskServerSource.visibility, 'none')
  assert.equal(riskServer.visibility, 'none')
  assert.equal(riskServer.repositoryUrl, undefined)
  assert.doesNotThrow(() => assertProjectRepositoryVisibility(riskServer))
})

test('refreshed project overlays stay aligned with their published source facts', () => {
  const snapshot = JSON.parse(
    readFileSync(new URL('../content/obsidian-public/projects.json', import.meta.url), 'utf8'),
  )
  const refreshedSlugs = [
    'exchange-wallet-system',
    'risk-server',
    's78-market-services',
    'wallet-reliability-lab',
    'web3-wallet-engineer-lab',
    'wallet-launchpad',
  ]

  for (const slug of refreshedSlugs) {
    const source = parseMarkdownFrontmatter(
      readFileSync(new URL(`../content/projects/${slug}.md`, import.meta.url), 'utf8'),
      `content/projects/${slug}.md`,
    ).meta
    const overlay = snapshot.projects.find(project => project.siteSlug === slug)

    assert.ok(overlay, `${slug} overlay is required`)
    assert.equal(overlay.stage, source.stage, `${slug} stage`)
    assert.equal(overlay.portfolioTier, source.portfolioTier, `${slug} portfolioTier`)
    assert.equal(overlay.activityStatus, source.activityStatus, `${slug} activityStatus`)
    assert.equal(overlay.publicSummary, source.positioning, `${slug} publicSummary`)
    assert.equal(overlay.publicNextMilestone, source.nextMilestone, `${slug} publicNextMilestone`)
    assert.equal(overlay.updatedAt, source.updatedAt, `${slug} updatedAt`)
    overlay.publicEvidence.forEach(evidence => {
      assert.ok(source.verifiedEvidence.includes(evidence), `${slug} evidence must come from source`)
    })

    assert.doesNotThrow(() =>
      assertProjectRepositoryVisibility(applyProjectPublicOverlay(source, overlay), slug),
    )
  }
})
