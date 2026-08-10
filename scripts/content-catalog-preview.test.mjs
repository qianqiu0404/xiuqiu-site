import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { handleContentCatalogPreview } from '../api/content-catalog-preview.ts'
import {
  verifyArticleCatalogRequest,
} from '../lib/article-catalog-auth.js'
import { deterministicMetadataHash } from '../article-catalog-shadow/article-source.mjs'
import { buildContentCatalogStaticFallback } from '../src/data/contentCatalogPreviewFallback.ts'
import { articleSummaries } from '../src/data/articleSummaries.ts'

const PREVIEW_NOW = 1_786_291_200_000
const PREVIEW_COMMIT = 'b'.repeat(40)
const PREVIEW_SECRET = 'preview-proxy-test-secret-that-is-long-enough'
const PREVIEW_KEY_ID = 'preview_2026_08'
const PREVIEW_NONCE = '3'.repeat(32)

function responseRecorder() {
  const headers = new Map()
  return {
    headers,
    statusCode: 0,
    body: undefined,
    setHeader(name, value) { headers.set(name.toLowerCase(), String(value)) },
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) { this.body = body },
    end() {},
  }
}

function setPreviewEnvironment() {
  process.env.VERCEL_ENV = 'preview'
  process.env.CONTENT_CATALOG_PREVIEW_ENABLED = 'true'
  process.env.ARTICLE_CATALOG_PREVIEW_UPSTREAM_URL = 'https://content-preview.example.test/'
  process.env.ARTICLE_CATALOG_PREVIEW_SECRET = PREVIEW_SECRET
  process.env.ARTICLE_CATALOG_PREVIEW_KEY_ID = PREVIEW_KEY_ID
}

function clearPreviewEnvironment() {
  for (const key of [
    'VERCEL_ENV',
    'CONTENT_CATALOG_PREVIEW_ENABLED',
    'ARTICLE_CATALOG_PREVIEW_UPSTREAM_URL',
    'ARTICLE_CATALOG_PREVIEW_SECRET',
    'ARTICLE_CATALOG_PREVIEW_KEY_ID',
  ]) delete process.env[key]
}

function validPayload() {
  return {
    articles: [{
      slug: 'public-article',
      title: 'Public article',
      summary: 'A public summary.',
      publishedAt: '2026-08-09',
      updatedAt: null,
      sourceCommit: PREVIEW_COMMIT,
      sourceHash: 'c'.repeat(64),
      schemaVersion: 1,
      content: 'PRIVATE_BODY_SENTINEL',
      privateFrontmatter: 'PRIVATE_FRONTMATTER_SENTINEL',
    }],
    audit: {
      sourceCommit: PREVIEW_COMMIT,
      catalogHash: 'd'.repeat(64),
      schemaVersion: 1,
      articleCount: 1,
      publishedAt: '2026-08-09T08:00:00.000Z',
      secret: 'PRIVATE_SECRET_SENTINEL',
    },
  }
}

test('Content Catalog Preview security and fallback contracts', async t => {
  t.after(clearPreviewEnvironment)

  await t.test('production, development, and disabled previews are indistinguishable 404s', async () => {
    const calls = []
    for (const environment of ['production', 'development', undefined]) {
      clearPreviewEnvironment()
      if (environment) process.env.VERCEL_ENV = environment
      process.env.CONTENT_CATALOG_PREVIEW_ENABLED = 'true'
      const response = responseRecorder()
      await handleContentCatalogPreview({ method: 'GET' }, response, {
        fetchImpl: async (...args) => { calls.push(args); throw new Error('must not fetch') },
      })
      assert.equal(response.statusCode, 404)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow')
      assert.deepEqual(response.body, { error: 'Not found.' })
    }
    clearPreviewEnvironment()
    process.env.VERCEL_ENV = 'preview'
    process.env.CONTENT_CATALOG_PREVIEW_ENABLED = 'false'
    const disabled = responseRecorder()
    await handleContentCatalogPreview({ method: 'GET' }, disabled, {
      fetchImpl: async (...args) => { calls.push(args); throw new Error('must not fetch') },
    })
    assert.equal(disabled.statusCode, 404)
    assert.equal(calls.length, 0)
  })

  await t.test('enabled preview enforces GET and local configuration', async () => {
    setPreviewEnvironment()
    const method = responseRecorder()
    await handleContentCatalogPreview({ method: 'POST' }, method)
    assert.equal(method.statusCode, 405)
    assert.equal(method.headers.get('allow'), 'GET')
    assert.equal(method.headers.get('cache-control'), 'no-store')

    delete process.env.ARTICLE_CATALOG_PREVIEW_SECRET
    const unavailable = responseRecorder()
    await handleContentCatalogPreview({ method: 'GET' }, unavailable)
    assert.equal(unavailable.statusCode, 503)
    assert.doesNotMatch(JSON.stringify(unavailable.body), /ARTICLE_CATALOG|PREVIEW_SECRET/)
  })

  await t.test('proxy signs the canonical upstream request and strips non-allowlisted fields', async () => {
    setPreviewEnvironment()
    let verified = false
    const response = responseRecorder()
    await handleContentCatalogPreview({ method: 'GET' }, response, {
      now: () => PREVIEW_NOW,
      nonce: PREVIEW_NONCE,
      fetchImpl: async (url, init) => {
        assert.equal(String(url), 'https://content-preview.example.test/v1/public/articles')
        assert.equal(init.method, 'GET')
        assert.equal(init.redirect, 'error')
        const verification = verifyArticleCatalogRequest({
          keys: { [PREVIEW_KEY_ID]: PREVIEW_SECRET },
          method: 'GET',
          target: '/v1/public/articles',
          body: '',
          headers: new Headers(init.headers),
          now: PREVIEW_NOW,
          replayCache: new Map(),
        })
        verified = verification.ok
        return new Response(JSON.stringify(validPayload()), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      },
    })
    assert.equal(verified, true)
    assert.equal(response.statusCode, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    assert.deepEqual(Object.keys(response.body.articles[0]).sort(), [
      'publishedAt', 'schemaVersion', 'slug', 'sourceCommit', 'sourceHash',
      'summary', 'title', 'updatedAt',
    ].sort())
    const serialized = JSON.stringify(response.body)
    assert.doesNotMatch(serialized, /PRIVATE_BODY_SENTINEL|PRIVATE_FRONTMATTER_SENTINEL|PRIVATE_SECRET_SENTINEL/)
    assert.doesNotMatch(serialized, new RegExp(PREVIEW_SECRET))
  })

  await t.test('upstream failures, invalid DTOs, and timeouts fail closed without caching', async () => {
    setPreviewEnvironment()
    const cases = [
      {
        expected: 502,
        fetchImpl: async () => new Response('upstream detail must not pass through', { status: 503 }),
      },
      {
        expected: 502,
        fetchImpl: async () => new Response('{not json', { status: 200 }),
      },
      {
        expected: 502,
        fetchImpl: async () => new Response(JSON.stringify({ articles: [], audit: {} }), { status: 200 }),
      },
      {
        expected: 504,
        timeoutMs: 5,
        fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const error = new Error('upstream timeout details')
            error.name = 'AbortError'
            reject(error)
          }, { once: true })
        }),
      },
    ]
    for (const scenario of cases) {
      const response = responseRecorder()
      await handleContentCatalogPreview({ method: 'GET' }, response, {
        fetchImpl: scenario.fetchImpl,
        timeoutMs: scenario.timeoutMs,
        now: () => PREVIEW_NOW,
      })
      assert.equal(response.statusCode, scenario.expected)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow')
      assert.deepEqual(response.body, { error: 'Content catalog preview is unavailable.' })
    }
  })

  await t.test('build-time Git fallback contains the complete public allowlist and matching hashes', async () => {
    const fallback = await buildContentCatalogStaticFallback({
      sourceCommit: PREVIEW_COMMIT,
      publishedAt: '2026-08-09T08:00:00.000Z',
    })
    assert.equal(fallback.audit.articleCount, articleSummaries.length)
    assert.equal(fallback.articles.length, articleSummaries.length)
    assert.equal(fallback.audit.sourceCommit, PREVIEW_COMMIT)
    assert.match(fallback.audit.catalogHash, /^[0-9a-f]{64}$/)
    for (const article of fallback.articles) {
      const expectedInput = {
        slug: article.slug,
        title: article.title,
        summary: article.summary,
        publishedAt: article.publishedAt,
        ...(article.updatedAt === null ? {} : { updatedAt: article.updatedAt }),
      }
      assert.equal(article.sourceHash, deterministicMetadataHash(expectedInput))
      assert.deepEqual(Object.keys(article).sort(), [
        'publishedAt', 'schemaVersion', 'slug', 'sourceCommit', 'sourceHash',
        'summary', 'title', 'updatedAt',
      ].sort())
    }
    const serialized = JSON.stringify(fallback)
    for (const forbidden of ['content', 'body', 'sourcePath', 'privateMetadata', 'suggestedQuestions']) {
      assert.doesNotMatch(serialized, new RegExp(`"${forbidden}"`))
    }
  })

  await t.test('route remains flag-only and absent from navigation, SEO, and sitemap sources', () => {
    const router = readFileSync(new URL('../src/router/index.ts', import.meta.url), 'utf8')
    const page = readFileSync(new URL('../src/pages/ContentCatalogPreviewPage.vue', import.meta.url), 'utf8')
    const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
    const sitemap = readFileSync(new URL('./generate-sitemap.mjs', import.meta.url), 'utf8')
    const meta = readFileSync(new URL('./generate-meta-pages.mjs', import.meta.url), 'utf8')
    const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
    assert.match(router, /import\.meta\.env\.VITE_CONTENT_CATALOG_PREVIEW === 'true'/)
    assert.match(router, /\['', 'content-catalog-preview'\]\.join\('\/'\)/)
    assert.doesNotMatch(app, /content-catalog-preview/)
    assert.doesNotMatch(sitemap, /content-catalog-preview/)
    assert.doesNotMatch(meta, /content-catalog-preview/)
    assert.doesNotMatch(page, /<main(?:\s|>)/)
    assert.match(page, /noindex, nofollow/)
    assert.match(page, /min-height:\s*44px/)
    assert.match(page, /prefers-reduced-motion:\s*reduce/)
    assert.match(page, /在线 · 已对齐/)
    assert.match(page, /在线 · 待同步/)
    assert.match(page, /离线 · 构建快照/)
    const previewHeaders = vercel.headers.find(entry => entry.source === '/content-catalog-preview')
    assert.ok(previewHeaders)
    assert.deepEqual(
      Object.fromEntries(previewHeaders.headers.map(header => [header.key.toLowerCase(), header.value])),
      { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' },
    )
  })
})
