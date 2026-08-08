import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'
import chatHandler from '../api/chat.ts'

const originalFetch = globalThis.fetch
const originalApiKey = process.env.DEEPSEEK_API_KEY
const originalModel = process.env.DEEPSEEK_MODEL

afterEach(() => {
  globalThis.fetch = originalFetch

  if (originalApiKey === undefined) delete process.env.DEEPSEEK_API_KEY
  else process.env.DEEPSEEK_API_KEY = originalApiKey

  if (originalModel === undefined) delete process.env.DEEPSEEK_MODEL
  else process.env.DEEPSEEK_MODEL = originalModel
})

function createResponseRecorder() {
  let statusCode = 200
  let body
  const headers = new Map()

  return {
    response: {
      setHeader(name, value) {
        headers.set(name.toLowerCase(), value)
      },
      status(code) {
        statusCode = code
        return {
          json(value) {
            body = value
          },
          end() {},
        }
      },
    },
    result() {
      return { statusCode, body, headers }
    },
  }
}

test('chat endpoint only accepts POST', async () => {
  const recorder = createResponseRecorder()

  await chatHandler({ method: 'GET', headers: { 'x-forwarded-for': 'test-method' } }, recorder.response)

  const result = recorder.result()
  assert.equal(result.statusCode, 405)
  assert.equal(result.body.code, 'method_not_allowed')
  assert.equal(result.headers.get('allow'), 'POST')
})

test('chat endpoint fails closed when the provider key is missing', async () => {
  delete process.env.DEEPSEEK_API_KEY
  const recorder = createResponseRecorder()

  await chatHandler({
    method: 'POST',
    headers: { 'x-forwarded-for': 'test-missing-key' },
    body: { messages: [{ role: 'user', content: '介绍 Wallet Launchpad' }] },
  }, recorder.response)

  const result = recorder.result()
  assert.equal(result.statusCode, 500)
  assert.equal(result.body.code, 'missing_api_key')
})

test('chat endpoint sends public context with low-latency model settings', async () => {
  process.env.DEEPSEEK_API_KEY = 'test-only-key'
  delete process.env.DEEPSEEK_MODEL
  let upstreamRequest

  globalThis.fetch = async (url, options) => {
    upstreamRequest = { url, options }
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          choices: [{ message: { content: 'Wallet Launchpad 是钱包控制平面。' } }],
        })
      },
    }
  }

  const recorder = createResponseRecorder()
  await chatHandler({
    method: 'POST',
    headers: { 'x-forwarded-for': 'test-success' },
    body: {
      messages: [{ role: 'user', content: 'Wallet Launchpad 完成后是什么产品？' }],
      pageContext: {
        type: 'project',
        title: 'Wallet Launchpad',
        slug: 'wallet-launchpad',
      },
    },
  }, recorder.response)

  assert.equal(recorder.result().statusCode, 200)
  assert.equal(recorder.result().body.answer, 'Wallet Launchpad 是钱包控制平面。')
  assert.ok(Array.isArray(recorder.result().body.references))
  assert.equal(upstreamRequest.url, 'https://api.deepseek.com/chat/completions')

  const upstreamBody = JSON.parse(upstreamRequest.options.body)
  assert.equal(upstreamBody.model, 'deepseek-v4-flash')
  assert.deepEqual(upstreamBody.thinking, { type: 'disabled' })
  assert.equal(upstreamBody.messages.at(-1).content, 'Wallet Launchpad 完成后是什么产品？')
  assert.match(upstreamBody.messages[0].content, /Current page title: Wallet Launchpad/)
  assert.match(upstreamBody.messages[0].content, /Relevant public website context:/)
  assert.match(upstreamBody.messages[0].content, /Project: Wallet Launchpad/)
  assert.equal(upstreamRequest.options.headers.Authorization, 'Bearer test-only-key')
})
