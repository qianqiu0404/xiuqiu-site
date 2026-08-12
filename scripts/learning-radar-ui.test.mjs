import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { mapPublicStoryReportRow, mapPublicStoryUpdateRow, mapPublicTimelineItemRow } from '../src/learning-radar/public-story.ts'
import {
  buildStaticTimeline,
  countOccurredToday,
  groupHistoricalTimeline,
  parseLearningSummary,
  parseLearningStory,
  parseLearningTimelineList,
  partitionTimelineByOccurrence,
  rankFeaturedTimeline,
  toTimelineCardViewModel,
} from '../src/learning-radar/timeline-presentation.ts'
import { latestRadars } from '../src/data/generatedRadars.ts'
import { publicLearningTimelineRow, publicLearningReportRow, publicLearningUpdateRow } from './fixtures/learning-radar-public-story-row.mjs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('real public row flows through the production mapper, API parser and timeline view model', () => {
  const mapped = mapPublicTimelineItemRow(publicLearningTimelineRow)
  const apiPayload = parseLearningTimelineList({ status: 'healthy', items: [mapped], nextCursor: null })
  assert.ok(apiPayload)
  const card = toTimelineCardViewModel(apiPayload.items[0])
  assert.deepEqual({ id: card.id, title: card.title, category: card.category, sourceName: card.sourceName,
    sourceUrl: card.sourceUrl, detailHref: card.detailHref }, {
    id: publicLearningTimelineRow.id,
    title: publicLearningTimelineRow.title_zh,
    category: publicLearningTimelineRow.category,
    sourceName: publicLearningTimelineRow.primary_source.name,
    sourceUrl: publicLearningTimelineRow.primary_source.url,
    detailHref: `/radar/stories/${publicLearningTimelineRow.slug}`,
  })
  assert.equal(card.whySelected, publicLearningTimelineRow.why_selected_zh)
  assert.equal(card.sourceCount, 1)
  const report = mapPublicStoryReportRow(publicLearningReportRow)
  const update = mapPublicStoryUpdateRow(publicLearningUpdateRow)
  assert.ok(report && update)
  assert.ok(parseLearningStory({ ...mapped, reports: [report], updates: [update] }))

  const dateBackedReport = mapPublicStoryReportRow({
    ...publicLearningReportRow,
    published_at: new Date(publicLearningReportRow.published_at),
  })
  assert.ok(dateBackedReport, 'Neon timestamptz Date objects must survive the production mapper')
  assert.equal(dateBackedReport.publishedAt, publicLearningReportRow.published_at)
  assert.equal([dateBackedReport].filter(item => item.isPrimary).length, 1)
  const dateBackedUpdate = mapPublicStoryUpdateRow({
    ...publicLearningUpdateRow,
    occurred_at: new Date(publicLearningUpdateRow.occurred_at),
  })
  assert.ok(dateBackedUpdate, 'Neon timestamptz Date objects must survive the update mapper')
  assert.equal(dateBackedUpdate.occurredAt, publicLearningUpdateRow.occurred_at)
  assert.ok(parseLearningStory({ ...mapped, reports: [dateBackedReport], updates: [dateBackedUpdate] }))
})

test('runtime API validation fails closed for malformed enums, dates, cursors, arrays and source URLs', () => {
  const mapped = mapPublicTimelineItemRow(publicLearningTimelineRow)
  const list = item => ({ status: 'healthy', items: [item], nextCursor: null })
  for (const invalid of [
    { ...mapped, category: 'market' },
    { ...mapped, titleZh: '' },
    { ...mapped, occurredAt: 'tomorrow' },
    { ...mapped, occurredAt: '2026-02-30T01:00:00.000Z' },
    { ...mapped, primarySource: { ...mapped.primarySource, url: 'javascript:alert(1)' } },
    { ...mapped, primarySource: { ...mapped.primarySource, url: 'http://127.0.0.1/private' } },
    { ...mapped, primarySource: { ...mapped.primarySource, url: 'http://metadata.google.internal/latest/meta-data' } },
    { ...mapped, primarySource: { ...mapped.primarySource, url: 'https://example.com/reserved' } },
    { ...mapped, primarySource: { ...mapped.primarySource, url: 'https://user:pass@www.postgresql.org/docs' } },
    { ...mapped, sourceCount: 0, primarySource: null },
  ]) assert.equal(parseLearningTimelineList(list(invalid)), null)
  assert.equal(parseLearningTimelineList({ ...list(mapped), nextCursor: 'broken' }), null)
  assert.equal(parseLearningTimelineList({ ...list(mapped), nextCursor: '2026-02-30T01:00:00.000Z|story' }), null)
  assert.equal(parseLearningTimelineList({ status: 'healthy', items: {}, nextCursor: null }), null)
  assert.equal(parseLearningTimelineList({ ...list(mapped), message: { unsafe: true } }), null)
  assert.equal(parseLearningTimelineList({ status: 'healthy', items: [mapped, { ...mapped }], nextCursor: null }), null)
  const report = mapPublicStoryReportRow(publicLearningReportRow)
  assert.ok(report)
  assert.equal(mapPublicStoryReportRow({ ...publicLearningReportRow, published_at: null }), null)
  assert.equal(mapPublicStoryReportRow({ ...publicLearningReportRow, published_at: 'not-a-date' }), null)
  assert.equal(mapPublicStoryReportRow({ ...publicLearningReportRow, published_at: new Date('not-a-date') }), null)
  assert.equal(mapPublicStoryUpdateRow({ ...publicLearningUpdateRow, occurred_at: null }), null)
  assert.equal(mapPublicStoryUpdateRow({ ...publicLearningUpdateRow, occurred_at: 'not-a-date' }), null)
  assert.equal(mapPublicStoryUpdateRow({ ...publicLearningUpdateRow, occurred_at: new Date('not-a-date') }), null)
  assert.equal(parseLearningStory({ ...mapped, reports: [{ ...report, sourceUrl: 'http://[::1]/private' }], updates: [] }), null)
  assert.equal(parseLearningStory({ ...mapped, reports: [], updates: [publicLearningUpdateRow] }), null,
    'database rows must pass through their production camelCase mappers before reaching UI')
  const validSummary = {
    status: 'healthy', generatedAt: mapped.publishedAt, latestStoryAt: mapped.publishedAt,
    freshnessMinutes: 1, isDelayed: false, todayCount: 1, keyCount: 1, noteworthyCount: 0,
    sources: [{ source: 'fixture', health: 'healthy', lastSuccessAt: mapped.publishedAt }],
  }
  assert.ok(parseLearningSummary(validSummary))
  assert.equal(parseLearningSummary({ ...validSummary, message: { unsafe: true } }), null)
  assert.equal(parseLearningSummary({ ...validSummary,
    sources: [{ ...validSummary.sources[0], message: { unsafe: true } }] }), null)
})

test('committed daily reports make an explicit, separately ranked static fallback', () => {
  const fallback = buildStaticTimeline(latestRadars)
  const expectedLearningItemCount = latestRadars.reduce((count, radar) => count
    + Number(Boolean(radar.aiTip))
    + Number(Boolean(radar.web3Design))
    + Number(Boolean(radar.vibeProject))
    + Number(Boolean(radar.readingPick)), 0)
  const marketSignalTitles = new Set(latestRadars.flatMap(radar => radar.marketSignals.map(item => item.title)))
  assert.equal(fallback.length, expectedLearningItemCount, 'market signals must not affect Learn snapshot counts')
  assert.ok(fallback.every(item => !marketSignalTitles.has(item.title)), 'market signal titles must not enter Learn snapshots')
  assert.ok(fallback.every(item => item.importance === 'watch' && item.importanceLabel === '静态快照'))
  assert.ok(fallback.every(item => item.isStaticSnapshot && item.detailHref.startsWith('/radar/2026-')))
  assert.deepEqual(rankFeaturedTimeline(fallback).map(item => item.id), fallback.slice(0, 3).map(item => item.id))
})

test('future items sort ascending, history sorts descending and far-future items never count as today', () => {
  const mapped = toTimelineCardViewModel(mapPublicTimelineItemRow(publicLearningTimelineRow))
  const past = { ...mapped, id: 'past', occurredAt: '2026-08-11T01:00:00.000Z' }
  const futureNear = { ...mapped, id: 'future-near', occurredAt: '2026-08-11T04:00:00.000Z' }
  const futureFar = { ...mapped, id: 'future-far', occurredAt: '2099-08-11T04:00:00.000Z' }
  const now = new Date('2026-08-11T03:00:00.000Z')
  const partitioned = partitionTimelineByOccurrence([futureFar, past, futureNear], now)
  assert.deepEqual(partitioned.historical.map(item => item.id), ['past'])
  assert.deepEqual(partitioned.future.map(item => item.id), ['future-near', 'future-far'])
  assert.equal(countOccurredToday([past, futureNear, futureFar], now), 1)
  const previousShanghaiDay = { ...mapped, id: 'previous-day', occurredAt: '2026-08-10T15:59:00.000Z' }
  const groups = groupHistoricalTimeline([past, previousShanghaiDay])
  assert.deepEqual(groups.map(group => ({ date: group.date, ids: group.items.map(item => item.id) })), [
    { date: '2026-08-11', ids: ['past'] },
    { date: '2026-08-10', ids: ['previous-day'] },
  ])
})

test('learning UI keeps the static v2 authority while preserving detail and route compatibility', () => {
  const page = read('../src/pages/RadarPage.vue')
  const card = read('../src/components/TimelineCard.vue')
  const detail = read('../src/pages/LearningRadarStoryPage.vue')
  const router = read('../src/router/index.ts')
  const css = read('../src/styles/radar-timeline.css')
  const vercel = JSON.parse(read('../vercel.json'))
  assert.doesNotMatch(page, /fetch\(|new AbortController\(\)|parseLearningTimelineList/)
  assert.match(page, /latestRadars, radarIndex/)
  assert.match(page, /:data-snapshot-id="latestRadar\?\.snapshotId"/)
  assert.match(page, /:data-snapshot-as-of="latestRadar\?\.asOf"/)
  assert.match(page, /ResearchOps 门禁通过/)
  assert.match(page, /暂无已公开日报/)
  assert.match(page, /人工复核周报/)
  assert.match(page, /历史档案/)
  assert.match(page, /`\/radar\/week\/\$\{latestWeekly\.slug\}`/)
  assert.match(card, /timeline-card__rail/)
  assert.match(card, /formatRailTime/)
  assert.match(card, /timeZone: 'Asia\/Shanghai'/)
  assert.match(card, /item\.sourceName[\s\S]*item\.categoryLabel[\s\S]*item\.importanceLabel/)
  assert.match(card, /timeline-card__summary[\s\S]*timeline-card__why/)
  assert.doesNotMatch(card, /<details/)
  assert.doesNotMatch(card, /v-html/)
  assert.match(card, /target="_blank" rel="noopener noreferrer"/)
  assert.match(detail, /\/api\/learning-radar\/stories\//)
  assert.match(detail, /unavailable === '404'/)
  assert.match(detail, /503/)
  assert.match(detail, /来源报道时间线/)
  assert.match(detail, /Follow-up updates/)
  assert.match(detail, /暂无后续更新/)
  assert.doesNotMatch(detail, /Key points|<h2>要点/)
  assert.match(detail, /v-if="story\.reports\.length"/)
  assert.match(detail, /暂无可展示的来源报道/)
  assert.match(detail, /indexable: false/)
  assert.match(detail, /payload\.slug !== slug/)
  assert.match(detail, /onBeforeUnmount/)
  assert.match(detail, /requestVersion \+= 1/)
  const storyRoute = router.indexOf("path: '/radar/stories/:slug'")
  const broadRoute = router.indexOf("path: '/radar/:date'")
  assert.ok(storyRoute > 0 && storyRoute < broadRoute)
  assert.deepEqual(vercel.rewrites.find(rule => rule.source === '/radar/stories/:slug'),
    { source: '/radar/stories/:slug', destination: '/radar/index.html' })
  assert.deepEqual(vercel.headers.find(rule => rule.source === '/radar/stories/:slug')?.headers,
    [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }])
  assert.doesNotMatch(JSON.stringify(vercel.rewrites), /\/api\/\(\.\*\)|\/assets\/|\/radar\/:date|\/radar\/week/)
  assert.match(css, /min-height: 44px/)
  assert.match(css, /grid-template-columns: 6\.5rem minmax\(0, 1fr\)/)
  assert.match(css, /timeline-card__rail::before/)
  assert.match(css, /timeline-card__rail > span/)
  assert.match(css, /@media \(max-width: 520px\)/)
  assert.match(css, /\.learn-timeline-hero \{\s*padding: 104px 0 48px;/)
  assert.match(css, /\.learn-ledger \{ padding: clamp\(48px, 5vw, 64px\) 0 82px;/)
  assert.match(css, /font-size: clamp\(32px, 10\.2vw, 39px\)/)
  assert.match(css, /\.learn-timeline-hero \{ padding: 60px 0 16px; \}/)
  assert.match(css, /\.learn-ledger \{ padding-block: 18px 56px; \}/)
  assert.match(css, /\.learn-category-filter \{ flex-wrap: nowrap;[\s\S]*overflow-x: auto;/)
  assert.match(css, /\.learn-filter-count \{ margin-bottom: 10px;/)
  assert.match(css, /prefers-reduced-motion: reduce/)
  assert.equal((page.match(/<main\b/g) || []).length, 0)
  assert.equal((detail.match(/<main\b/g) || []).length, 0)
})
