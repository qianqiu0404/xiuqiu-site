import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { articleSummaries } from '../src/data/generatedArticleKnowledge.ts'
import { projects } from '../src/data/generatedProjects.ts'
import { dailyRadars } from '../src/data/generatedRadars.ts'
import { radarWeeklies } from '../src/data/generatedRadarWeeklies.ts'
import { deliveryRecords } from '../src/data/generatedDeliveries.ts'
import { nowSnapshot } from '../src/data/generatedNow.ts'

const SITE_URL = 'https://xiuqiu-site.vercel.app'
const distIndexUrl = new URL('../dist/index.html', import.meta.url)

if (!existsSync(distIndexUrl)) {
  throw new Error('dist/index.html does not exist. Run vite build before generating meta pages.')
}

const baseHtml = readFileSync(distIndexUrl, 'utf8')

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function jsonLdScript(data) {
  const json = JSON.stringify(data).replaceAll('<', '\\u003c')
  return `<script type="application/ld+json" data-site-meta>${json}</script>`
}

function replaceMeta(html, { title, description, path, type = 'website', structuredData, robots }) {
  const escapedTitle = escapeHtml(title)
  const escapedDescription = escapeHtml(description)
  const escapedUrl = escapeHtml(`${SITE_URL}${path}`)
  const generatedHead = [
    structuredData ? jsonLdScript(structuredData) : '',
    robots ? `<meta name="robots" content="${escapeHtml(robots)}" data-site-meta />` : '',
  ].filter(Boolean)
  const robotsPattern = robots
    ? /\s*<meta\b(?=[^>]*\bname=["']robots["'])[^>]*\/?>/gi
    : /\s*<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bdata-site-meta\b)[^>]*\/?>/gi
  const withoutGeneratedMeta = html
    .replace(/\s*<script type="application\/ld\+json" data-site-meta>[\s\S]*?<\/script>/g, '')
    .replace(robotsPattern, '')
  const withGeneratedMeta = generatedHead.length
    ? withoutGeneratedMeta.replace('</head>', `    ${generatedHead.join('\n    ')}\n  </head>`)
    : withoutGeneratedMeta

  return withGeneratedMeta
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapedTitle}</title>`)
    .replace(
      /<meta name="description" content="[\s\S]*?" \/>/,
      `<meta name="description" content="${escapedDescription}" />`,
    )
    .replace(
      /<meta property="og:title" content="[\s\S]*?" \/>/,
      `<meta property="og:title" content="${escapedTitle}" />`,
    )
    .replace(
      /<meta property="og:description" content="[\s\S]*?" \/>/,
      `<meta property="og:description" content="${escapedDescription}" />`,
    )
    .replace(/<meta property="og:type" content="[\s\S]*?" \/>/, `<meta property="og:type" content="${type}" />`)
    .replace(/<meta property="og:url" content="[\s\S]*?" \/>/, `<meta property="og:url" content="${escapedUrl}" />`)
    .replace(
      /<meta name="twitter:title" content="[\s\S]*?" \/>/,
      `<meta name="twitter:title" content="${escapedTitle}" />`,
    )
    .replace(
      /<meta name="twitter:description" content="[\s\S]*?" \/>/,
      `<meta name="twitter:description" content="${escapedDescription}" />`,
    )
    .replace(/<link rel="canonical" href="[\s\S]*?" \/>/, `<link rel="canonical" href="${escapedUrl}" />`)
}

let generatedRouteCount = 0

function writePage(path, html) {
  const normalizedPath = path === '/' ? '/index' : path
  const outputUrl = new URL(`../dist${normalizedPath}/index.html`, import.meta.url)
  mkdirSync(dirname(fileURLToPath(outputUrl)), { recursive: true })
  writeFileSync(outputUrl, html)
  generatedRouteCount += 1
}

if (articleSummaries.length === 0) {
  throw new Error('No article summaries found for static meta page generation.')
}

const writingDescription = `${articleSummaries.length} 篇关于交易所钱包、多链模型、签名服务、Go 后端与 AI 工程工作流的学习笔记。`

writePage(
  '/projects',
  replaceMeta(baseHtml, {
    title: '项目图谱｜xiuqiu',
    description: '先进入 Wallet Launchpad 与 Qiu Market 两个产品主页，再按证据层级浏览其他 Web3 与 AI 工程项目。',
    path: '/projects',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: '项目图谱｜xiuqiu',
      url: `${SITE_URL}/projects`,
      author: { '@type': 'Person', name: 'xiuqiu' },
    },
  }),
)

writePage(
  '/engineering',
  replaceMeta(baseHtml, {
    title: '工程证据索引｜xiuqiu',
    description: '从证据矩阵、失败恢复手册和项目档案复核 xiuqiu 的 Web3 钱包与工程实践边界。',
    path: '/engineering',
  }),
)

writePage(
  '/engineering/failures',
  replaceMeta(baseHtml, {
    title: '钱包异常恢复手册｜xiuqiu',
    description: '30 个钱包后端核心异常，按资金事实、止损动作、排查证据、恢复步骤和当前证据边界组织。',
    path: '/engineering/failures',
  }),
)

writePage(
  '/engineering/evidence',
  replaceMeta(baseHtml, {
    title: '工程证据覆盖｜xiuqiu',
    description: '按工程实现、自动化测试、可运行演示和公开说明查看钱包工程证据与当前边界。',
    path: '/engineering/evidence',
  }),
)

writePage(
  '/ai',
  replaceMeta(baseHtml, {
    title: 'AI Engineering OS｜xiuqiu',
    description: 'AI 参与定义、执行、审查与验证；真实交付、人工门禁和工程证据共同决定结果。',
    path: '/ai',
  }),
)

writePage(
  '/ai/social-research',
  replaceMeta(baseHtml, {
    title: 'Social Media Research Skill｜xiuqiu',
    description: 'MediaCrawler 本地采集与 TikHub 付费确认回退组成的双后端社交媒体研究工作流。',
    path: '/ai/social-research',
  }),
)

writePage(
  '/ai/deliveries',
  replaceMeta(baseHtml, {
    title: 'AI 协作交付记录｜xiuqiu',
    description: '真实任务中的 AI 参与、人工判断、审查纠正、验证结果与公开交付。',
    path: '/ai/deliveries',
  }),
)

writePage(
  '/now',
  replaceMeta(baseHtml, {
    title: '当前动态｜xiuqiu',
    description: nowSnapshot.summary,
    path: '/now',
  }),
)

writePage(
  '/learning',
  replaceMeta(baseHtml, {
    title: '学习复盘｜xiuqiu',
    description: '按阶段归档的 Web3 钱包工程学习结论、验证证据与下一步。',
    path: '/learning',
  }),
)

writePage(
  '/radar',
  replaceMeta(baseHtml, {
    title: '行业情报雷达｜xiuqiu',
    description: '面向 Web3 钱包与 AI 工程的每日行业简报、人工复核周度收敛和可追溯历史档案。',
    path: '/radar',
    structuredData: {
      '@context': 'https://schema.org', '@type': 'CollectionPage', name: '行业情报雷达｜xiuqiu',
      url: `${SITE_URL}/radar`, author: { '@type': 'Person', name: 'xiuqiu' },
    },
  }),
)

writePage(
  '/articles',
  replaceMeta(baseHtml, {
    title: '工程笔记｜xiuqiu Web3 钱包学习档案',
    description: writingDescription,
    path: '/articles',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: '工程笔记｜xiuqiu Web3 钱包学习档案',
      description: writingDescription,
      url: `${SITE_URL}/articles`,
      author: {
        '@type': 'Person',
        name: 'xiuqiu',
      },
    },
  }),
)

articleSummaries.forEach(article => {
  writePage(
    `/articles/${article.slug}`,
    replaceMeta(baseHtml, {
      title: `${article.title}｜xiuqiu 工程笔记`,
      description: article.summary,
      path: `/articles/${article.slug}`,
      type: 'article',
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: article.summary,
        datePublished: article.date,
        author: {
          '@type': 'Person',
          name: 'xiuqiu',
        },
        url: `${SITE_URL}/articles/${article.slug}`,
        mainEntityOfPage: `${SITE_URL}/articles/${article.slug}`,
      },
    }),
  )
})

projects.forEach(project => {
  writePage(
    `/projects/${project.slug}`,
    replaceMeta(baseHtml, {
      title: `${project.name}｜xiuqiu 工程项目`,
      description: project.positioning,
      path: `/projects/${project.slug}`,
    }),
  )

  ;[project.id, ...project.legacyIds].forEach(id => {
    writePage(
      `/projects/${id}`,
      replaceMeta(baseHtml, {
        title: `${project.name}｜xiuqiu 工程项目`,
        description: project.positioning,
        path: `/projects/${project.slug}`,
      }),
    )
  })
})

dailyRadars.forEach(radar => {
  writePage(
    `/radar/${radar.slug}`,
    replaceMeta(baseHtml, {
      title: `${radar.title}｜xiuqiu`, description: radar.summary, path: `/radar/${radar.slug}`, type: 'article',
      structuredData: {
        '@context': 'https://schema.org', '@type': 'Article', headline: radar.title, description: radar.summary,
        datePublished: radar.date, author: { '@type': 'Person', name: 'xiuqiu' },
        url: `${SITE_URL}/radar/${radar.slug}`, mainEntityOfPage: `${SITE_URL}/radar/${radar.slug}`,
      },
    }),
  )
})

radarWeeklies.forEach(weekly => {
  writePage(
    `/radar/week/${weekly.slug}`,
    replaceMeta(baseHtml, {
      title: `${weekly.title}｜xiuqiu`,
      description: weekly.summary,
      path: `/radar/week/${weekly.slug}`,
      type: 'article',
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: weekly.title,
        description: weekly.summary,
        datePublished: weekly.reviewedAt,
        author: { '@type': 'Person', name: 'xiuqiu' },
        url: `${SITE_URL}/radar/week/${weekly.slug}`,
        mainEntityOfPage: `${SITE_URL}/radar/week/${weekly.slug}`,
      },
    }),
  )
})

deliveryRecords.forEach(record => {
  writePage(
    `/ai/deliveries/${record.slug}`,
    replaceMeta(baseHtml, {
      title: `${record.title}｜AI 交付记录`, description: record.summary,
      path: `/ai/deliveries/${record.slug}`, type: 'article',
      structuredData: {
        '@context': 'https://schema.org', '@type': 'TechArticle', headline: record.title,
        description: record.summary, datePublished: record.date,
        author: { '@type': 'Person', name: 'xiuqiu' },
        url: `${SITE_URL}/ai/deliveries/${record.slug}`,
        mainEntityOfPage: `${SITE_URL}/ai/deliveries/${record.slug}`,
      },
    }),
  )
})

const notFoundHtml = replaceMeta(baseHtml, {
  title: '页面没有找到｜xiuqiu',
  description: '这个页面不存在、已移动或尚未公开。请返回项目图谱、工程证据或网站首页继续浏览。',
  path: '/404',
  robots: 'noindex, nofollow',
})
writePage('/404', notFoundHtml)
writeFileSync(new URL('../dist/404.html', import.meta.url), notFoundHtml)

console.log(`Generated static meta pages for ${generatedRouteCount} routes.`)
