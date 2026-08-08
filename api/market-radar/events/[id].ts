import { getEvent } from '../../../lib/market-radar/repository.js'
import { allowMethods, preparePublicResponse, queryValue, type MarketRadarRequest, type MarketRadarResponse } from '../../../lib/market-radar/http.js'

export default async function handler(req: MarketRadarRequest, res: MarketRadarResponse) {
  preparePublicResponse(res)
  if (!allowMethods(req, res, ['GET'])) return
  const id = queryValue(req, 'id')?.slice(0, 160)
  if (!id) return res.status(400).json({ code: 'missing_id', error: 'Event id is required.' })
  try {
    const event = await getEvent(id)
    if (!event) return res.status(404).json({ code: 'event_not_found', error: 'Event not found.' })
    return res.status(200).json(event)
  } catch {
    return res.status(503).json({ code: 'data_delayed', error: '交易雷达数据暂时不可用。' })
  }
}
