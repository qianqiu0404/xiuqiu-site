import { allowMethods, clampInteger, preparePublicResponse, queryValue, type MarketRadarRequest, type MarketRadarResponse } from '../../lib/market-radar/http.js'
import { fetchRadarUpstream, isRadarUpstreamConfigured } from '../../lib/radar-upstream.js'

export default async function handler(req: MarketRadarRequest, res: MarketRadarResponse) {
  preparePublicResponse(res)
  if (!allowMethods(req, res, ['GET'])) return
  try {
    const limit = clampInteger(queryValue(req, 'limit'), 7, 1, 30)
    if (!isRadarUpstreamConfigured()) throw new Error('radar_upstream_unconfigured')
    return res.status(200).json(await fetchRadarUpstream(`/v1/market-radar/digests?limit=${limit}`))
  } catch {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ status: 'degraded', snapshotId: null, asOf: null, items: [], message: '交易雷达摘要暂时不可用。' })
  }
}
