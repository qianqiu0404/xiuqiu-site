import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { parseMarkdownFrontmatter, requireFields } from '../scripts/frontmatter.mjs'

const REQUIRED_FIELDS = [
  'id', 'slug', 'title', 'date', 'summary', 'tags', 'difficulty', 'conceptTags',
  'relatedProjectIds', 'recommendedSlugs', 'suggestedQuestions', 'kind',
]
const ARTICLE_KINDS = new Set(['engineering-note', 'research', 'learning-log'])
const EVIDENCE_LEVELS = new Set([
  'design', 'source-reviewed', 'local-verified', 'integrated', 'public-demo',
])
const KNOWLEDGE_TAGS = new Set([
  'wallet-backend', 'signer-service', 'multi-chain', 'go-infra', 'evm', 'mpc-tss',
  'api-design', 'ai-engineering',
])

export const PUBLIC_ARTICLE_FIELDS = Object.freeze([
  'slug', 'title', 'summary', 'publishedAt', 'updatedAt',
])

function requireString(value, field, sourceName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${sourceName}: ${field} must be a non-empty string.`)
  }
  return value.trim()
}

function requireStringArray(meta, field, sourceName) {
  if (!Array.isArray(meta[field]) || meta[field].some(value => typeof value !== 'string')) {
    throw new Error(`${sourceName}: ${field} must be a string array.`)
  }
  return meta[field].map(value => value.trim())
}

function requireNumberArray(meta, field, sourceName) {
  if (!Array.isArray(meta[field]) || meta[field].some(value => !Number.isInteger(value))) {
    throw new Error(`${sourceName}: ${field} must be an integer array.`)
  }
  return [...meta[field]]
}

function requireIsoDate(value, field, sourceName) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${sourceName}: ${field} must use YYYY-MM-DD.`)
  }
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${sourceName}: ${field} is not a valid calendar date.`)
  }
  return value
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)]),
    )
  }
  return value
}

export function deterministicMetadataHash(publicArticle) {
  return createHash('sha256').update(JSON.stringify(stableValue(publicArticle))).digest('hex')
}

export function deterministicCatalogHash({ sourceCommit, schemaVersion, articles }) {
  return createHash('sha256').update(JSON.stringify(stableValue({
    sourceCommit,
    schemaVersion,
    articles: articles
      .map(article => ({ slug: article.slug, sourceHash: article.sourceHash }))
      .sort((left, right) => left.slug.localeCompare(right.slug)),
  }))).digest('hex')
}

export function publicArticleDto(article) {
  return Object.fromEntries(
    PUBLIC_ARTICLE_FIELDS
      .filter(field => article[field] !== undefined && article[field] !== null)
      .map(field => [field, article[field]]),
  )
}

export function parseArticleSource(raw, sourceName) {
  const { meta, body } = parseMarkdownFrontmatter(raw, sourceName)
  requireFields(meta, REQUIRED_FIELDS, sourceName)

  const id = Number(meta.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new Error(`${sourceName}: id must be a positive safe integer.`)
  }

  const slug = requireString(meta.slug, 'slug', sourceName)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`${sourceName}: slug must use lowercase kebab-case.`)
  }

  const kind = requireString(meta.kind, 'kind', sourceName)
  if (!ARTICLE_KINDS.has(kind)) throw new Error(`${sourceName}: unknown article kind ${kind}.`)

  requireStringArray(meta, 'tags', sourceName)
  const conceptTags = requireStringArray(meta, 'conceptTags', sourceName)
  const relatedProjectIds = requireNumberArray(meta, 'relatedProjectIds', sourceName)
  const recommendedSlugs = requireStringArray(meta, 'recommendedSlugs', sourceName)
  const suggestedQuestions = requireStringArray(meta, 'suggestedQuestions', sourceName)
  conceptTags.forEach(tag => {
    if (!KNOWLEDGE_TAGS.has(tag)) throw new Error(`${sourceName}: unknown concept tag ${tag}.`)
  })

  const publishedAt = requireIsoDate(meta.date, 'date', sourceName)
  const updatedAt = meta.updatedAt === undefined
    ? undefined
    : requireIsoDate(meta.updatedAt, 'updatedAt', sourceName)
  if (updatedAt && updatedAt < publishedAt) {
    throw new Error(`${sourceName}: updatedAt cannot be earlier than date.`)
  }

  if (kind === 'engineering-note') {
    requireFields(meta, ['evidenceLevel', 'evidenceSummary'], sourceName)
    const evidenceLevel = requireString(meta.evidenceLevel, 'evidenceLevel', sourceName)
    requireString(meta.evidenceSummary, 'evidenceSummary', sourceName)
    if (!EVIDENCE_LEVELS.has(evidenceLevel)) {
      throw new Error(`${sourceName}: unknown evidenceLevel ${evidenceLevel}.`)
    }
  }

  const hasSeries = meta.series !== undefined
  const hasSeriesOrder = meta.seriesOrder !== undefined
  if (hasSeries !== hasSeriesOrder) {
    throw new Error(`${sourceName}: series and seriesOrder must be provided together.`)
  }
  if (hasSeries) requireString(meta.series, 'series', sourceName)
  if (hasSeriesOrder && (!Number.isInteger(meta.seriesOrder) || meta.seriesOrder < 1)) {
    throw new Error(`${sourceName}: seriesOrder must be a positive integer.`)
  }
  if (!body) throw new Error(`${sourceName}: article body is empty.`)

  const publicArticle = publicArticleDto({
    slug,
    title: requireString(meta.title, 'title', sourceName),
    summary: requireString(meta.summary, 'summary', sourceName),
    publishedAt,
    updatedAt,
  })

  return {
    id,
    ...publicArticle,
    sourcePath: sourceName,
    sourceHash: deterministicMetadataHash(publicArticle),
    privateMetadata: { conceptTags, relatedProjectIds, recommendedSlugs, suggestedQuestions },
  }
}

export function readArticleCatalog(contentDir) {
  if (!existsSync(contentDir)) throw new Error(`Article source directory does not exist: ${contentDir}`)
  const files = readdirSync(contentDir).filter(file => file.endsWith('.md')).sort()
  if (files.length === 0) throw new Error('No Markdown articles found in the article source directory.')

  const articles = files.map(file => parseArticleSource(readFileSync(new URL(file, contentDir), 'utf8'), file))
  const ids = new Set()
  const slugs = new Set()

  articles.forEach(article => {
    if (ids.has(article.id)) throw new Error(`Duplicate article id: ${article.id}`)
    if (slugs.has(article.slug)) throw new Error(`Duplicate article slug: ${article.slug}`)
    ids.add(article.id)
    slugs.add(article.slug)
  })

  articles.forEach(article => {
    if (article.sourcePath !== `${article.slug}.md`) {
      throw new Error(`${article.sourcePath}: filename must match article slug ${article.slug}.md.`)
    }
    article.privateMetadata.recommendedSlugs.forEach(slug => {
      if (!slugs.has(slug)) throw new Error(`${article.slug}: recommended article does not exist: ${slug}`)
    })
  })

  return articles.sort((left, right) => left.slug.localeCompare(right.slug))
}
