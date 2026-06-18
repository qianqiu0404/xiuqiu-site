import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { articleSummaries } from '../src/data/generatedArticleKnowledge.ts'

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

const writingDescription = `Technical writing on wallet architecture, signer services, backend communication, EVM, and MPC/TSS. ${articleSummaries.length} articles available.`

writePage(
  '/articles',
  replaceMeta(baseHtml, {
    title: 'Writing | xiuqiu Web3 Wallet Engineering',
    description: writingDescription,
    path: '/articles',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Writing | xiuqiu Web3 Wallet Engineering',
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
      title: `${article.title} | xiuqiu Writing`,
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

console.log(`Generated static meta pages for ${articleSummaries.length + 1} routes.`)
