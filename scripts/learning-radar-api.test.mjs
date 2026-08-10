import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  createLearningRadarHandler,
  LEARNING_RADAR_ROUTE_QUERY,
} from '../lib/learning-radar/http-handlers.ts'
import {
  allowMethods,
  clampInteger,
  preparePublicResponse,
  queryValue,
  sendPublicError,
} from '../lib/market-radar/http.ts'

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))

function createResponse() {
  const headers = new Map()
  const result = { statusCode: 0, body: undefined, headers }
  return {
    result,
    response: {
      setHeader(name, value) { headers.set(name.toLowerCase(), String(value)) },
      status(statusCode) {
        result.statusCode = statusCode
        return {
          json(body) { result.body = body },
          end() {},
        }
      },
    },
  }
}

function createFixture(overrides = {}) {
  const calls = { items: [], digests: [], stories: [] }
  const dependencies = {
    getSummary: async () => ({ status: 'healthy', todayCount: 2 }),
    listItems: async filters => {
      calls.items.push(filters)
      return { status: 'healthy', items: [], nextCursor: null }
    },
    listDigests: async limit => {
      calls.digests.push(limit)
      return { status: 'healthy', items: [] }
    },
    getStory: async id => {
      calls.stories.push(id)
      return { id, slug: id }
    },
    parseCursor: value => value === 'valid-cursor',
    allowMethods,
    clampInteger,
    preparePublicResponse,
    queryValue,
    sendPublicError,
    ...overrides,
  }
  return { handler: createLearningRadarHandler(dependencies), calls }
}

async function invoke(handler, route, { method = 'GET', query = {} } = {}) {
  const { result, response } = createResponse()
  await handler({ method, headers: {}, query: { [LEARNING_RADAR_ROUTE_QUERY]: route, ...query } }, response)
  return result
}

function assertPublic(result, statusCode = 200) {
  assert.equal(result.statusCode, statusCode)
  assert.equal(result.headers.get('cache-control'), 'public, s-maxage=60, stale-while-revalidate=300')
  assert.equal(result.headers.get('x-content-type-options'), 'nosniff')
}

function assertNoStore(result, statusCode, code) {
  assert.equal(result.statusCode, statusCode)
  assert.equal(result.body?.code, code)
  assert.equal(result.headers.get('cache-control'), 'no-store')
  assert.equal(result.headers.get('x-content-type-options'), 'nosniff')
}

test('four public learning URLs rewrite narrowly to one dispatcher', () => {
  const apiRewrites = vercel.rewrites.filter(rule => rule.source.startsWith('/api/'))
  assert.deepEqual(apiRewrites, [
    { source: '/api/learning-radar/summary', destination: '/api/learning-radar?__learning_route=summary' },
    { source: '/api/learning-radar/items', destination: '/api/learning-radar?__learning_route=items' },
    { source: '/api/learning-radar/digests', destination: '/api/learning-radar?__learning_route=digests' },
    { source: '/api/learning-radar/stories/:id', destination: '/api/learning-radar?__learning_route=story&id=:id' },
  ])
  assert.ok(vercel.rewrites.every(rule => !/^\/(?:api|assets)\/\(\.\*\)/.test(rule.source)))
})

test('dispatcher preserves successful summary, items, digests and encoded story responses', async () => {
  const { handler, calls } = createFixture()
  const summary = await invoke(handler, 'summary')
  const items = await invoke(handler, 'items', {
    query: { category: 'ai', cursor: 'valid-cursor', window: '24', limit: '9' },
  })
  const digests = await invoke(handler, 'digests', { query: { limit: '5' } })
  const encodedId = 'story%20with%20spaces'
  const story = await invoke(handler, 'story', { query: { id: decodeURIComponent(encodedId) } })
  for (const result of [summary, items, digests, story]) assertPublic(result)
  assert.deepEqual(calls.items, [{ category: 'ai', cursor: 'valid-cursor', windowHours: 24, limit: 9 }])
  assert.deepEqual(calls.digests, [5])
  assert.deepEqual(calls.stories, ['story with spaces'])
  assert.equal(story.body.slug, 'story with spaces')
})

test('dispatcher keeps validation, missing and unknown routes fail-closed', async () => {
  const { handler } = createFixture()
  assertNoStore(await invoke(handler, 'items', { query: { category: 'market' } }), 400, 'invalid_category')
  assertNoStore(await invoke(handler, 'items', { query: { cursor: 'bad' } }), 400, 'invalid_cursor')
  assertNoStore(await invoke(handler, 'story'), 400, 'missing_id')
  assertNoStore(await invoke(handler, 'unknown'), 404, 'route_not_found')
  const missing = createFixture({ getStory: async () => null })
  assertNoStore(await invoke(missing.handler, 'story', { query: { id: 'missing' } }), 404, 'story_not_found')
})

test('dispatcher preserves GET-only method handling for every public route', async () => {
  const { handler } = createFixture()
  for (const route of ['summary', 'items', 'digests', 'story']) {
    const result = await invoke(handler, route, { method: 'POST', query: { id: 'story' } })
    assertNoStore(result, 405, 'method_not_allowed')
    assert.equal(result.headers.get('allow'), 'GET')
  }
})

test('repository failures remain 503 no-store for every public route', async () => {
  const unavailable = async () => { throw new Error('database unavailable') }
  const { handler } = createFixture({
    getSummary: unavailable,
    listItems: unavailable,
    listDigests: unavailable,
    getStory: unavailable,
  })
  for (const [route, query] of [
    ['summary', {}],
    ['items', {}],
    ['digests', {}],
    ['story', { id: 'story' }],
  ]) assertNoStore(await invoke(handler, route, { query }), 503, 'data_delayed')
})

test('unconfigured payloads remain successful public responses', async () => {
  const unconfigured = { status: 'unconfigured', items: [], message: '数据库尚未配置。' }
  const { handler } = createFixture({
    getSummary: async () => ({ status: 'unconfigured', todayCount: 0 }),
    listItems: async () => unconfigured,
    listDigests: async () => unconfigured,
  })
  for (const route of ['summary', 'items', 'digests']) {
    const result = await invoke(handler, route)
    assertPublic(result)
    assert.equal(result.body.status, 'unconfigured')
  }
})
