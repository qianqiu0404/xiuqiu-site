import { parseEventCursor } from '../../src/market-radar/contracts.js'
import { allowMethods, clampInteger, preparePublicResponse, queryValue, sendPublicError } from '../../lib/market-radar/http.js'
import { createMarketEventsHandler } from '../../lib/market-radar/events-handler.js'
import { fetchRadarUpstream, isRadarUpstreamConfigured } from '../../lib/radar-upstream.js'

interface UpstreamEventQuery { market?: string; priority?: string; reaction?: string; asset?: string; cursor?: string; windowHours: number; limit: number }
async function listEventsFromActiveBackend(query: UpstreamEventQuery) {
  if (!isRadarUpstreamConfigured()) throw new Error('radar_upstream_unconfigured')
  const target = new URL('/v1/market-radar/events', 'https://radar.invalid')
  for (const [key, value] of Object.entries({ market:query.market,priority:query.priority,reaction:query.reaction,asset:query.asset,cursor:query.cursor,window:String(query.windowHours),limit:String(query.limit) })) if(value) target.searchParams.set(key,String(value))
  return fetchRadarUpstream(`${target.pathname}${target.search}`)
}

export default createMarketEventsHandler({
  listEvents: listEventsFromActiveBackend,
  parseEventCursor,
  allowMethods,
  clampInteger,
  preparePublicResponse,
  queryValue,
  sendPublicError,
})
