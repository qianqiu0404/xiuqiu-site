import { getSummary } from '../../lib/market-radar/repository.js'
import { allowMethods, preparePublicResponse, type MarketRadarRequest, type MarketRadarResponse } from '../../lib/market-radar/http.js'

export default async function handler(req: MarketRadarRequest, res: MarketRadarResponse) {
  preparePublicResponse(res)
  if (!allowMethods(req, res, ['GET'])) return
  try {
    return res.status(200).json(await getSummary())
  } catch {
    return res.status(200).json({
      status: 'degraded', generatedAt: new Date().toISOString(), latestEventAt: null, freshnessMinutes: null,
      isDelayed: true, eventCount24h: 0, p0Count24h: 0, p1Count24h: 0, sources: [],
      message: '交易雷达数据暂时不可用，请把它视为数据延迟。',
    })
  }
}
