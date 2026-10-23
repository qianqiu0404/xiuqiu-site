import test from 'node:test'
import assert from 'node:assert/strict'
import { parseGrokBatch, parseGrokIndex } from '../shared/grokNews.ts'
import { mergeGrokNews, publishGrokNews, NEWS_REPO, NEWS_BRANCH } from './publish-grok-news.mjs'
import { createGrokNewsClient, grokReadingItems, grokDetail } from '../src/data/grokNews.ts'
import { filterIntel, intelSourceLabel } from '../src/data/intelPresentation.ts'

const item = (extra = {}) => ({ origin_id: 'x-ai-digest:fixture:001', revision: 1, bot_id: 'x-ai-digest', visibility: 'public', review_status: 'unreviewed',
  collected_at: '2026-10-23T14:00:00Z', published_at: null, event_date: null, domain: 'ai', title: '本地测试资料', summary: '仅用于离线测试，不作为真实新闻发布。',
  source_url: 'https://example.org/fixture', source_name: '测试来源', source_access: 'not_checked', source_excerpt: null, bot_analysis: null, ...extra })
const batch = (...items) => ({ schema_version: 1, bot_id: 'x-ai-digest', items })
const empty = () => ({ schema_version: 1, bot_id: 'x-ai-digest', updated_at: null, records: [] })

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

function fakeGitHub(push = true) {
  const blobs = new Map(), trees = new Map(), commits = new Map(), calls = []
  let head, serial = 0
  const request = async (method, path, body) => {
    calls.push({ method, path, body })
    const prefix = `repos/${NEWS_REPO}`
    assert.ok(path.startsWith(prefix))
    if (method === 'GET' && path === prefix) return { permissions: { push } }
    if (method === 'GET' && path.includes('/git/ref/')) {
      if (!head) throw Object.assign(new Error('missing'), { status: 404 })
      return { object: { sha: head } }
    }
    if (method === 'GET' && path.includes('/git/commits/')) return commits.get(path.split('/').pop())
    if (method === 'GET' && path.includes('/contents/')) {
      const ref = decodeURIComponent(path.split('?ref=')[1]), sha = ref === NEWS_BRANCH ? head : ref
      return { content: Buffer.from(blobs.get(trees.get(commits.get(sha).tree.sha)['feed/v1/index.json'])).toString('base64') }
    }
    const sha = `fake-${++serial}`
    if (path.endsWith('/git/blobs')) { blobs.set(sha, body.content); return { sha } }
    if (path.endsWith('/git/trees')) { trees.set(sha, { ...(trees.get(body.base_tree) || {}), ...Object.fromEntries(body.tree.map(entry => [entry.path, entry.sha])) }); return { sha } }
    if (path.endsWith('/git/commits')) { commits.set(sha, { tree: { sha: body.tree }, parents: body.parents }); return { sha } }
    if (method === 'POST' && path.endsWith('/git/refs')) { assert.equal(body.ref, `refs/heads/${NEWS_BRANCH}`); head = body.sha; return {} }
    if (method === 'PATCH' && path.endsWith(`/git/refs/heads/${NEWS_BRANCH}`)) { assert.equal(body.force, false); assert.equal(commits.get(body.sha).parents[0], head); head = body.sha; return {} }
    throw new Error(`Unexpected request ${method} ${path}`)
  }
  return { request, calls, trees, blobs, commits }
}

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
