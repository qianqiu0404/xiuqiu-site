import { getMarketRadarDb } from '../../../lib/market-radar/db.js'
import { allowMethods, hasInternalToken, parseJsonBody, preparePrivateResponse, type MarketRadarRequest, type MarketRadarResponse } from '../../../lib/market-radar/http.js'
import { MARKET_NOTIFICATION_KINDS, parseNotificationKinds, publicOutboxItem } from '../../../lib/radar-notifications/outbox.js'

export default async function handler(req: MarketRadarRequest, res: MarketRadarResponse) {
  preparePrivateResponse(res)
  if (!allowMethods(req, res, ['POST'])) return
  if (!hasInternalToken(req)) return res.status(401).json({ code: 'unauthorized', error: 'Invalid dispatcher token.' })
  const body = parseJsonBody(req.body)
  const leaseSeconds = Math.min(300, Math.max(30, Number(body.leaseSeconds) || 90))
  let kinds: string[]
  try {
    kinds = parseNotificationKinds(body.kinds, MARKET_NOTIFICATION_KINDS)
  } catch (error) {
    return res.status(400).json({ code: 'invalid_kinds', error: error instanceof Error ? error.message : 'Invalid kinds.' })
  }
  const leaseToken = crypto.randomUUID()
  try {
    const rows = await getMarketRadarDb().query(`with candidate as (
      select id from market_radar.outbox
      where ((status = 'pending' and available_at <= now()) or (status = 'leased' and lease_until <= now()))
      and kind = any($3::text[])
      and kind <> 'test'
      and origin = 'research'
      and publication_state = 'published'
      and snapshot_id is not null
      and exists (
        select 1 from radar_system.publication_snapshots publication
        where publication.snapshot_id = market_radar.outbox.snapshot_id
          and publication.radar_kind = 'market'
          and publication.origin = 'research'
          and publication.publication_state = 'published'
      )
      and payload::text !~* '(\\[preview[[:space:]]+pr|preview[[:space:]]*qa|test[[:space:]]*fixture|测试夹具|验收夹具)'
      order by case kind when 'p0' then 0 when 'p1_batch' then 1 else 2 end, created_at
      for update skip locked limit 1
    )
    update market_radar.outbox o set status = 'leased', lease_token = $1,
      lease_until = now() + ($2::text || ' seconds')::interval, updated_at = now()
    from candidate where o.id = candidate.id
    returning o.id, o.kind, o.channel, o.idempotency_key, o.payload, o.attempts,
      o.available_at, o.lease_token, o.lease_until, o.snapshot_id`,
    [leaseToken, leaseSeconds, kinds])
    return res.status(200).json({ item: publicOutboxItem(rows[0]) })
  } catch {
    return res.status(503).json({ code: 'outbox_unavailable', error: 'Outbox is unavailable.' })
  }
}
