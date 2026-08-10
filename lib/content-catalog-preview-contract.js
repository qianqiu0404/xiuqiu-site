const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const SHA40 = /^[0-9a-f]{40}$/
const SHA64 = /^[0-9a-f]{64}$/
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeArticle(value) {
  if (!isRecord(value)) return undefined
  if (
    typeof value.slug !== 'string' || !SLUG.test(value.slug)
    || typeof value.title !== 'string' || !value.title.trim()
    || typeof value.summary !== 'string' || !value.summary.trim()
    || typeof value.publishedAt !== 'string' || !ISO_DATE.test(value.publishedAt)
    || !(value.updatedAt === null || (typeof value.updatedAt === 'string' && ISO_DATE.test(value.updatedAt)))
    || typeof value.sourceCommit !== 'string' || !SHA40.test(value.sourceCommit)
    || typeof value.sourceHash !== 'string' || !SHA64.test(value.sourceHash)
    || value.schemaVersion !== 1
  ) return undefined

  return {
    slug: value.slug,
    title: value.title.trim(),
    summary: value.summary.trim(),
    publishedAt: value.publishedAt,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null,
    sourceCommit: value.sourceCommit,
    sourceHash: value.sourceHash,
    schemaVersion: value.schemaVersion,
  }
}

function normalizeAudit(value) {
  if (!isRecord(value)) return undefined
  if (
    typeof value.sourceCommit !== 'string' || !SHA40.test(value.sourceCommit)
    || typeof value.catalogHash !== 'string' || !SHA64.test(value.catalogHash)
    || value.schemaVersion !== 1
    || !Number.isSafeInteger(value.articleCount) || Number(value.articleCount) < 0
    || typeof value.publishedAt !== 'string' || Number.isNaN(Date.parse(value.publishedAt))
  ) return undefined
  return {
    sourceCommit: value.sourceCommit,
    catalogHash: value.catalogHash,
    schemaVersion: value.schemaVersion,
    articleCount: Number(value.articleCount),
    publishedAt: value.publishedAt,
  }
}

export function normalizeContentCatalogPreviewPayload(value) {
  if (!isRecord(value) || !Array.isArray(value.articles)) return undefined
  const articles = value.articles.map(normalizeArticle)
  if (articles.some(article => !article)) return undefined
  const slugs = new Set(articles.map(article => article.slug))
  if (slugs.size !== articles.length) return undefined
  const audit = normalizeAudit(value.audit)
  if (!audit || audit.articleCount !== articles.length) return undefined
  if (articles.some(article => (
    article.sourceCommit !== audit.sourceCommit || article.schemaVersion !== audit.schemaVersion
  ))) return undefined
  return { articles, audit }
}
