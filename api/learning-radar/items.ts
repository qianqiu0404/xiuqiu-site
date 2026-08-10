import { listLearningRadarItems } from '../../lib/learning-radar/repository.js'
import { parseLearningRadarCursor } from '../../src/learning-radar/contracts.js'
import { allowMethods, clampInteger, preparePublicResponse, queryValue, sendPublicError, type MarketRadarRequest, type MarketRadarResponse } from '../../lib/market-radar/http.js'

const categories = new Set(['ai', 'web3_wallet', 'engineering_tools', 'reading'])

export default async function handler(req: MarketRadarRequest, res: MarketRadarResponse) {
  preparePublicResponse(res)
  if (!allowMethods(req, res, ['GET'])) return
  const category = queryValue(req, 'category')
  const cursor = queryValue(req, 'cursor')
  if (category && !categories.has(category)) {
    return sendPublicError(res, 400, 'invalid_category', 'Unsupported learning radar category.')
  }
  if (cursor && !parseLearningRadarCursor(cursor)) {
    return sendPublicError(res, 400, 'invalid_cursor', 'Invalid learning radar cursor.')
  }
  try {
    return res.status(200).json(await listLearningRadarItems({
      category,
      cursor,
      windowHours: clampInteger(queryValue(req, 'window'), 168, 1, 720),
      limit: clampInteger(queryValue(req, 'limit'), 30, 1, 50),
    }))
  } catch {
    return sendPublicError(res, 503, 'data_delayed', '学习雷达时间线暂时不可用。')
  }
}
