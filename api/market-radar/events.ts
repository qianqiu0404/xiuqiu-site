import { listEvents } from '../../lib/market-radar/repository.js'
import { parseEventCursor } from '../../src/market-radar/contracts.js'
import { allowMethods, clampInteger, preparePublicResponse, queryValue, type MarketRadarRequest, type MarketRadarResponse } from '../../lib/market-radar/http.js'

const markets = new Set(['crypto', 'us_equity', 'macro'])
const priorities = new Set(['P0', 'P1', 'P2'])
const reactions = new Set(['pending', 'confirmed', 'priced_in', 'ignored', 'contradicted'])

export default async function handler(req: MarketRadarRequest, res: MarketRadarResponse) {
  preparePublicResponse(res)
  if (!allowMethods(req, res, ['GET'])) return
  const market = queryValue(req, 'market')
  const priority = queryValue(req, 'priority')
  const reaction = queryValue(req, 'reaction')
  const cursor = queryValue(req, 'cursor')
  if (market && !markets.has(market)) return res.status(400).json({ code: 'invalid_market', error: 'Unsupported market filter.' })
  if (priority && !priorities.has(priority)) return res.status(400).json({ code: 'invalid_priority', error: 'Unsupported priority filter.' })
  if (reaction && !reactions.has(reaction)) return res.status(400).json({ code: 'invalid_reaction', error: 'Unsupported reaction filter.' })
  if (cursor && !parseEventCursor(cursor)) return res.status(400).json({ code: 'invalid_cursor', error: 'Invalid event cursor.' })

  try {
    return res.status(200).json(await listEvents({
      market, priority, reaction,
      asset: queryValue(req, 'asset')?.slice(0, 16),
      cursor,
      windowHours: clampInteger(queryValue(req, 'window'), 24, 1, 168),
      limit: clampInteger(queryValue(req, 'limit'), 20, 1, 50),
    }))
  } catch {
    return res.status(200).json({ status: 'degraded', items: [], nextCursor: null, message: '交易雷达数据暂时不可用，请稍后再试。' })
  }
}
