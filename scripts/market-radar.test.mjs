import assert from 'node:assert/strict'
import test from 'node:test'
import { allMarketRadars } from '../src/data/generatedMarketRadarAll.ts'
import { latestMarketRadars, marketRadarIndex } from '../src/data/generatedMarketRadars.ts'
import { loadMarketRadarBySlug } from '../src/data/generatedMarketRadarLoader.ts'
import { assertMarketRadarArchive, validateMarketRadar } from './market-radar-contracts.mjs'

function event(overrides = {}) {
  return {
    id: 'official-event', priority: 'P1', status: 'monitoring', category: 'crypto',
    title: '官方事件', fact: '官方来源确认了一个需要继续验证的事件。', whyWatch: '它可能改变公开系统的运行边界。',
    assets: ['BTC'], watchFor: '观察后续正式说明和公开运行证据。', invalidation: '没有进一步证据时不外推市场方向。',
    sourceName: 'Official Source', sourceUrl: 'https://github.com/example/project/releases/tag/v1.0.0', sourcePublishedAt: '2026-08-09',
    ...overrides,
  }
}

function radar(overrides = {}) {
  const events = overrides.events || [event()]
  return {
    date: '2026-08-09', slug: '2026-08-09', title: '交易研究雷达', summary: '只保留可验证事件和观察边界。',
    publish: true, reviewStatus: 'automated', generatedAt: '2026-08-09T12:30:00+08:00', events,
    sourceUrls: events.map(item => item.sourceUrl), ...overrides,
  }
}

test('static market radar accepts bounded source-backed observations', () => {
  assert.doesNotThrow(() => validateMarketRadar(radar()))
  assert.throws(() => validateMarketRadar(radar({ events: [] })), /1-5/)
  assert.throws(() => validateMarketRadar(radar({ slug: 'different' })), /slug must equal date/)
})

test('trade calls, malformed sources and duplicate archive events fail closed', () => {
  assert.throws(() => validateMarketRadar(radar({ events: [event({ watchFor: '建议立即买入。' })] })), /trade call/)
  assert.throws(() => validateMarketRadar(radar({ events: [event({ sourceUrl: 'http://localhost/private' })] })), /complete http/)
  assert.throws(() => assertMarketRadarArchive([radar(), radar()]), /Duplicate market event/)
})

test('generated index, recent records and monthly loader remain aligned', async () => {
  assert.deepEqual(marketRadarIndex.map(item => item.slug), allMarketRadars.map(item => item.slug))
  assert.deepEqual(latestMarketRadars, allMarketRadars.slice(0, 7))
  assert.deepEqual(await loadMarketRadarBySlug(allMarketRadars[0].slug), allMarketRadars[0])
  assert.equal(await loadMarketRadarBySlug('not-a-date'), undefined)
})

test('the public page is static and contains no runtime API dependency', async () => {
  const { readFile } = await import('node:fs/promises')
  const overview = await readFile(new URL('../src/pages/MarketRadarPage.vue', import.meta.url), 'utf8')
  const detail = await readFile(new URL('../src/pages/MarketRadarDetailPage.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles/market-radar.css', import.meta.url), 'utf8')
  assert.doesNotMatch(`${overview}\n${detail}`, /fetch\(|\/api\/market-radar/)
  assert.match(overview, /不接账户 · 不自动下单/)
  assert.match(overview, /<h1>先看发生了什么。<span>再判断市场怎么走。<\/span><\/h1>/)
  assert.match(overview, /它不告诉你买什么。/)
  assert.match(overview, /<details class="trade-event-analysis">/)
  assert.match(overview, /v-else class="trade-radar-state"/)
  assert.match(styles, /--trade-market: #5ad7c7/)
  assert.match(styles, /\.trade-radar-page :where\(a, summary, \[tabindex='-1'\]\):focus-visible/)
  assert.match(styles, /@media \(max-width: 720px\)/)
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/)
})
