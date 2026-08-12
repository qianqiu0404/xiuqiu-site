import { allowMethods, preparePublicResponse, queryValue, sendPublicError, type MarketRadarRequest, type MarketRadarResponse } from '../../../lib/market-radar/http.js'
import { fetchRadarUpstream, isRadarUpstreamConfigured } from '../../../lib/radar-upstream.js'

export default async function handler(req: MarketRadarRequest, res: MarketRadarResponse) {
  preparePublicResponse(res)
  if (!allowMethods(req, res, ['GET'])) return
  const id = queryValue(req, 'id')?.slice(0, 160)
  if (!id) return sendPublicError(res, 400, 'missing_id', 'Event id is required.')
  try {
    if (!isRadarUpstreamConfigured()) throw new Error('radar_upstream_unconfigured')
    const event = await fetchRadarUpstream(`/v1/market-radar/events/${encodeURIComponent(id)}`,fetch,{notFoundAsNull:true})
    if (!event) return sendPublicError(res, 404, 'event_not_found', 'Event not found.')
    return res.status(200).json(event)
  } catch {
    return sendPublicError(res, 503, 'data_delayed', '交易雷达数据暂时不可用。')
  }
}
