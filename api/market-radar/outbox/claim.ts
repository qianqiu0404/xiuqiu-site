import { getMarketRadarDb } from '../../../lib/market-radar/db.ts'
import { allowMethods, hasInternalToken, parseJsonBody, preparePrivateResponse, type MarketRadarRequest, type MarketRadarResponse } from '../../../lib/market-radar/http.ts'

export default async function handler(req: MarketRadarRequest, res: MarketRadarResponse) {
  preparePrivateResponse(res)
  if (!allowMethods(req, res, ['POST'])) return
  if (!hasInternalToken(req)) return res.status(401).json({ code: 'unauthorized', error: 'Invalid dispatcher token.' })
  const body = parseJsonBody(req.body)
  const leaseSeconds = Math.min(300, Math.max(30, Number(body.leaseSeconds) || 90))
  const leaseToken = crypto.randomUUID()
  try {
    const rows = await getMarketRadarDb().query(`with candidate as (
      select id from market_radar.outbox
      where ((status = 'pending' and available_at <= now()) or (status = 'leased' and lease_until <= now()))
      order by case kind when 'p0' then 0 when 'p1_batch' then 1 else 2 end, created_at
      for update skip locked limit 1
    )
    update market_radar.outbox o set status = 'leased', lease_token = $1,
      lease_until = now() + ($2::text || ' seconds')::interval, updated_at = now()
    from candidate where o.id = candidate.id
    returning o.id, o.kind, o.channel, o.idempotency_key, o.payload, o.attempts, o.lease_token, o.lease_until`,
    [leaseToken, leaseSeconds])
    return res.status(200).json({ item: rows[0] || null })
  } catch {
    return res.status(503).json({ code: 'outbox_unavailable', error: 'Outbox is unavailable.' })
  }
}
