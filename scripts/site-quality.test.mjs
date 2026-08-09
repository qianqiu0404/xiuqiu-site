import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { articleSummaries } from '../src/data/generatedArticleKnowledge.ts'
import { deliveryRecords } from '../src/data/generatedDeliveries.ts'
import { nowSnapshot } from '../src/data/generatedNow.ts'
import { projects } from '../src/data/generatedProjects.ts'
import { radarWeeklies } from '../src/data/generatedRadarWeeklies.ts'
import { dailyRadars } from '../src/data/generatedRadarAll.ts'
import { allMarketRadars } from '../src/data/generatedMarketRadarAll.ts'
import { parseMarkdownFrontmatter } from './frontmatter.mjs'

const SITE_ORIGIN = 'https://xiuqiu-site.vercel.app'
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DIST_ROOT = join(ROOT, 'dist')

function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), 'utf8')
}

function assertSameSet(actualValues, expectedValues, label) {
  const actual = new Set(actualValues)
  const expected = new Set(expectedValues)
  const missing = [...expected].filter(value => !actual.has(value)).sort()
  const unexpected = [...actual].filter(value => !expected.has(value)).sort()

  assert.deepEqual(
    { missing, unexpected },
    { missing: [], unexpected: [] },
    `${label} must not contain missing or unexpected values`,
  )
  assert.equal(actualValues.length, actual.size, `${label} must not contain duplicates`)
}

function markdownSourceSlugs(relativeDirectory, { requirePublish = false } = {}) {
  const directory = join(ROOT, relativeDirectory)
  return readdirSync(directory)
    .filter(fileName => fileName.endsWith('.md'))
    .sort()
    .map(fileName => {
      const sourceName = `${relativeDirectory}/${fileName}`
      const { meta } = parseMarkdownFrontmatter(read(sourceName), sourceName)
      return meta
    })
    .filter(meta => !requirePublish || meta.publish === true)
    .map(meta => String(meta.slug))
}

function sitemapEntries() {
  const source = read('public/sitemap.xml')
  return [...source.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1].trim())
}

function routeFromSitemapUrl(value) {
  const url = new URL(value)
  assert.equal(url.origin, SITE_ORIGIN, `sitemap URL must use the canonical origin: ${value}`)
  assert.equal(url.search, '', `sitemap URL must not contain a query: ${value}`)
  assert.equal(url.hash, '', `sitemap URL must not contain a fragment: ${value}`)
  assert.ok(url.pathname === '/' || !url.pathname.endsWith('/'), `non-root sitemap route must not end in /: ${value}`)
  return url.pathname
}

function expectedSitemapRoutes() {
  const routerSource = read('src/router/index.ts')
  const fixedRouterPaths = [...routerSource.matchAll(/\bpath:\s*['"`]([^'"`]+)['"`]/g)]
    .map(match => match[1])
    .filter(path => !path.includes(':') && !path.includes('*') && path !== '/404')

  for (const dynamicPath of [
    '/ai/deliveries/:slug',
    '/radar/week/:week',
    '/radar/:date',
    '/market-radar/:date',
    '/articles/:slug',
    '/projects/:project',
  ]) {
    assert.ok(routerSource.includes(`path: '${dynamicPath}'`), `router is missing public dynamic route ${dynamicPath}`)
  }

  return [
    ...fixedRouterPaths,
    ...projects.map(project => `/projects/${project.slug}`),
    ...articleSummaries.map(article => `/articles/${article.slug}`),
    ...dailyRadars.map(radar => `/radar/${radar.slug}`),
    ...allMarketRadars.map(radar => `/market-radar/${radar.slug}`),
    ...radarWeeklies.map(weekly => `/radar/week/${weekly.slug}`),
    ...deliveryRecords.map(record => `/ai/deliveries/${record.slug}`),
  ]
}

function htmlTags(html, tagName) {
  return html.match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) || []
}

function htmlAttribute(tag, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = tag.match(new RegExp(`\\s${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'))
  return match ? (match[1] ?? match[2] ?? '') : undefined
}

function decodeHtml(value) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

function builtPagePath(route) {
  const segments = route.split('/').filter(Boolean)
  return join(DIST_ROOT, ...segments, 'index.html')
}

function expectedCanonical(route) {
  return route === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${route}`
}

function inspectMeta(html, sourceName) {
  const titleMatches = [...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)]
  const descriptionTags = htmlTags(html, 'meta')
    .filter(tag => htmlAttribute(tag, 'name')?.toLowerCase() === 'description')
  const robotsTags = htmlTags(html, 'meta')
    .filter(tag => htmlAttribute(tag, 'name')?.toLowerCase() === 'robots')
  const canonicalTags = htmlTags(html, 'link')
    .filter(tag => (htmlAttribute(tag, 'rel') || '').toLowerCase().split(/\s+/).includes('canonical'))

  assert.equal(titleMatches.length, 1, `${sourceName} must contain exactly one title`)
  assert.equal(descriptionTags.length, 1, `${sourceName} must contain exactly one description`)
  assert.equal(canonicalTags.length, 1, `${sourceName} must contain exactly one canonical`)
  assert.ok(robotsTags.length <= 1, `${sourceName} must not contain duplicate robots metadata`)

  return {
    title: decodeHtml(titleMatches[0][1].trim()),
    description: decodeHtml(htmlAttribute(descriptionTags[0], 'content') || ''),
    canonical: decodeHtml(htmlAttribute(canonicalTags[0], 'href') || ''),
    robots: robotsTags.length ? (htmlAttribute(robotsTags[0], 'content') || '').toLowerCase() : undefined,
  }
}

function expectedMetadataByRoute() {
  const writingDescription =
    `${articleSummaries.length} 篇关于交易所钱包、多链模型、签名服务、Go 后端与 AI 工程工作流的学习笔记。`
  const metadata = new Map([
    ['/', {
      title: 'xiuqiu｜Wallet Launchpad、Qiu Market 与 AI Engineering',
      description: '构建 Wallet Launchpad 与 Qiu Market，并用 AI-native Engineering 工作流、自动化测试、失败恢复和公开证据说明 Web3 系统能力。',
    }],
    ['/engineering', {
      title: '工程证据索引｜xiuqiu',
      description: '从证据矩阵、失败恢复手册和项目档案复核 xiuqiu 的 Web3 钱包与工程实践边界。',
    }],
    ['/engineering/failures', {
      title: '钱包异常恢复手册｜xiuqiu',
      description: '30 个钱包后端核心异常，按资金事实、止损动作、排查证据、恢复步骤和当前证据边界组织。',
    }],
    ['/engineering/evidence', {
      title: '工程证据覆盖｜xiuqiu',
      description: '按工程实现、自动化测试、可运行演示和公开说明查看钱包工程证据与当前边界。',
    }],
    ['/projects', {
      title: '项目图谱｜xiuqiu',
      description: '先进入 Wallet Launchpad 与 Qiu Market 两个产品主页，再按证据层级浏览其他 Web3 与 AI 工程项目。',
    }],
    ['/ai', {
      title: 'AI Engineering OS｜xiuqiu',
      description: 'AI 参与定义、执行、审查与验证；真实交付、人工门禁和工程证据共同决定结果。',
    }],
    ['/ai/social-research', {
      title: 'Social Media Research Skill｜xiuqiu',
      description: 'MediaCrawler 本地采集与 TikHub 付费确认回退组成的双后端社交媒体研究工作流。',
    }],
    ['/ai/deliveries', {
      title: 'AI 协作交付记录｜xiuqiu',
      description: '真实任务中的 AI 参与、人工判断、审查纠正、验证结果与公开交付。',
    }],
    ['/now', {
      title: '当前动态｜xiuqiu',
      description: nowSnapshot.summary,
    }],
    ['/learning', {
      title: '学习复盘｜xiuqiu',
      description: '按阶段归档的 Web3 钱包工程学习结论、验证证据与下一步。',
    }],
    ['/radar', {
      title: '行业情报雷达｜xiuqiu',
      description: '面向 Web3 钱包与 AI 工程的每日行业简报、人工复核周度收敛和可追溯历史档案。',
    }],
    ['/market-radar', {
      title: '交易研究雷达｜xiuqiu',
      description: '基于公开来源的静态交易事件观察：事实、影响资产、观察条件和失效边界分开呈现，不调用实时行情 API。',
    }],
    ['/articles', {
      title: '工程笔记｜xiuqiu Web3 钱包学习档案',
      description: writingDescription,
    }],
  ])

  for (const project of projects) {
    metadata.set(`/projects/${project.slug}`, {
      title: `${project.name}｜xiuqiu 工程项目`,
      description: project.positioning,
    })
  }
  for (const article of articleSummaries) {
    metadata.set(`/articles/${article.slug}`, {
      title: `${article.title}｜xiuqiu 工程笔记`,
      description: article.summary,
    })
  }
  for (const radar of dailyRadars) {
    metadata.set(`/radar/${radar.slug}`, {
      title: `${radar.title}｜xiuqiu`,
      description: radar.summary,
    })
  }
  for (const radar of allMarketRadars) {
    metadata.set(`/market-radar/${radar.slug}`, {
      title: `${radar.title}｜xiuqiu`,
      description: radar.summary,
    })
  }
  for (const weekly of radarWeeklies) {
    metadata.set(`/radar/week/${weekly.slug}`, {
      title: `${weekly.title}｜xiuqiu`,
      description: weekly.summary,
    })
  }
  for (const record of deliveryRecords) {
    metadata.set(`/ai/deliveries/${record.slug}`, {
      title: `${record.title}｜AI 交付记录`,
      description: record.summary,
    })
  }

  return metadata
}

test('generated public records stay aligned with their reviewed source files', () => {
  assertSameSet(
    articleSummaries.map(article => article.slug),
    markdownSourceSlugs('content/articles'),
    'generated article slugs',
  )
  assertSameSet(
    projects.map(project => project.slug),
    markdownSourceSlugs('content/projects', { requirePublish: true }),
    'generated project slugs',
  )
  assertSameSet(
    dailyRadars.map(radar => radar.slug),
    markdownSourceSlugs('content/radar', { requirePublish: true }),
    'generated daily radar slugs',
  )
  assertSameSet(
    allMarketRadars.map(radar => radar.slug),
    markdownSourceSlugs('content/market-radar', { requirePublish: true }),
    'generated static market radar slugs',
  )
  assertSameSet(
    deliveryRecords.map(record => record.slug),
    markdownSourceSlugs('content/deliveries', { requirePublish: true }),
    'generated delivery slugs',
  )

  const weeklySnapshot = JSON.parse(read('content/obsidian-public/radar-weeklies.json'))
  const publishedWeeklySlugs = weeklySnapshot.radarWeeklies
    .filter(weekly => weekly.publish === true)
    .map(weekly => String(weekly.slug))
  assertSameSet(
    radarWeeklies.map(weekly => weekly.slug),
    publishedWeeklySlugs,
    'generated reviewed weekly radar slugs',
  )
})

test('sitemap exactly represents canonical public router routes and generated records', () => {
  const entries = sitemapEntries()
  const actualRoutes = entries.map(routeFromSitemapUrl)
  const expectedRoutes = expectedSitemapRoutes()

  assert.ok(entries.length > 0, 'sitemap must contain at least one URL')
  assertSameSet(actualRoutes, expectedRoutes, 'sitemap routes')
  assert.ok(!actualRoutes.includes('/404'), 'the noindex 404 page must not be indexed in the sitemap')

  const legacyProjectRoutes = projects.flatMap(project =>
    [project.id, ...project.legacyIds].map(id => `/projects/${id}`),
  )
  for (const legacyRoute of legacyProjectRoutes) {
    assert.ok(!actualRoutes.includes(legacyRoute), `legacy project alias must not be indexed: ${legacyRoute}`)
  }
})

test('robots.txt exposes one canonical sitemap without blocking public pages', () => {
  const robots = read('public/robots.txt')
  const sitemapDirectives = robots.match(/^Sitemap:\s*(\S+)\s*$/gim) || []

  assert.match(robots, /^User-agent:\s*\*\s*$/im)
  assert.match(robots, /^Allow:\s*\/\s*$/im)
  assert.doesNotMatch(robots, /^Disallow:\s*\/\s*$/im)
  assert.deepEqual(sitemapDirectives.map(directive => directive.trim()), [`Sitemap: ${SITE_ORIGIN}/sitemap.xml`])
})

test('every sitemap route has fresh local static metadata and one canonical URL', () => {
  assert.ok(
    existsSync(join(DIST_ROOT, 'index.html')),
    'dist/index.html is missing; run npm run build before this build-artifact contract',
  )

  const expectedMetadata = expectedMetadataByRoute()
  const routes = sitemapEntries().map(routeFromSitemapUrl)
  assertSameSet(routes, [...expectedMetadata.keys()], 'static metadata routes')

  for (const route of routes) {
    const outputPath = builtPagePath(route)
    assert.ok(existsSync(outputPath), `static meta page is missing for ${route}: ${outputPath}`)
    const meta = inspectMeta(readFileSync(outputPath, 'utf8'), outputPath)
    const expected = expectedMetadata.get(route)

    assert.equal(meta.title, expected.title, `${route} must use data-backed title metadata`)
    assert.equal(meta.description, expected.description, `${route} must use data-backed description metadata`)
    assert.equal(meta.canonical, expectedCanonical(route), `${route} must use its canonical public URL`)
    if (meta.robots) {
      assert.doesNotMatch(meta.robots, /\bnoindex\b/, `${route} must remain indexable`)
      assert.doesNotMatch(meta.robots, /\bnofollow\b/, `${route} must remain followable`)
    }
  }
})

test('legacy project static pages canonicalize to the public slug', () => {
  for (const project of projects) {
    for (const id of [project.id, ...project.legacyIds]) {
      const legacyRoute = `/projects/${id}`
      const outputPath = builtPagePath(legacyRoute)
      assert.ok(existsSync(outputPath), `legacy project page is missing: ${legacyRoute}`)
      const meta = inspectMeta(readFileSync(outputPath, 'utf8'), outputPath)
      assert.equal(meta.canonical, `${SITE_ORIGIN}/projects/${project.slug}`)
    }
  }
})

test('unknown paths render a noindex 404 page instead of redirecting to home', () => {
  const vercelConfig = JSON.parse(read('vercel.json'))
  const platformRoutingRules = JSON.stringify([
    ...(vercelConfig.routes || []),
    ...(vercelConfig.rewrites || []),
  ])
  assert.doesNotMatch(
    platformRoutingRules,
    /"(?:dest|destination)"\s*:\s*"\/?index\.html"/,
    'Vercel must not rewrite unknown paths to the home document with HTTP 200',
  )

  const routerSource = read('src/router/index.ts')
  const catchAllStart = routerSource.indexOf("path: '/:pathMatch(.*)*'")
  assert.notEqual(catchAllStart, -1, 'router must retain an explicit catch-all route')

  const catchAllContract = routerSource.slice(catchAllStart, catchAllStart + 320)
  assert.match(catchAllContract, /name:\s*['"]not-found['"]/)
  assert.match(catchAllContract, /component:\s*\(\)\s*=>\s*import\(['"]\.\.\/pages\/NotFoundPage\.vue['"]\)/)
  assert.doesNotMatch(catchAllContract, /\bredirect\s*:/, 'unknown paths must not silently redirect to home')

  const notFoundPath = join(ROOT, 'src/pages/NotFoundPage.vue')
  assert.ok(existsSync(notFoundPath), 'src/pages/NotFoundPage.vue must exist')
  const notFoundSource = readFileSync(notFoundPath, 'utf8')
  assert.equal((notFoundSource.match(/<h1\b/g) || []).length, 1, '404 page must contain one h1')
  assert.match(notFoundSource, />页面没有找到</)
  assert.match(notFoundSource, /title:\s*['"]页面没有找到｜xiuqiu['"]/)
  assert.match(notFoundSource, /path:\s*['"]\/404['"]/)
  assert.match(
    notFoundSource,
    /(?:robots:\s*|setAttribute\(\s*['"]content['"]\s*,\s*)['"]noindex,\s*nofollow['"]/,
  )
  assert.match(
    notFoundSource,
    /\bon(?:Before)?Unmount(?:ed)?\s*\(/,
    '404 robots metadata must be cleaned up when leaving the page',
  )
  assert.match(notFoundSource, /robotsMeta\.remove\(\)/, '404 robots metadata cleanup must remove the route tag')

  const static404Path = builtPagePath('/404')
  assert.ok(existsSync(static404Path), 'dist/404/index.html must be generated by npm run build')
  const static404Meta = inspectMeta(readFileSync(static404Path, 'utf8'), static404Path)
  assert.equal(static404Meta.title, '页面没有找到｜xiuqiu')
  assert.equal(static404Meta.canonical, `${SITE_ORIGIN}/404`)
  assert.equal(static404Meta.robots?.replaceAll(' ', ''), 'noindex,nofollow')

  const platform404Path = join(DIST_ROOT, '404.html')
  assert.ok(existsSync(platform404Path), 'dist/404.html must exist for Vercel filesystem 404 handling')
  const platform404Meta = inspectMeta(readFileSync(platform404Path, 'utf8'), platform404Path)
  assert.deepEqual(platform404Meta, static404Meta, 'client and platform 404 documents must share metadata')
})
