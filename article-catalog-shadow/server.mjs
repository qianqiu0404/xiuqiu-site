import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { queryJson } from './postgres.mjs'

const FAILURE_HEADERS = {
  'cache-control': 'no-store',
  connection: 'close',
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
}

export function queryPublicCatalog(databaseUrl) {
  return queryJson(databaseUrl, `
    SELECT jsonb_build_object(
      'articles', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'slug', slug,
          'title', title,
          'summary', summary,
          'publishedAt', published_on,
          'updatedAt', updated_on,
          'sourceCommit', source_commit,
          'sourceHash', source_hash,
          'schemaVersion', schema_version
        ) ORDER BY published_on DESC, slug)
        FROM article_catalog.public_articles
      ), '[]'::jsonb),
      'audit', COALESCE((
        SELECT jsonb_build_object(
          'sourceCommit', source_commit,
          'catalogHash', catalog_hash,
          'schemaVersion', schema_version,
          'articleCount', article_count,
          'publishedAt', published_at
        )
        FROM article_catalog.public_catalog_audit
      ), '{}'::jsonb)
    )::text;
  `)
}

function sendJson(response, statusCode, body, headers = FAILURE_HEADERS) {
  response.writeHead(statusCode, headers)
  response.end(JSON.stringify(body))
}

export function createArticleCatalogServer({ databaseUrl } = {}) {
  return createServer((request, response) => {
    if (request.url !== '/v1/public/articles') {
      sendJson(response, 404, { error: 'Not found.' })
      return
    }
    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Method not allowed.' }, { ...FAILURE_HEADERS, allow: 'GET' })
      return
    }
    if (!databaseUrl) {
      sendJson(response, 503, { error: 'Article catalog unavailable.' })
      return
    }

    try {
      sendJson(response, 200, queryPublicCatalog(databaseUrl), {
        'cache-control': 'no-store',
        connection: 'close',
        'content-type': 'application/json; charset=utf-8',
        'x-content-type-options': 'nosniff',
      })
    } catch {
      sendJson(response, 503, { error: 'Article catalog unavailable.' })
    }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.ARTICLE_CATALOG_PORT || 4318)
  const server = createArticleCatalogServer({ databaseUrl: process.env.ARTICLE_CATALOG_DATABASE_URL })
  server.listen(port, '127.0.0.1', () => {
    console.log(`Article Catalog Shadow listening on http://127.0.0.1:${port}`)
  })
}
