export interface ArticleOrderEntry {
  id: number
  slug: string
  date: string
  updatedAt?: string
}

export const articleKindOptions = [
  { key: 'All', label: '全部', shortLabel: '全部' },
  { key: 'engineering-note', label: '工程笔记', shortLabel: '工程' },
  { key: 'research', label: '技术研究', shortLabel: '研究' },
  { key: 'learning-log', label: '学习复盘', shortLabel: '复盘' },
] as const

export interface ArticleIndexEntry extends ArticleOrderEntry {
  title: string
  summary: string
  kind: string
  tags: string[]
  conceptTags: string[]
  suggestedQuestions: string[]
  relatedProjectIds: number[]
  evidenceLevel?: string
  difficulty: string
  series?: string
  seriesOrder?: number
}

const articleEvidenceLabels: Record<string, string> = {
  design: '架构设计',
  'source-reviewed': '资料与代码复核',
  'local-verified': '本地已验证',
  integrated: '已集成验证',
  'public-demo': '公开可运行',
}

export function articleReadingRows<T extends ArticleIndexEntry>(
  articles: readonly T[],
  projects: readonly { id: number; name: string }[],
) {
  return sortArticlesForReading(articles).map(article => ({
    article,
    kindLabel: articleKindOptions.find(option => option.key === article.kind)?.label ?? article.kind,
    evidenceLabel: articleEvidenceLabels[article.evidenceLevel ?? ''] ?? article.difficulty,
    projectNames: projects.filter(project => article.relatedProjectIds.includes(project.id)).map(project => project.name),
    seriesLabel: article.series && article.seriesOrder
      ? `${article.series} · ${article.seriesOrder}/${articles.filter(item => item.series === article.series).length}`
      : undefined,
  }))
}

export function filterArticleRows<T extends { article: ArticleIndexEntry }>(
  rows: readonly T[],
  { kind = 'All', query = '' }: { kind?: string; query?: string },
): T[] {
  const keyword = query.trim().toLocaleLowerCase()
  return rows.filter(({ article }) => (kind === 'All' || article.kind === kind)
    && (!keyword || [article.title, article.summary, ...article.tags, ...article.conceptTags, ...article.suggestedQuestions]
      .join(' ').toLocaleLowerCase().includes(keyword)))
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
