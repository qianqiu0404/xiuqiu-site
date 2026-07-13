import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { parseMarkdownFrontmatter, requireFields } from './frontmatter.mjs'

const CONTENT_DIR = new URL('../content/articles/', import.meta.url)
const KNOWLEDGE_OUTPUT_URL = new URL('../src/data/generatedArticleKnowledge.ts', import.meta.url)
const ARTICLES_OUTPUT_URL = new URL('../src/data/generatedArticles.ts', import.meta.url)
const REQUIRED_FIELDS = [
  'id',
  'slug',
  'title',
  'date',
  'summary',
  'tags',
  'difficulty',
  'conceptTags',
  'relatedProjectIds',
  'recommendedSlugs',
  'suggestedQuestions',
  'kind',
]
const ARTICLE_KINDS = ['engineering-note', 'research', 'learning-log']
const EVIDENCE_LEVELS = ['design', 'source-reviewed', 'local-verified', 'integrated', 'public-demo']
const KNOWLEDGE_TAGS = [
  'wallet-backend',
  'signer-service',
  'multi-chain',
  'go-infra',
  'evm',
  'mpc-tss',
  'api-design',
  'ai-engineering',
]

if (!existsSync(CONTENT_DIR)) {
  throw new Error('content/articles does not exist.')
}

function escapeTs(value) {
  return JSON.stringify(value, null, 2)
}

function countWords(content) {
  const latinWords = content.match(/[A-Za-z0-9_]+/g) || []
  const cjkChars = content.match(/[\u4e00-\u9fff]/g) || []
  return latinWords.length + cjkChars.length
}

function getReadingTime(content, fallback) {
  if (typeof fallback === 'string' && fallback.trim()) return fallback.trim()
  const minutes = Math.max(1, Math.ceil(countWords(content) / 450))
  return `${minutes} min`
}

function assertArray(meta, field) {
  if (!Array.isArray(meta[field])) {
    throw new Error(`${meta.slug || 'Unknown article'}: ${field} must be an array.`)
  }
}

function parseArticle(fileName) {
  const fileUrl = new URL(fileName, CONTENT_DIR)
  const raw = readFileSync(fileUrl, 'utf8')
  const { meta, body } = parseMarkdownFrontmatter(raw, fileName)
  requireFields(meta, REQUIRED_FIELDS, fileName)

  ;['tags', 'conceptTags', 'relatedProjectIds', 'recommendedSlugs', 'suggestedQuestions'].forEach(field => {
    assertArray(meta, field)
  })

  meta.conceptTags.forEach(tag => {
    if (!KNOWLEDGE_TAGS.includes(tag)) {
      throw new Error(`${fileName}: unknown concept tag ${tag}.`)
    }
  })

  if (!ARTICLE_KINDS.includes(meta.kind)) {
    throw new Error(`${fileName}: unknown article kind ${meta.kind}.`)
  }

  if (meta.kind === 'engineering-note') {
    requireFields(meta, ['evidenceLevel', 'evidenceSummary'], fileName)
    if (!EVIDENCE_LEVELS.includes(meta.evidenceLevel)) {
      throw new Error(`${fileName}: unknown evidenceLevel ${meta.evidenceLevel}.`)
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) {
    throw new Error(`${fileName}: date must use YYYY-MM-DD.`)
  }

  if (meta.updatedAt && !/^\d{4}-\d{2}-\d{2}$/.test(meta.updatedAt)) {
    throw new Error(`${fileName}: updatedAt must use YYYY-MM-DD.`)
  }

  const content = body
  if (!content) {
    throw new Error(`${fileName}: article body is empty.`)
  }

  return {
    id: Number(meta.id),
    slug: String(meta.slug),
    title: String(meta.title),
    date: String(meta.date),
    updatedAt: meta.updatedAt ? String(meta.updatedAt) : undefined,
    summary: String(meta.summary),
    tags: meta.tags.map(String),
    readingTime: getReadingTime(content, meta.readingTime),
    difficulty: String(meta.difficulty),
    kind: String(meta.kind),
    evidenceLevel: meta.evidenceLevel ? String(meta.evidenceLevel) : undefined,
    evidenceSummary: meta.evidenceSummary ? String(meta.evidenceSummary) : undefined,
    conceptTags: meta.conceptTags.map(String),
    relatedProjectIds: meta.relatedProjectIds.map(Number),
    recommendedSlugs: meta.recommendedSlugs.map(String),
    suggestedQuestions: meta.suggestedQuestions.map(String),
    content,
  }
}

const files = readdirSync(CONTENT_DIR)
  .filter(file => file.endsWith('.md'))
  .sort()

if (files.length === 0) {
  throw new Error('No Markdown articles found in content/articles.')
}

const articles = files.map(parseArticle).sort((a, b) => a.id - b.id)
const slugs = new Set()
const ids = new Set()

articles.forEach(article => {
  if (slugs.has(article.slug)) throw new Error(`Duplicate article slug: ${article.slug}`)
  if (ids.has(article.id)) throw new Error(`Duplicate article id: ${article.id}`)
  slugs.add(article.slug)
  ids.add(article.id)
})

articles.forEach(article => {
  article.recommendedSlugs.forEach(slug => {
    if (!slugs.has(slug)) {
      throw new Error(`${article.slug}: recommended article does not exist: ${slug}`)
    }
  })
})

const articleKnowledge = articles.map(({ content, ...article }) => article)
const summaries = articles.map(({ content, conceptTags, relatedProjectIds, recommendedSlugs, suggestedQuestions, ...summary }) => summary)

const knowledgeTagType = KNOWLEDGE_TAGS.map(tag => `'${tag}'`).join(' | ')
const articleKindType = ARTICLE_KINDS.map(kind => `'${kind}'`).join(' | ')
const articleEvidenceType = EVIDENCE_LEVELS.map(level => `'${level}'`).join(' | ')
const knowledgeOutput = `/* eslint-disable */\n// Generated by scripts/generate-articles.mjs. Do not edit by hand.\n\nexport type ArticleConceptTag = ${knowledgeTagType}\nexport type ArticleKind = ${articleKindType}\nexport type ArticleEvidenceLevel = ${articleEvidenceType}\n\nexport interface ArticleSummary {\n  id: number\n  slug: string\n  title: string\n  date: string\n  updatedAt?: string\n  summary: string\n  tags: string[]\n  readingTime: string\n  difficulty: string\n  kind: ArticleKind\n  evidenceLevel?: ArticleEvidenceLevel\n  evidenceSummary?: string\n}\n\nexport interface ArticleKnowledge extends ArticleSummary {\n  conceptTags: ArticleConceptTag[]\n  relatedProjectIds: number[]\n  recommendedSlugs: string[]\n  suggestedQuestions: string[]\n}\n\nexport const articleKnowledge: ArticleKnowledge[] = ${escapeTs(articleKnowledge)}\n\nexport const articleSummaries: ArticleSummary[] = ${escapeTs(summaries)}\n`

const articlesOutput = `/* eslint-disable */\n// Generated by scripts/generate-articles.mjs. Do not edit by hand.\n\nimport type { ArticleKnowledge } from './generatedArticleKnowledge.ts'\n\nexport interface Article extends ArticleKnowledge {\n  content: string\n}\n\nexport const articles: Article[] = ${escapeTs(articles)}\n`

mkdirSync(new URL('../src/data/', import.meta.url), { recursive: true })
writeFileSync(KNOWLEDGE_OUTPUT_URL, knowledgeOutput)
writeFileSync(ARTICLES_OUTPUT_URL, articlesOutput)
console.log(`Generated ${articles.length} articles from content/articles.`)
