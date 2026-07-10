# xiuqiu-site

项目驱动的 Web3 钱包后端公开学习档案，使用 Vue、Vite 和 Vercel Serverless Functions 构建。

## Architecture

- `content/articles/*.md`: Markdown article source files with JSON frontmatter.
- `src/data/generatedArticleKnowledge.ts`: generated lightweight article metadata for lists, search, AI context, and sitemap generation.
- `src/data/generatedArticles.ts`: generated full article content for article detail pages.
- `src/data/projects.ts`: project source data.
- `src/data/siteKnowledge.ts`: unified knowledge graph that connects projects, articles, tags, related reading, suggested questions, and the Engineering Map.
- `src/components/AiChatWidget.vue`: site-level DeepSeek chat widget with page context and quick prompts.
- `api/chat.ts`: Vercel Serverless proxy for DeepSeek. The browser never receives the API key.
- `scripts/generate-articles.mjs`: generates typed article data from Markdown files.
- `scripts/generate-sitemap.mjs`: generates `public/sitemap.xml` from article summaries.
- `scripts/validate-knowledge.mjs`: checks article metadata, project relations, Engineering Map references, and sitemap URLs stay in sync.

## Commands

```bash
npm run dev
npm run build
npm run preview
npm run generate:articles
npm run generate:sitemap
npm run check:knowledge
npm run typecheck:api
```

`npm run build` generates article data, regenerates the sitemap, validates knowledge links, type-checks the API and Vue app, builds Vite, and generates static article meta pages.

## Environment

Configure these in Vercel:

```env
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash
```

`DEEPSEEK_MODEL` is optional. The default is `deepseek-v4-flash`.

## Content Workflow

When adding a new article:

1. Create `content/articles/your-slug.md`.
2. Add JSON frontmatter with `id`, `slug`, `title`, `date`, `summary`, `tags`, `difficulty`, `conceptTags`, `relatedProjectIds`, `recommendedSlugs`, and `suggestedQuestions`.
3. Write the article body as Markdown below the frontmatter.
4. Run `npm run build`.

`readingTime` is optional. If omitted, it is generated from article length. `updatedAt` is optional and appears on the article detail page when present.

When adding a new project:

1. Add it to `src/data/projects.ts`.
2. Add project metadata in `src/data/siteKnowledge.ts`.
3. Reference the project from article frontmatter via `relatedProjectIds` when relevant.
3. Run `npm run build`.

## Public Learning Workflow

- Public learning records live in `content/learning/*.md` and must set `"publish": true` plus `"kind": "learning-log"` in JSON frontmatter.
- To curate records from Obsidian locally, run `npm run sync:learning -- "/absolute/path/to/vault"`.
- The sync script ignores every note without the explicit public markers. Hosted builds read committed site content only and never access the local Obsidian vault.
