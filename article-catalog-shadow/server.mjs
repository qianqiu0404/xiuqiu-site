import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import {
  parseArticleCatalogKeys,
  verifyArticleCatalogRequest,
} from '../lib/article-catalog-auth.js'
import { queryJson } from './postgres.mjs'

const FAILURE_HEADERS = {
  'cache-control': 'no-store',
  connection: 'close',
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'x-robots-tag': 'noindex, nofollow',
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

const ALLOWED_TARGETS = new Set(['/health', '/v1/public/articles'])

export function createArticleCatalogServer({
  databaseUrl,
  hmacKeys = parseArticleCatalogKeys(process.env.ARTICLE_CATALOG_HMAC_KEYS_JSON),
  replayCache = new Map(),
  now = () => Date.now(),
} = {}) {
  return createServer((request, response) => {
    const target = request.url || ''
    if (!ALLOWED_TARGETS.has(target)) {
      sendJson(response, 404, { error: 'Not found.' })
      return
    }
    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'Method not allowed.' }, { ...FAILURE_HEADERS, allow: 'GET' })
      return
    }
    if (Object.keys(hmacKeys).length === 0) {
      sendJson(response, 503, { error: 'Article catalog unavailable.' })
      return
    }
    const authentication = verifyArticleCatalogRequest({
      keys: hmacKeys,
      method: request.method,
      target,
      body: '',
      headers: request.headers,
      now: now(),
      replayCache,
    })
    if (!authentication.ok) {
      const replayed = authentication.code === 'replayed_signature'
      sendJson(response, replayed ? 409 : 401, {
        error: replayed ? 'Request already used.' : 'Authentication failed.',
      })
      return
    }
    if (!databaseUrl) {
      sendJson(response, 503, { error: 'Article catalog unavailable.' })
      return
    }

    try {
      const catalog = queryPublicCatalog(databaseUrl)
      const body = target === '/health'
        ? {
            status: 'ok',
            service: 'article-catalog-shadow',
            articleCount: catalog.audit.articleCount,
            schemaVersion: catalog.audit.schemaVersion,
          }
        : catalog
      sendJson(response, 200, body, {
        'cache-control': 'no-store',
        connection: 'close',
        'content-type': 'application/json; charset=utf-8',
        'x-content-type-options': 'nosniff',
        'x-robots-tag': 'noindex, nofollow',
      })
    } catch {
      sendJson(response, 503, { error: 'Article catalog unavailable.' })
    }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.ARTICLE_CATALOG_PORT || 4318)
  const server = createArticleCatalogServer({
    databaseUrl: process.env.ARTICLE_CATALOG_DATABASE_URL,
    hmacKeys: parseArticleCatalogKeys(process.env.ARTICLE_CATALOG_HMAC_KEYS_JSON),
  })
  server.listen(port, '127.0.0.1', () => {
    console.log(`Article Catalog Shadow listening on http://127.0.0.1:${port}`)
  })
}
