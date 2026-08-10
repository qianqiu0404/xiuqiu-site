import { getLearningRadarStory } from '../../../lib/learning-radar/repository.js'
import { allowMethods, preparePublicResponse, queryValue, sendPublicError, type MarketRadarRequest, type MarketRadarResponse } from '../../../lib/market-radar/http.js'

export default async function handler(req: MarketRadarRequest, res: MarketRadarResponse) {
  preparePublicResponse(res)
  if (!allowMethods(req, res, ['GET'])) return
  const id = queryValue(req, 'id')?.slice(0, 160)
  if (!id) return sendPublicError(res, 400, 'missing_id', 'Story id is required.')
  try {
    const story = await getLearningRadarStory(id)
    if (!story) return sendPublicError(res, 404, 'story_not_found', 'Story not found.')
    return res.status(200).json(story)
  } catch {
    return sendPublicError(res, 503, 'data_delayed', '学习雷达详情暂时不可用。')
  }
}
