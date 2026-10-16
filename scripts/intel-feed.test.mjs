import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildIntelItems, buildIntelTopics, latestIntelItems } from './generate-intel-feed.mjs'
import { intelItemCount, intelLatestDate, intelLatestItems, intelTopics, loadIntelItems } from '../src/data/generatedIntelFeed.ts'
import {
  continuingIntelTopics,
  filterIntel,
  getIntelFreshness,
  groupIntelByDate,
  intelSourceLabel,
  intelTopicLabel,
  topicsForFilter,
} from '../src/data/intelPresentation.ts'

const item = (overrides) => ({ id: 'x', kind: 'learning', date: '2026-10-13', domain: 'ai', topic: 'agent', title: 'T', summary: 'S', href: '/radar/2026-10-13#x', ...overrides })

test('generated intel index and monthly chunks match the content sources', async () => {
  const built = buildIntelItems()
  const loaded = await loadIntelItems()
  assert.deepEqual(loaded, JSON.parse(JSON.stringify(built)))
  assert.equal(intelItemCount, built.length)
  assert.equal(intelLatestDate, built[0].date)
  assert.deepEqual(intelLatestItems, JSON.parse(JSON.stringify(latestIntelItems(built))))
  assert.deepEqual(intelTopics, buildIntelTopics(built))
  assert.ok(built.some(entry => entry.kind === 'learning') && built.some(entry => entry.kind === 'market') && built.some(entry => entry.kind === 'review'))
  assert.equal(new Set(built.map(entry => entry.id)).size, built.length, 'intel ids must be unique')
})

test('intel items link to existing readers and never expose brief bodies', () => {
  for (const entry of buildIntelItems()) {
    assert.match(entry.href, /^\/(radar\/\d{4}-\d{2}-\d{2}#|market-radar\/\d{4}-\d{2}-\d{2}#|radar\/review\/)/)
    assert.ok(!('mechanism' in entry) && !('workedExample' in entry))
  }
})

test('newest day first, reviews before learning before market within a day', () => {
  const built = buildIntelItems({
    radars: [], reviews: [{ slug: '2026-08-14--2026-10-13', periodEnd: '2026-10-13', title: 'R', summary: 'review summary' }],
    marketRadars: [{ date: '2026-10-13', events: [{ id: 'e1', category: 'macro', title: 'M', whyWatch: 'w', fact: 'f', sourceName: 'Fed', sourceUrl: 'https://www.federalreserve.gov/x', priority: 'P0' }] }],
  })
  assert.deepEqual(built.map(entry => entry.kind), ['review', 'market'])
  assert.equal(built[1].flags.priority, 'P0')
  assert.equal(built[1].topic, 'market_macro')
})

test('latest window and topics are computed from the newest date', () => {
  const items = [item({ id: 'a', date: '2026-10-13' }), item({ id: 'b', date: '2026-10-07' }), item({ id: 'c', date: '2026-10-06', topic: 'l2', domain: 'web3' })]
  assert.deepEqual(latestIntelItems(items).map(entry => entry.id), ['a', 'b'])
  const topics = buildIntelTopics(items)
  assert.deepEqual(topics.map(entry => entry.topic), ['agent', 'l2'])
  assert.deepEqual(topics[0], { topic: 'agent', domain: 'ai', count: 2, firstSeen: '2026-10-07', lastSeen: '2026-10-13' })
  assert.deepEqual(topicsForFilter(topics, 'web3').map(entry => entry.topic), ['l2'])
})

test('filters keep reviews visible in every domain and search titles and summaries', () => {
  const items = [item({ id: 'a' }), item({ id: 'm', domain: 'market', kind: 'market', topic: 'market_macro', title: 'CPI' }), item({ id: 'r', domain: 'review', kind: 'review', topic: 'trend_review' })]
  assert.deepEqual(filterIntel(items, { filter: 'market' }).map(entry => entry.id), ['m', 'r'])
  assert.deepEqual(filterIntel(items, { filter: 'all', search: 'cpi' }).map(entry => entry.id), ['m'])
  assert.deepEqual(groupIntelByDate(items).map(day => day.items.length), [3])
})

test('continuing badge only counts editions inside the 30-day window', () => {
  const items = [
    item({ id: '1', date: '2026-10-13' }), item({ id: '2', date: '2026-10-01' }),
    item({ id: '3', date: '2026-08-13', topic: 'l2' }), item({ id: '4', date: '2026-08-12', topic: 'l2' }),
  ]
  assert.deepEqual([...continuingIntelTopics(items)], ['agent'])
})

test('freshness banner is explicit about publishing gaps', () => {
  const now = new Date('2026-10-13T04:00:00Z')
  assert.equal(getIntelFreshness('2026-10-13', now).state, 'today')
  assert.equal(getIntelFreshness('2026-10-12', now).state, 'recent')
  const stale = getIntelFreshness('2026-08-13', now)
  assert.equal(stale.state, 'stale')
  assert.equal(stale.ageDays, 61)
  assert.match(stale.label, /已 61 天未更新 · 最后一期 2026-08-13/)
  assert.equal(getIntelFreshness(null, now).state, 'unknown')
})

test('labels cover market topics and source tiers', () => {
  assert.equal(intelTopicLabel('market_macro'), '宏观')
  assert.equal(intelTopicLabel('model_inference'), 'model inference')
  assert.equal(intelSourceLabel(item({ source: { name: 'vLLM', tier: 'tier1', url: 'https://github.com/x' } })), '一手来源 · vLLM')
  assert.equal(intelSourceLabel(item({ source: { name: 'Fed', url: 'https://www.federalreserve.gov/x' } })), '来源 · Fed')
  assert.equal(intelSourceLabel(item({})), undefined)
})

test('public intel API files carry a schema version and absolute URLs', () => {
  const latest = JSON.parse(readFileSync(new URL('../public/data/intel/latest.json', import.meta.url), 'utf8'))
  const topics = JSON.parse(readFileSync(new URL('../public/data/intel/topics.json', import.meta.url), 'utf8'))
  assert.equal(latest.schemaVersion, 1)
  assert.equal(latest.latestDate, intelLatestDate)
  assert.ok(latest.items.every(entry => entry.url.startsWith('https://xiuqiu-site.vercel.app/')))
  assert.deepEqual(topics.topics.map(entry => entry.topic), intelTopics.map(entry => entry.topic))
})

test('home is the intel feed, the old home moved to /about, and topic pages are routed', () => {
  const router = readFileSync(new URL('../src/router/index.ts', import.meta.url), 'utf8')
  assert.match(router, /path: '\/',\s*name: 'home',\s*component: \(\) => import\('\.\.\/features\/intel\/pages\/IntelHomePage\.vue'\)/)
  assert.match(router, /path: '\/about',[\s\S]*?features\/about\/pages\/HomePage\.vue/)
  assert.match(router, /path: '\/topics\/:topic',[\s\S]*?features\/intel\/pages\/IntelTopicPage\.vue/)
  const sitemap = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8')
  for (const topic of intelTopics) assert.match(sitemap, new RegExp(`/topics/${topic.topic}<`))
  assert.match(sitemap, /\/about</)
})

test('both daily PR gates may commit the regenerated intel feed', () => {
  const learning = readFileSync(new URL('../.github/workflows/daily-radar.yml', import.meta.url), 'utf8')
  const market = readFileSync(new URL('../.github/workflows/static-market-radar.yml', import.meta.url), 'utf8')
  for (const workflow of [learning, market]) {
    assert.match(workflow, /generatedIntelFeed/)
    assert.match(workflow, /public\/data\/intel/)
  }
})

test('dateline helpers format Shanghai calendar dates in Chinese', async () => {
  const { intelDayLabel, shanghaiToday, intelKindLabel } = await import('../src/data/intelPresentation.ts')
  assert.equal(intelDayLabel('2026-10-15'), '10月15日 周四')
  assert.equal(intelDayLabel('2026-08-13'), '8月13日 周四')
  assert.equal(intelDayLabel('bad'), 'bad')
  assert.equal(shanghaiToday(new Date('2026-10-14T17:00:00Z')), '2026-10-15')
  assert.equal(shanghaiToday(new Date('2026-10-14T15:00:00Z')), '2026-10-14')
  assert.equal(intelKindLabel('market'), '市场雷达')
})
