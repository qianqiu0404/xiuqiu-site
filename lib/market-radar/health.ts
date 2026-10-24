import type { MarketRadarHealth, MarketRadarSummary } from '../../src/market-radar/contracts.js'

export const marketRadarSources = ['github_releases', 'sec_edgar', 'federal_reserve', 'binance_market_data', 'qiu_market']

export interface MarketRadarPublicationPointer {
  snapshotId: string
  asOf: string
}

export interface MarketRadarSourceRun {
  source: string
  status: string
  lastSuccessAt: string | null
  errorCode?: string
}

const minuteMs = 60_000
const shanghaiOffsetMs = 8 * 60 * minuteMs
const publicationCutoffMs = 8 * 60 * minuteMs

function ageMinutes(timestamp: string | null, now: Date): number | null {
  const parsed = timestamp ? Date.parse(timestamp) : NaN
  return Number.isFinite(parsed) && parsed <= now.getTime()
    ? (now.getTime() - parsed) / minuteMs
    : null
}

function publicationIsCurrent(publication: MarketRadarPublicationPointer | null, now: Date): boolean {
  if (!publication || ageMinutes(publication.asOf, now) === null) return false
  const publishedDay = new Date(Date.parse(publication.asOf) + shanghaiOffsetMs).toISOString().slice(0, 10)
  const expectedDay = new Date(now.getTime() + shanghaiOffsetMs - publicationCutoffMs).toISOString().slice(0, 10)
  return publishedDay >= expectedDay
}

type HealthSummary = Pick<MarketRadarSummary, 'status' | 'freshnessMinutes' | 'isDelayed' | 'sources' | 'message'>

export function summarizeMarketRadarHealth(
  publication: MarketRadarPublicationPointer | null,
  sourceRuns: MarketRadarSourceRun[],
  now: Date,
): HealthSummary {
  const sourceByName = new Map(sourceRuns.map(run => [run.source, run]))
  let anySourceDelayed = false
  const sources = marketRadarSources.map(source => {
    const run = sourceByName.get(source)
    const lastSuccessAt = run?.lastSuccessAt || null
    const age = ageMinutes(lastSuccessAt, now)
    // The Federal Reserve collector runs once every nine 20-minute slots.
    const windowMinutes = source === 'federal_reserve' ? 210 : 90
    const delayed = age === null || age > windowMinutes
    anySourceDelayed ||= delayed
    const health: MarketRadarHealth = run?.status === 'succeeded' && !delayed ? 'healthy' : 'degraded'
    const message = !run ? '尚无采集运行记录。'
      : run.status === 'running' ? '最近一次采集尚未完成。'
        : run.status !== 'succeeded' ? (run.errorCode || '最近一次采集未成功。')
          : delayed ? `来源超过 ${windowMinutes} 分钟没有可验证的成功采集。` : undefined
    return { source, health, lastSuccessAt, message }
  })
  const latestSourceSuccessAt = sources.reduce<string | null>((latest, source) => {
    if (ageMinutes(source.lastSuccessAt, now) === null) return latest
    return !latest || source.lastSuccessAt! > latest ? source.lastSuccessAt : latest
  }, null)
  // This remains the age of the newest source success, not the publication age.
  const newestSuccessAge = ageMinutes(latestSourceSuccessAt, now)
  const freshnessMinutes = newestSuccessAge === null ? null : Math.round(newestSuccessAge)
  const publicationCurrent = publicationIsCurrent(publication, now)
  const isDelayed = !publicationCurrent || anySourceDelayed
  const allSourcesHealthy = sources.every(source => source.health === 'healthy')
  return {
    status: publicationCurrent && allSourcesHealthy ? 'healthy' : 'degraded',
    freshnessMinutes,
    isDelayed,
    sources,
    message: !publication ? '当前没有通过发布门禁的交易快照。'
      : !publicationCurrent ? '公开研究快照未达到应发布日（Asia/Shanghai 每日 08:00 截止），来源心跳不能代表日报已更新。'
        : anySourceDelayed ? '部分来源超过各自采集周期没有成功记录，请把它视为采集延迟，而不是没有事件。'
          : !allSourcesHealthy ? '部分来源最近一次采集失败或尚未完成，公开快照与其他来源不代表这些来源已恢复。' : undefined,
  }
}
