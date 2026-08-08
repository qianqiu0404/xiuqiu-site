import { getMarketRadarDb } from '../../../lib/market-radar/db.js'
import { allowMethods, hasInternalToken, parseJsonBody, preparePrivateResponse, type MarketRadarRequest, type MarketRadarResponse } from '../../../lib/market-radar/http.js'

export default async function handler(req: MarketRadarRequest, res: MarketRadarResponse) {
  preparePrivateResponse(res)
  if (!allowMethods(req, res, ['POST'])) return
  if (!hasInternalToken(req)) return res.status(401).json({ code: 'unauthorized', error: 'Invalid dispatcher token.' })
  const body = parseJsonBody(req.body)
  const id = typeof body.id === 'string' ? body.id.slice(0, 160) : ''
  const leaseToken = typeof body.leaseToken === 'string' ? body.leaseToken.slice(0, 160) : ''
  const success = body.success === true
  const errorCode = typeof body.errorCode === 'string' ? body.errorCode.slice(0, 120) : null
  const providerMessageId = typeof body.providerMessageId === 'string' ? body.providerMessageId.slice(0, 200) : null
  if (!id || !leaseToken) return res.status(400).json({ code: 'invalid_ack', error: 'Outbox id and lease token are required.' })
  try {
    const rows = await getMarketRadarDb().query(`with updated as (
      update market_radar.outbox set
        attempts = attempts + 1,
        status = case when $3::boolean then 'sent' when attempts + 1 >= 5 then 'dead_letter' else 'pending' end,
        sent_at = case when $3::boolean then now() else sent_at end,
        available_at = case when $3::boolean or attempts + 1 >= 5 then available_at else now() + (power(2, attempts + 1)::text || ' minutes')::interval end,
        last_error = case when $3::boolean then null else $4 end,
        lease_token = null, lease_until = null, updated_at = now()
      where id = $1 and lease_token = $2 and status = 'leased'
      returning id, attempts, status
    ), logged as (
      insert into market_radar.delivery_logs (id, outbox_id, attempt, status, provider_message_id, error_code)
      select $5, id, attempts, case when $3::boolean then 'sent' else 'failed' end, $6, $4 from updated
      returning outbox_id
    ) select updated.* from updated join logged on logged.outbox_id = updated.id`,
    [id, leaseToken, success, errorCode, crypto.randomUUID(), providerMessageId])
    if (!rows[0]) return res.status(409).json({ code: 'lease_mismatch', error: 'Lease expired or already acknowledged.' })
    return res.status(200).json(rows[0])
  } catch {
    return res.status(503).json({ code: 'outbox_unavailable', error: 'Outbox is unavailable.' })
  }
}
