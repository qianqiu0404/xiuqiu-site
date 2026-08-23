import assert from 'node:assert/strict'
import test from 'node:test'
import { getSnapshotFreshness } from '../src/data/snapshotFreshness.ts'

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
