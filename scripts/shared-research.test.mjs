import test from 'node:test'
import assert from 'node:assert/strict'
import { createResearchClient, parseResearchIndex, parseResearchDetail, ResearchRequestError } from '../src/data/sharedResearch.ts'
import { mergeReadingItems, readingTopics, researchCardLabel, researchDateLabel, researchCalendarDate, researchUpdateLabel, dailyRadarHref } from '../src/data/sharedResearchPresentation.ts'
import { filterIntel, topicsForFilter, intelSourceLabel, getIntelFreshness } from '../src/data/intelPresentation.ts'

const record = (overrides = {}) => ({ id: 'cap-a', kind: 'capture', title: '模型发布', summary: '收录材料的摘要', category: 'AI 与软件',
  date: '2026-10-20', date_basis: 'published', collected_at: '2026-10-23T12:00:00+08:00', published_at: '2026-10-20T12:00:00+08:00',
  event_date: null, updated_at: '2026-10-23T12:00:00+08:00', evidence_status: 'unverified', url: 'https://shared-research.vercel.app/captures/a.html',
  materials: [{ id: 'cap-a', title: 'A', url: 'https://shared-research.vercel.app/captures/a.html', source_url: 'https://example.org/story', source_type: 'model_output', source_access: 'accessible' }], topic_ids: [], coverage: null, ...overrides })
const index = (cards = [record()]) => ({ schema_version: 1, source: { name: 'shared-research', home_url: 'https://shared-research.vercel.app/', revision: 'a'.repeat(40) },
  updated_at: '2026-10-23T12:00:00+08:00', record_count: cards.length, cards, briefs: [] })
const native = { id: 'radar:a', kind: 'learning', date: '2026-10-19', domain: 'ai', topic: 'agent', title: '模型发布', summary: '工程简报', href: '/radar/2026-10-19#a', source: { name: 'Example', url: 'https://example.org/story' } }
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })

test('shared research joins the native feed without changing dates, truth status or existing records', () => {
  const feed = parseResearchIndex(index())
  const items = mergeReadingItems([native], feed)
  assert.deepEqual(items.map(i => i.date), ['2026-10-20', '2026-10-19'])
  assert.equal(items[1], native)
  assert.equal(items[0].href, '/research?id=cap-a')
  assert.match(intelSourceLabel(items[0]), /未核实/)
  assert.equal(items[0].research.materials[0].source_type, 'model_output')
  assert.equal(items[0].source, undefined, 'model output must not be promoted to a Tier 1 source')
  assert.equal(items.length, 2, 'a shared URL and similar title are insufficient to collapse different records')
  assert.equal(dailyRadarHref([items[0]]), undefined, 'research-only dates must not create nonexistent Radar links')
  assert.equal(dailyRadarHref(items), '/radar/2026-10-19')
  assert.match(researchUpdateLabel(feed), /最近收录 2026-10-23/)
  const sameDay = [{ ...native, id: 'review', kind: 'review', date: '2026-10-20' }, { ...native, date: '2026-10-20' }, { ...native, id: 'market', kind: 'market', date: '2026-10-20' }]
  assert.deepEqual(mergeReadingItems(sameDay, feed).map(i => i.kind), ['review', 'research', 'learning', 'market'])
  assert.equal(getIntelFreshness('2026-10-19', new Date('2026-10-23T04:00:00Z')).state, 'stale')
})

test('research participates in domain, source, keyword and topic filters', () => {
  const items = mergeReadingItems([native], parseResearchIndex(index([record(), record({ id: 'cap-b', category: '职业与机会', title: '招聘' })])))
  assert.equal(filterIntel(items, { filter: 'research' }).length, 2)
  assert.equal(filterIntel(items, { filter: 'ai' }).length, 2)
  assert.equal(filterIntel(items, { filter: 'research', search: '招聘' }).length, 1)
  const topics = readingTopics(items)
  assert.equal(topicsForFilter(topics, 'research').length, 2)
  assert.equal(topics.find(t => t.topic === 'research-ai').count, 1)
})

test('collection date and evidence descriptions are explicit, including an empty source', () => {
  assert.equal(researchDateLabel('collected'), '收录日期')
  assert.equal(researchCalendarDate('2026-10-20T23:30:00Z'), '2026-10-21')
  assert.match(researchCardLabel(record({ evidence_status: 'disputed' })), /存在分歧/)
  assert.match(researchCardLabel(record({ evidence_status: 'source_checked' })), /指定陈述已核对原文/)
  assert.equal(researchUpdateLabel(index([])), '共享研究 · 暂无公开资料')
  assert.deepEqual(mergeReadingItems([native], parseResearchIndex(index([]))), [native])
})

test('versions, invalid dates, duplicate IDs and unsafe or unexpected source URLs fail closed', () => {
  assert.throws(() => parseResearchIndex({ ...index(), schema_version: 2 }))
  assert.throws(() => parseResearchIndex(index([record({ date: '2026-02-30' })])))
  assert.throws(() => parseResearchIndex(index([record(), record()])))
  assert.throws(() => parseResearchIndex(index([record({ url: 'https://other.example/a' })])))
  assert.throws(() => parseResearchIndex(index([record({ materials: [{ ...record().materials[0], source_url: 'javascript:alert(1)' }] })])))
})

test('native detail rendering allows only safe text trees and stable internal references', () => {
  const content = [{ tag: 'p', onclick: 'bad()', children: [{ text: '<script>alert(1)</script>' }, { tag: 'a', record_id: 'cap-b', children: [{ text: '关联材料' }] }] }]
  const detail = parseResearchDetail({ schema_version: 1, record: record(), content }, 'cap-a')
  assert.equal(detail.content[0].onclick, undefined)
  assert.equal(detail.content[0].children[0].text, '<script>alert(1)</script>')
  assert.throws(() => parseResearchDetail({ schema_version: 1, record: record(), content: [{ tag: 'script', children: [] }] }, 'cap-a'))
  assert.throws(() => parseResearchDetail({ schema_version: 1, record: record(), content: [{ tag: 'a', href: 'data:text/html,bad', children: [] }] }, 'cap-a'))
  assert.throws(() => parseResearchDetail({ schema_version: 1, record: record(), content }, 'cap-b'))
})

test('public requests are coalesced, bounded, credential-free and recover after refresh failure', async () => {
  let calls = 0, fail = false, clock = 0
  const client = createResearchClient(async (url, options) => {
    calls++
    assert.equal(url, '/research-data/index.json')
    assert.equal(options.credentials, 'omit')
    if (fail) throw new Error('offline')
    return json(index())
  }, () => clock)
  const [first, second] = await Promise.all([client.loadIndex(), client.loadIndex()])
  assert.equal(first, second)
  assert.equal(calls, 1)
  assert.equal(await client.loadIndex(), first)
  fail = true
  await assert.rejects(client.loadIndex(true), /offline/)
  assert.equal(await client.loadIndex(), first, 'a failed refresh must not corrupt the last good cache')
  clock = 300001
  fail = false
  await client.loadIndex()
  assert.equal(calls, 3)
})

test('HTTP, HTML responses, oversized payloads and unsupported versions remain visible failures', async () => {
  for (const response of [new Response('Not found', { status: 404 }), new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } }),
    new Response(' '.repeat(2 * 1024 * 1024 + 1), { headers: { 'content-type': 'application/json' } }), json({ ...index(), schema_version: 9 })]) {
    const client = createResearchClient(async () => response)
    await assert.rejects(client.loadIndex())
  }
  const client = createResearchClient(async () => new Response('', { status: 404 }))
  await assert.rejects(client.loadDetail('cap-missing'), error => error instanceof ResearchRequestError && error.status === 404)
  assert.throws(() => client.loadDetail('../private'))
})
