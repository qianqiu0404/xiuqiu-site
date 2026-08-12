import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  getRadarReviewBoundary,
  getFeaturedRadarItem,
  getIndustryRadarItems,
  getRadarDetailSections,
  getSupportingRadarItems,
  getVisibleRadarArchive,
  radarSignalCountLabel,
} from '../src/data/radarPresentation.ts'
import { dailyRadars } from '../src/data/generatedRadarAll.ts'
import { latestRadars, radarIndex } from '../src/data/generatedRadars.ts'
import { loadRadarBySlug } from '../src/data/generatedRadarLoader.ts'
import {
  selectPublishableRadarWeeklies,
  validateRadarWeekly,
} from './generate-radar-weeklies.mjs'

const appSource = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const radarPageSource = readFileSync(new URL('../src/pages/RadarPage.vue', import.meta.url), 'utf8')
const radarDetailSource = readFileSync(new URL('../src/pages/RadarDetailPage.vue', import.meta.url), 'utf8')
const radarWeeklySource = readFileSync(new URL('../src/pages/RadarWeeklyPage.vue', import.meta.url), 'utf8')

function radar(overrides = {}) {
  return {
    date: '2026-07-25',
    slug: '2026-07-25',
    title: 'Daily radar',
    summary: 'Summary',
    reviewStatus: 'automated',
    generatedAt: '2026-07-25T07:00:00+08:00',
    sourceSections: ['crypto', 'radar', 'vibe', 'reading'],
    missingSections: [],
    marketSignals: [{ title: 'Industry', summary: 'Industry summary' }],
    aiTip: { title: 'AI', summary: 'AI summary' },
    web3Design: { title: 'Web3', summary: 'Web3 summary' },
    vibeProject: { title: 'Tool', summary: 'Tool summary' },
    readingPick: { title: 'Reading', summary: 'Reading summary' },
    sourceUrls: [],
    relatedProjectSlugs: [],
    ...overrides,
  }
}

test('featured story prefers Web3 design, then AI, then the first industry signal', () => {
  assert.equal(getFeaturedRadarItem(radar())?.key, 'web3')
  assert.equal(getFeaturedRadarItem(radar({ web3Design: undefined }))?.key, 'ai')
  assert.equal(getFeaturedRadarItem(radar({ web3Design: undefined, aiTip: undefined }))?.key, 'industry')
})

test('industry list omits the signal already promoted to the featured story', () => {
  const source = radar({
    web3Design: undefined,
    aiTip: undefined,
    marketSignals: [
      { title: 'Industry one', summary: 'First signal' },
      { title: 'Industry two', summary: 'Second signal' },
    ],
  })

  assert.deepEqual(
    getIndustryRadarItems(source, getFeaturedRadarItem(source)?.key).map(item => item.title),
    ['Industry two'],
  )
})

test('supporting items omit the featured story and missing optional sections', () => {
  const full = radar()
  assert.deepEqual(getSupportingRadarItems(full, 'web3').map(item => item.key), ['ai', 'tools', 'reading'])
  assert.deepEqual(
    getSupportingRadarItems(radar({ web3Design: undefined, vibeProject: undefined }), 'ai').map(item => item.key),
    ['reading'],
  )
})

test('detail sections omit empty content without changing the remaining order', () => {
  const sections = getRadarDetailSections(radar({ marketSignals: [], aiTip: undefined, vibeProject: undefined }))
  assert.deepEqual(sections.map(section => section.id), ['web3-design', 'reading'])
})

test('archive shows seven records by default and all records after expansion', () => {
  const records = Array.from({ length: 13 }, (_, index) => index)
  assert.equal(getVisibleRadarArchive(records, false).length, 7)
  assert.equal(getVisibleRadarArchive(records, true).length, 13)
})

test('daily signal promise always reflects the actual 0, 1, 2, 3 or larger count', () => {
  assert.equal(radarSignalCountLabel(0), '今天暂无公开行业信号。')
  assert.equal(radarSignalCountLabel(1), '今天值得留下的一条信号。')
  assert.equal(radarSignalCountLabel(2), '今天值得留下的两条信号。')
  assert.equal(radarSignalCountLabel(3), '今天值得留下的三条信号。')
  assert.equal(radarSignalCountLabel(7), '今天值得留下的 7 条信号。')
})

test('manual review boundary derives only from published review and daily dates', () => {
  assert.deepEqual(getRadarReviewBoundary('2026-07-24', '2026-08-09'), {
    lastReviewedLabel: '最后人工复核 2026-07-24',
    statusLabel: '截至最新日报 2026-08-09，尚无更新周报。',
    nextReviewLabel: '下一次复核时间未在公开数据中排期。',
  })
  assert.equal(
    getRadarReviewBoundary('2026-07-24', '2026-07-24').statusLabel,
    '这是当前公开的最近一次人工复核。',
  )
  assert.equal(
    getRadarReviewBoundary('2026-07-24').statusLabel,
    '这是当前公开的最近一次人工复核。',
  )
})

test('Learn Radar routes rely on the single application main landmark', () => {
  assert.equal((appSource.match(/<main\b/g) || []).length, 1)
  for (const [name, source, h1Count] of [
    ['overview', radarPageSource, 1],
    ['daily detail', radarDetailSource, 4],
    ['weekly detail', radarWeeklySource, 2],
  ]) {
    assert.equal((source.match(/<main\b/g) || []).length, 0, name)
    assert.equal((source.match(/<h1\b/g) || []).length, h1Count, `${name} keeps one h1 per visible branch`)
  }
  assert.match(radarWeeklySource, /<h2 class="radar-kicker">\{\{ section\.label \}\}<\/h2>/)
})

test('Learn Radar exposes generated, review, loading, empty and error boundaries', () => {
  assert.match(radarPageSource, /radarSignalCountLabel\(latestRadar\?\.marketSignals\.length \?\? 0\)/)
  assert.match(radarPageSource, /latestRadar\.date[\s\S]*latestWeekly\.reviewedAt|latestWeekly\.reviewedAt[\s\S]*latestRadar\?\.date/)
  assert.match(radarDetailSource, /aria-busy="true"/)
  assert.match(radarDetailSource, /role="alert"/)
  assert.match(radarDetailSource, /AI 自动汇总 · 未经人工复核/)
  assert.match(radarDetailSource, /@click="loadRadar\(/)
  assert.match(radarWeeklySource, /reviewBoundary\.statusLabel/)
  assert.match(radarWeeklySource, /reviewBoundary\.nextReviewLabel/)
})

test('Learn Radar exposes the immutable publication snapshot in the rendered DOM', () => {
  assert.match(radarPageSource, /:data-snapshot-id="latestRadar\?\.snapshotId"/)
  assert.match(radarPageSource, /:data-snapshot-as-of="latestRadar\?\.asOf"/)
})

test('generated radar layers keep the compact archive and recent full records aligned', () => {
  assert.deepEqual(
    radarIndex.map(item => item.slug),
    dailyRadars.map(item => item.slug),
  )
  assert.deepEqual(latestRadars, dailyRadars.slice(0, 7))
  assert.ok(latestRadars.length <= 7)
  assert.deepEqual(
    radarIndex[0].marketSignals.map(item => item.title),
    dailyRadars[0].marketSignals.map(item => item.title),
  )
  if (radarIndex[0].marketSignals[0]) assert.equal('summary' in radarIndex[0].marketSignals[0], false)
  assert.equal(radarIndex[0].schemaVersion, 2)
  assert.deepEqual(radarIndex[0].briefs?.map(item => item.title), dailyRadars[0].briefs?.map(item => item.title))
  assert.equal(radarIndex[0].briefs?.every(item => !('mechanism' in item)), true)
  assert.ok(dailyRadars.every(radar => radar.origin === 'research' && radar.publicationState === 'published'))
  assert.ok(dailyRadars.every(radar => radar.snapshotId.startsWith(`learning-${radar.date}-`) && radar.asOf === new Date(radar.generatedAt).toISOString()))
})

test('historical radar detail loads by month and rejects invalid routes', async () => {
  const newest = dailyRadars[0]
  const oldest = dailyRadars.at(-1)

  assert.deepEqual(await loadRadarBySlug(newest.slug), newest)
  assert.deepEqual(await loadRadarBySlug(oldest.slug), oldest)
  assert.equal(await loadRadarBySlug('not-a-date'), undefined)
  assert.equal(await loadRadarBySlug('2025-01-01'), undefined)
})

const publicProjectSlugs = new Set([
  'wallet-reliability-lab',
  'web3-wallet-engineer-lab',
])

function weekly(overrides = {}) {
  return {
    week: '2026-W29',
    slug: '2026-W29',
    title: '研究收敛 · 2026-W29',
    summary: '本周把行业观察收敛为可验证的钱包工程判断。',
    judgments: ['钱包可靠性需要可重放状态机和可执行不变量。'],
    shipped: ['Wallet Reliability Lab 已提供可交互的异常恢复演示。'],
    watch: ['受限钱包权限仍需最小可测试模型。'],
    stopped: ['没有本地复现的规模叙事不进入项目能力。'],
    nextFocus: ['固定 Scenario Catalog 的版本引用。'],
    relatedProjectSlugs: ['wallet-reliability-lab'],
    sourceUrls: ['https://github.com/qianqiu0404/wallet-reliability-lab'],
    publish: true,
    reviewedAt: '2026-07-24',
    ...overrides,
  }
}

test('weekly radar generation only includes explicitly published, manually reviewed entries', () => {
  const draft = weekly({ week: '2026-W30', slug: '2026-W30', publish: false, reviewedAt: undefined })
  const stringPublish = weekly({ week: '2026-W31', slug: '2026-W31', publish: 'true' })
  const published = selectPublishableRadarWeeklies(
    [draft, stringPublish, weekly()],
    publicProjectSlugs,
  )

  assert.deepEqual(published.map(item => item.slug), ['2026-W29'])
  assert.throws(
    () => validateRadarWeekly(weekly({ reviewedAt: '2026-02-30' }), publicProjectSlugs),
    /reviewedAt must use a valid/,
  )
  assert.throws(
    () => validateRadarWeekly(weekly({ reviewedAt: undefined }), publicProjectSlugs),
    /reviewedAt must use a valid/,
  )
})

test('weekly convergence requires reviewed judgments and next focus', () => {
  for (const field of ['judgments', 'nextFocus']) {
    assert.throws(
      () => validateRadarWeekly(weekly({ [field]: [] }), publicProjectSlugs),
      new RegExp(`${field} must contain at least one reviewed item`),
      field,
    )
    assert.throws(
      () => validateRadarWeekly(weekly({ [field]: ['待补充'] }), publicProjectSlugs),
      /placeholder text/,
      field,
    )
  }

  assert.throws(
    () => validateRadarWeekly(
      weekly({ nextFocus: ['第一项', '第二项', '第三项'] }),
      publicProjectSlugs,
    ),
    /one or two items/,
  )
})

test('weekly optional convergence lists may stay empty instead of inventing activity', () => {
  for (const field of ['shipped', 'watch', 'stopped']) {
    assert.doesNotThrow(
      () => validateRadarWeekly(weekly({ [field]: [] }), publicProjectSlugs),
      field,
    )
    assert.throws(
      () => validateRadarWeekly(weekly({ [field]: ['待补充'] }), publicProjectSlugs),
      /placeholder text/,
      field,
    )
  }
})

test('weekly project links are optional but must resolve when present', () => {
  assert.throws(
    () => validateRadarWeekly(
      weekly({ relatedProjectSlugs: ['unknown-project'] }),
      publicProjectSlugs,
    ),
    /related project does not exist/,
  )
  assert.throws(
    () => validateRadarWeekly(
      weekly({ relatedProjectSlugs: ['wallet-reliability-lab', 'wallet-reliability-lab'] }),
      publicProjectSlugs,
    ),
    /relatedProjectSlugs must not contain duplicates/,
  )
  assert.doesNotThrow(
    () => validateRadarWeekly(weekly({ relatedProjectSlugs: [] }), publicProjectSlugs),
  )
})

test('weekly source links reject empty, duplicate, local, malformed and placeholder URLs', () => {
  const invalidSourceLists = [
    [],
    ['https://github.com/qianqiu0404/wallet-reliability-lab', 'https://github.com/qianqiu0404/wallet-reliability-lab'],
    ['https://example.org/source'],
    ['https://sources.invalid/review'],
    ['http://localhost:43127/api/health'],
    ['http://github.com/qianqiu0404/wallet-reliability-lab'],
    ['https://github.com/qianqiu0404/wallet-reliability-lab`'],
  ]

  invalidSourceLists.forEach(sourceUrls => {
    assert.throws(
      () => validateRadarWeekly(weekly({ sourceUrls }), publicProjectSlugs),
      /sourceUrls/,
      JSON.stringify(sourceUrls),
    )
  })
})

test('duplicate published weekly identities are rejected before sorting', () => {
  assert.throws(
    () => selectPublishableRadarWeeklies([weekly(), weekly()], publicProjectSlugs),
    /Duplicate weekly radar identity/,
  )
})

test('the existing W29 reviewed snapshot satisfies the weekly publication contract', () => {
  const snapshot = JSON.parse(
    readFileSync(new URL('../content/obsidian-public/radar-weeklies.json', import.meta.url), 'utf8'),
  )
  const projectSnapshot = JSON.parse(
    readFileSync(new URL('../content/obsidian-public/projects.json', import.meta.url), 'utf8'),
  )
  const projectSlugs = new Set(projectSnapshot.projects.map(project => project.siteSlug))
  const published = selectPublishableRadarWeeklies(snapshot.radarWeeklies, projectSlugs)

  assert.deepEqual(published.map(item => item.slug), ['2026-W29'])
  assert.equal(published[0].reviewedAt, '2026-07-24')
})
