import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHATGPT_BOT_ID, NEWS_PRODUCERS, parseGrokBatch, parseGrokIndex, parseNewsBatch, parseNewsIndex, parseNewsItem } from '../shared/grokNews.ts'
import { mergeGrokNews, publishGrokNews, mergeNews, publishNews, NEWS_REPO, NEWS_BRANCH } from './publish-grok-news.mjs'
import { createGrokNewsClient, grokReadingItems, grokDetail } from '../src/data/grokNews.ts'
import { filterIntel, intelSourceLabel } from '../src/data/intelPresentation.ts'
import { mergeReadingItems } from '../src/data/sharedResearchPresentation.ts'

const item = (extra = {}) => ({ origin_id: 'x-ai-digest:fixture:001', revision: 1, bot_id: 'x-ai-digest', visibility: 'public', review_status: 'unreviewed',
  collected_at: '2026-10-23T14:00:00Z', published_at: null, event_date: null, domain: 'ai', title: '本地测试资料', summary: '仅用于离线测试，不作为真实新闻发布。',
  source_url: 'https://example.org/fixture', source_name: '测试来源', source_access: 'not_checked', source_excerpt: null, bot_analysis: null, ...extra })
const batch = (...items) => ({ schema_version: 1, bot_id: 'x-ai-digest', items })
const empty = () => ({ schema_version: 1, bot_id: 'x-ai-digest', updated_at: null, records: [] })
const chatItem = (extra = {}) => item({ origin_id: 'chatgpt-daily:fixture:001', bot_id: CHATGPT_BOT_ID, ...extra })
const chatBatch = (...items) => ({ schema_version: 1, bot_id: CHATGPT_BOT_ID, items })
const chatEmpty = () => ({ ...empty(), bot_id: CHATGPT_BOT_ID })
const hash = value => createHash('sha256').update(value).digest('hex')

test('Grok ingress accepts only specified public unreviewed data and validates before network', async () => {
  for (const extra of [{ bot_id: 'other' }, { visibility: 'private' }, { review_status: 'verified' }, { source_url: 'javascript:alert(1)' },
    { source_url: 'https://user:password@example.org/' }, { source_url: 'http://127.0.0.1/private' }, { event_date: '2026-02-30' },
    { collected_at: '2026-10-23' }, { summary: 'ghp_' + 'a'.repeat(30) }]) {
    let requests = 0
    await assert.rejects(publishGrokNews(batch(item(extra)), async () => { requests++; return {} }))
    assert.equal(requests, 0)
  }
  assert.throws(() => parseGrokBatch(batch(item(), item())), /重复/)
  assert.equal(parseGrokBatch(batch(item()))[0].published_at, null)
})

test('stable origins are idempotent, conflicts stop and corrections retain identity', () => {
  const first = mergeGrokNews(empty(), batch(item()))
  assert.equal(first.changed.length, 1)
  assert.equal(mergeGrokNews(first.index, batch(item())).changed.length, 0)
  assert.throws(() => mergeGrokNews(first.index, batch(item({ summary: 'same revision changed' }))), /冲突/)
  assert.throws(() => mergeGrokNews({ ...first.index, records: [{ ...first.index.records[0], summary: 'corrupt baseline' }] }, batch(item())), /指纹/)
  assert.throws(() => mergeGrokNews(first.index, batch(item({ revision: 3 }))), /逐版/)
  const next = mergeGrokNews(first.index, batch(item({ revision: 2, summary: '更正' })))
  assert.equal(first.index.records[0].summary, item().summary)
  assert.equal(next.index.records[0].id, first.index.records[0].id)
  assert.equal(next.index.records[0].revision, 2)
})

function fakeGitHub(push = true, options = {}) {
  const blobs = new Map(), trees = new Map(), commits = new Map(), calls = [], heads = new Map()
  let serial = 0
  const request = async (method, path, body) => {
    calls.push({ method, path, body })
    const prefix = `repos/${NEWS_REPO}`
    assert.ok(path.startsWith(prefix))
    if (method === 'GET' && path === prefix) return { permissions: { push } }
    if (method === 'GET' && path.includes('/git/ref/')) {
      const head = heads.get(path.split('/git/ref/heads/')[1])
      if (!head) throw Object.assign(new Error('missing'), { status: 404 })
      return { object: { sha: head } }
    }
    if (method === 'GET' && path.includes('/git/commits/')) return commits.get(path.split('/').pop())
    if (method === 'GET' && path.includes('/contents/')) {
      const ref = decodeURIComponent(path.split('?ref=')[1]), sha = heads.get(ref) || ref
      const filePath = path.split('/contents/')[1].split('?')[0]
      const blobSha = trees.get(commits.get(sha).tree.sha)[filePath]
      if (!blobSha || (options.missingHistory && filePath.startsWith('feed/v1/records/'))) throw Object.assign(new Error('missing'), { status: 404 })
      const content = blobs.get(blobSha), size = Buffer.byteLength(content)
      return size > 1024 * 1024 ? { sha: blobSha, size, encoding: 'none', content: '' }
        : { sha: blobSha, size, encoding: 'base64', content: Buffer.from(content).toString('base64') }
    }
    if (method === 'GET' && path.includes('/git/blobs/')) {
      const sha = path.split('/').pop(), content = blobs.get(sha)
      if (!content) throw Object.assign(new Error('missing'), { status: 404 })
      return { sha, size: Buffer.byteLength(content), encoding: 'base64', content: Buffer.from(content).toString('base64') }
    }
    const sha = (++serial).toString(16).padStart(40, '0')
    if (path.endsWith('/git/blobs')) { blobs.set(sha, body.content); return { sha } }
    if (path.endsWith('/git/trees')) { trees.set(sha, { ...(trees.get(body.base_tree) || {}), ...Object.fromEntries(body.tree.map(entry => [entry.path, entry.sha])) }); return { sha } }
    if (path.endsWith('/git/commits')) { commits.set(sha, { tree: { sha: body.tree }, parents: body.parents }); return { sha } }
    if (method === 'POST' && path.endsWith('/git/refs')) {
      const branch = body.ref.replace(/^refs\/heads\//, '')
      assert.ok(Object.values(NEWS_PRODUCERS).some(config => config.branch === branch))
      assert.ok(!heads.has(branch)); heads.set(branch, body.sha); return {}
    }
    if (method === 'PATCH' && path.includes('/git/refs/heads/')) {
      const branch = path.split('/git/refs/heads/')[1]
      assert.ok(Object.values(NEWS_PRODUCERS).some(config => config.branch === branch))
      assert.equal(body.force, false); assert.equal(commits.get(body.sha).parents[0], heads.get(branch)); heads.set(branch, body.sha)
      if (options.failAfterRef) { options.failAfterRef = false; throw new Error('simulated response lost after ref update') }
      return {}
    }
    throw new Error(`Unexpected request ${method} ${path}`)
  }
  return { request, calls, trees, blobs, commits, heads,
    currentIndex: (branch = NEWS_BRANCH) => JSON.parse(blobs.get(trees.get(commits.get(heads.get(branch)).tree.sha)['feed/v1/index.json'])) }
}

test('Grok defaults retain the original serialized bytes, IDs, fingerprints and request sequence', async () => {
  // Recorded from the pre-adapter schema and publisher, before adding another producer.
  const expected = { id: 'grok-2be6e210f8b599e19bb5c411', fingerprint: '9e2623fc606651f8967cf5ef03465143378fea8c14a53c7a3f938f8ac1c52c8f',
    indexFileSha256: 'aa6708dd9722a0356651b7880c18c68499bc815a578529fdf035bd0c170e2285', recordFileSha256: 'e6b503fb14df680067699dafe1eafe683bc512197dd267626ee9dcc6bffc48fb' }
  const legacy = mergeGrokNews(empty(), batch(item())), generic = mergeNews(empty(), batch(item()))
  assert.deepEqual(generic, legacy)
  assert.equal(legacy.changed[0].id, expected.id)
  assert.equal(legacy.changed[0].fingerprint, expected.fingerprint)
  assert.equal(hash(JSON.stringify(legacy.index, null, 2) + '\n'), expected.indexFileSha256)
  assert.equal(hash(JSON.stringify(legacy.changed[0], null, 2) + '\n'), expected.recordFileSha256)
  const oldApi = fakeGitHub(), newApi = fakeGitHub()
  assert.deepEqual(await publishNews(batch(item()), newApi.request), await publishGrokNews(batch(item()), oldApi.request))
  assert.deepEqual(newApi.calls, oldApi.calls)
  const contents = newApi.calls.filter(call => call.path.endsWith('/git/blobs')).map(call => hash(call.body.content))
  assert.deepEqual(contents, [expected.indexFileSha256, expected.recordFileSha256])
  assert.equal(NEWS_BRANCH, 'news/x-ai-digest')
})

test('ChatGPT ingress requires an explicit producer and rejects cross-producer batches, origins, indexes and IDs', async () => {
  assert.equal(parseNewsItem(chatItem(), 'chatgpt').bot_id, CHATGPT_BOT_ID)
  assert.equal(parseNewsBatch(chatBatch(chatItem()), 'chatgpt').length, 1)
  assert.throws(() => parseGrokBatch(chatBatch(chatItem())))
  assert.throws(() => parseNewsItem(chatItem({ origin_id: item().origin_id }), 'chatgpt'))
  assert.throws(() => parseNewsBatch(chatBatch(item()), 'chatgpt'))
  assert.throws(() => parseNewsBatch(batch(chatItem()), 'chatgpt'))
  assert.throws(() => parseNewsBatch(chatBatch(chatItem()), 'other'), /来源不受支持/)
  assert.throws(() => parseNewsBatch(chatBatch(chatItem()), 'toString'), /来源不受支持/)
  assert.throws(() => parseNewsBatch(chatBatch(chatItem()), undefined), /来源不受支持/)
  const first = mergeNews(chatEmpty(), chatBatch(chatItem()), new Map(), 'chatgpt')
  assert.match(first.changed[0].id, /^chatgpt-[a-f0-9]{24}$/)
  assert.equal(first.changed[0].id, `chatgpt-${hash(chatItem().origin_id).slice(0, 24)}`)
  assert.deepEqual(parseNewsIndex(first.index, 'chatgpt'), first.index)
  assert.throws(() => parseGrokIndex(first.index))
  assert.throws(() => parseNewsIndex({ ...first.index, records: [{ ...first.changed[0], id: first.changed[0].id.replace('chatgpt-', 'grok-') }] }, 'chatgpt'), /标识/)
  assert.throws(() => mergeNews(empty(), chatBatch(chatItem()), new Map(), 'chatgpt'))
  assert.throws(() => mergeNews(chatEmpty(), batch(item()), new Map(), 'chatgpt'))
  for (const [payload, producer] of [[chatBatch(chatItem()), undefined], [batch(item()), 'chatgpt'], [chatBatch(chatItem({ bot_id: 'x-ai-digest' })), 'chatgpt'], [chatBatch(chatItem()), 'other']]) {
    let requests = 0
    await assert.rejects(publishNews(payload, async () => { requests++; return {} }, producer))
    assert.equal(requests, 0)
  }
  assert.ok(Object.isFrozen(NEWS_PRODUCERS) && Object.isFrozen(NEWS_PRODUCERS.chatgpt))
})

test('each producer atomically publishes to its own branch and retains immutable revision history', async () => {
  const api = fakeGitHub(), branch = NEWS_PRODUCERS.chatgpt.branch
  const grok = await publishGrokNews(batch(item()), api.request)
  const chat = await publishNews(chatBatch(chatItem()), api.request, 'chatgpt')
  assert.equal(chat.status, 'data_verified')
  assert.equal(chat.branch, 'news/chatgpt-daily')
  assert.equal(chat.website, 'not_verified')
  assert.equal(api.heads.get(NEWS_BRANCH), grok.commit)
  assert.equal(api.currentIndex(branch).bot_id, CHATGPT_BOT_ID)
  assert.ok(api.currentIndex(branch).records.every(record => record.id.startsWith('chatgpt-')))
  assert.deepEqual(api.currentIndex(), mergeGrokNews(empty(), batch(item())).index)
  const writes = api.calls.filter(call => call.method !== 'GET').length
  assert.equal((await publishNews(chatBatch(chatItem()), api.request, 'chatgpt')).status, 'unchanged')
  assert.equal(api.calls.filter(call => call.method !== 'GET').length, writes)
  const correction = chatBatch(chatItem({ revision: 2, summary: '更正' }))
  await publishNews(correction, api.request, 'chatgpt')
  const head = api.heads.get(branch), tree = api.trees.get(api.commits.get(head).tree.sha), current = api.currentIndex(branch).records[0]
  assert.equal(current.revision, 2)
  assert.equal(current.id, `chatgpt-${hash(chatItem().origin_id).slice(0, 24)}`)
  for (const revision of [1, 2]) assert.ok(tree[`feed/v1/records/${current.id}/r${revision}.json`])
  const refUpdates = api.calls.filter(call => call.method === 'PATCH')
  assert.deepEqual(refUpdates.map(call => call.path), [`repos/${NEWS_REPO}/git/refs/heads/${branch}`])
  assert.equal(api.calls.at(-1).path, `repos/${NEWS_REPO}/contents/feed/v1/index.json?ref=${encodeURIComponent(branch)}`)
  assert.ok(!api.calls.some(call => /refs\/heads\/main|actions|deployments/.test(call.path)))
  const denied = fakeGitHub(false)
  await assert.rejects(publishNews(chatBatch(chatItem()), denied.request, 'chatgpt'), /没有本站写权限/)
  assert.equal(denied.calls.filter(call => call.method !== 'GET').length, 0)
})

test('ChatGPT replays, revision conflicts and stale history preserve newer records', async () => {
  for (const missingHistory of [false, true]) {
    const api = fakeGitHub(true, { missingHistory }), payload = chatBatch(chatItem())
    await publishNews(payload, api.request, 'chatgpt')
    await publishNews(chatBatch(chatItem({ revision: 2, summary: '更正' })), api.request, 'chatgpt')
    const writes = api.calls.filter(call => call.method !== 'GET').length
    const replay = await publishNews(payload, api.request, 'chatgpt')
    assert.equal(replay.status, missingHistory ? 'stale_ignored' : 'unchanged')
    assert.deepEqual(replay.ignored, [{ origin_id: chatItem().origin_id, revision: 1, current_revision: 2, status: missingHistory ? 'stale_ignored' : 'verified_replay' }])
    assert.equal(api.calls.filter(call => call.method !== 'GET').length, writes)
    await assert.rejects(publishNews(chatBatch(chatItem({ revision: 2, summary: 'conflict' })), api.request, 'chatgpt'), /冲突/)
    await assert.rejects(publishNews(chatBatch(chatItem({ revision: 4 })), api.request, 'chatgpt'), /逐版/)
    if (!missingHistory) await assert.rejects(publishNews(chatBatch(chatItem({ summary: 'old conflict' })), api.request, 'chatgpt'), /冲突/)
    const mixed = await publishNews(chatBatch(chatItem(), chatItem({ origin_id: 'chatgpt-daily:fixture:new' })), api.request, 'chatgpt')
    assert.equal(mixed.status, 'data_verified')
    assert.equal(mixed.changed, 1)
    assert.equal(api.currentIndex(NEWS_PRODUCERS.chatgpt.branch).records.find(record => record.origin_id === chatItem().origin_id).revision, 2)
  }
})

test('ChatGPT publication requires moving-branch readback and safely retries a lost ref response', async () => {
  const api = fakeGitHub(), branch = NEWS_PRODUCERS.chatgpt.branch
  const request = async (method, path, body) => {
    const result = await api.request(method, path, body)
    if (method === 'GET' && path.endsWith(`?ref=${encodeURIComponent(branch)}`)) {
      return { encoding: 'base64', content: Buffer.from(JSON.stringify(chatEmpty())).toString('base64') }
    }
    return result
  }
  await assert.rejects(publishNews(chatBatch(chatItem()), request, 'chatgpt'), /投递结果待核对/)
  const options = {}, retryApi = fakeGitHub(true, options)
  await publishNews(chatBatch(chatItem()), retryApi.request, 'chatgpt')
  options.failAfterRef = true
  const correction = chatBatch(chatItem({ revision: 2, summary: '更正' }))
  await assert.rejects(publishNews(correction, retryApi.request, 'chatgpt'), /response lost/)
  const writes = retryApi.calls.filter(call => call.method !== 'GET').length
  assert.equal((await publishNews(correction, retryApi.request, 'chatgpt')).status, 'unchanged')
  assert.equal(retryApi.calls.filter(call => call.method !== 'GET').length, writes)
})

test('the legacy and explicit-producer check CLI remains offline and rejects unknown or duplicate flags', () => {
  const directory = mkdtempSync(join(tmpdir(), 'news-cli-'))
  try {
    const grokFile = join(directory, 'grok.json'), chatFile = join(directory, 'chatgpt.json'), log = join(directory, 'gh-called')
    writeFileSync(grokFile, JSON.stringify(batch(item())))
    writeFileSync(chatFile, JSON.stringify(chatBatch(chatItem())))
    writeFileSync(join(directory, 'gh'), '#!/bin/sh\nprintf "called\\n" >> "$NEWS_TEST_GH_LOG"\nexit 97\n', { mode: 0o755 })
    const run = args => spawnSync(process.execPath, [fileURLToPath(new URL('./publish-grok-news.mjs', import.meta.url)), ...args], {
      encoding: 'utf8', env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, NEWS_TEST_GH_LOG: log }, timeout: 10000,
    })
    for (const args of [['--check', grokFile], ['--check', grokFile, '--producer', 'grok'], ['--check', chatFile, '--producer', 'chatgpt'], ['--producer', 'chatgpt', '--check', chatFile]]) {
      const result = run(args)
      assert.equal(result.status, 0, result.stderr)
      assert.deepEqual(JSON.parse(result.stdout), { status: 'valid', items: 1, network: false })
    }
    for (const args of [['--check', chatFile], ['--check', grokFile, '--producer', 'chatgpt'], ['--check', chatFile, '--producer', 'unknown'],
      ['--check', chatFile, '--producer', 'chatgpt', '--producer', 'grok'], ['--check', grokFile, '--check', grokFile],
      ['--check', grokFile, '--unknown', 'x'], ['--check', grokFile, '--producer'], ['--check', grokFile, 'extra'], ['--producer', 'chatgpt']]) {
      const result = run(args)
      assert.equal(result.status, 1, `${args}: ${result.stderr}`)
      assert.equal(result.stdout, '')
    }
    assert.ok(!existsSync(log), 'all check and invalid argument paths must avoid GitHub entirely')
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('publication is atomic on the data branch, reads back and never deploys the website', async () => {
  const api = fakeGitHub()
  const first = await publishGrokNews(batch(item()), api.request)
  assert.equal(first.status, 'data_verified')
  assert.equal(first.website, 'not_verified')
  const writes = api.calls.filter(c => c.method !== 'GET').length
  assert.equal((await publishGrokNews(batch(item()), api.request)).status, 'unchanged')
  assert.equal(api.calls.filter(c => c.method !== 'GET').length, writes)
  await publishGrokNews(batch(item({ revision: 2, summary: '更正' })), api.request)
  const lastTree = [...api.trees.values()].pop()
  assert.ok(Object.keys(lastTree).some(path => path.endsWith('/r1.json')))
  assert.ok(Object.keys(lastTree).some(path => path.endsWith('/r2.json')))
  assert.ok(!api.calls.some(call => /refs\/heads\/main|actions|deployments/.test(call.path)))
  const denied = fakeGitHub(false)
  await assert.rejects(publishGrokNews(batch(item()), denied.request), /没有本站写权限/)
  assert.equal(denied.calls.filter(c => c.method !== 'GET').length, 0)
  const large = fakeGitHub()
  const chunk = offset => batch(...Array.from({ length: 50 }, (_, n) => item({ origin_id: `x-ai-digest:large:${offset + n}`, summary: '摘要'.repeat(750), bot_analysis: '分析'.repeat(1500) })))
  await publishGrokNews(chunk(0), large.request)
  assert.equal((await publishGrokNews(chunk(50), large.request)).status, 'data_verified')
  const indexBytes = Buffer.byteLength(JSON.stringify(large.currentIndex(), null, 2) + '\n')
  assert.ok(indexBytes > 1024 * 1024 && indexBytes < 2 * 1024 * 1024)
  assert.ok(large.calls.some(call => call.method === 'GET' && call.path.includes('/git/blobs/')),
    'large contents metadata must be resolved through the immutable blob for readback')
  const writesBeforeReplay = large.calls.filter(call => call.method !== 'GET').length
  assert.equal((await publishGrokNews(chunk(50), large.request)).status, 'unchanged')
  assert.equal(large.calls.filter(call => call.method !== 'GET').length, writesBeforeReplay)
  const safeWrites = large.calls.filter(call => call.method !== 'GET').length
  await assert.rejects(publishGrokNews(chunk(100), large.request), /读取上限/)
  assert.equal(large.calls.filter(call => call.method !== 'GET').length, safeWrites, 'an unreadable index must never replace the last good branch')
})

test('large-file fallback rejects unsafe blob identifiers, unsupported encodings and invalid schema', async () => {
  for (const failure of ['unsafe_sha', 'encoding', 'schema']) {
    const api = fakeGitHub()
    await publishGrokNews(batch(item()), api.request)
    const writes = api.calls.filter(call => call.method !== 'GET').length
    let blobReads = 0
    const request = async (method, path, body) => {
      const result = await api.request(method, path, body)
      if (method === 'GET' && path.includes('/contents/')) return { ...result, content: '', encoding: 'none',
        ...(failure === 'unsafe_sha' ? { sha: '../untrusted/path' } : {}) }
      if (method === 'GET' && path.includes('/git/blobs/')) {
        blobReads++
        if (failure === 'encoding') return { ...result, encoding: 'utf-8' }
        if (failure === 'schema') return { ...result, content: Buffer.from('{}').toString('base64') }
      }
      return result
    }
    await assert.rejects(publishGrokNews(batch(item()), request), failure === 'unsafe_sha' ? /安全的 Blob 标识/ : failure === 'encoding' ? /Blob 编码/ : /索引版本/)
    assert.equal(blobReads, failure === 'unsafe_sha' ? 0 : 1)
    assert.equal(api.calls.filter(call => call.method !== 'GET').length, writes)
  }
})

test('old revisions are verified against history, preserve the current revision and do not block new items', async () => {
  const api = fakeGitHub()
  await publishGrokNews(batch(item()), api.request)
  await publishGrokNews(batch(item({ revision: 2, summary: '更正' })), api.request)
  const writes = api.calls.filter(call => call.method !== 'GET').length
  const replay = await publishGrokNews(batch(item()), api.request)
  assert.equal(replay.status, 'unchanged')
  assert.deepEqual(replay.ignored, [{ origin_id: item().origin_id, revision: 1, current_revision: 2, status: 'verified_replay' }])
  assert.equal(api.calls.filter(call => call.method !== 'GET').length, writes)
  await assert.rejects(publishGrokNews(batch(item({ summary: 'altered old revision' })), api.request), /同一新闻版本内容冲突/)
  await assert.rejects(publishGrokNews(batch(item({ revision: 2, summary: 'altered current revision' })), api.request), /同一新闻版本内容冲突/)
  assert.equal(api.calls.filter(call => call.method !== 'GET').length, writes)
  const mixed = await publishGrokNews(batch(item(), item({ origin_id: 'x-ai-digest:fixture:new' })), api.request)
  assert.equal(mixed.status, 'data_verified')
  assert.equal(mixed.changed, 1)
  assert.equal(mixed.ignored[0].status, 'verified_replay')
  assert.equal(api.currentIndex().records.find(record => record.origin_id === item().origin_id).revision, 2)
  assert.equal(api.currentIndex().records.length, 2)
})

test('missing historical payloads return explicit stale receipts without claiming publication or rejecting new items', async () => {
  const api = fakeGitHub(true, { missingHistory: true })
  await publishGrokNews(batch(item()), api.request)
  await publishGrokNews(batch(item({ revision: 2, summary: '更正' })), api.request)
  const writes = api.calls.filter(call => call.method !== 'GET').length
  const stale = await publishGrokNews(batch(item()), api.request)
  assert.equal(stale.status, 'stale_ignored')
  assert.equal(stale.changed, 0)
  assert.equal(stale.ignored[0].status, 'stale_ignored')
  assert.equal(api.calls.filter(call => call.method !== 'GET').length, writes)
  const mixed = await publishGrokNews(batch(item(), item({ origin_id: 'x-ai-digest:fixture:new' })), api.request)
  assert.equal(mixed.status, 'data_verified')
  assert.equal(mixed.changed, 1)
  assert.equal(mixed.ignored[0].status, 'stale_ignored')
  assert.equal(api.currentIndex().records.find(record => record.origin_id === item().origin_id).revision, 2)
  await assert.rejects(publishGrokNews(batch(item({ revision: 2, summary: 'conflicting current revision' })), api.request), /冲突/)
})

test('a lost ref-update response can be retried as an unchanged publication without duplicate writes', async () => {
  const options = {}, api = fakeGitHub(true, options)
  await publishGrokNews(batch(item()), api.request)
  const correction = batch(item({ revision: 2, summary: '更正' }))
  options.failAfterRef = true
  await assert.rejects(publishGrokNews(correction, api.request), /response lost/)
  assert.equal(api.currentIndex().records[0].revision, 2)
  const writes = api.calls.filter(call => call.method !== 'GET').length
  assert.equal((await publishGrokNews(correction, api.request)).status, 'unchanged')
  assert.equal(api.calls.filter(call => call.method !== 'GET').length, writes)
})

test('index and UI order compare collection instants across timezones and break ties by stable id', () => {
  const older = item({ origin_id: 'x-ai-digest:fixture:older', collected_at: '2026-10-23T09:00:00+08:00' })
  const newer = item({ origin_id: 'x-ai-digest:fixture:newer', collected_at: '2026-10-23T05:00:00Z' })
  const tie = item({ origin_id: 'x-ai-digest:fixture:tie', collected_at: '2026-10-23T13:00:00+08:00' })
  const index = mergeGrokNews(empty(), batch(older, newer)).index
  assert.equal(index.records[0].origin_id, newer.origin_id)
  assert.equal(index.updated_at, newer.collected_at)
  const staleUiInput = grokReadingItems(index).reverse()
  assert.equal(mergeReadingItems(staleUiInput)[0].id, index.records[0].id)
  const withTie = mergeGrokNews(empty(), batch(older, tie, newer)).index
  const tiedIds = withTie.records.filter(record => record.origin_id !== older.origin_id).map(record => record.id)
  assert.deepEqual(tiedIds, [...tiedIds].sort())
  assert.deepEqual(mergeGrokNews(empty(), batch(newer, older, tie)).index, withTie)
  assert.deepEqual(mergeReadingItems(grokReadingItems(withTie).reverse()).map(record => record.id), withTie.records.map(record => record.id))
})

test('news retains date provenance, unverified status and distinct source filtering', () => {
  const index = mergeGrokNews(empty(), batch(item({ source_excerpt: '<script>not executable</script>', bot_analysis: 'Bot 判断' }))).index
  const entries = grokReadingItems(index)
  assert.equal(entries[0].date, '2026-10-23')
  assert.equal(entries[0].research.date_basis, 'collected')
  assert.equal(entries[0].research.evidence_status, 'unverified')
  assert.equal(filterIntel(entries, { filter: 'grok' }).length, 1)
  assert.equal(filterIntel(entries, { filter: 'research' }).length, 0)
  assert.match(intelSourceLabel(entries[0]), /Grok Bot.*未核实/)
  const detail = grokDetail(index.records[0])
  assert.equal(detail.content[3].tag, 'blockquote')
  assert.equal(detail.content[3].children[0].children[0].text, '<script>not executable</script>')
  assert.throws(() => parseGrokIndex({ ...index, records: [...index.records, index.records[0]] }), /重复/)
})

test('fetches coalesce, refresh independently of site builds and do not replace a good cache on error', async () => {
  let time = 1000, calls = 0, fail = false
  const index = mergeGrokNews(empty(), batch(item())).index
  const client = createGrokNewsClient(async (url, options) => {
    calls++
    assert.match(url, /^\/grok-news-data\/index.json\?v=/)
    assert.equal(options.credentials, 'omit')
    if (fail) throw new Error('offline')
    return new Response(JSON.stringify(index))
  }, () => time)
  const [a, b] = await Promise.all([client.load(), client.load()])
  assert.equal(a, b)
  assert.equal(calls, 1)
  fail = true
  await assert.rejects(client.load(true), /offline/)
  assert.equal(await client.load(), a)
  time += 60001
  fail = false
  assert.deepEqual(await client.load(), a)
  assert.equal(calls, 3)
})
