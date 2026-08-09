import { listDigests } from '../../lib/market-radar/repository.js'
import { allowMethods, clampInteger, preparePublicResponse, queryValue, type MarketRadarRequest, type MarketRadarResponse } from '../../lib/market-radar/http.js'

export default async function handler(req: MarketRadarRequest, res: MarketRadarResponse) {
  preparePublicResponse(res)
  if (!allowMethods(req, res, ['GET'])) return
  try {
    return res.status(200).json(await listDigests(clampInteger(queryValue(req, 'limit'), 7, 1, 30)))
  } catch {
    return res.status(200).json({ status: 'degraded', items: [], message: '交易雷达摘要暂时不可用。' })
  }
}
