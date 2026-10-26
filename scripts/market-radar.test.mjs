import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { allMarketRadars } from '../src/data/generatedMarketRadarAll.ts'
import { latestMarketRadars, marketRadarIndex } from '../src/data/generatedMarketRadars.ts'
import { loadMarketRadarBySlug } from '../src/data/generatedMarketRadarLoader.ts'
import { assertMarketRadarArchive, buildMarketResearchPack, validateMarketRadar } from './market-radar-contracts.mjs'
import { buildRadarPublication, selectRadarDataset } from './radar-publication-boundary.mjs'
import { marketRadarSources, summarizeMarketRadarHealth } from '../lib/market-radar/health.ts'

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

function researchQuestions(eventId = 'official-event') {
  return [
    { id: '1', lens: 'transmission', shortQuestion: '这项事件通过哪些可验证环节影响相关资产？', focusEventIds: [eventId] },
    { id: '2', lens: 'falsification', shortQuestion: '哪些跨资产证据会支持或推翻当前解释？', focusEventIds: [eventId] },
    { id: '3', lens: 'scenario', shortQuestion: '最强反方情景、后续验证与失效条件是什么？', focusEventIds: [eventId] },
  ]
}

function sampleGatedQuant(sourceUrl = 'https://github.com/example/project/releases/tag/v1.0.0') {
  return {
    horizonTradingDays: 3, status: 'historical_samples_insufficient', methodology: '固定规则样本尚未达到门槛。', sampleSize: 0,
    assets: [
      ['SPY', 'us_equity_etf'], ['QQQ', 'us_equity_etf'], ['BTC', 'crypto'], ['ETH', 'crypto'], ['GLD', 'gold_etf'],
    ].map(([symbol, group]) => ({ symbol, group, signalQuality: 'weak' })),
    rationale: '证据完整度不足。', nextValidation: '记录固定窗口证据。', invalidation: '规则或来源变化后重建样本。', sourceUrls: [sourceUrl],
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

test('schema v2 requires exactly three ordered research lenses with valid event references', () => {
  const current = radar({ schemaVersion: 2, researchQuestions: researchQuestions() })
  assert.doesNotThrow(() => validateMarketRadar(current))
  assert.doesNotThrow(() => validateMarketRadar(radar()))
  assert.throws(() => validateMarketRadar(radar({ researchQuestions: researchQuestions() })), /require schemaVersion 2/)
  assert.throws(() => validateMarketRadar({ ...current, researchQuestions: current.researchQuestions.slice(0, 2) }), /exactly 3/)
  assert.throws(() => validateMarketRadar({ ...current, researchQuestions: current.researchQuestions.map((item, index) => index === 1 ? { ...item, lens: 'scenario' } : item) }), /lens must be falsification/)
  assert.throws(() => validateMarketRadar({ ...current, researchQuestions: current.researchQuestions.map((item, index) => index === 0 ? { ...item, focusEventIds: ['missing-event'] } : item) }), /reference a daily event/)
  const httpEvent = event({ sourceUrl: 'http://www.federalreserve.gov/example' })
  assert.throws(() => validateMarketRadar({ ...current, events: [httpEvent], sourceUrls: [httpEvent.sourceUrl] }), /HTTPS primary sources/)
  assert.throws(() => validateMarketRadar(radar({ date: '2026-08-13', slug: '2026-08-13' })), /required from 2026-08-13/)
  assert.doesNotThrow(() => validateMarketRadar(radar({
    date: '2026-08-13', slug: '2026-08-13', schemaVersion: 2, researchQuestions: researchQuestions(), quantStrategy: sampleGatedQuant(),
  })))
})

test('research pack is deterministic, public and checksums each exact UTF-8 prompt', () => {
  const current = radar({ schemaVersion: 2, researchQuestions: researchQuestions() })
  const publication = buildRadarPublication('market', current)
  const pack = buildMarketResearchPack(current, publication)
  assert.deepEqual(pack, buildMarketResearchPack(current, publication))
  assert.equal(pack.schemaVersion, 2)
  assert.equal(pack.date, current.date)
  assert.equal(pack.snapshotId, publication.snapshotId)
  assert.equal(pack.asOf, publication.asOf)
  assert.equal(pack.origin, 'research')
  assert.equal(pack.publicationState, 'published')
  assert.equal(pack.pageUrl, 'https://xiuqiu-site.vercel.app/market-radar/2026-08-09')
  assert.equal(pack.questions.length, 3)
  for (const question of pack.questions) {
    assert.equal(question.promptChecksum, createHash('sha256').update(question.prompt).digest('hex'))
    assert.ok(question.prompt.length <= 1500)
    assert.ok(question.sourceUrls.length >= 1 && question.sourceUrls.length <= 2)
    assert.match(question.prompt, /已确认事实/)
    assert.match(question.prompt, /最强反证/)
    assert.match(question.prompt, /不得编造概率/)
    assert.match(question.prompt, /不得给出买卖、仓位、止损、目标价或收益承诺/)
  }
})

test('generator publishes schema v2 packs and prunes only orphan JSON artifacts', async () => {
  const { readFile } = await import('node:fs/promises')
  const source = await readFile(new URL('./generate-market-radars.mjs', import.meta.url), 'utf8')
  assert.match(source, /public\/data\/market-radar-packs/)
  assert.match(source, /filter\(item => item\.schemaVersion === 2\)/)
  assert.match(source, /writeFileSync\(new URL\(fileName, PUBLIC_PACK_DIR\), serialized\)/)
  assert.match(source, /expectedPackFiles/)
  assert.match(source, /git', \['ls-tree', '-r', '--name-only', 'HEAD'/)
  assert.match(source, /Unable to verify committed research pack history; generation stopped closed/)
  assert.match(source, /for \(const repositoryPath of committedPaths\)/)
  assert.match(source, /repositoryPath\.slice\(PUBLIC_PACK_PREFIX\.length\)/)
  assert.match(source, /!expectedPackFiles\.has\(fileName\)/)
  assert.match(source, /published research packs are immutable and cannot be removed/)
  assert.match(source, /unlinkSync\(new URL\(fileName, PUBLIC_PACK_DIR\)\)/)
  assert.match(source, /readCommittedPack\(repositoryPath, committedPaths\)/)
  assert.match(source, /published research packs are immutable/)
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
  const overview = await readFile(new URL('../src/features/market-radar/pages/MarketRadarPage.vue', import.meta.url), 'utf8')
  const detail = await readFile(new URL('../src/features/market-radar/pages/MarketRadarDetailPage.vue', import.meta.url), 'utf8')
  const styles = await readFile(new URL('../src/design/market-reader.css', import.meta.url), 'utf8')
  const router = await readFile(new URL('../src/router/index.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(`${overview}\n${detail}`, /fetch\(|\/api\/market-radar/)
  assert.match(detail, /slug: String\(route\.params\.date \|\| ''\), hash: route\.hash/)
  assert.match(detail, /requestAnimationFrame/)
  assert.match(detail, /hash === '#main-content'/)
  assert.match(detail, /classList\.contains\('market-event'\)/)
  const { withReadingReturn, readingReturnLink } = await import('../src/data/readingNavigationPresentation.ts')
  const from = '/market-radar?category=crypto&q=Hoodi#queue-official-event'
  const eventLink = new URL(withReadingReturn('/market-radar/events/official-event', from), 'https://xiuqiu-site.vercel.app')
  assert.equal(eventLink.pathname, '/market-radar/events/official-event')
  assert.equal(readingReturnLink(eventLink.searchParams.get('from')).href, from)
  assert.match(detail, /entry\.quantStrategy/)
  assert.match(detail, /:data-snapshot-state="entryFreshness\.state"/)
  assert.match(detail, /事件状态与排期只描述当时/)
  assert.match(detail, /未回测情景权重/)
  assert.match(detail, /历史样本不足/)
  const anchorLink = new URL(withReadingReturn('/market-radar/2026-10-24#official-event', from), 'https://xiuqiu-site.vercel.app')
  assert.equal(anchorLink.hash, '#official-event')
  assert.equal(readingReturnLink(anchorLink.searchParams.get('from')).href, from)
  assert.match(router, /to\.name === 'market-radar-detail'\) return false/)
  // The snapshot reader uses the shared brief/reader shell and tokens only.
  assert.match(detail, /import '\.\.\/\.\.\/\.\.\/design\/reader\.css'/)
  assert.doesNotMatch(detail, /market-skin\.css|styles\/market-radar\.css/)
  assert.doesNotMatch(styles, /#[0-9a-fA-F]{3,8}\b|rgba\(/)
  assert.match(styles, /\.market-quant-groups \{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.market-quant-groups \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/)
})

const healthNow = new Date('2026-10-24T04:00:00.000Z')
const currentPublication = { snapshotId: 'market-2026-10-24-current', asOf: '2026-10-24T00:00:00.000Z' }
function successfulSources(minutesAgo = 10) {
  return marketRadarSources.map(source => ({
    source, status: 'succeeded', lastSuccessAt: new Date(healthNow.getTime() - minutesAgo * 60_000).toISOString(),
  }))
}

test('new source heartbeats cannot make an old public market snapshot healthy', () => {
  const result = summarizeMarketRadarHealth({
    snapshotId: 'market-2026-08-13-old', asOf: '2026-08-13T00:04:41.000Z',
  }, successfulSources(), healthNow)
  assert.equal(result.status, 'degraded')
  assert.equal(result.isDelayed, true)
  assert.equal(result.freshnessMinutes, 10)
  assert.ok(result.sources.every(source => source.health === 'healthy'))
  assert.match(result.message, /公开研究快照/)
})

test('one recent source cannot hide another source past its collection window', () => {
  const sources = successfulSources()
  sources[0].lastSuccessAt = new Date(healthNow.getTime() - 91 * 60_000).toISOString()
  const result = summarizeMarketRadarHealth(currentPublication, sources, healthNow)
  assert.equal(result.status, 'degraded')
  assert.equal(result.isDelayed, true)
  assert.equal(result.freshnessMinutes, 10)
  assert.equal(result.sources[0].health, 'degraded')
  assert.equal(result.sources[1].health, 'healthy')
})

test('the three-hour Federal Reserve collector has its own bounded grace window', () => {
  const sources = successfulSources()
  const fed = sources.find(source => source.source === 'federal_reserve')
  fed.lastSuccessAt = new Date(healthNow.getTime() - 210 * 60_000).toISOString()
  assert.equal(summarizeMarketRadarHealth(currentPublication, sources, healthNow).status, 'healthy')
  fed.lastSuccessAt = new Date(healthNow.getTime() - 211 * 60_000).toISOString()
  const result = summarizeMarketRadarHealth(currentPublication, sources, healthNow)
  assert.equal(result.status, 'degraded')
  assert.equal(result.sources.find(source => source.source === 'federal_reserve').health, 'degraded')
})

test('no published snapshot stays degraded even when all collectors have succeeded', () => {
  const result = summarizeMarketRadarHealth(null, successfulSources(), healthNow)
  assert.equal(result.status, 'degraded')
  assert.equal(result.isDelayed, true)
  assert.match(result.message, /没有通过发布门禁/)
})

test('fresh successful collectors and a current daily snapshot remain healthy on a quiet day', () => {
  const result = {
    ...summarizeMarketRadarHealth(currentPublication, successfulSources(), healthNow),
    latestEventAt: null, eventCount24h: 0, p0Count24h: 0, p1Count24h: 0,
  }
  assert.equal(result.status, 'healthy')
  assert.equal(result.isDelayed, false)
  assert.equal(result.eventCount24h, 0)
  assert.equal(result.message, undefined)
})

test('daily publication age uses the 08:00 Shanghai deadline rather than the worker window', () => {
  const previousPublication = { snapshotId: 'market-2026-10-23-previous', asOf: '2026-10-23T00:00:00.000Z' }
  const beforeCutoff = new Date('2026-10-23T23:59:00.000Z')
  const sources = successfulSources().map(source => ({ ...source, lastSuccessAt: '2026-10-23T23:50:00.000Z' }))
  assert.equal(summarizeMarketRadarHealth(previousPublication, sources, beforeCutoff).status, 'healthy')
  const atCutoff = new Date('2026-10-24T00:00:00.000Z')
  assert.equal(summarizeMarketRadarHealth(previousPublication, sources, atCutoff).status, 'degraded')
  // Today's eight-hour-old publication is valid while each collector is current.
  assert.equal(summarizeMarketRadarHealth(currentPublication, successfulSources(), healthNow).status, 'healthy')
})

test('failed and unfinished runs stay visible and retain only actual prior success timestamps', () => {
  for (const status of ['failed', 'running']) {
    const sources = successfulSources()
    sources[0] = { ...sources[0], status }
    const result = summarizeMarketRadarHealth(currentPublication, sources, healthNow)
    assert.equal(result.status, 'degraded')
    assert.equal(result.isDelayed, false)
    assert.equal(result.sources[0].health, 'degraded')
    assert.equal(result.sources[0].lastSuccessAt, sources[0].lastSuccessAt)
    assert.match(result.sources[0].message, status === 'failed' ? /未成功/ : /尚未完成/)
  }
})

test('missing, invalid and future source success times fail closed', () => {
  for (const lastSuccessAt of [null, 'invalid', '2026-10-25T04:00:00.000Z']) {
    const sources = successfulSources().map(source => ({ ...source, lastSuccessAt }))
    const result = summarizeMarketRadarHealth(currentPublication, sources, healthNow)
    assert.equal(result.status, 'degraded')
    assert.equal(result.freshnessMinutes, null)
    assert.equal(result.isDelayed, true)
  }
  assert.equal(summarizeMarketRadarHealth(currentPublication, successfulSources().slice(1), healthNow).status, 'degraded')
})

test('market data with a different API snapshot never replaces the static publication', () => {
  const staticDataset = { snapshotId: currentPublication.snapshotId, items: ['reviewed-static-event'] }
  const apiDataset = { snapshotId: 'market-2026-08-13-old', items: [], status: 'healthy' }
  assert.equal(selectRadarDataset(staticDataset, apiDataset), staticDataset)
  assert.equal(selectRadarDataset(staticDataset, { ...apiDataset, snapshotId: currentPublication.snapshotId }).items.length, 0)
})
