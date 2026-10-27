import test from 'node:test'
import assert from 'node:assert/strict'
import { parseNewsIndex } from '../shared/grokNews.ts'
import { createNewsClient } from '../src/data/grokNews.ts'
import { newsCard, newsDetail, newsDetailContext, newsReadingItems, newsUpdateLabel } from '../src/data/newsPresentation.ts'
import { filterIntel, intelKindLabel, intelSourceLabel, intelTopicHref, topicsForFilter } from '../src/data/intelPresentation.ts'
import { intelCanShowEmpty, intelFeedStates, intelFilterOptions, intelReadingHref, intelReadingLabel, intelReadingReady, intelResultLabel, readIntelQuery, readingReturnLink } from '../src/data/readingNavigationPresentation.ts'
import { mergeReadingItems, readingTopics } from '../src/data/sharedResearchPresentation.ts'

const record = (extra = {}) => ({ id: `chatgpt-${'a'.repeat(24)}`, fingerprint: 'b'.repeat(64), origin_id: 'chatgpt-daily:fixture:001', revision: 1,
  bot_id: 'chatgpt-daily', visibility: 'public', review_status: 'unreviewed', collected_at: '2026-10-27T03:00:00Z', published_at: null, event_date: null,
  domain: 'ai', title: 'ChatGPT 离线 fixture', summary: 'MCP 测试资料，不作为真实新闻发布。', source_url: 'https://example.org/fixture',
  source_name: 'fixture 原始来源', source_access: 'not_checked', source_excerpt: '<script>仅为文本</script>', bot_analysis: '尚待核对的 fixture 分析', ...extra })
const index = (records = [record()]) => parseNewsIndex({ schema_version: 1, bot_id: 'chatgpt-daily', updated_at: records.length ? records[0].collected_at : null, records }, 'chatgpt')
const ready = { archive: 'ready', research: 'ready', grok: 'ready', chatgpt: 'ready' }

test('ChatGPT has distinct source and category filters while preserving unreviewed provenance', () => {
  const input = index(['ai', 'web3', 'market', 'research'].map((domain, i) => record({ domain, id: `chatgpt-${String(i + 1).repeat(24)}`, origin_id: `chatgpt-daily:fixture:${i}` })))
  const entries = newsReadingItems(input, 'chatgpt')
  assert.equal(filterIntel(entries, { filter: 'chatgpt' }).length, 4)
  assert.equal(filterIntel(entries, { filter: 'grok' }).length, 0)
  assert.equal(filterIntel(entries, { filter: 'research' }).length, 0)
  for (const domain of ['ai', 'web3', 'market']) assert.equal(filterIntel(entries, { filter: domain }).length, 1)
  assert.equal(filterIntel(entries, { filter: 'chatgpt', search: 'mcp' }).length, 4)
  assert.equal(topicsForFilter(readingTopics(entries), 'chatgpt').length, 4)
  assert.equal(topicsForFilter(readingTopics(entries), 'grok').length, 0)
  assert.equal(intelKindLabel('chatgpt'), 'ChatGPT推荐')
  assert.match(intelSourceLabel(entries[0]), /ChatGPT推荐.*未经人工复核.*未核实.*example\.org/)
  assert.match(newsUpdateLabel(input, 'chatgpt'), /ChatGPT推荐 · 4 条.*未经人工复核/)
  assert.equal(intelReadingLabel('chatgpt'), '阅读推荐与来源 →')
})

test('ChatGPT details keep excerpt and analysis as text with source attribution and real date basis', () => {
  const input = record()
  const detail = newsDetail(input, 'chatgpt')
  assert.equal(detail.record.url, `/research?producer=chatgpt&id=${input.id}`)
  assert.equal(detail.record.evidence_status, 'unverified')
  assert.equal(detail.record.materials[0].source_type, 'model_output')
  assert.equal(detail.record.materials[0].source_url, input.source_url)
  assert.equal(detail.record.date_basis, 'collected')
  assert.equal(detail.record.date, '2026-10-27')
  assert.equal(newsCard(record({ published_at: '2026-10-26T20:00:00Z' }), 'chatgpt').date_basis, 'published')
  assert.equal(newsCard(record({ event_date: '2026-10-25' }), 'chatgpt').date, '2026-10-25')
  assert.equal(detail.content[0].children[0].text, 'ChatGPT推荐')
  assert.equal(detail.content[3].tag, 'blockquote')
  assert.equal(detail.content[3].children[0].children[0].text, input.source_excerpt)
  assert.match(detail.content.at(-1).children[0].text, /ChatGPT.*未经人工复核/)
})

test('producer route and reading return retain the source, keyword, topic and focus anchor', () => {
  assert.deepEqual(newsDetailContext('chatgpt'), { producer: 'chatgpt', sourceLabel: 'ChatGPT推荐', listPath: '/?domain=chatgpt' })
  assert.equal(newsDetailContext('grok').sourceLabel, 'Grok Bot 新闻')
  for (const value of [undefined, 'unknown', ['chatgpt']]) assert.equal(newsDetailContext(value).listPath, '/?domain=research')
  const entry = newsReadingItems(index(), 'chatgpt')[0]
  const listPath = '/?domain=chatgpt&topic=chatgpt-ai&q=MCP%20fixture&expanded=1'
  const href = new URL(intelReadingHref(entry, listPath), 'https://example.org')
  assert.equal(href.searchParams.get('producer'), 'chatgpt')
  const back = readingReturnLink(href.searchParams.get('from'))
  assert.equal(back.href, `/?domain=chatgpt&topic=chatgpt-ai&q=MCP+fixture&expanded=1#intel-item-${entry.id}`)
  assert.match(back.label, /ChatGPT推荐.*MCP fixture.*搜索结果/)
  assert.equal(readIntelQuery({ domain: 'chatgpt' }).filter, 'chatgpt')
  assert.equal(intelTopicHref('chatgpt-web3'), '/?domain=chatgpt&topic=chatgpt-web3')
  assert.equal(intelTopicHref('grok-web3'), '/?domain=grok&topic=grok-web3')
})

test('ChatGPT loading and failure never become a confirmed zero recommendation count', () => {
  for (const chatgpt of ['loading', 'error']) {
    const states = { ...ready, chatgpt }
    assert.equal(intelCanShowEmpty(intelFeedStates('chatgpt', states)), false)
    assert.equal(intelCanShowEmpty(intelFeedStates('all', states)), false)
    assert.equal(intelCanShowEmpty(intelFeedStates('grok', states)), true)
    assert.equal(intelFilterOptions([], states).find(option => option.key === 'chatgpt').count, undefined)
  }
  assert.equal(intelCanShowEmpty(intelFeedStates('chatgpt', ready)), true)
  assert.equal(intelFilterOptions([], ready).find(option => option.key === 'chatgpt').count, 0)
})

test('return focus waits only for sources used by the active filter and settles on completed errors', () => {
  const waitingElsewhere = { archive: 'loading', research: 'loading', grok: 'loading', chatgpt: 'ready' }
  assert.equal(intelReadingReady(intelFeedStates('chatgpt', waitingElsewhere)), true)
  for (const filter of ['all', 'ai', 'web3', 'market', 'grok', 'research']) {
    assert.equal(intelReadingReady(intelFeedStates(filter, waitingElsewhere)), false, `${filter} still needs a pending source`)
  }
  assert.equal(intelReadingReady(intelFeedStates('chatgpt', { ...ready, chatgpt: 'loading' })), false)
  assert.equal(intelReadingReady(intelFeedStates('chatgpt', { ...waitingElsewhere, chatgpt: 'error' })), true)
  assert.equal(intelCanShowEmpty(intelFeedStates('chatgpt', { ...waitingElsewhere, chatgpt: 'error' })), false)
  assert.equal(intelReadingReady(intelFeedStates('grok', { ...waitingElsewhere, grok: 'ready' })), true)
  assert.equal(intelReadingReady(intelFeedStates('research', { ...waitingElsewhere, research: 'error' })), true)
  assert.equal(intelReadingReady(intelFeedStates('all', { archive: 'ready', research: 'error', grok: 'error', chatgpt: 'ready' })), true)
})

test('result feedback distinguishes unknown source counts, partial matches and confirmed empty results', () => {
  assert.equal(intelResultLabel(0, 0, ['loading']), '正在载入资料')
  assert.equal(intelResultLabel(0, 0, ['error']), '资料源暂不可读，无法确认匹配数量')
  assert.equal(intelResultLabel(0, 0, ['ready', 'error']), '资料源暂不可读，无法确认匹配数量')
  assert.equal(intelResultLabel(0, 0, ['ready']), '找到 0 条')
  assert.equal(intelResultLabel(2, 2, ['ready', 'error']), '已载入资料中匹配 2 条')
  assert.equal(intelResultLabel(2, 2, ['loading']), '正在载入资料，已匹配 2 条')
  assert.equal(intelResultLabel(10, 8, ['ready', 'error']), '已载入资料中匹配 10 条 · 当前显示 8 条')
})

test('ChatGPT client reads its independent source, retries failures and retains the last good cache', async () => {
  const input = index()
  let status = 404, calls = 0, time = 1000
  const client = createNewsClient('chatgpt', async (url, options) => {
    calls++
    assert.match(url, /^\/chatgpt-news-data\/index.json\?v=/)
    assert.equal(options.credentials, 'omit')
    assert.equal(options.cache, 'no-store')
    return new Response(JSON.stringify(input), { status })
  }, () => time)
  await assert.rejects(client.load(), /尚未接入或暂时无法读取/)
  status = 200
  const [a, b] = await Promise.all([client.load(), client.load()])
  assert.equal(a, b)
  assert.equal(calls, 2)
  status = 502
  await assert.rejects(client.load(true), /暂时无法读取/)
  assert.equal(await client.load(), a)
  time += 60001
  status = 200
  assert.deepEqual(await client.load(), input)
  const wrongSource = createNewsClient('chatgpt', async () => new Response(JSON.stringify({ ...input, bot_id: 'x-ai-digest' })))
  await assert.rejects(wrongSource.load(), /新闻索引版本不受支持/)
})

test('ChatGPT ordering uses collection time within a day and leaves Grok source ordering stable', () => {
  const earlier = record({ id: `chatgpt-${'c'.repeat(24)}`, origin_id: 'chatgpt-daily:fixture:002', collected_at: '2026-10-27T02:00:00Z' })
  const entries = newsReadingItems(index([earlier, record()]), 'chatgpt')
  assert.deepEqual(mergeReadingItems(entries).map(item => item.id), [record().id, earlier.id])
})
