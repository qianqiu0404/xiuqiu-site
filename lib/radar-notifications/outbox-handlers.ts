import { getMarketRadarDb } from '../market-radar/db.js'
import { allowMethods, hasInternalToken, parseJsonBody, preparePrivateResponse, type MarketRadarRequest, type MarketRadarResponse } from '../market-radar/http.js'
import { ackFields, parseNotificationKinds, publicOutboxItem } from './outbox.js'
import { ackSql, claimSql, type OutboxConfig } from './outbox-sql.js'

// Shared Hermes claim/ack handlers for the Learning and Market outboxes. The
// route files under api/*/outbox stay in place because Vercel maps file paths
// to URLs; they only choose a schema. Request/response shapes, status codes and
// SQL semantics are frozen contracts (see AGENTS.md).

type Query = (sql: string, params: unknown[]) => Promise<Record<string, unknown>[]>

export interface OutboxHandlerConfig extends OutboxConfig {
  getDb?: () => { query: Query }
}

export function createOutboxHandlers(config: OutboxHandlerConfig) {
  const getDb = config.getDb ?? (getMarketRadarDb as unknown as () => { query: Query })
  const claimQuery = claimSql(config)
  const ackQuery = ackSql(config)

  async function claim(req: MarketRadarRequest, res: MarketRadarResponse) {
    preparePrivateResponse(res)
    if (!allowMethods(req, res, ['POST'])) return
    if (!hasInternalToken(req)) return res.status(401).json({ code: 'unauthorized', error: 'Invalid dispatcher token.' })
    const body = parseJsonBody(req.body)
    const leaseSeconds = Math.min(300, Math.max(30, Number(body.leaseSeconds) || 90))
    let kinds: string[]
    try {
      kinds = parseNotificationKinds(body.kinds, config.kinds)
    } catch (error) {
      return res.status(400).json({ code: 'invalid_kinds', error: error instanceof Error ? error.message : 'Invalid kinds.' })
    }
    const leaseToken = crypto.randomUUID()
    try {
      const rows = await getDb().query(claimQuery, [leaseToken, leaseSeconds, kinds])
      return res.status(200).json({ item: publicOutboxItem(rows[0]) })
    } catch {
      return res.status(503).json({ code: 'outbox_unavailable', error: 'Outbox is unavailable.' })
    }
  }

  async function ack(req: MarketRadarRequest, res: MarketRadarResponse) {
    preparePrivateResponse(res)
    if (!allowMethods(req, res, ['POST'])) return
    if (!hasInternalToken(req)) return res.status(401).json({ code: 'unauthorized', error: 'Invalid dispatcher token.' })
    let fields: ReturnType<typeof ackFields>
    try {
      fields = ackFields(parseJsonBody(req.body))
    } catch (error) {
      return res.status(400).json({ code: 'invalid_ack', error: error instanceof Error ? error.message : 'Invalid acknowledgement.' })
    }
    try {
      const rows = await getDb().query(ackQuery,
        [fields.id, fields.leaseToken, fields.success, fields.errorCode, crypto.randomUUID(), fields.providerMessageId, fields.errorMessage])
      if (!rows[0]) return res.status(409).json({ code: 'lease_mismatch', error: 'Lease expired or already acknowledged.' })
      return res.status(200).json(rows[0])
    } catch {
      return res.status(503).json({ code: 'outbox_unavailable', error: 'Outbox is unavailable.' })
    }
  }

  return { claim, ack }
}
