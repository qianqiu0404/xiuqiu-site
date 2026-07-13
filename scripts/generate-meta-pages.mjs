import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { articleSummaries } from '../src/data/generatedArticleKnowledge.ts'
import { projects } from '../src/data/generatedProjects.ts'

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

function replaceMeta(html, { title, description, path, type = 'website', structuredData }) {
  const escapedTitle = escapeHtml(title)
  const escapedDescription = escapeHtml(description)
  const escapedUrl = escapeHtml(`${SITE_URL}${path}`)
  const withoutGeneratedJsonLd = html.replace(/\s*<script type="application\/ld\+json" data-site-meta>[\s\S]*?<\/script>/g, '')
  const withStructuredData = structuredData
    ? withoutGeneratedJsonLd.replace('</head>', `    ${jsonLdScript(structuredData)}\n  </head>`)
    : withoutGeneratedJsonLd

  return withStructuredData
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

function writePage(path, html) {
  const normalizedPath = path === '/' ? '/index' : path
  const outputUrl = new URL(`../dist${normalizedPath}/index.html`, import.meta.url)
  mkdirSync(dirname(fileURLToPath(outputUrl)), { recursive: true })
  writeFileSync(outputUrl, html)
}

if (articleSummaries.length === 0) {
  throw new Error('No article summaries found for static meta page generation.')
}

const writingDescription = `${articleSummaries.length} 篇关于交易所钱包、多链模型、签名服务、Go 后端与 AI 工程工作流的学习笔记。`

writePage(
  '/engineering',
  replaceMeta(baseHtml, {
    title: '工程档案｜xiuqiu Web3 钱包后端',
    description: '面向技术面试官的交易所钱包工程档案：资金编排、风险控制、链交互、签名边界、失败场景和验证证据。',
    path: '/engineering',
  }),
)

writePage(
  '/ai',
  replaceMeta(baseHtml, {
    title: 'AI 协作｜xiuqiu 工程工作流',
    description: 'AI Coding 协作、Obsidian 知识系统与研究自动化三个可验证案例。',
    path: '/ai',
  }),
)

writePage(
  '/learning',
  replaceMeta(baseHtml, {
    title: '学习复盘｜xiuqiu',
    description: '精选公开的 Web3 钱包工程学习进度、验证证据、失败复盘与下一步。',
    path: '/learning',
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

const legacyProjectPages = projects.reduce((total, project) => total + 1 + project.legacyIds.length, 0)
console.log(`Generated static meta pages for ${articleSummaries.length + projects.length + legacyProjectPages + 4} routes.`)
