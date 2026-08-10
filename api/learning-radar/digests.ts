import { listLearningRadarDigests } from '../../lib/learning-radar/repository.js'
import { allowMethods, clampInteger, preparePublicResponse, queryValue, sendPublicError, type MarketRadarRequest, type MarketRadarResponse } from '../../lib/market-radar/http.js'

export default async function handler(req: MarketRadarRequest, res: MarketRadarResponse) {
  preparePublicResponse(res)
  if (!allowMethods(req, res, ['GET'])) return
  try {
    return res.status(200).json(await listLearningRadarDigests(
      clampInteger(queryValue(req, 'limit'), 7, 1, 30),
    ))
  } catch {
    return sendPublicError(res, 503, 'data_delayed', '学习雷达摘要暂时不可用。')
  }
}
