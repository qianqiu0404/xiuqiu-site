import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  deterministicCatalogHash,
  deterministicMetadataHash,
  publicArticleDto,
  readArticleCatalog,
} from './article-source.mjs'
import { queryJson, runPsql } from './postgres.mjs'

const DEFAULT_CONTENT_DIR = new URL('../content/articles/', import.meta.url)
const REPOSITORY_DIR = fileURLToPath(new URL('../', import.meta.url))
const SCHEMA_VERSION = 1

function sqlText(value) {
  return value === undefined || value === null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`
}

function normalizeDatabaseArticle(row) {
  return publicArticleDto({
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt ?? undefined,
  })
}

function readDatabaseArticles(databaseUrl) {
  return queryJson(databaseUrl, `
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'slug', slug,
      'title', title,
      'summary', summary,
      'publishedAt', published_on,
      'updatedAt', updated_on,
      'sourceCommit', source_commit,
      'sourceHash', source_hash,
      'schemaVersion', schema_version
    ) ORDER BY slug), '[]'::jsonb)::text
    FROM article_catalog.articles;
  `)
}

function assertDatabaseIntegrity(existing) {
  existing.forEach(row => {
    const expected = deterministicMetadataHash(normalizeDatabaseArticle(row))
    if (row.sourceHash !== expected) {
      throw new Error(`Database metadata hash drift detected for article ${row.slug}; import refused.`)
    }
    if (Number(row.schemaVersion) !== SCHEMA_VERSION) {
      throw new Error(`Unsupported schema version for article ${row.slug}; import refused.`)
    }
  })
}

function assertNonDestructive(existing, incoming) {
  const bySlug = new Map(incoming.map(article => [article.slug, article]))
  existing.forEach(row => {
    if (!bySlug.has(row.slug)) {
      throw new Error(`Article deletion or slug rename detected for ${row.slug}; import refused.`)
    }
  })
}

function resolveSourceCommit(explicitCommit, requireCleanGitSource) {
  if (!explicitCommit && requireCleanGitSource) {
    const changes = execFileSync(
      'git',
      ['status', '--porcelain=v1', '--untracked-files=all', '--', 'content/articles'],
      { cwd: REPOSITORY_DIR, encoding: 'utf8' },
    ).trim()
    if (changes) {
      throw new Error('content/articles has tracked or untracked changes; import refused before HEAD attribution.')
    }
  }
  const commit = explicitCommit || execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: REPOSITORY_DIR,
    encoding: 'utf8',
  }).trim()
  if (!/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error('sourceCommit must be a complete 40-character lowercase Git SHA.')
  }
  return commit
}

function articleValueTuple(article, sourceCommit) {
  return `(
    ${sqlText(article.slug)}, ${sqlText(article.title)}, ${sqlText(article.summary)},
    ${sqlText(article.publishedAt)}::date,
    ${article.updatedAt ? `${sqlText(article.updatedAt)}::date` : 'NULL'},
    ${sqlText(sourceCommit)}, ${sqlText(article.sourceHash)}, ${SCHEMA_VERSION}
  )`
}

function catalogUpsertSql(incoming, sourceCommit, catalogHash) {
  return `
    WITH inserted_publication AS (
      INSERT INTO article_catalog.publication_runs (
        source_commit, catalog_hash, schema_version, article_count
      )
      VALUES (${sqlText(sourceCommit)}, ${sqlText(catalogHash)}, ${SCHEMA_VERSION}, ${incoming.length})
      ON CONFLICT (catalog_hash) DO NOTHING
      RETURNING id
    ),
    publication AS (
      SELECT id FROM inserted_publication
      UNION ALL
      SELECT id FROM article_catalog.publication_runs
      WHERE catalog_hash = ${sqlText(catalogHash)}
      LIMIT 1
    ),
    incoming (slug, title, summary, published_on, updated_on, source_commit, source_hash, schema_version) AS (
      VALUES ${incoming.map(article => articleValueTuple(article, sourceCommit)).join(',\n')}
    )
    INSERT INTO article_catalog.articles (
      slug, title, summary, published_on, updated_on,
      source_commit, source_hash, schema_version, publication_id
    )
    SELECT
      incoming.slug,
      incoming.title,
      incoming.summary,
      incoming.published_on,
      incoming.updated_on,
      incoming.source_commit,
      incoming.source_hash,
      incoming.schema_version,
      publication.id
    FROM incoming CROSS JOIN publication
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title,
      summary = EXCLUDED.summary,
      published_on = EXCLUDED.published_on,
      updated_on = EXCLUDED.updated_on,
      source_commit = EXCLUDED.source_commit,
      source_hash = EXCLUDED.source_hash,
      schema_version = EXCLUDED.schema_version,
      publication_id = EXCLUDED.publication_id
    WHERE (
      article_catalog.articles.title,
      article_catalog.articles.summary,
      article_catalog.articles.published_on,
      article_catalog.articles.updated_on,
      article_catalog.articles.source_commit,
      article_catalog.articles.source_hash,
      article_catalog.articles.schema_version,
      article_catalog.articles.publication_id
    ) IS DISTINCT FROM (
      EXCLUDED.title,
      EXCLUDED.summary,
      EXCLUDED.published_on,
      EXCLUDED.updated_on,
      EXCLUDED.source_commit,
      EXCLUDED.source_hash,
      EXCLUDED.schema_version,
      EXCLUDED.publication_id
    );
  `
}

export function importArticleCatalog({ databaseUrl, contentDir = DEFAULT_CONTENT_DIR, sourceCommit } = {}) {
  if (!databaseUrl) throw new Error('ARTICLE_CATALOG_DATABASE_URL is required for import.')
  const incoming = readArticleCatalog(contentDir)
  const existing = readDatabaseArticles(databaseUrl)
  assertDatabaseIntegrity(existing)
  assertNonDestructive(existing, incoming)
  const resolvedCommit = resolveSourceCommit(sourceCommit, String(contentDir) === String(DEFAULT_CONTENT_DIR))
  const catalogHash = deterministicCatalogHash({
    sourceCommit: resolvedCommit,
    schemaVersion: SCHEMA_VERSION,
    articles: incoming,
  })

  const existingBySlug = new Map(existing.map(article => [article.slug, article]))
  const inserted = incoming.filter(article => !existingBySlug.has(article.slug)).length
  const updated = incoming.filter(article => {
    const current = existingBySlug.get(article.slug)
    return current && (current.sourceHash !== article.sourceHash || current.sourceCommit !== resolvedCommit)
  }).length

  runPsql(databaseUrl, `
    BEGIN;
    ${catalogUpsertSql(incoming, resolvedCommit, catalogHash)}
    COMMIT;
  `)

  return { total: incoming.length, inserted, updated, unchanged: incoming.length - inserted - updated }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = importArticleCatalog({ databaseUrl: process.env.ARTICLE_CATALOG_DATABASE_URL })
    console.log(
      `Imported ${result.total} articles (${result.inserted} inserted, ${result.updated} updated, ${result.unchanged} unchanged).`,
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
