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

test('quant strategies require five assets, probability sums and source-subset evidence', () => {
  const sourceUrl = 'https://github.com/example/project/releases/tag/v1.0.0'
  const strategy = {
    horizonTradingDays: 3,
    status: 'heuristic_unbacktested',
    methodology: '透明启发式，尚未进行历史回测。',
    assets: [
      ['SPY', 'us_equity_etf', 34, 41, 25], ['QQQ', 'us_equity_etf', 36, 36, 28],
      ['BTC', 'crypto', 27, 40, 33], ['ETH', 'crypto', 25, 40, 35], ['GLD', 'gold_etf', 42, 36, 22],
    ].map(([symbol, group, up, sideways, down]) => ({ symbol, group, up, sideways, down })),
    rationale: '价格动量与公开事件共同构成情景权重。',
    nextValidation: '核对公开结果与资产反应。',
    invalidation: '来源更新或窗口结束后重新计算。',
    sourceUrls: [sourceUrl],
  }
  const current = radar({ date: '2026-08-10', slug: '2026-08-10', quantStrategy: strategy })
  assert.doesNotThrow(() => validateMarketRadar(current))
  assert.throws(() => validateMarketRadar({ ...current, quantStrategy: { ...strategy, assets: strategy.assets.map((item, index) => index ? item : { ...item, up: 35 }) } }), /sum to 100/)
  assert.throws(() => validateMarketRadar({ ...current, quantStrategy: { ...strategy, sourceUrls: ['https://www.federalreserve.gov/unlisted'] } }), /subset/)
})

test('new quant briefs suppress exact probabilities until historical samples reach the gate', () => {
  const sourceUrl = 'https://github.com/example/project/releases/tag/v1.0.0'
  const strategy = {
    horizonTradingDays: 3,
    status: 'historical_samples_insufficient',
    methodology: '固定规则的历史样本尚未达到展示精确概率的门槛。',
    sampleSize: 0,
    assets: [
      ['SPY', 'us_equity_etf'], ['QQQ', 'us_equity_etf'], ['BTC', 'crypto'],
      ['ETH', 'crypto'], ['GLD', 'gold_etf'],
    ].map(([symbol, group]) => ({ symbol, group, signalQuality: 'weak' })),
    rationale: '公开事件存在，但量价、衍生品和跨资产确认尚不完整。',
    nextValidation: '等待官方结果并记录固定窗口内的确认数据。',
    invalidation: '规则、窗口或来源变化后重新建立样本。',
    sourceUrls: [sourceUrl],
  }
  const current = radar({ date: '2026-08-11', slug: '2026-08-11', quantStrategy: strategy })
  assert.doesNotThrow(() => validateMarketRadar(current))
  assert.throws(() => validateMarketRadar({ ...current, quantStrategy: { ...strategy, assets: strategy.assets.map((item, index) => index ? item : { ...item, up: 60 }) } }), /must not publish exact probabilities/)
  assert.throws(() => validateMarketRadar({ ...current, quantStrategy: { ...strategy, sampleSize: 50 } }), /0 to 49/)
})

test('generated index, recent records and monthly loader remain aligned', async () => {
  assert.deepEqual(marketRadarIndex.map(item => item.slug), allMarketRadars.map(item => item.slug))
  assert.deepEqual(latestMarketRadars, allMarketRadars.slice(0, 7))
  assert.deepEqual(await loadMarketRadarBySlug(allMarketRadars[0].slug), allMarketRadars[0])
  assert.equal(await loadMarketRadarBySlug('not-a-date'), undefined)
  assert.ok(allMarketRadars.every(radar => radar.origin === 'research' && radar.publicationState === 'published'))
  assert.ok(allMarketRadars.every(radar => radar.snapshotId.startsWith(`market-${radar.date}-`) && radar.asOf === new Date(radar.generatedAt).toISOString()))
})

test('the public page is static and contains no runtime API dependency', async () => {
  const { readFile } = await import('node:fs/promises')
  const overview = await readFile(new URL('../src/pages/MarketRadarPage.vue', import.meta.url), 'utf8')
  const detail = await readFile(new URL('../src/pages/MarketRadarDetailPage.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/styles/market-radar.css', import.meta.url), 'utf8')
  const router = await readFile(new URL('../src/router/index.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(`${overview}\n${detail}`, /fetch\(|\/api\/market-radar/)
  assert.match(overview, /:data-snapshot-id="latest\?\.snapshotId"/)
  assert.match(overview, /:data-snapshot-as-of="latest\?\.asOf"/)
  assert.match(overview, /不接账户 · 不自动下单/)
  assert.match(overview, /<h1>先看发生了什么。<span>再判断市场怎么走。<\/span><\/h1>/)
  assert.match(overview, /它不告诉你买什么。/)
  assert.match(overview, /<dt>总事件<\/dt>/)
  assert.match(overview, /<dt>P0 \+ P1<\/dt>/)
  assert.match(overview, /<dt>下一事件<\/dt>/)
  assert.match(overview, /<dt>更新于<\/dt>/)
  assert.match(overview, /v-if="event\.priority !== 'P2'"/)
  assert.match(overview, /<details v-else class="trade-event-analysis">/)
  assert.match(overview, /v-else class="trade-radar-state"/)
  assert.match(detail, /slug: String\(route\.params\.date \|\| ''\), hash: route\.hash/)
  assert.match(detail, /requestAnimationFrame/)
  assert.match(detail, /hash === '#main-content'/)
  assert.match(detail, /classList\.contains\('trade-radar-detail-event'\)/)
  assert.match(detail, /name: 'market-radar-event'/)
  assert.match(detail, /entry\.quantStrategy/)
  assert.match(detail, /未回测情景权重/)
  assert.match(detail, /历史样本不足/)
  assert.match(detail, /name: 'market-radar-detail'[\s\S]*hash: `#\$\{event\.id\}`/)
  assert.match(router, /to\.name === 'market-radar-detail'\) return false/)
  assert.match(styles, /--trade-market: #5ad7c7/)
  assert.match(styles, /color: #b8c1cc/)
  assert.match(styles, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(styles, /\.trade-radar-page :where\(a, summary, \[tabindex='-1'\]\):focus-visible/)
  assert.match(styles, /@media \(max-width: 720px\)/)
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/)
})
