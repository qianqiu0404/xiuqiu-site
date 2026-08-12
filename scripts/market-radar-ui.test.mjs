import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  buildStaticTradeTimeline,
  countOccurredTradeToday,
  groupHistoricalTradeTimeline,
  isSafePublicMarketUrl,
  isStrictMarketIso,
  mergeTradeTimelinePage,
  parseMarketEventDetail,
  parseMarketTimelineList,
  parseMarketTimelineSummary,
  partitionTradeTimeline,
  toTradeTimelineCard,
} from '../src/market-radar/timeline-presentation.ts'
import { mapPublicEventReportRow, mapPublicEventRow } from '../src/market-radar/public-event.ts'
import { publicEventReportRow, publicEventRowV2 } from './fixtures/market-radar-public-event-row.mjs'

const productionEvent = mapPublicEventRow(publicEventRowV2)
const healthyList = { status: 'healthy', snapshotId: productionEvent.snapshotId, asOf: productionEvent.snapshotAsOf,
  items: [productionEvent], nextCursor: null, message: null }
const healthySummary = {
  status: 'healthy', snapshotId: productionEvent.snapshotId, asOf: productionEvent.snapshotAsOf,
  generatedAt: '2026-08-11T02:10:00.000Z', latestEventAt: productionEvent.occurredAt,
  freshnessMinutes: 8, isDelayed: false, eventCount24h: 3, p0Count24h: 1, p1Count24h: 1,
  sources: [{ source: 'official', health: 'healthy', lastSuccessAt: '2026-08-11T02:08:00.000Z', message: null }],
  message: null,
}

function listWith(event, overrides = {}) {
  return { ...healthyList, items: [event], ...overrides }
}

test('real public row flows through the production mapper, strict parser and UI card mapper', () => {
  const parsed = parseMarketTimelineList(healthyList)
  assert.ok(parsed)
  const card = toTradeTimelineCard(parsed.items[0])
  assert.equal(card.id, publicEventRowV2.id)
  assert.equal(card.title, publicEventRowV2.title_zh)
  assert.equal(card.sourceUrl, publicEventRowV2.sources[0].url)
  assert.equal(card.detailHref, `/market-radar/events/${publicEventRowV2.id}`)
  assert.equal(Object.hasOwn(parsed.items[0], 'reports'), false)
})

test('runtime list parser fails closed on invalid calendars, unsafe evidence, missing sources and duplicate IDs', () => {
  assert.equal(isStrictMarketIso('2026-02-30T08:00:00+08:00'), false)
  assert.equal(isStrictMarketIso('1999-12-31T23:59:59Z'), false)
  for (const url of [
    'https://user:pass@example.com/story', 'http://127.0.0.1/private', 'http://169.254.169.254/latest/meta-data',
    'http://10.1.2.3/private', 'http://192.168.1.1/private', 'http://[::1]/private', 'https://metadata.google.internal/computeMetadata/v1/',
  ]) assert.equal(isSafePublicMarketUrl(url), false, url)
  assert.equal(isSafePublicMarketUrl('https://www.federalreserve.gov/newsevents.htm'), true)

  assert.equal(parseMarketTimelineList(listWith({ ...productionEvent, occurredAt: '2026-02-30T08:00:00+08:00' })), null)
  assert.equal(parseMarketTimelineList(listWith({ ...productionEvent, sourceCount: 0 })), null)
  assert.equal(parseMarketTimelineList(listWith({ ...productionEvent, sources: [] })), null)
  assert.equal(parseMarketTimelineList(listWith({ ...productionEvent, sources: [{ name: 'unsafe', url: 'http://127.0.0.1/private' }] })), null)
  assert.equal(parseMarketTimelineList({ ...healthyList, message: { secret: true } }), null)
  assert.equal(parseMarketTimelineList({ ...healthyList, items: [productionEvent, productionEvent] }), null)
  assert.equal(parseMarketTimelineList({ ...healthyList, nextCursor: '2026-02-30T08:00:00+08:00|event-id' }), null)
  assert.equal(parseMarketTimelineList(listWith({ ...productionEvent, reports: [] })), null)
  assert.equal(parseMarketTimelineList({ ...healthyList, snapshotId: 'market-2026-08-11-1111111111111111' }), null)
  assert.equal(parseMarketTimelineList({ ...healthyList, snapshotId: null, asOf: null }), null)
})

test('summary health remains an independent strict contract for mixed list-summary results', () => {
  assert.ok(parseMarketTimelineSummary(healthySummary))
  assert.equal(parseMarketTimelineSummary({ ...healthySummary, generatedAt: '2026-02-30T08:00:00+08:00' }), null)
  assert.equal(parseMarketTimelineSummary({ ...healthySummary, message: { leaked: true } }), null)
  assert.equal(parseMarketTimelineSummary({ ...healthySummary, sources: [{ ...healthySummary.sources[0], lastSuccessAt: 'not-a-date' }] }), null)
  assert.equal(parseMarketTimelineSummary({ ...healthySummary, eventCount24h: 1, p0Count24h: 1, p1Count24h: 1 }), null)
  assert.equal(parseMarketTimelineSummary({ ...healthySummary, snapshotId: null }), null)
  for (const key of ['eventCount24h', 'p0Count24h', 'p1Count24h']) {
    assert.equal(parseMarketTimelineSummary({ ...healthySummary, [key]: -1 }), null)
    assert.equal(parseMarketTimelineSummary({ ...healthySummary, [key]: 1.5 }), null)
  }
  assert.ok(parseMarketTimelineList(healthyList), 'a bad summary must not invalidate an independently healthy DB list')
})

test('detail is the only contract that accepts reports and validates every report URL and timestamp', () => {
  const report = mapPublicEventReportRow(publicEventReportRow)
  assert.ok(report)
  const detail = { ...productionEvent, reports: [report] }
  assert.ok(parseMarketEventDetail(detail))
  assert.equal(parseMarketEventDetail({ ...detail, reports: [{ ...report, sourceUrl: 'http://[::1]/private' }] }), null)
  assert.equal(parseMarketEventDetail({ ...detail, reports: [{ ...report, publishedAt: '2026-02-30T08:00:00+08:00' }] }), null)
  assert.equal(parseMarketEventDetail({ ...detail, reports: [report, report] }), null)
  assert.ok(parseMarketEventDetail({ ...productionEvent, reports: [] }), 'empty reports are an explicit valid detail state')
  assert.equal(parseMarketEventDetail({ ...productionEvent, reports: [{ ...report, isPrimary: false }] }), null)
  const secondary = { ...report, id: 'report-secondary', isPrimary: false }
  assert.ok(parseMarketEventDetail({ ...productionEvent, reports: [report, secondary] }))
  assert.equal(parseMarketEventDetail({ ...productionEvent, reports: [report, { ...secondary, isPrimary: true }] }), null)
})

test('pagination deduplicates IDs, requires a descending cursor and stops cursor replay', () => {
  const firstCard = toTradeTimelineCard(productionEvent)
  const requested = `${productionEvent.occurredAt}|${productionEvent.id}`
  const olderEvent = { ...productionEvent, id: 'older-event', slug: 'older-event', occurredAt: '2026-08-09T01:00:00.000Z' }
  const olderCursor = `${olderEvent.occurredAt}|${olderEvent.id}`
  const page = { ...healthyList, items: [productionEvent, olderEvent], nextCursor: olderCursor }
  const merged = mergeTradeTimelinePage([firstCard], page, requested, [])
  assert.deepEqual(merged.cards.map(card => card.id), [productionEvent.id, olderEvent.id])
  assert.equal(merged.nextCursor, olderCursor)
  assert.deepEqual(merged.requestedCursors, [requested])
  assert.equal(merged.stopped, false)

  const untrustedReplayItem = { ...olderEvent, id: 'must-not-append', slug: 'must-not-append' }
  const replay = mergeTradeTimelinePage(merged.cards, { ...healthyList, items: [untrustedReplayItem], nextCursor: requested }, olderCursor, merged.requestedCursors)
  assert.equal(replay.nextCursor, null)
  assert.equal(replay.stopped, true)
  assert.deepEqual(replay.cards.map(card => card.id), merged.cards.map(card => card.id))

  const forwardCursor = '2026-08-11T01:00:00.000Z|future-event'
  const failedProgress = mergeTradeTimelinePage(merged.cards, { ...healthyList, items: [], nextCursor: forwardCursor }, olderCursor, merged.requestedCursors)
  assert.equal(failedProgress.nextCursor, null)
  assert.equal(failedProgress.stopped, true)
})

test('future is ascending, occurred is descending and grouped by stable Shanghai date', () => {
  const card = toTradeTimelineCard(productionEvent)
  const items = [
    { ...card, id: 'future-later', occurredAt: '2026-08-12T12:00:00+08:00' },
    { ...card, id: 'past-older', occurredAt: '2026-08-09T23:30:00+08:00' },
    { ...card, id: 'future-sooner', occurredAt: '2026-08-11T12:00:00+08:00' },
    { ...card, id: 'past-newer', occurredAt: '2026-08-10T00:30:00+08:00' },
  ]
  const now = new Date('2026-08-11T10:00:00+08:00')
  const result = partitionTradeTimeline(items, now)
  assert.deepEqual(result.future.map(item => item.id), ['future-sooner', 'future-later'])
  assert.deepEqual(result.historical.map(item => item.id), ['past-newer', 'past-older'])
  const groups = groupHistoricalTradeTimeline(result.historical)
  assert.deepEqual(groups.map(group => group.date), ['2026-08-10', '2026-08-09'])
  assert.equal(countOccurredTradeToday([{ ...card, occurredAt: '2026-08-11T09:00:00+08:00' }, ...result.future], now), 1)
})

test('static schedule keeps committed provenance and never masquerades as the live DB timeline', () => {
  const radar = {
    date: '2026-08-10', slug: '2026-08-10', title: '交易雷达', summary: '快照', publish: true,
    reviewStatus: 'automated', generatedAt: '2026-08-10T08:00:00+08:00', sourceUrls: ['https://www.bls.gov/schedule/'],
    events: [{
      id: 'scheduled-cpi', priority: 'P0', status: 'scheduled', category: 'macro', title: 'CPI 排期', fact: 'BLS 已公布排期。',
      whyWatch: '发布后再验证。', assets: ['BTC'], watchFor: '等待正式数据。', invalidation: '日程变更即失效。',
      sourceName: 'BLS', sourceUrl: 'https://www.bls.gov/schedule/', sourcePublishedAt: '2026-08-01', eventAt: '2026-08-12T20:30:00+08:00',
    }],
  }
  const [item] = buildStaticTradeTimeline(radar)
  assert.equal(item.origin, 'static')
  assert.equal(item.statusLabel, '已排期')
  assert.equal(item.occurredAt, '2026-08-12T20:30:00+08:00')
  assert.equal(item.publishedAt, radar.generatedAt)
})

test('overview, card, detail, routing and deployment keep the T6 evidence boundaries', async () => {
  const [overview, card, detail, dated, router, vercel] = await Promise.all([
    readFile(new URL('../src/pages/MarketRadarPage.vue', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/MarketTimelineCard.vue', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/MarketRadarEventPage.vue', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/MarketRadarDetailPage.vue', import.meta.url), 'utf8'),
    readFile(new URL('../src/router/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
  ])
  assert.match(overview, /events\?window=24&limit=30/)
  assert.doesNotMatch(overview, /window=168/)
  assert.match(overview, /cursor=\$\{encodeURIComponent\(requestedCursor\)\}/)
  assert.match(overview, /mergeTradeTimelinePage/)
  assert.match(overview, /更多历史暂时无法读取；已显示事件保持不变/)
  assert.match(overview, /paginationRequest\?\.abort/)
  assert.match(overview, /<dt>数据新鲜度<\/dt>/)
  assert.match(overview, /summary\.value\?\.isDelayed/)
  assert.match(overview, /最新事件/)
  assert.doesNotMatch(overview, /\/reports|events\/\$\{|events\/\${/)
  assert.match(overview, /静态排期快照/)
  assert.match(overview, /较远预定事件不来自数据库 live 时间线/)
  assert.match(overview, /futureGroups/)
  assert.match(overview, /trade-radar-date-group--future/)
  assert.match(overview, /group\.items\.length }} 条/)
  assert.match(overview, /汇总状态不可用；事件列表仍为数据库公开记录。/)
  assert.match(overview, /onBeforeUnmount[\s\S]*requestVersion \+= 1[\s\S]*activeRequest\?\.abort/)
  assert.match(card, /item\.priority !== 'P2'/)
  assert.match(card, /<details v-else/)
  assert.match(card, /trade-event-signal/)
  assert.match(card, /formatRailTime/)
  assert.match(card, /timeZone: 'Asia\/Shanghai'/)
  assert.match(card, /item\.sourceName[\s\S]*item\.categoryLabel[\s\S]*item\.priority/)
  assert.match(card, /trade-event-fact[\s\S]*trade-event-analysis/)
  assert.match(card, /rel="noopener noreferrer"/)
  assert.match(card, /:to="item\.detailHref"/)
  assert.doesNotMatch(`${overview}\n${card}\n${detail}`, /v-html|innerHTML/)
  assert.match(detail, /parseMarketEventDetail/)
  assert.match(detail, /reports\.find\(report => report\.isPrimary\) \|\| null/)
  assert.doesNotMatch(detail, /\|\| event\.value\?\.reports\[0\]/)
  assert.match(detail, /report\.isPrimary/)
  assert.match(detail, /payload\.id !== id && payload\.slug !== id/)
  assert.match(detail, /来源报道时间线/)
  assert.match(detail, /暂无可展示的来源报道/)
  assert.match(detail, /responseStatus === 404/)
  assert.match(detail, /indexable: false/)
  assert.match(dated, /requestAnimationFrame/)
  assert.match(dated, /hash === '#main-content'/)
  assert.ok(router.indexOf("path: '/market-radar/events/:id'") < router.indexOf("path: '/market-radar/:date'"))
  const deployment = JSON.parse(vercel)
  assert.deepEqual(deployment.rewrites.find(rule => rule.source === '/market-radar/events/:id'), {
    source: '/market-radar/events/:id', destination: '/market-radar/index.html',
  })
  assert.equal(deployment.headers.find(rule => rule.source === '/market-radar/events/:id')?.headers[0]?.value, 'noindex, nofollow')
})

test('browser fixture can independently fail summary without replacing a healthy event list', async () => {
  const fixture = await readFile(new URL('./market-radar-browser-fixture.mjs', import.meta.url), 'utf8')
  assert.match(fixture, /'summary-503', 'summary-unconfigured', 'summary-invalid'/)
  assert.match(fixture, /mode === 'summary-invalid'/)
  assert.match(fixture, /mode === 'unconfigured'\) return json\(res, 200, \{ status: 'unconfigured', items: \[\]/)
})
