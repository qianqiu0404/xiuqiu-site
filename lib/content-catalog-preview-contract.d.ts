export interface ContentCatalogPreviewArticle {
  slug: string
  title: string
  summary: string
  publishedAt: string
  updatedAt: string | null
  sourceCommit: string
  sourceHash: string
  schemaVersion: number
}

export interface ContentCatalogPreviewAudit {
  sourceCommit: string
  catalogHash: string
  schemaVersion: number
  articleCount: number
  publishedAt: string
}

export interface ContentCatalogPreviewPayload {
  articles: ContentCatalogPreviewArticle[]
  audit: ContentCatalogPreviewAudit
}

export function normalizeContentCatalogPreviewPayload(
  value: unknown,
): ContentCatalogPreviewPayload | undefined
