// Pure SQL builders for the Hermes outbox claim/ack routes. Kept free of
// runtime imports so node:test can load them directly and assert the exact
// statements both outboxes have always used.

export interface OutboxConfig {
  schema: 'learning_radar' | 'market_radar'
  radarKind: 'learning' | 'market'
  kinds: readonly string[]
  // Extra claim filter and ordering; Market excludes test sends and prioritises P0.
  claimFilter?: string
  claimOrder: string
}

const FIXTURE_PAYLOAD_RE = `'(\\[preview[[:space:]]+pr|preview[[:space:]]*qa|test[[:space:]]*fixture|测试夹具|验收夹具)'`

export function claimSql({ schema, radarKind, claimFilter, claimOrder }: OutboxConfig): string {
  return `with candidate as (
      select id from ${schema}.outbox
      where ((status = 'pending' and available_at <= now()) or (status = 'leased' and lease_until <= now()))
      and kind = any($3::text[])${claimFilter ? `\n      ${claimFilter}` : ''}
      and origin = 'research'
      and publication_state = 'published'
      and snapshot_id is not null
      and exists (
        select 1 from radar_system.publication_snapshots publication
        where publication.snapshot_id = ${schema}.outbox.snapshot_id
          and publication.radar_kind = '${radarKind}'
          and publication.origin = 'research'
          and publication.publication_state = 'published'
      )
      and payload::text !~* ${FIXTURE_PAYLOAD_RE}
      order by ${claimOrder}
      for update skip locked limit 1
    )
    update ${schema}.outbox o set status = 'leased', lease_token = $1,
      lease_until = now() + ($2::text || ' seconds')::interval, updated_at = now()
    from candidate where o.id = candidate.id
    returning o.id, o.kind, o.channel, o.idempotency_key, o.payload, o.attempts,
      o.available_at, o.lease_token, o.lease_until, o.snapshot_id`
}

export function ackSql({ schema }: Pick<OutboxConfig, 'schema'>): string {
  return `with updated as (
      update ${schema}.outbox set
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
      insert into ${schema}.delivery_logs
        (id, outbox_id, idempotency_key, attempt, status, provider_message_id, error_code, error_message)
      select $5, id, idempotency_key, attempts, case when $3::boolean then 'sent' else 'failed' end, $6, $4, $7 from updated
      returning outbox_id
    ) select updated.* from updated join logged on logged.outbox_id = updated.id`
}
