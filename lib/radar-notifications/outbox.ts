export const MARKET_NOTIFICATION_KINDS = ['p0', 'p1_batch', 'daily', 'us_premarket', 'test'] as const
export const LEARNING_NOTIFICATION_KINDS = ['daily'] as const

type QueryRow = Record<string, unknown>

export function parseNotificationKinds(value: unknown, allowed: readonly string[]): string[] {
  if (value === undefined) return [...allowed]
  if (!Array.isArray(value) || value.length === 0 || value.some(kind => typeof kind !== 'string')) {
    throw new Error('kinds must be a non-empty string array.')
  }
  const kinds = [...new Set(value)]
  if (kinds.some(kind => !allowed.includes(kind))) throw new Error('kinds contains an unsupported notification type.')
  return kinds
}

export function publicOutboxItem(row: QueryRow | undefined): Record<string, unknown> | null {
  if (!row) return null
  return {
    id: row.id,
    kind: row.kind,
    channel: row.channel,
    idempotencyKey: row.idempotency_key,
    payload: row.payload,
    attempts: row.attempts,
    availableAt: row.available_at,
    leaseToken: row.lease_token,
    leaseUntil: row.lease_until,
  }
}

export function ackFields(body: Record<string, unknown>): {
  id: string
  leaseToken: string
  success: boolean
  providerMessageId: string | null
  errorCode: string | null
  errorMessage: string | null
} {
  const id = typeof body.id === 'string' ? body.id.slice(0, 160) : ''
  const leaseToken = typeof body.leaseToken === 'string' ? body.leaseToken.slice(0, 160) : ''
  const success = body.success === true
  const providerMessageId = typeof body.providerMessageId === 'string' && body.providerMessageId.trim()
    ? body.providerMessageId.trim().slice(0, 200)
    : null
  const errorCode = typeof body.errorCode === 'string' && body.errorCode.trim()
    ? body.errorCode.trim().slice(0, 120)
    : null
  const errorMessage = typeof body.errorMessage === 'string' && body.errorMessage.trim()
    ? body.errorMessage.trim().slice(0, 500)
    : null
  if (!id || !leaseToken) throw new Error('Outbox id and lease token are required.')
  if (success && !providerMessageId) throw new Error('Successful delivery requires providerMessageId.')
  if (!success && !errorCode) throw new Error('Failed delivery requires errorCode.')
  return { id, leaseToken, success, providerMessageId, errorCode, errorMessage }
}
