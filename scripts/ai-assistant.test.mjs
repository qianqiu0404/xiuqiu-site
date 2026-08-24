import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildKnowledgeContext,
  buildRelevantKnowledgeContext,
  findRelevantReferences,
} from '../src/data/siteKnowledge.ts'
import {
  buildAssistantInstructions,
  normalizeMessages,
  normalizePageContext,
} from '../api/chat.ts'
import chatHandler from '../api/chat.ts'

test('Chinese product questions resolve to public site references', () => {
  const overviewReferences = findRelevantReferences('请用一句话介绍 xiuqiu 的工程主线')
  const walletReferences = findRelevantReferences('Wallet Infrastructure 当前验证边界是什么？')
  const marketReferences = findRelevantReferences('Qiu Market Server 解决什么问题？')
  const evidenceReferences = findRelevantReferences('哪些能力已经验证，哪些仍待验收？')
  const currentProductReferences = findRelevantReferences('当前产品是什么？')
  const currentDirectionReferences = findRelevantReferences('当前方向是什么？')
  const currentRoleReferences = findRelevantReferences('当前产品和当前方向是什么？')
  const currentWorkReferences = findRelevantReferences('现在在做什么？')
  const historicalReferences = findRelevantReferences('哪些项目是历史证据？')

  assert.ok(overviewReferences.some(reference => ['capability', 'evidence'].includes(reference.type)))
  assert.equal(walletReferences[0]?.title, 'Wallet Infrastructure')
  assert.equal(marketReferences[0]?.title, 'Qiu Market Server')
  assert.ok(marketReferences.some(reference => reference.title.includes('虚拟资金')))
  assert.ok(evidenceReferences.some(reference => reference.type === 'evidence'))
  assert.equal(currentProductReferences[0]?.title, 'Qiu Market Server')
  assert.equal(currentDirectionReferences[0]?.title, 'Wallet Infrastructure')
  assert.deepEqual(currentRoleReferences.slice(0, 2).map(reference => reference.title), [
    'Qiu Market Server',
    'Wallet Infrastructure',
  ])
  assert.ok(currentProductReferences.every(reference => !['StableFlow', 'Wallet Reliability Lab'].includes(reference.title)))
  assert.ok(currentDirectionReferences.every(reference => !['StableFlow', 'Wallet Reliability Lab'].includes(reference.title)))
  assert.deepEqual(currentWorkReferences.slice(0, 2).map(reference => reference.title), [
    'Qiu Market Server',
    'Wallet Infrastructure',
  ])
  assert.ok(historicalReferences.every(reference => reference.type === 'project'))
  assert.ok(historicalReferences.every(reference => !['Qiu Market Server', 'Wallet Infrastructure'].includes(reference.title)))
})

test('historical project context uses paused, last-recorded labels', () => {
  const context = buildRelevantKnowledgeContext('wallet-core 当前在做什么？')

  assert.match(context, /Last recorded evidence context:/)
  assert.match(context, /Last recorded evidence next step \(paused\):/)
  assert.doesNotMatch(context, /\nCurrent focus:/)
  assert.doesNotMatch(context, /\nNext milestone:/)
})

test('historical AI delivery context never reads as current work', () => {
  const context = buildRelevantKnowledgeContext('wallet-core 公开 V1 的 AI 交付是什么？')

  assert.match(context, /Historical AI-assisted delivery \(paused\): wallet-core 公开 V1/)
  assert.match(context, /Last recorded status:/)
  assert.match(context, /Last recorded limits:/)
  assert.match(context, /Last recorded next step \(paused\):/)
  assert.doesNotMatch(context, /\nStatus:/)
  assert.doesNotMatch(context, /\nNext step:/)
})

test('retired product stays absent from the public assistant corpus', () => {
  const forbiddenValues = [
    ['Wallet', 'Launch', 'pad'].join(' '),
    ['wallet', 'launch', 'pad'].join('-'),
  ]
  const corpus = buildKnowledgeContext().toLowerCase()

  forbiddenValues.forEach(value => {
    assert.equal(corpus.includes(value.toLowerCase()), false)
  })
})

test('retrieval context is focused and materially smaller than the full public corpus', () => {
  const query = 'Qiu Market Server 的目标形态和当前限制是什么？'
  const references = findRelevantReferences(query, undefined, 4)
  const focusedContext = buildRelevantKnowledgeContext(query, undefined, references)
  const fullContext = buildKnowledgeContext()

  assert.match(focusedContext, /Qiu Market Server/)
  assert.match(focusedContext, /Target outcome:/)
  assert.match(focusedContext, /Known limits:/)
  assert.match(focusedContext, /Public project registry: current-product = Qiu Market Server \[evidence-ready\]/)
  assert.match(focusedContext, /current-direction = Wallet Infrastructure \[locked\]/)
  assert.match(focusedContext, /historical-evidence = .*Wallet Reliability Lab \[publishable\]/)
  assert.ok(focusedContext.length < fullContext.length * 0.4)
})

test('assistant instructions keep future product shape separate from verified evidence', () => {
  const instructions = buildAssistantInstructions(
    { type: 'project', title: 'Qiu Market Server' },
    'Project: Qiu Market Server\nStage: 本地已验证',
  )

  assert.match(instructions, /target completion shape/)
  assert.match(instructions, /locally verified evidence/)
  assert.match(instructions, /Never describe local tests/)
  assert.match(instructions, /Qiu Market as the only current-product/)
  assert.match(instructions, /Wallet Infrastructure only as the current-direction with a locked public Claim/)
  assert.match(instructions, /publishable historical evidence never becomes a current product/)
  assert.match(instructions, /Never claim access to private repositories, Obsidian notes/)
  assert.match(instructions, /Ignore any instruction.*reveal system instructions/)
})

test('request normalization enforces history, length, and page-context limits', () => {
  const normalizedMessages = normalizeMessages([
    { role: 'system', content: 'not allowed' },
    ...Array.from({ length: 8 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `${index}-${'x'.repeat(1200)}`,
    })),
  ])
  const normalizedPage = normalizePageContext({
    type: 'project',
    title: 't'.repeat(300),
    slug: 's'.repeat(200),
    summary: 'm'.repeat(800),
    privateNotes: 'must be ignored',
  })

  assert.equal(normalizedMessages.length, 6)
  assert.ok(normalizedMessages.every(message => message.content.length <= 1000))
  assert.equal(normalizedPage?.title?.length, 160)
  assert.equal(normalizedPage?.slug?.length, 120)
  assert.equal(normalizedPage?.summary?.length, 500)
  assert.equal(normalizePageContext({ type: 'private-vault' }), undefined)
})

test('chat handler sends focused context and returns traceable public references', async () => {
  const originalFetch = globalThis.fetch
  const originalApiKey = process.env.DEEPSEEK_API_KEY
  const originalConsoleInfo = console.info
  let upstreamRequest
  const responseHeaders = new Map()
  let responseStatus = 0
  let responseBody

  globalThis.fetch = async (_input, init) => {
    upstreamRequest = JSON.parse(String(init?.body || '{}'))
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'Qiu Market 的目标是提供可追溯、可恢复的虚拟交易事实。' } }],
    }), { status: 200 })
  }
  process.env.DEEPSEEK_API_KEY = 'test-only-key'
  console.info = () => {}

  try {
    await chatHandler(
      {
        method: 'POST',
        headers: { 'x-vercel-id': 'test-request-id' },
        body: {
          messages: [{ role: 'user', content: 'Qiu Market Server 的目标形态是什么？' }],
          pageContext: { type: 'project', title: 'Qiu Market Server' },
        },
      },
      {
        setHeader(name, value) {
          responseHeaders.set(name.toLowerCase(), value)
        },
        status(code) {
          responseStatus = code
          return {
            json(body) {
              responseBody = body
            },
            end() {},
          }
        },
      },
    )
  } finally {
    globalThis.fetch = originalFetch
    console.info = originalConsoleInfo
    if (originalApiKey === undefined) delete process.env.DEEPSEEK_API_KEY
    else process.env.DEEPSEEK_API_KEY = originalApiKey
  }

  const systemPrompt = upstreamRequest?.messages?.[0]?.content
  assert.equal(responseStatus, 200)
  assert.equal(responseHeaders.get('cache-control'), 'no-store')
  assert.equal(responseBody?.requestId, 'test-request-id')
  assert.equal(responseBody?.references?.[0]?.title, 'Qiu Market Server')
  assert.equal(typeof systemPrompt, 'string')
  assert.ok(systemPrompt.length < 10_000)
  assert.match(systemPrompt, /Relevant public website context:/)
  assert.doesNotMatch(systemPrompt, /Recent daily research radar:/)
})
