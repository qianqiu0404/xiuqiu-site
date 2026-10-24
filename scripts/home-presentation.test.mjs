import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import './shared-research.test.mjs'
import {
  aiEngineeringOutcomes,
  homeAiProofContexts,
  homeAiWorkflow,
  homeCapabilities,
  homeEvidenceHighlights,
  homeProofMethods,
  homeSeo,
  homeServiceFlow,
} from '../src/data/homePresentation.ts'
import { intelHomeSeo } from '../src/data/intelPresentation.ts'
import { evidenceRecords } from '../src/data/generatedEvidence.ts'
import { evidenceLedgerRecords, evidenceLedgerStats } from '../src/data/evidenceLedger.ts'
import { projects } from '../src/data/generatedProjects.ts'
import { productPresentations, qiuMarketUrl } from '../src/data/productPresentation.ts'
import { getAdjacentArticles, sortArticlesForReading } from '../src/data/articlePresentation.ts'

const homeSource = readFileSync(new URL('../src/features/about/pages/HomePage.vue', import.meta.url), 'utf8')
const intelHomeSource = readFileSync(new URL('../src/features/intel/pages/IntelHomePage.vue', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const chatWidgetSource = readFileSync(new URL('../src/components/AiChatWidget.vue', import.meta.url), 'utf8')
const projectAtlasSource = readFileSync(new URL('../src/features/projects/pages/ProjectAtlasPage.vue', import.meta.url), 'utf8')
const projectDetailSource = readFileSync(new URL('../src/features/projects/pages/ProjectDetailPage.vue', import.meta.url), 'utf8')
const qiuProjectSource = readFileSync(new URL('../content/projects/s78-market-services.md', import.meta.url), 'utf8')
const engineeringPageSource = readFileSync(new URL('../src/features/proof/pages/EngineeringPage.vue', import.meta.url), 'utf8')
const nowPageSource = readFileSync(new URL('../src/features/about/pages/NowPage.vue', import.meta.url), 'utf8')
const evidencePageSource = readFileSync(new URL('../src/features/proof/pages/EngineeringEvidencePage.vue', import.meta.url), 'utf8')
const aiPageSource = readFileSync(new URL('../src/features/ai/pages/AiCollaborationPage.vue', import.meta.url), 'utf8')
const radarPageSource = readFileSync(new URL('../src/features/intel/pages/RadarPage.vue', import.meta.url), 'utf8')
const radarDetailSource = readFileSync(new URL('../src/features/intel/pages/RadarDetailPage.vue', import.meta.url), 'utf8')
const radarWeeklySource = readFileSync(new URL('../src/features/intel/pages/RadarWeeklyPage.vue', import.meta.url), 'utf8')
const articlesPageSource = readFileSync(new URL('../src/features/articles/pages/ArticlesPage.vue', import.meta.url), 'utf8')
const articleDetailSource = readFileSync(new URL('../src/features/articles/pages/ArticleDetailPage.vue', import.meta.url), 'utf8')
const routerSource = readFileSync(new URL('../src/router/index.ts', import.meta.url), 'utf8')
const deliveryListSource = readFileSync(new URL('../src/features/proof/pages/DeliveryListPage.vue', import.meta.url), 'utf8')
const deliveryDetailSource = readFileSync(new URL('../src/features/proof/pages/DeliveryDetailPage.vue', import.meta.url), 'utf8')
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const readmeSource = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
const globalStyleSource = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
const homeStyleSource = readFileSync(new URL('../src/styles/home.css', import.meta.url), 'utf8')
const briefCss = readFileSync(new URL('../src/design/brief.css', import.meta.url), 'utf8')
const notFoundStyleSource = readFileSync(new URL('../src/styles/not-found.css', import.meta.url), 'utf8')
const aiProofRailSource = readFileSync(new URL('../src/features/about/components/AiEngineeringProofRail.vue', import.meta.url), 'utf8')

function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} must be unique`)
}

test('article reading order is deterministic and never wraps at either edge', () => {
  const records = [
    { id: 1, slug: 'oldest', date: '2026-06-01' },
    { id: 3, slug: 'newest', date: '2026-08-01' },
    { id: 2, slug: 'middle', date: '2026-07-01', updatedAt: '2026-07-02' },
  ]

  assert.deepEqual(sortArticlesForReading(records).map(item => item.slug), ['newest', 'middle', 'oldest'])
  assert.deepEqual(getAdjacentArticles(records, 'newest'), { previous: undefined, next: records[2] })
  assert.deepEqual(getAdjacentArticles(records, 'middle'), { previous: records[1], next: records[0] })
  assert.deepEqual(getAdjacentArticles(records, 'oldest'), { previous: records[2], next: undefined })
  assert.deepEqual(getAdjacentArticles(records, 'missing'), {})
})

test('article list and reader keep one main landmark and truthful editorial metadata', () => {
  assert.equal((appSource.match(/<main\b/g) || []).length, 1)
  assert.equal((articlesPageSource.match(/<main\b/g) || []).length, 0)
  assert.equal((articleDetailSource.match(/<main\b/g) || []).length, 0)
  assert.equal((articlesPageSource.match(/<h1\b/g) || []).length, 1)
  assert.equal((articleDetailSource.match(/<h1\b/g) || []).length, 4)

  assert.match(articlesPageSource, /发布\s*<time :datetime="article\.date">/)
  assert.match(articlesPageSource, /v-if="article\.updatedAt">更新\s*<time :datetime="article\.updatedAt">/)
  assert.match(articlesPageSource, /articleSeriesLabel\(article\)/)
  assert.match(articlesPageSource, /articleProjectNames\(article\)/)
  assert.match(articleDetailSource, /发布\s*<time :datetime="article\.date">/)
  assert.match(articleDetailSource, /v-if="article\.updatedAt">更新\s*<time :datetime="article\.updatedAt">/)
  assert.match(articleDetailSource, /v-if="article\.series \|\| relatedProjects\.length"/)
})

test('article reader exposes only source-backed next steps and recoverable states', () => {
  assert.match(articleDetailSource, /v-if="article\.series"/)
  assert.match(articleDetailSource, /v-if="relatedProjects\.length"/)
  assert.match(articleDetailSource, /v-if="recommendedArticles\.length"/)
  assert.match(articleDetailSource, /v-if="previousArticle \|\| nextArticle"/)
  assert.doesNotMatch(articleDetailSource, /\(index \+ 1\) % siteArticles\.length/)
  assert.match(articleDetailSource, /!hasEditorialRelations/)
  assert.match(articleDetailSource, /返回工程笔记列表/)

  assert.match(articleDetailSource, /role="status" aria-live="polite" aria-busy="true"/)
  assert.match(articleDetailSource, /role="alert"/)
  assert.match(articleDetailSource, /@click="loadCurrentArticle\(slug\)"/)
  assert.match(articleDetailSource, /这篇文章不存在。/)
})

test('article body keeps heading hierarchy without repeating the document title', () => {
  assert.match(articleDetailSource, /renderContent\(article\.content, article\.title\)/)
  assert.match(articleDetailSource, /headingText === documentTitle/)
  assert.match(articleDetailSource, /result\.push\('<h2>'/)
  assert.match(articleDetailSource, /result\.push\('<h3>'/)
  assert.match(articleDetailSource, /article-table-wrap/)
  assert.match(articleDetailSource, /code-block/)
})

test('article paper, touch, focus and long-content style contracts stay responsive', () => {
  assert.match(globalStyleSource, /\.article-reader-page\s*\{[\s\S]*?--article-paper: var\(--bg\);[\s\S]*?background: var\(--article-paper\)/)
  assert.match(globalStyleSource, /\.article-reader-page :where\(a, button\):focus-visible/)
  assert.match(globalStyleSource, /\.article-detail-body\s*\{[\s\S]*?width: min\(100%, 760px\);[\s\S]*?overflow-wrap: anywhere/)
  assert.match(globalStyleSource, /\.article-detail-body \.code-block\s*\{[\s\S]*?overflow-x: auto/)
  assert.match(globalStyleSource, /\.article-detail-body \.article-table-wrap\s*\{[\s\S]*?overflow-x: auto/)
  assert.match(globalStyleSource, /\.article-reader-state__actions :where\(a, button\)\s*\{[\s\S]*?min-height: 44px/)
  assert.match(globalStyleSource, /\.article-navigation > a\s*\{[\s\S]*?min-height: 88px/)
  assert.match(globalStyleSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.article-series-links a,[\s\S]*?\.followup-link/)
  assert.match(articlesPageSource, /min-height: 46px/)
  assert.match(articlesPageSource, /@media \(prefers-reduced-motion: reduce\)/)
})

test('skip, homepage utility actions and 404 recovery keep 44px targets', () => {
  assert.match(globalStyleSource, /\.skip-link\s*\{[\s\S]*?min-height: 44px;[\s\S]*?display: inline-flex;/)
  assert.match(globalStyleSource, /\.back-link\s*\{[\s\S]*?min-height: 44px;[\s\S]*?display: inline-flex;/)
  // The product page back link uses the shared brief-back target.
  assert.match(briefCss, /\.brief-back\s*\{[\s\S]*?min-height: var\(--touch-target\);[\s\S]*?display: inline-flex;/)
  for (const selector of [
    '.cinematic-hero-proof-link',
    '.cinematic-scroll-cue',
    '.home-ai-delivery a',
    '.cinematic-profile-link',
  ]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    assert.match(homeStyleSource, new RegExp(`${escaped}\\s*\\{[\\s\\S]*?min-height: 44px;`), selector)
  }
  assert.match(homeStyleSource, /\.home-ai-actions :where\(a, button\)\s*\{[\s\S]*?min-height: 44px;/)
  assert.match(aiProofRailSource, /\.ai-proof-evidence,[\s\S]*?\.ai-proof-ask\s*\{[\s\S]*?min-height: 44px;/)
  assert.match(notFoundStyleSource, /\.route-not-found-home\s*\{[\s\S]*?min-height: 44px;/)
})

test('missing project pages fail closed with a named heading and recovery path', () => {
  assert.match(projectDetailSource, /title: '项目未公开或不存在｜xiuqiu'/)
  assert.match(projectDetailSource, /indexable: false/)
  assert.match(projectDetailSource, /v-else class="container not-found" aria-labelledby="project-not-found-title"/)
  assert.match(projectDetailSource, /<h1 id="project-not-found-title" class="not-found-title">/)
  assert.match(projectDetailSource, /<router-link to="\/projects" class="btn btn-primary">返回项目图谱<\/router-link>/)
})

test('homepage presentation keeps the intended cardinalities', () => {
  assert.equal(homeCapabilities.length, 4)
  assert.equal(homeServiceFlow.length, 4)
  assert.equal(homeProofMethods.length, 5)
  assert.equal(homeEvidenceHighlights.length, 3)
  assert.equal(aiEngineeringOutcomes.length, 8)
  assert.equal(homeAiProofContexts.length, 3)
  assert.equal(homeAiWorkflow.length, 7)
  assertUnique(homeCapabilities.map(item => item.id), 'capability ids')
  assertUnique(homeServiceFlow.map(item => item.name), 'service names')
  assertUnique(homeProofMethods.map(item => item.id), 'proof ids')
  assertUnique(homeEvidenceHighlights.map(item => item.evidenceSlug), 'evidence highlight slugs')
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

test('generated projects separate the current product, current direction and historical evidence', () => {
  const projectsBySlug = new Map(projects.map(project => [project.slug, project]))

  assert.equal(projectsBySlug.get('exchange-wallet-system')?.portfolioTier, 'exploration')
  assert.equal(projectsBySlug.get('exchange-wallet-system')?.publicRole, 'current-direction')
  assert.equal(projectsBySlug.get('exchange-wallet-system')?.claimState, 'locked')
  assert.equal(projectsBySlug.get('wallet-reliability-lab')?.portfolioTier, 'verified')
  assert.equal(projectsBySlug.get('wallet-reliability-lab')?.publicRole, 'historical-evidence')
  assert.equal(projectsBySlug.get('wallet-reliability-lab')?.claimState, 'publishable')
  assert.equal(projectsBySlug.get('s78-market-services')?.portfolioTier, 'verified')
  assert.equal(projectsBySlug.get('s78-market-services')?.publicRole, 'current-product')
  assert.equal(projectsBySlug.get('s78-market-services')?.claimState, 'evidence-ready')
})

test('generated site registry has exactly one active product and one active direction', () => {
  const currentProducts = projects.filter(project => project.publicRole === 'current-product')
  const currentDirections = projects.filter(project => project.publicRole === 'current-direction')
  const historicalProjects = projects.filter(project => project.publicRole === 'historical-evidence')

  assert.deepEqual(currentProducts.map(project => project.slug), ['s78-market-services'])
  assert.deepEqual(currentDirections.map(project => project.slug), ['exchange-wallet-system'])
  assert.equal(currentProducts[0].activityStatus, 'active')
  assert.equal(currentDirections[0].activityStatus, 'active')
  assert.equal(historicalProjects.length, 6)
  assert.ok(historicalProjects.every(project => project.activityStatus !== 'active'))
})

test('project details expose role, Claim and activity status without promoting historical evidence', () => {
  assert.match(projectDetailSource, /projectPublicRoleLabels\[project\.publicRole\]/)
  assert.match(projectDetailSource, /projectClaimStateLabels\[project\.claimState\]/)
  assert.match(projectDetailSource, /projectActivityLabels\[project\.activityStatus\]/)
  assert.match(projectDetailSource, /project\.value\?\.publicRole === 'historical-evidence'/)
  assert.match(projectDetailSource, /不代表当前产品、当前方向或现役优先级/)
  assert.match(projectDetailSource, /历史记录中由代码、测试或运行记录支持的事实/)
  assert.match(projectDetailSource, /Last recorded evidence next step/)
})

test('repository and homepage keep historical wallet work out of the current-product frame', () => {
  assert.match(readmeSource, /当前只把 Qiu Market 作为产品呈现/)
  assert.match(readmeSource, /Wallet Infrastructure.*当前钱包后端学习与工程证据方向/)
  assert.match(readmeSource, /历史公开模拟与交付记录仍作为可追溯证据保留/)
  assert.match(readmeSource, /它们不定义当前产品优先级/)
  assert.doesNotMatch(readmeSource, /## Three-repository portfolio/)

  assert.match(homeSource, /Historical wallet proof/)
  assert.match(homeSource, /Historical AI delivery/)
  assert.match(homeSource, /Historical delivery/)
  assert.doesNotMatch(homeSource, /Featured delivery/)

  assert.match(chatWidgetSource, /Qiu Market current product × Wallet Infrastructure current direction/)
  assert.match(chatWidgetSource, /Qiu Market 是唯一 current product/)
  assert.match(chatWidgetSource, /Wallet Infrastructure 只是 current direction/)
  assert.match(chatWidgetSource, /Wallet Infrastructure 只是 locked current direction/)
  assert.match(chatWidgetSource, /6 个历史项目/)
  assert.doesNotMatch(chatWidgetSource, /Wallet Platform × Market Server/)

  assert.match(qiuProjectSource, /Node 24.*submit→ledger→recovery/)
  assert.match(qiuProjectSource, /跨日 Owner Gate 尚未通过/)
  assert.match(projectDetailSource, /Evidence ready/)
  assert.match(projectDetailSource, /OWNER GATE PENDING/)
  assert.match(projectDetailSource, /跨日 Owner Gate 尚未通过/)

  assert.match(nowPageSource, /Qiu Market 维护者 × Wallet Infrastructure 学习与证据建设/)
  assert.match(nowPageSource, /Qiu Market current product · Wallet Infrastructure current direction/)
  assert.match(nowPageSource, /Latest historical delivery trace/)
  assert.doesNotMatch(nowPageSource, /Wallet Platform · Market Server/)

  assert.match(engineeringPageSource, /Current product、Current direction 与 Historical evidence/)
  assert.match(engineeringPageSource, /currentProjectCount.*historicalProjectCount/)
  assert.match(evidencePageSource, /projectPublicRoleLabels\[project\.publicRole\]/)
  assert.match(evidencePageSource, /projectClaimStateLabels\[project\.claimState\]/)
  assert.match(evidencePageSource, /Historical delivery \/ run/)

  assert.match(deliveryListSource, /AI 历史公开交付记录｜xiuqiu/)
  assert.match(deliveryListSource, /不代表当前 Wallet Infrastructure 已实现/)
  assert.match(deliveryDetailSource, /AI 历史公开交付/)
  assert.match(deliveryDetailSource, /LAST RECORDED LIMITS/)
  assert.match(deliveryDetailSource, /LAST RECORDED NEXT STEP \/ PAUSED/)
  assert.doesNotMatch(deliveryDetailSource, /CURRENT LIMITS/)
})

test('homepage evidence highlights resolve to dated site evidence', () => {
  const evidenceBySlug = new Map(evidenceRecords.map(record => [record.slug, record]))

  assert.deepEqual(homeEvidenceHighlights.map(item => item.evidenceSlug), [
    'qiu-market-release-artifact',
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
  assert.match(heroSource, /to="\/projects\/s78-market-services"/)
  assert.match(heroSource, /to="\/projects"/)
  assert.match(homeSource, /id="products"/)
  assert.match(homeSource, /id="ai-engineering"/)
  assert.match(homeSource, /id="evidence"/)
  assert.match(homeSource, /AiEngineeringProofRail/)
  assert.match(homeSource, /Ask xiuqiu AI/)
  assert.match(homeSource, /AI 不替我判断/)
  assert.match(homeSource, /qiu-market\.vercel\.app/)

  function linksInClass(className) {
    const block = appSource.match(new RegExp(`<div class="${className}"[\\s\\S]*?<\\/div>`))?.[0]
    assert.ok(block, `${className} markup is missing`)
    return [...block.matchAll(/<router-link\b([\s\S]*?)>([\s\S]*?)<\/router-link>/g)]
      .map(([, attributes, label]) => ({
        to: attributes.match(/\bto="([^"]+)"/)?.[1],
        label: label.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
      }))
  }

  assert.match(appSource, /id="primary-navigation"/)
  const primaryLinks = linksInClass('nav-primary-links')
  assert.equal(primaryLinks.length, 5)
  assertUnique(primaryLinks.map(link => link.to), 'primary navigation destinations')
  assertUnique(primaryLinks.map(link => link.label), 'primary navigation labels')
  assert.deepEqual(primaryLinks, [
    { to: '/', label: '情报流' },
    { to: '/radar', label: '学习雷达' },
    { to: '/market-radar', label: '市场雷达' },
    { to: '/projects/s78-market-services', label: 'Qiu Market' },
    { to: '/ai', label: 'AI' },
  ])

  const secondaryLinks = linksInClass('nav-secondary-links')
  assert.deepEqual(secondaryLinks, [
    { to: '/engineering/evidence', label: '证据' },
    { to: '/projects', label: '项目' },
    { to: '/articles', label: '笔记' },
    { to: '/about', label: '关于' },
  ])
  assertUnique(
    [...primaryLinks, ...secondaryLinks].map(link => link.to),
    'all navigation destinations',
  )
  assert.deepEqual(primaryLinks.map(link => link.to), ['/', '/radar', '/market-radar', '/projects/s78-market-services', '/ai'])

  assert.match(appSource, /currentRoute\.name === 'learning'\) return 'learn-radar'/)
  assert.match(appSource, /aria-current="location"/)
  assert.match(appSource, /class="nav-mobile-context"/)
  assert.match(appSource, /'trade-radar': 'Trade Radar'/)
  assert.match(appSource, /@click="toggleNav"/)
  assert.equal((appSource.match(/@keydown\.space\.prevent="activateLinkOnSpace"/g) || []).length, 9)
  assert.match(appSource, /navToggle\.value\?\.focus\(\)/)
  assert.match(appSource, /mainContent\.value\?\.focus\(\{ preventScroll: true \}\)/)
  assert.match(appSource, /<main id="main-content" ref="mainContent" tabindex="-1">/)

  assert.match(globalStyleSource, /\.nav-context\s*\{/)
  assert.match(globalStyleSource, /\.nav-mobile-context\s*\{/)
  assert.match(globalStyleSource, /\.nav-link[\s\S]*?min-width:\s*44px/)
  assert.match(globalStyleSource, /\.nav-toggle[\s\S]*?width:\s*44px[\s\S]*?height:\s*44px/)
  assert.match(globalStyleSource, /max-height:\s*calc\(100dvh - 48px\)/)
  assert.match(globalStyleSource, /overflow-x:\s*hidden/)
  assert.match(globalStyleSource, /@media \(prefers-reduced-motion: reduce\)/)
})

test('product presentation contains only the current public product', () => {
  assert.deepEqual(productPresentations.map(item => item.slug), [
    's78-market-services',
  ])
  productPresentations.forEach(item => {
    assert.match(item.publicAction.href, /^https:\/\//)
    assert.ok(item.publicAction.boundary.length > 20)
    assert.match(item.proofAction.to, /^\//)
  })

  const marketPresentation = productPresentations.find(item => item.slug === 's78-market-services')
  assert.ok(marketPresentation)
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
  assert.match(appSource, /s78-market-services/)
  assert.match(appSource, /:cinematic="usesCinematicChrome"/)
  assert.match(appSource, /:hide-desktop-toggle="isCinematicHome"/)
  assert.match(appSource, /v-if="showAiChat"/)
  assert.match(chatWidgetSource, /'ai-chat--desktop-rail': props\.hideDesktopToggle/)
  assert.match(chatWidgetSource, /\.ai-chat--desktop-rail \.ai-chat-toggle/)
})

test('cinematic evidence pages preserve their source-backed interaction contracts', () => {
  assert.match(projectAtlasSource, /id="current-product"/)
  assert.match(projectAtlasSource, /project\.publicRole === group\.role/)
  assert.match(projectAtlasSource, /Current product/)
  assert.match(projectAtlasSource, /Current direction/)
  assert.match(projectAtlasSource, /Historical evidence/)
  assert.match(projectAtlasSource, /projectClaimStateLabels\[project\.claimState\]/)
  assert.match(projectAtlasSource, /project\.verifiedEvidence\[0\]/)
  assert.match(projectAtlasSource, /productPresentations/)
  assert.match(projectAtlasSource, /进入产品主页/)
  // Atlas actions use the shared brief targets (44px via --touch-target).
  assert.match(projectAtlasSource, /class="brief-button" :to="`\/projects\/\$\{entry\.project\.slug\}`">进入产品主页/)
  assert.match(projectAtlasSource, /class="reader-source-link" :href="projectAction\(project\)\.href"/)
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

  // Primary action opens the public product; the secondary action goes to its evidence.
  assert.match(
    projectDetailSource,
    /<a class="brief-button brief-button--primary" :href="presentation\.publicAction\.href"/,
  )
  assert.match(projectDetailSource, /<router-link class="brief-button" :to="presentation\.proofAction\.to">/)

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
    aiPageSource.indexOf('id="execution-kernel-title"') < aiPageSource.indexOf('id="public-delivery-title"'),
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
  assert.match(radarPageSource, /radar-feed-cards/)
  for (const component of ['IntelCard', 'ChipGroup', 'SearchBox', 'LoadState', 'SubscribeBar']) {
    assert.match(radarPageSource, new RegExp(`import ${component} from '../../../design/components/${component}.vue'`))
  }
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

  assert.equal(title, intelHomeSeo.title)
  assert.equal(description, intelHomeSeo.description)
  assert.match(intelHomeSource, /\.\.\.intelHomeSeo, path: '\/'/)
  // The former home moved to /about and keeps its own SEO.
  assert.match(homeSource, /\.\.\.homeSeo, path: '\/about'/)
})
