import { getMarketRadarDb } from '../market-radar/db.js'
import type { MarketSnapshotV1 } from './contract.js'

type Row = Record<string, unknown>

function iso(value: unknown): string {
  return new Date(String(value)).toISOString()
}

export async function ingestMarketSnapshot(snapshot: MarketSnapshotV1, keyId: string, nonce: string, timestamp: number): Promise<'created' | 'existing'> {
  const rows = await getMarketRadarDb().query(
    'select status from market_data.ingest_snapshot($1::jsonb, $2, $3, to_timestamp($4::double precision / 1000.0))',
    [JSON.stringify(snapshot), keyId, nonce, timestamp],
  ) as Row[]
  const status = rows[0]?.status
  if (status !== 'created' && status !== 'existing') throw new Error('Market snapshot ingest returned an invalid status.')
  return status
}

export async function getPublicMarketStatus() {
  const rows = await getMarketRadarDb().query(`select snapshot_id, as_of, generated_at, mode, asset_id, status, market_state, reason
    from market_data.public_current_coverage order by asset_id`, []) as Row[]
  if (!rows.length) return { status: 'unavailable', snapshotId: null, asOf: null, generatedAt: null, mode: null, coverage: [], message: '尚无已发布的市场快照。' }
  return {
    status: rows.some(row => row.status === 'healthy') ? 'available' : 'unavailable',
    snapshotId: String(rows[0].snapshot_id), asOf: iso(rows[0].as_of), generatedAt: iso(rows[0].generated_at), mode: String(rows[0].mode),
    coverage: rows.map(row => ({ assetId: String(row.asset_id), status: String(row.status), marketState: String(row.market_state), ...(row.reason ? { reason: String(row.reason) } : {}) })),
  }
}

export async function getPrivateMarketSnapshot() {
  const rows = await getMarketRadarDb().query(`with selected as materialized (
      select s.snapshot_id, s.as_of, s.generated_at, s.mode
      from market_data.current_snapshot c join market_data.snapshots s on s.snapshot_id = c.snapshot_id
      where c.pointer_key = 'current'
    )
    select selected.*,
      coalesce((select jsonb_agg(jsonb_build_object(
        'assetId', q.asset_id, 'role', q.role, 'price', q.price_text, 'currency', q.currency,
        'observedAt', q.observed_at, 'delaySeconds', q.delay_seconds, 'provider', q.provider, 'mode', q.mode
      ) order by q.asset_id, q.role) from market_data.quotes q
        where q.snapshot_id = selected.snapshot_id and q.role = 'display' and q.display_scope = 'private'), '[]'::jsonb) quotes,
      coalesce((select jsonb_agg(jsonb_build_object(
        'assetId', cv.asset_id, 'status', cv.status, 'marketState', cv.market_state, 'reason', cv.reason
      ) order by cv.asset_id) from market_data.coverage cv where cv.snapshot_id = selected.snapshot_id), '[]'::jsonb) coverage
    from selected`, []) as Row[]
  const snapshot = rows[0]
  if (!snapshot) return null
  const quoteRows = Array.isArray(snapshot.quotes) ? snapshot.quotes as Row[] : []
  const coverageRows = Array.isArray(snapshot.coverage) ? snapshot.coverage as Row[] : []
  return {
    snapshotId: String(snapshot.snapshot_id), asOf: iso(snapshot.as_of), generatedAt: iso(snapshot.generated_at), mode: String(snapshot.mode),
    quotes: quoteRows.map(row => ({ assetId: String(row.assetId), role: String(row.role), price: String(row.price), currency: String(row.currency), observedAt: iso(row.observedAt), delaySeconds: Number(row.delaySeconds), provider: String(row.provider), mode: String(row.mode) })),
    coverage: coverageRows.map(row => ({ assetId: String(row.assetId), status: String(row.status), marketState: String(row.marketState), ...(row.reason ? { reason: String(row.reason) } : {}) })),
  }
}

export async function createPrivateMarketAuthFlow(stateHash: string, verifierCiphertext: string): Promise<void> {
  await getMarketRadarDb().query(`with cleanup as (
      delete from private_market.auth_flows where expires_at <= now() or consumed_at is not null returning 1
    ) insert into private_market.auth_flows (state_hash, verifier_ciphertext, expires_at)
    values ($1, $2, now() + interval '10 minutes')`, [stateHash, verifierCiphertext])
}

export async function consumePrivateMarketLoginRateLimit(clientHash: string): Promise<boolean> {
  const rows = await getMarketRadarDb().query(
    'select private_market.consume_rate_limit($1, 10, 600) allowed',
    [`oauth:${clientHash}`],
  ) as Row[]
  return rows[0]?.allowed === true
}

export async function consumePrivateMarketAuthFlow(stateHash: string): Promise<string | null> {
  const rows = await getMarketRadarDb().query(`update private_market.auth_flows set consumed_at = now()
    where state_hash = $1 and consumed_at is null and expires_at > now()
    returning verifier_ciphertext`, [stateHash]) as Row[]
  return rows[0] ? String(rows[0].verifier_ciphertext) : null
}

export async function createPrivateMarketSession(sessionHash: string, githubUserId: number, githubLogin: string): Promise<void> {
  await getMarketRadarDb().query(`with cleanup as (
      delete from private_market.sessions where expires_at <= now() or revoked_at is not null returning 1
    ) insert into private_market.sessions (session_hash, github_user_id, github_login, expires_at)
    values ($1, $2, $3, now() + interval '12 hours')`, [sessionHash, githubUserId, githubLogin])
}

export async function getPrivateMarketSession(sessionHash: string): Promise<{ githubUserId: number; githubLogin: string } | null> {
  const rows = await getMarketRadarDb().query(`select github_user_id, github_login from private_market.sessions
    where session_hash = $1 and revoked_at is null and expires_at > now()`, [sessionHash]) as Row[]
  return rows[0] ? { githubUserId: Number(rows[0].github_user_id), githubLogin: String(rows[0].github_login) } : null
}

export async function revokePrivateMarketSession(sessionHash: string): Promise<void> {
  await getMarketRadarDb().query(`update private_market.sessions set revoked_at = now()
    where session_hash = $1 and revoked_at is null`, [sessionHash])
}
