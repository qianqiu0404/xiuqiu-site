import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  aiEngineeringOutcomes,
  flagshipProjectSlug,
  homeAiProofContexts,
  homeAiWorkflow,
  homeCapabilities,
  homeEvidenceHighlights,
  homeProductGroups,
  homeProofMethods,
  homeSeo,
  homeServiceFlow,
  representativeProjectSlugs,
  walletLabUrl,
} from '../src/data/homePresentation.ts'
import { evidenceRecords } from '../src/data/generatedEvidence.ts'
import { evidenceLedgerRecords, evidenceLedgerStats } from '../src/data/evidenceLedger.ts'
import { projects } from '../src/data/generatedProjects.ts'
import { productPresentations, qiuMarketUrl } from '../src/data/productPresentation.ts'

const homeSource = readFileSync(new URL('../src/pages/HomePage.vue', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const chatWidgetSource = readFileSync(new URL('../src/components/AiChatWidget.vue', import.meta.url), 'utf8')
const projectAtlasSource = readFileSync(new URL('../src/pages/ProjectAtlasPage.vue', import.meta.url), 'utf8')
const projectDetailSource = readFileSync(new URL('../src/pages/ProjectDetailPage.vue', import.meta.url), 'utf8')
const evidencePageSource = readFileSync(new URL('../src/pages/EngineeringEvidencePage.vue', import.meta.url), 'utf8')
const aiPageSource = readFileSync(new URL('../src/pages/AiCollaborationPage.vue', import.meta.url), 'utf8')
const radarPageSource = readFileSync(new URL('../src/pages/RadarPage.vue', import.meta.url), 'utf8')
const radarDetailSource = readFileSync(new URL('../src/pages/RadarDetailPage.vue', import.meta.url), 'utf8')
const radarWeeklySource = readFileSync(new URL('../src/pages/RadarWeeklyPage.vue', import.meta.url), 'utf8')
const routerSource = readFileSync(new URL('../src/router/index.ts', import.meta.url), 'utf8')
const deliveryDetailSource = readFileSync(new URL('../src/pages/DeliveryDetailPage.vue', import.meta.url), 'utf8')
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} must be unique`)
}

test('homepage presentation keeps the intended cardinalities', () => {
  assert.equal(homeCapabilities.length, 4)
  assert.equal(homeServiceFlow.length, 4)
  assert.equal(homeProofMethods.length, 5)
  assert.equal(homeEvidenceHighlights.length, 3)
  assert.equal(homeProductGroups.length, 2)
  assert.equal(aiEngineeringOutcomes.length, 8)
  assert.equal(homeAiProofContexts.length, 3)
  assert.equal(homeAiWorkflow.length, 7)
  assertUnique(homeCapabilities.map(item => item.id), 'capability ids')
  assertUnique(homeServiceFlow.map(item => item.name), 'service names')
  assertUnique(homeProofMethods.map(item => item.id), 'proof ids')
  assertUnique(homeEvidenceHighlights.map(item => item.evidenceSlug), 'evidence highlight slugs')
  assertUnique(homeProductGroups.map(item => item.id), 'product group ids')
  assertUnique(aiEngineeringOutcomes, 'AI outcomes')
  assertUnique(homeAiProofContexts.map(item => item.id), 'AI proof context ids')
  assertUnique(homeAiWorkflow, 'AI workflow steps')
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

test('configured homepage projects foreground the two finished-product directions', () => {
  const projectsBySlug = new Map(projects.map(project => [project.slug, project]))

  assert.equal(representativeProjectSlugs.length, 4)
  assert.deepEqual([...representativeProjectSlugs], [
    'exchange-wallet-system',
    'wallet-launchpad',
    'wallet-reliability-lab',
    's78-market-services',
  ])
  assert.deepEqual(
    homeProductGroups.map(group => ({ id: group.id, projectSlugs: [...group.projectSlugs] })),
    [
      {
        id: 'wallet-platform',
        projectSlugs: ['exchange-wallet-system', 'wallet-launchpad', 'wallet-reliability-lab'],
      },
      {
        id: 'market-server',
        projectSlugs: ['s78-market-services'],
      },
    ],
  )
  assertUnique([...representativeProjectSlugs], 'homepage project slugs')
  assert.ok(representativeProjectSlugs.includes('wallet-launchpad'))
  assert.ok(representativeProjectSlugs.includes('s78-market-services'))

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
    'wallet-launchpad-no-funds-acceptance',
    'failure-playbook-public',
    'wallet-lab-demo',
  ])
  homeEvidenceHighlights.forEach(item => {
    const record = evidenceBySlug.get(item.evidenceSlug)
    assert.ok(record, `Missing generated evidence: ${item.evidenceSlug}`)
    assert.match(record.verifiedAt, /^\d{4}-\d{2}-\d{2}$/)
  })
})

test('verification ledger resolves only source-backed evidence relationships', () => {
  assert.equal(evidenceLedgerRecords.length, evidenceRecords.length)
  assert.equal(
    evidenceLedgerStats.verified + evidenceLedgerStats.partial + evidenceLedgerStats.design,
    evidenceLedgerStats.total,
  )
  assert.equal(
    evidenceLedgerStats.public,
    evidenceRecords.filter(record => record.visibility === 'public' && record.url).length,
  )

  evidenceLedgerRecords.forEach(record => {
    assert.deepEqual(record.projects.map(project => project.slug), record.evidence.projectSlugs)
    assert.deepEqual(record.deliveries.map(delivery => delivery.slug), record.evidence.deliverySlugs)
    assert.deepEqual(record.failures.map(failure => failure.slug), record.evidence.failureSlugs)
    assert.deepEqual(record.articles.map(article => article.slug), record.evidence.articleSlugs)
  })
})

test('homepage and primary navigation keep their structural contract', () => {
  assert.equal((homeSource.match(/<section(?:\s|>)/g) || []).length, 5)
  const heroSource = homeSource.match(/<section class="cinematic-hero"[\s\S]*?<\/section>/)?.[0]
  assert.ok(heroSource, 'Homepage hero markup is missing')
  assert.equal((heroSource.match(/class="cinematic-button /g) || []).length, 2)
  assert.match(heroSource, /to="\/projects\/wallet-launchpad"/)
  assert.match(heroSource, /to="\/projects\/s78-market-services"/)
  assert.match(homeSource, /id="products"/)
  assert.match(homeSource, /id="ai-engineering"/)
  assert.match(homeSource, /id="evidence"/)
  assert.match(homeSource, /AiEngineeringProofRail/)
  assert.match(homeSource, /Ask xiuqiu AI/)
  assert.match(homeSource, /AI 不替我判断/)
  assert.match(homeSource, /qiu-market\.vercel\.app/)

  const primaryNavigation = appSource.match(/<div id="primary-navigation"[\s\S]*?<\/div>/)?.[0]
  assert.ok(primaryNavigation, 'Primary navigation markup is missing')

  const links = [...primaryNavigation.matchAll(/<router-link\s+to="([^"]+)"[^>]*>([^<]+)<\/router-link>/g)]
    .map(([, to, label]) => ({ to, label: label.trim() }))

  assert.equal(links.length, 6)
  assertUnique(links.map(link => link.to), 'primary navigation destinations')
  assertUnique(links.map(link => link.label), 'primary navigation labels')
  assert.deepEqual(links.map(link => link.to), [
    '/projects/wallet-launchpad',
    '/projects/s78-market-services',
    '/ai',
    '/engineering/evidence',
    '/radar',
    '/market-radar',
  ])
})

test('two product home presentations keep public products separate from companion experiments', () => {
  assert.deepEqual(productPresentations.map(item => item.slug), [
    'wallet-launchpad',
    's78-market-services',
  ])
  productPresentations.forEach(item => {
    assert.match(item.publicAction.href, /^https:\/\//)
    assert.ok(item.publicAction.boundary.length > 20)
    assert.match(item.proofAction.to, /^\//)
  })

  const walletPresentation = productPresentations.find(item => item.slug === 'wallet-launchpad')
  const marketPresentation = productPresentations.find(item => item.slug === 's78-market-services')
  assert.ok(walletPresentation)
  assert.ok(marketPresentation)
  assert.equal(walletPresentation.publicAction.role, 'companion')
  assert.equal(walletPresentation.publicAction.href, walletLabUrl)
  assert.match(walletPresentation.publicAction.label, /simulation-only/)
  assert.match(walletPresentation.publicAction.boundary, /不是 Wallet Launchpad/)
  assert.equal(
    walletPresentation.proofAction.to,
    '/engineering/evidence#wallet-launchpad-no-funds-acceptance',
  )
  assert.match(homeSource, /v-if="entry\.presentation\.publicAction\.role === 'companion'"/)
  assert.match(homeSource, /:to="entry\.presentation\.proofAction\.to"/)
  assert.equal(marketPresentation.publicAction.role, 'product')
  assert.equal(qiuMarketUrl, 'https://qiu-market.vercel.app')
})

test('AI proof rails preserve evidence and human-decision boundaries', () => {
  assert.deepEqual(homeAiProofContexts.map(context => context.id), ['wallet', 'market', 'ai'])

  homeAiProofContexts.forEach(context => {
    assert.ok(context.steps.length >= 5)
    assert.ok(context.boundary.length > 20)
    assert.ok(context.assistantPrompt.length > 10)
    assert.ok(context.steps.some(step => step.status === 'verified' || step.status === 'pending'))
    if (context.evidence.destination.kind === 'internal') {
      assert.match(context.evidence.destination.to, /^\//)
    }
  })

  assert.match(homeAiProofContexts[1].summary, /没有单独发布的 AI delivery/)
  assert.match(homeAiProofContexts[2].boundary, /不能替代安全判断/)
})

test('route-driven visual modes keep shared chrome without hiding their desktop AI entry', () => {
  assert.match(appSource, /currentRoute\.meta\.visual/)
  assert.match(appSource, /wallet-launchpad/)
  assert.match(appSource, /s78-market-services/)
  assert.match(appSource, /:cinematic="usesCinematicChrome"/)
  assert.match(appSource, /:hide-desktop-toggle="isCinematicHome"/)
  assert.match(chatWidgetSource, /'ai-chat--desktop-rail': props\.hideDesktopToggle/)
  assert.match(chatWidgetSource, /\.ai-chat--desktop-rail \.ai-chat-toggle/)
})

test('cinematic evidence pages preserve their source-backed interaction contracts', () => {
  assert.match(projectAtlasSource, /:id="group\.tier"/)
  assert.match(projectAtlasSource, /portfolioTier === tier/)
  assert.match(projectAtlasSource, /project\.verifiedEvidence\[0\]/)
  assert.match(projectAtlasSource, /productPresentations/)
  assert.match(projectAtlasSource, /进入产品主页/)
  assert.match(projectAtlasSource, /target="_blank"/)
  assert.match(projectAtlasSource, /rel="noopener"/)

  assert.match(evidencePageSource, /Verification Ledger/)
  assert.match(evidencePageSource, /class="verification-ledger-row"/)
  assert.match(evidencePageSource, /projectFilter/)
  assert.match(evidencePageSource, /kindFilter/)
  assert.match(evidencePageSource, /statusFilter/)
  assert.match(evidencePageSource, /visibilityFilter/)
  assert.match(evidencePageSource, /record\.projects/)
  assert.match(evidencePageSource, /record\.deliveries/)
  assert.match(evidencePageSource, /record\.failures/)
  assert.match(evidencePageSource, /record\.articles/)
  assert.match(evidencePageSource, /Coverage Map/)
  assert.match(evidencePageSource, /role="table"/)
  assert.match(evidencePageSource, /role="columnheader"/)
  assert.match(evidencePageSource, /role="rowheader"/)
  assert.match(evidencePageSource, /role="cell"/)
  assert.match(evidencePageSource, /record\.evidence\.visibility === 'public' && record\.evidence\.url/)
  assert.match(evidencePageSource, /私有工程去敏摘要/)
  assert.match(evidencePageSource, /它不自动等于生产可用、经过审计或处理过真实资金/)
  assert.match(evidencePageSource, /:id="record\.evidence\.slug"/)

  assert.match(
    projectDetailSource,
    /<template v-if="presentation\.publicAction\.role === 'companion'">[\s\S]*?<router-link class="product-button product-button--primary" :to="presentation\.proofAction\.to">/,
  )
  assert.match(
    projectDetailSource,
    /<a class="product-button product-button--quiet" :href="presentation\.publicAction\.href"/,
  )
  assert.match(projectDetailSource, /先检查 Launchpad 的工程证据，再运行独立的配套实验/)

  assert.match(aiPageSource, /executionKernel/)
  assert.match(aiPageSource, /latestDeliveries/)
  assert.match(aiPageSource, /aiModules/)
  assert.match(aiPageSource, /AI Engineering \/ Evidence OS/)
  assert.match(aiPageSource, /Review Before Claim/)
  assert.match(aiPageSource, /Operational Automation/)
  assert.match(aiPageSource, /Private Control Plane/)
  assert.match(aiPageSource, /Human Boundary/)
  assert.match(aiPageSource, /\/ai\/deliveries/)
  assert.ok(
    aiPageSource.indexOf('class="aeo-protocol"') < aiPageSource.indexOf('class="aeo-ledger"'),
    'AI execution protocol should appear before the public delivery ledger',
  )
  for (const field of ['aiContribution', 'humanDecisions', 'reviewFindings', 'corrections', 'knownLimits', 'nextStep']) {
    assert.match(deliveryDetailSource, new RegExp(`delivery\\.${field}`))
  }
})

test('radar uses one intelligence system across overview, daily and weekly readers', () => {
  assert.match(radarPageSource, /radar-intelligence-hero/)
  assert.match(radarPageSource, /radar-signal-ledger/)
  assert.match(radarPageSource, /radar-convergence-stage/)
  assert.match(radarPageSource, /radar-archive-ledger/)
  assert.match(radarPageSource, /archiveLimit = 10/)
  assert.match(radarDetailSource, /radar-daily-reader-page/)
  assert.match(radarDetailSource, /radar-reader-articles/)
  assert.match(radarWeeklySource, /radar-weekly-reader-page/)
  assert.match(radarWeeklySource, /radar-weekly-boundary/)
  assert.match(routerSource, /path: '\/radar',[\s\S]*?visual: 'narrative'/)
  assert.match(routerSource, /path: '\/radar\/week\/:week',[\s\S]*?visual: 'narrative'/)
  assert.match(routerSource, /path: '\/radar\/:date',[\s\S]*?visual: 'narrative'/)
})

test('static and runtime homepage SEO stay aligned', () => {
  const title = indexHtml.match(/<title>([^<]+)<\/title>/)?.[1]
  const description = indexHtml.match(/<meta name="description" content="([^"]+)"\s*\/>/)?.[1]

  assert.equal(title, homeSeo.title)
  assert.equal(description, homeSeo.description)
  assert.match(homeSource, /\.\.\.homeSeo/)
})
