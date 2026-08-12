import { allowMethods, preparePublicResponse, type MarketRadarRequest, type MarketRadarResponse } from '../../lib/market-radar/http.js'
import { fetchRadarUpstream, isRadarUpstreamConfigured } from '../../lib/radar-upstream.js'

export default async function handler(req: MarketRadarRequest, res: MarketRadarResponse) {
  preparePublicResponse(res)
  if (!allowMethods(req, res, ['GET'])) return
  try {
    if (!isRadarUpstreamConfigured()) throw new Error('radar_upstream_unconfigured')
    return res.status(200).json(await fetchRadarUpstream('/v1/market-radar/summary'))
  } catch {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      status: 'degraded', snapshotId: null, asOf: null, generatedAt: new Date().toISOString(), latestEventAt: null, freshnessMinutes: null,
      isDelayed: true, eventCount24h: 0, p0Count24h: 0, p1Count24h: 0, sources: [],
      message: '交易雷达数据暂时不可用，请把它视为数据延迟。',
    })
  }
}
