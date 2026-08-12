import type { MarketRadarRequest, MarketRadarResponse } from './http.js'

interface MarketEventsQuery {
  market?: string
  priority?: string
  reaction?: string
  asset?: string
  cursor?: string
  windowHours: number
  limit: number
}

interface MarketEventsHandlerDependencies {
  listEvents(query: MarketEventsQuery): Promise<unknown>
  parseEventCursor(value: string): unknown
  allowMethods(req: MarketRadarRequest, res: MarketRadarResponse, methods: string[]): boolean
  clampInteger(value: string | undefined, fallback: number, min: number, max: number): number
  preparePublicResponse(res: MarketRadarResponse): void
  queryValue(req: MarketRadarRequest, key: string): string | undefined
  sendPublicError(res: MarketRadarResponse, status: number, code: string, error: string): void
}

const markets = new Set(['crypto', 'us_equity', 'macro'])
const priorities = new Set(['P0', 'P1', 'P2'])
const reactions = new Set(['pending', 'confirmed', 'priced_in', 'ignored', 'contradicted'])

export function createMarketEventsHandler(dependencies: MarketEventsHandlerDependencies) {
  const {
    listEvents,
    parseEventCursor,
    allowMethods,
    clampInteger,
    preparePublicResponse,
    queryValue,
    sendPublicError,
  } = dependencies

  return async function handler(req: MarketRadarRequest, res: MarketRadarResponse) {
    preparePublicResponse(res)
    if (!allowMethods(req, res, ['GET'])) return
    const market = queryValue(req, 'market')
    const priority = queryValue(req, 'priority')
    const reaction = queryValue(req, 'reaction')
    const cursor = queryValue(req, 'cursor')
    if (market && !markets.has(market)) return sendPublicError(res, 400, 'invalid_market', 'Unsupported market filter.')
    if (priority && !priorities.has(priority)) return sendPublicError(res, 400, 'invalid_priority', 'Unsupported priority filter.')
    if (reaction && !reactions.has(reaction)) return sendPublicError(res, 400, 'invalid_reaction', 'Unsupported reaction filter.')
    if (cursor && !parseEventCursor(cursor)) return sendPublicError(res, 400, 'invalid_cursor', 'Invalid event cursor.')

    try {
      return res.status(200).json(await listEvents({
        market,
        priority,
        reaction,
        asset: queryValue(req, 'asset')?.slice(0, 16),
        cursor,
        windowHours: clampInteger(queryValue(req, 'window'), 24, 1, 168),
        limit: clampInteger(queryValue(req, 'limit'), 20, 1, 50),
      }))
    } catch {
      preparePublicResponse(res)
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json({
        status: 'degraded',
        snapshotId: null,
        asOf: null,
        items: [],
        nextCursor: null,
        message: '交易雷达数据暂时不可用，请稍后再试。',
      })
    }
  }
}
