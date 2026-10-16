import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadRadarReviews, validateRadarReview } from './generate-radar-reviews.mjs'
import { radarReviews } from '../src/data/generatedRadarReviews.ts'
import {
  reviewDomainCounts,
  reviewMilestoneCount,
  reviewPeriodDays,
  trendMonthTicks,
  trendSpan,
  trendTrack,
} from '../src/data/radarReviewPresentation.ts'

function review(overrides = {}) {
  const trend = (id, domain, topic, milestones) => ({
    id, domain, topic, title: `${id} 趋势标题`, thesis: '这是一条足够长的趋势判断，用来说明这两个月里工程方向如何移动。',
    signal: '3 个版本，按 GitHub releases 统计。', milestones,
    implication: '对工程的意义写在这里，说明要改什么。', falsifier: '什么情况会推翻这条判断，写清楚条件。',
  })
  return {
    slug: '2026-08-14--2026-10-13', periodStart: '2026-08-14', periodEnd: '2026-10-13',
    title: '两个月趋势回顾测试', summary: '这是一段足够长的摘要，用于测试趋势回顾的校验与展示逻辑。',
    researchedAt: '2026-10-13T12:00:00+08:00', publish: true, reviewStatus: 'automated',
    trends: [
      trend('ai-a', 'ai', 'agent', [{ date: '2026-08-19', text: '第一个里程碑的完整描述文字', url: 'https://github.com/openai/openai-agents-python/releases/tag/v0.22.0' }]),
      trend('web3-a', 'web3', 'protocol', [
        { date: '2026-09-17', text: '第一个协议里程碑的完整描述', url: 'https://github.com/paradigmxyz/reth/releases/tag/v2.6.0' },
        { date: '2026-10-13', text: '期末那天发生的里程碑描述', url: 'https://github.com/ethereum/go-ethereum/releases/tag/v1.17.8' },
      ]),
    ],
    ...overrides,
  }
}

test('published review covers both domains with in-period, dated, primary-source milestones', () => {
  assert.deepEqual(radarReviews, loadRadarReviews())
  assert.ok(radarReviews.length >= 1)
  for (const item of radarReviews) {
    assert.ok(item.trends.some(trend => trend.domain === 'ai'))
    assert.ok(item.trends.some(trend => trend.domain === 'web3'))
    for (const trend of item.trends) {
      for (const milestone of trend.milestones) {
        assert.ok(milestone.date >= item.periodStart && milestone.date <= item.periodEnd)
        assert.ok(!/aihot|x\.com|twitter|reddit|discord/.test(milestone.url), milestone.url)
      }
    }
  }
})

test('validator fails closed on out-of-period, unordered, discovery-only or one-domain reviews', () => {
  assert.doesNotThrow(() => validateRadarReview(review()))
  const late = review()
  late.trends[0].milestones[0].date = '2026-10-14'
  assert.throws(() => validateRadarReview(late), /outside the review period/)
  const unordered = review()
  unordered.trends[1].milestones.reverse()
  assert.throws(() => validateRadarReview(unordered), /date order/)
  const discovery = review()
  discovery.trends[0].milestones[0].url = 'https://aihot.virxact.com/item/1'
  assert.throws(() => validateRadarReview(discovery), /discovery-only/)
  const oneDomain = review({ trends: [review().trends[0], { ...review().trends[0], id: 'ai-b', topic: 'safety' }] })
  assert.throws(() => validateRadarReview(oneDomain), /must cover web3/)
  assert.throws(() => validateRadarReview(review({ slug: 'wrong-slug' })), /slug must be periodStart--periodEnd/)
  assert.throws(() => validateRadarReview(review({ reviewStatus: 'human' })), /reviewStatus/)
})

test('trend track places milestones and month ticks on the review calendar', () => {
  const item = validateRadarReview(review())
  assert.equal(reviewPeriodDays(item), 61)
  assert.deepEqual(trendMonthTicks(item).map(tick => tick.label), ['9 月', '10 月'])
  const [first, last] = trendTrack(item, item.trends[1])
  assert.ok(first.offset > 0 && first.offset < 100)
  assert.equal(last.offset, 100)
  assert.equal(trendTrack(item, { milestones: [{ date: '2026-08-14', text: 'x', url: 'https://a.example.org' }] })[0].offset, 0)
  assert.deepEqual(trendSpan(trendTrack(item, item.trends[1])), { from: first.offset, to: 100 })
  assert.deepEqual(trendSpan([]), { from: 0, to: 0 })
  assert.deepEqual(reviewDomainCounts(item), { ai: 1, web3: 1 })
  assert.equal(reviewMilestoneCount(item), 3)
})

test('review route, sitemap and radar entry point are wired', () => {
  const router = readFileSync(new URL('../src/router/index.ts', import.meta.url), 'utf8')
  assert.ok(router.indexOf("path: '/radar/review/:period'") < router.indexOf("path: '/radar/:date'"), 'review route must precede /radar/:date')
  const sitemap = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8')
  for (const item of radarReviews) assert.match(sitemap, new RegExp(`/radar/review/${item.slug}<`))
})
