import { createOutboxHandlers } from './outbox-handlers.js'
import { LEARNING_NOTIFICATION_KINDS, MARKET_NOTIFICATION_KINDS } from './outbox.js'

export const learningOutbox = createOutboxHandlers({
  schema: 'learning_radar',
  radarKind: 'learning',
  kinds: LEARNING_NOTIFICATION_KINDS,
  claimOrder: 'created_at',
})

export const marketOutbox = createOutboxHandlers({
  schema: 'market_radar',
  radarKind: 'market',
  kinds: MARKET_NOTIFICATION_KINDS,
  claimFilter: "and kind <> 'test'",
  claimOrder: "case kind when 'p0' then 0 when 'p1_batch' then 1 else 2 end, created_at",
})
