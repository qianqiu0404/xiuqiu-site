import type { MarketRadarRequest, MarketRadarResponse } from '../market-radar/http.js'

interface LearningRadarDependencies {
  getSummary(): Promise<unknown>
  listItems(filters: {
    category?: string
    cursor?: string
    windowHours: number
    limit: number
  }): Promise<unknown>
  listDigests(limit: number): Promise<unknown>
  getStory(id: string): Promise<unknown | null>
  parseCursor(value: string): unknown
  allowMethods(req: MarketRadarRequest, res: MarketRadarResponse, methods: string[]): boolean
  clampInteger(value: string | undefined, fallback: number, min: number, max: number): number
  preparePublicResponse(res: MarketRadarResponse): void
  queryValue(req: MarketRadarRequest, key: string): string | undefined
  sendPublicError(res: MarketRadarResponse, status: number, code: string, error: string): void
}

export const LEARNING_RADAR_ROUTE_QUERY = '__learning_route'

const categories = new Set(['ai', 'web3_wallet', 'engineering_tools', 'reading'])

export function createLearningRadarHandler(dependencies: LearningRadarDependencies) {
  const {
    getSummary,
    listItems,
    listDigests,
    getStory,
    parseCursor,
    allowMethods: allowRequestMethods,
    clampInteger: clampRequestInteger,
    preparePublicResponse: prepareResponse,
    queryValue: requestQueryValue,
    sendPublicError: sendError,
  } = dependencies

  return async function handler(req: MarketRadarRequest, res: MarketRadarResponse) {
    prepareResponse(res)
    if (!allowRequestMethods(req, res, ['GET'])) return

    const route = requestQueryValue(req, LEARNING_RADAR_ROUTE_QUERY)
    if (route === 'summary') {
      try {
        return res.status(200).json(await getSummary())
      } catch {
        return sendError(res, 503, 'data_delayed', '学习雷达摘要暂时不可用。')
      }
    }

    if (route === 'items') {
      const category = requestQueryValue(req, 'category')
      const cursor = requestQueryValue(req, 'cursor')
      if (category && !categories.has(category)) {
        return sendError(res, 400, 'invalid_category', 'Unsupported learning radar category.')
      }
      if (cursor && !parseCursor(cursor)) {
        return sendError(res, 400, 'invalid_cursor', 'Invalid learning radar cursor.')
      }
      try {
        return res.status(200).json(await listItems({
          category,
          cursor,
          windowHours: clampRequestInteger(requestQueryValue(req, 'window'), 168, 1, 720),
          limit: clampRequestInteger(requestQueryValue(req, 'limit'), 30, 1, 50),
        }))
      } catch {
        return sendError(res, 503, 'data_delayed', '学习雷达时间线暂时不可用。')
      }
    }

    if (route === 'digests') {
      try {
        return res.status(200).json(await listDigests(
          clampRequestInteger(requestQueryValue(req, 'limit'), 7, 1, 30),
        ))
      } catch {
        return sendError(res, 503, 'data_delayed', '学习雷达摘要暂时不可用。')
      }
    }

    if (route === 'story') {
      const id = requestQueryValue(req, 'id')?.slice(0, 160)
      if (!id) return sendError(res, 400, 'missing_id', 'Story id is required.')
      try {
        const story = await getStory(id)
        if (!story) return sendError(res, 404, 'story_not_found', 'Story not found.')
        return res.status(200).json(story)
      } catch {
        return sendError(res, 503, 'data_delayed', '学习雷达详情暂时不可用。')
      }
    }

    return sendError(res, 404, 'route_not_found', 'Learning radar route not found.')
  }
}
