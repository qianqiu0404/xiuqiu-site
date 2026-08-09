export interface ArticleOrderEntry {
  id: number
  slug: string
  date: string
  updatedAt?: string
}

export function sortArticlesForReading<T extends ArticleOrderEntry>(articles: readonly T[]): T[] {
  return [...articles].sort((a, b) =>
    b.date.localeCompare(a.date)
    || (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
    || b.id - a.id
    || a.slug.localeCompare(b.slug),
  )
}

export function getAdjacentArticles<T extends ArticleOrderEntry>(
  articles: readonly T[],
  currentSlug: string,
): { previous?: T; next?: T } {
  const ordered = sortArticlesForReading(articles)
  const index = ordered.findIndex(article => article.slug === currentSlug)
  if (index < 0) return {}
  return {
    previous: index > 0 ? ordered[index - 1] : undefined,
    next: index < ordered.length - 1 ? ordered[index + 1] : undefined,
  }
}
