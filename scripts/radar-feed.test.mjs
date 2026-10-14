import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { buildJsonFeed, buildLlmsTxt, buildRadarFeedItems, buildRss } from './radar-feed.mjs'
import {
  continuingRadarTopics,
  countRadarFeedTopics,
  filterRadarFeed,
  groupRadarFeedByDate,
} from '../src/data/radarPresentation.ts'
import { dailyRadars } from '../src/data/generatedRadarAll.ts'
import { loadRadarFeed, radarFeedItemCount } from '../src/data/generatedRadarFeed.ts'

function brief(id, domain, topic, overrides = {}) {
  return {
    id, domain, topic, title: `${id} title`, whatHappened: 'w', mechanism: 'secret mechanism body', workedExample: 'e',
    whyItMatters: 'why it matters & <matters>', risksAndLimits: [], nextQuestions: [],
    sources: [{ tier: 'tier1', role: 'event', kind: 'official_release', name: `${id} source`, url: `https://example.com/${id}` }],
    ...overrides,
  }
}

const v2 = {
  date: '2026-08-13', slug: '2026-08-13', schemaVersion: 2, marketSignals: [],
  briefs: [brief('a1', 'ai', 'agent'), brief('w1', 'web3', 'protocol')],
  deepDive: { ...brief('d1', 'ai', 'agent'), basedOnBriefId: 'a1' },
}
const legacy = {
  date: '2026-07-14', slug: '2026-07-14', marketSignals: [{ title: 'Signal', summary: 'Signal summary' }],
  aiTip: { title: 'Tip', summary: 'Tip summary' },
}

test('feed flattens v2 briefs and legacy sections with public-only fields', () => {
  const items = buildRadarFeedItems([v2, legacy])
  assert.deepEqual(items.map(item => item.id), ['a1', 'w1', '2026-07-14-signal', '2026-07-14-ai'])
  assert.equal(items[0].isDeepDive, true)
  assert.equal(items[0].sourceTier, 'tier1')
  assert.equal(items[2].anchor, 'industry-signals')
  assert.ok(items.every(item => !('mechanism' in item)))
})

test('rss, json feed and llms.txt escape content and link to brief anchors', () => {
  const items = buildRadarFeedItems([v2])
  const rss = buildRss(items)
  assert.match(rss, /<link>https:\/\/xiuqiu-site\.vercel\.app\/radar\/2026-08-13#a1<\/link>/)
  assert.match(rss, /why it matters &amp; &lt;matters&gt;/)
  assert.doesNotMatch(rss, /secret mechanism body/)
  const json = JSON.parse(buildJsonFeed(items))
  assert.equal(json.version, 'https://jsonfeed.org/version/1.1')
  assert.equal(json.items[0].external_url, 'https://example.com/a1')
  assert.match(buildLlmsTxt(items), /\/radar\/rss\.xml/)
})

test('feed helpers filter, group and detect continuing topics', () => {
  const items = [
    { date: '2026-08-13', domain: 'ai', topic: 'agent', title: 'Agent state', summary: 'resume' },
    { date: '2026-08-13', domain: 'web3', topic: 'protocol', title: 'Sui', summary: 'verify' },
    { date: '2026-08-12', domain: 'ai', topic: 'agent', title: 'MCP', summary: 'transport' },
  ]
  assert.equal(filterRadarFeed(items, { domain: 'ai' }).length, 2)
  assert.equal(filterRadarFeed(items, { domain: 'all', topic: 'protocol' }).length, 1)
  assert.equal(filterRadarFeed(items, { domain: 'all', search: 'MCP' })[0].title, 'MCP')
  assert.deepEqual(groupRadarFeedByDate(items).map(day => day.items.length), [2, 1])
  assert.deepEqual(countRadarFeedTopics(items)[0], { topic: 'agent', count: 2 })
  assert.deepEqual([...continuingRadarTopics(items)], ['agent'])
})

test('generated feed stays aligned with the published archive', async () => {
  const radarFeedItems = await loadRadarFeed()
  assert.equal(radarFeedItemCount, radarFeedItems.length)
  assert.deepEqual(radarFeedItems, JSON.parse(JSON.stringify(buildRadarFeedItems(dailyRadars))))
  assert.equal(readFileSync(new URL('../public/radar/rss.xml', import.meta.url), 'utf8'), buildRss(radarFeedItems))
})

test('daily radar automation may commit the generated feed outputs', () => {
  const workflow = parse(readFileSync(new URL('../.github/workflows/daily-radar.yml', import.meta.url), 'utf8'))
  const steps = workflow.jobs['gate-and-merge'].steps
  const allowlist = steps.find(step => step.name === 'Restrict changed files').run
  for (const path of ['src/data/generatedRadarFeed', 'src/data/generatedIntelFeed', 'public/data/intel/', 'src/data/generatedRadarReviews', 'content/radar-reviews/', 'src/data/generatedRadarFeedMonths/', 'public/radar/rss', 'public/radar/feed', 'public/llms']) {
    assert.ok(allowlist.includes(path), path)
  }
  assert.match(steps.find(step => step.name === 'Ensure generated public data is committed').run, /generatedRadarFeed\.ts/)
})
