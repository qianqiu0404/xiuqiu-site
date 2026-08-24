import assert from 'node:assert/strict'
import test from 'node:test'
import { getRadarCollectionSeo, getSnapshotFreshness } from '../src/data/snapshotFreshness.ts'

const now = new Date('2026-08-24T01:00:00+08:00')

test('snapshot freshness uses the Shanghai calendar date', () => {
  assert.deepEqual(getSnapshotFreshness('2026-08-24', now), {
    state: 'today', ageDays: 0, isToday: true, isArchive: false, label: '今日快照',
  })
  assert.deepEqual(getSnapshotFreshness('2026-08-23', now), {
    state: 'recent', ageDays: 1, isToday: false, isArchive: false, label: '最近一期 · 1 天前',
  })
})

test('daily snapshots older than one calendar day are explicit archives', () => {
  assert.deepEqual(getSnapshotFreshness('2026-08-13', now), {
    state: 'archive', ageDays: 11, isToday: false, isArchive: true, label: '归档快照 · 11 天前',
  })
})

test('invalid and future dates fail closed instead of claiming freshness', () => {
  for (const value of [undefined, 'not-a-date', '2026-02-30', '2026-08-25']) {
    assert.deepEqual(getSnapshotFreshness(value, now), {
      state: 'unknown', isToday: false, isArchive: false, label: '快照日期待核验',
    })
  }
})

test('collection metadata names stale snapshots as archives', () => {
  assert.deepEqual(getRadarCollectionSeo('learning', '2026-08-13', now), {
    title: '行业情报雷达归档（截至 2026-08-13）｜xiuqiu',
    description: '截至 2026-08-13 的 Web3 钱包与 AI 工程行业简报历史档案；快照日期已明确标注，不代表今日情报。',
  })
  assert.deepEqual(getRadarCollectionSeo('market', '2026-08-13', now), {
    title: '交易研究雷达归档（截至 2026-08-13）｜xiuqiu',
    description: '截至 2026-08-13 的静态交易事件研究档案；事实、影响资产与失效边界分开呈现，不代表实时行情。',
  })
})

test('fresh and unknown collection metadata avoid false daily or real-time claims', () => {
  assert.match(getRadarCollectionSeo('learning', '2026-08-24', now).description, /最新公开简报为 2026-08-24/)
  assert.match(getRadarCollectionSeo('market', undefined, now).description, /不代表实时行情/)
})
