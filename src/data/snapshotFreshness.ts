export type SnapshotFreshnessState = 'today' | 'recent' | 'archive' | 'unknown'

export interface SnapshotFreshness {
  state: SnapshotFreshnessState
  ageDays?: number
  isToday: boolean
  isArchive: boolean
  label: string
}

export type RadarCollectionKind = 'learning' | 'market'

export interface RadarCollectionSeo {
  title: string
  description: string
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

export function getRadarCollectionSeo(
  kind: RadarCollectionKind,
  snapshotDate?: string,
  now = new Date(),
): RadarCollectionSeo {
  const freshness = getSnapshotFreshness(snapshotDate, now)
  const isLearning = kind === 'learning'
  const baseTitle = isLearning ? '行业情报雷达' : '交易研究雷达'

  if (freshness.isArchive && snapshotDate) {
    return {
      title: `${baseTitle}归档（截至 ${snapshotDate}）｜xiuqiu`,
      description: isLearning
        ? `截至 ${snapshotDate} 的 Web3 钱包与 AI 工程行业简报历史档案；快照日期已明确标注，不代表今日情报。`
        : `截至 ${snapshotDate} 的静态交易事件研究档案；事实、影响资产与失效边界分开呈现，不代表实时行情。`,
    }
  }

  if (snapshotDate && freshness.state !== 'unknown') {
    return {
      title: `${baseTitle}｜xiuqiu`,
      description: isLearning
        ? `最新公开简报为 ${snapshotDate}；聚焦 Web3 钱包与 AI 工程，并保留人工复核和可追溯档案。`
        : `最新公开快照为 ${snapshotDate}；基于公开来源呈现事件事实、影响资产、观察条件和失效边界。`,
    }
  }

  return {
    title: `${baseTitle}｜xiuqiu`,
    description: isLearning
      ? '按明确快照日期归档的 Web3 钱包与 AI 工程行业简报。'
      : '按明确快照日期归档的静态交易事件研究，不代表实时行情。',
  }
}
