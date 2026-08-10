import { listEvents } from '../../lib/market-radar/repository.js'
import { parseEventCursor } from '../../src/market-radar/contracts.js'
import { allowMethods, clampInteger, preparePublicResponse, queryValue, sendPublicError } from '../../lib/market-radar/http.js'
import { createMarketEventsHandler } from '../../lib/market-radar/events-handler.js'

export default createMarketEventsHandler({
  listEvents,
  parseEventCursor,
  allowMethods,
  clampInteger,
  preparePublicResponse,
  queryValue,
  sendPublicError,
})
