import { recordFeedback } from '../../lib/market-radar/repository.js'
import {
  allowMethods, consumeRateLimit, getClientId, hashClientId, parseJsonBody, preparePrivateResponse,
  type MarketRadarRequest, type MarketRadarResponse,
} from '../../lib/market-radar/http.js'

const values = new Set(['useful', 'noise', 'missed_context', 'wrong_direction'])

export default async function handler(req: MarketRadarRequest, res: MarketRadarResponse) {
  preparePrivateResponse(res)
  if (!allowMethods(req, res, ['POST'])) return
  const clientId = getClientId(req)
  if (!consumeRateLimit(`feedback:${clientId}`, 12, 60_000)) {
    return res.status(429).json({ code: 'rate_limited', error: '反馈过于频繁，请稍后再试。' })
  }
  const body = parseJsonBody(req.body)
  const eventId = typeof body.eventId === 'string' ? body.eventId.slice(0, 160) : ''
  const value = typeof body.value === 'string' ? body.value : ''
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : undefined
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.slice(0, 160) : ''
  if (!eventId || !idempotencyKey || !values.has(value)) {
    return res.status(400).json({ code: 'invalid_feedback', error: '反馈字段不完整。' })
  }
  try {
    await recordFeedback({ eventId, value, note, idempotencyKey, clientHash: await hashClientId(clientId) })
    return res.status(202).json({ accepted: true })
  } catch {
    return res.status(503).json({ code: 'feedback_unavailable', error: '反馈暂时无法保存。' })
  }
}
