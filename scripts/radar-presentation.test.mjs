import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getFeaturedRadarItem,
  getIndustryRadarItems,
  getRadarDetailSections,
  getSupportingRadarItems,
  getVisibleRadarArchive,
} from '../src/data/radarPresentation.ts'

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
