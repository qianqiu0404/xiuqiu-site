export type SnapshotFreshnessState = 'today' | 'recent' | 'archive' | 'unknown'

export interface SnapshotFreshness {
  state: SnapshotFreshnessState
  ageDays?: number
  isToday: boolean
  isArchive: boolean
  label: string
}

const datePattern = /^(\d{4})-(\d{2})-(\d{2})/

function calendarDay(value: string): number | undefined {
  const match = datePattern.exec(value)
  if (!match) return undefined
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const timestamp = Date.UTC(year, month - 1, day)
  const parsed = new Date(timestamp)
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) return undefined
  return timestamp
}

function shanghaiCalendarDay(now: Date): number | undefined {
  if (Number.isNaN(now.getTime())) return undefined
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return calendarDay(`${values.year}-${values.month}-${values.day}`)
}

export function getSnapshotFreshness(
  snapshotDate?: string,
  now = new Date(),
): SnapshotFreshness {
  const snapshotDay = snapshotDate ? calendarDay(snapshotDate) : undefined
  const currentDay = shanghaiCalendarDay(now)
  if (snapshotDay === undefined || currentDay === undefined || snapshotDay > currentDay) {
    return {
      state: 'unknown',
      isToday: false,
      isArchive: false,
      label: '快照日期待核验',
    }
  }

  const ageDays = Math.round((currentDay - snapshotDay) / 86_400_000)
  if (ageDays === 0) {
    return { state: 'today', ageDays, isToday: true, isArchive: false, label: '今日快照' }
  }
  if (ageDays === 1) {
    return { state: 'recent', ageDays, isToday: false, isArchive: false, label: '最近一期 · 1 天前' }
  }
  return {
    state: 'archive',
    ageDays,
    isToday: false,
    isArchive: true,
    label: `归档快照 · ${ageDays} 天前`,
  }
}
