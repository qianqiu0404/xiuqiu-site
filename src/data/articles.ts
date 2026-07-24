import type { ArticleKnowledge } from './generatedArticleKnowledge.ts'

export interface Article extends ArticleKnowledge {
  content: string
}

const articleSources = import.meta.glob('../../content/articles/*.md', {
  query: '?raw',
  import: 'default',
})

function extractBody(raw: string): string {
  const frontmatter = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/)
  return (frontmatter ? raw.slice(frontmatter[0].length) : raw).trim()
}

export async function loadArticleContent(slug: string): Promise<string | undefined> {
  const loader = articleSources[`../../content/articles/${slug}.md`]
  if (!loader) return undefined

  const raw = await loader()
  return extractBody(String(raw))
}
