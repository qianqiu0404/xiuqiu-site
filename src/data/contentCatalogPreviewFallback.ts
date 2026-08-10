import { articleSummaries } from './articleSummaries.ts'
import type {
  ContentCatalogPreviewArticle,
  ContentCatalogPreviewPayload,
} from './contentCatalogPreviewContract.ts'

interface PublicFallbackArticle {
  slug: string
  title: string
  summary: string
  publishedAt: string
  updatedAt: string | null
}

function stableValue(value: unknown): unknown {
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

async function sha256Hex(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(stableValue(value)))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function buildContentCatalogStaticFallback({
  sourceCommit,
  publishedAt,
}: {
  sourceCommit: string
  publishedAt: string
}): Promise<ContentCatalogPreviewPayload> {
  const publicArticles: PublicFallbackArticle[] = articleSummaries.map(article => ({
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    publishedAt: article.date,
    updatedAt: article.updatedAt ?? null,
  }))
  const articles: ContentCatalogPreviewArticle[] = await Promise.all(publicArticles.map(async article => {
    const hashInput = article.updatedAt === null
      ? {
          slug: article.slug,
          title: article.title,
          summary: article.summary,
          publishedAt: article.publishedAt,
        }
      : article
    return {
      ...article,
      sourceCommit,
      sourceHash: await sha256Hex(hashInput),
      schemaVersion: 1,
    }
  }))
  articles.sort((left, right) => (
    right.publishedAt.localeCompare(left.publishedAt) || left.slug.localeCompare(right.slug)
  ))
  const catalogHash = await sha256Hex({
    sourceCommit,
    schemaVersion: 1,
    articles: articles
      .map(article => ({ slug: article.slug, sourceHash: article.sourceHash }))
      .sort((left, right) => left.slug.localeCompare(right.slug)),
  })
  return {
    articles,
    audit: {
      sourceCommit,
      catalogHash,
      schemaVersion: 1,
      articleCount: articles.length,
      publishedAt,
    },
  }
}
