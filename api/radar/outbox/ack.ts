import { getMarketRadarDb } from '../../../lib/market-radar/db.js'
import { allowMethods, hasInternalToken, parseJsonBody, preparePrivateResponse, type MarketRadarRequest, type MarketRadarResponse } from '../../../lib/market-radar/http.js'
import { ackFields } from '../../../lib/radar-notifications/outbox.js'

export default async function handler(req: MarketRadarRequest, res: MarketRadarResponse) {
  preparePrivateResponse(res)
  if (!allowMethods(req, res, ['POST'])) return
  if (!hasInternalToken(req)) return res.status(401).json({ code: 'unauthorized', error: 'Invalid dispatcher token.' })
  let ack: ReturnType<typeof ackFields>
  try {
    ack = ackFields(parseJsonBody(req.body))
  } catch (error) {
    return res.status(400).json({ code: 'invalid_ack', error: error instanceof Error ? error.message : 'Invalid acknowledgement.' })
  }
  try {
    const rows = await getMarketRadarDb().query(`with updated as (
      update learning_radar.outbox set
        attempts = attempts + 1,
        status = case when $3::boolean then 'sent' when attempts + 1 >= 5 then 'dead_letter' else 'pending' end,
        sent_at = case when $3::boolean then now() else sent_at end,
        available_at = case when $3::boolean or attempts + 1 >= 5 then available_at else now() + (power(2, attempts + 1)::text || ' minutes')::interval end,
        last_error = case when $3::boolean then null else $4 end,
        last_error_message = case when $3::boolean then null else $7 end,
        lease_token = null, lease_until = null, updated_at = now()
      where id = $1 and lease_token = $2 and status = 'leased'
      returning id, idempotency_key, attempts, status
    ), logged as (
      insert into learning_radar.delivery_logs
        (id, outbox_id, idempotency_key, attempt, status, provider_message_id, error_code, error_message)
      select $5, id, idempotency_key, attempts, case when $3::boolean then 'sent' else 'failed' end, $6, $4, $7 from updated
      returning outbox_id
    ) select updated.* from updated join logged on logged.outbox_id = updated.id`,
    [ack.id, ack.leaseToken, ack.success, ack.errorCode, crypto.randomUUID(), ack.providerMessageId, ack.errorMessage])
    if (!rows[0]) return res.status(409).json({ code: 'lease_mismatch', error: 'Lease expired or already acknowledged.' })
    return res.status(200).json(rows[0])
  } catch {
    return res.status(503).json({ code: 'outbox_unavailable', error: 'Outbox is unavailable.' })
  }
}
