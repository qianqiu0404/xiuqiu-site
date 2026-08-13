create schema if not exists market_data;
create schema if not exists private_market;

revoke all on schema market_data from public;
revoke all on schema private_market from public;
alter default privileges in schema market_data revoke all on tables from public;
alter default privileges in schema private_market revoke all on tables from public;

create table if not exists market_data.snapshots (
  snapshot_id text primary key check (snapshot_id ~ '^market-[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9a-f]{16}$'),
  schema_version integer not null check (schema_version = 1),
  universe_version text not null check (universe_version = 'core-2026-08-v1'),
  as_of timestamptz not null,
  generated_at timestamptz not null,
  mode text not null check (mode in ('live', 'delayed', 'eod', 'mixed')),
  checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  producer_key_id text not null,
  created_at timestamptz not null default now(),
  unique (snapshot_id, checksum)
);

create table if not exists market_data.quotes (
  snapshot_id text not null references market_data.snapshots(snapshot_id) on delete restrict,
  asset_id text not null,
  role text not null check (role in ('analysis', 'display')),
  price_text text not null check (price_text ~ '^(0|[1-9][0-9]*)(\.[0-9]+)?$'),
  currency text not null,
  observed_at timestamptz not null,
  delay_seconds bigint not null check (delay_seconds >= 0),
  provider text not null,
  mode text not null check (mode in ('live', 'delayed', 'eod')),
  display_scope text not null check (display_scope in ('private', 'internal_non_display')),
  primary key (snapshot_id, asset_id, role),
  check ((role = 'display' and display_scope = 'private') or (role = 'analysis' and display_scope = 'internal_non_display'))
);

create table if not exists market_data.coverage (
  snapshot_id text not null references market_data.snapshots(snapshot_id) on delete restrict,
  asset_id text not null,
  status text not null check (status in ('healthy', 'stale', 'unavailable')),
  market_state text not null check (market_state in ('open', 'closed', 'pre', 'post', 'unknown')),
  reason text,
  primary key (snapshot_id, asset_id),
  check (status <> 'unavailable' or nullif(btrim(reason), '') is not null)
);

create table if not exists market_data.current_snapshot (
  pointer_key text primary key check (pointer_key = 'current'),
  snapshot_id text not null references market_data.snapshots(snapshot_id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table if not exists market_data.ingest_nonces (
  key_id text not null,
  nonce text not null check (nonce ~ '^[0-9a-f]{32}$'),
  request_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (key_id, nonce)
);

create table if not exists private_market.auth_flows (
  state_hash text primary key check (state_hash ~ '^[0-9a-f]{64}$'),
  verifier_ciphertext text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

create table if not exists private_market.sessions (
  session_hash text primary key check (session_hash ~ '^[0-9a-f]{64}$'),
  github_user_id bigint not null,
  github_login text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create table if not exists private_market.rate_limits (
  limit_key text primary key,
  window_started_at timestamptz not null,
  attempts integer not null check (attempts > 0)
);

create or replace function private_market.consume_rate_limit(
  requested_key text,
  max_attempts integer,
  window_seconds integer
) returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, private_market
as $$
declare
  current_attempts integer;
begin
  if length(requested_key) > 200 or max_attempts < 1 or window_seconds < 1 then
    return false;
  end if;
  insert into private_market.rate_limits (limit_key, window_started_at, attempts)
  values (requested_key, now(), 1)
  on conflict (limit_key) do update set
    window_started_at = case
      when private_market.rate_limits.window_started_at <= now() - make_interval(secs => window_seconds) then now()
      else private_market.rate_limits.window_started_at
    end,
    attempts = case
      when private_market.rate_limits.window_started_at <= now() - make_interval(secs => window_seconds) then 1
      else private_market.rate_limits.attempts + 1
    end
  returning attempts into current_attempts;
  delete from private_market.rate_limits where window_started_at < now() - interval '1 day';
  return current_attempts <= max_attempts;
end;
$$;

create or replace function market_data.ingest_snapshot(
  snapshot jsonb,
  signer_key_id text,
  request_nonce text,
  request_at timestamptz
) returns table(status text)
language plpgsql
security invoker
set search_path = pg_catalog, market_data
as $$
declare
  snapshot_id_value text := snapshot->>'snapshotId';
  checksum_value text := snapshot->>'checksum';
  existing_checksum text;
  coverage_count integer;
  quote_count integer;
begin
  if request_at < now() - interval '60 seconds' or request_at > now() + interval '60 seconds' then
    raise exception 'expired ingest request';
  end if;
  if jsonb_typeof(snapshot->'coverage') <> 'array' or jsonb_array_length(snapshot->'coverage') <> 21 then
    raise exception 'snapshot must contain exactly 21 coverage records';
  end if;
  if jsonb_typeof(snapshot->'quotes') <> 'array' then
    raise exception 'snapshot quotes must be an array';
  end if;
  if exists (
    select 1 from jsonb_array_elements(snapshot->'quotes') q
    where (q->>'role' = 'display' and q->>'displayScope' <> 'private')
      or (q->>'role' = 'analysis' and q->>'displayScope' <> 'internal_non_display')
  ) then
    raise exception 'quote role conflicts with display scope';
  end if;
  if exists (
    select 1 from jsonb_array_elements(snapshot->'quotes') q
    join jsonb_array_elements(snapshot->'coverage') c on c->>'assetId' = q->>'assetId'
    where c->>'status' = 'unavailable'
  ) then
    raise exception 'unavailable coverage cannot contain a quote';
  end if;
  if exists (
    select 1 from jsonb_array_elements(snapshot->'coverage') c
    where c->>'status' <> 'unavailable'
      and not exists (select 1 from jsonb_array_elements(snapshot->'quotes') q where q->>'assetId' = c->>'assetId')
  ) then
    raise exception 'available coverage requires a quote';
  end if;

  insert into market_data.ingest_nonces (key_id, nonce, request_at)
  values (signer_key_id, request_nonce, request_at);

  select s.checksum into existing_checksum from market_data.snapshots s where s.snapshot_id = snapshot_id_value;
  if existing_checksum is not null then
    if existing_checksum <> checksum_value then
      raise exception 'snapshot id conflicts with existing checksum';
    end if;
    return query select 'existing'::text;
    return;
  end if;

  insert into market_data.snapshots (
    snapshot_id, schema_version, universe_version, as_of, generated_at, mode, checksum, payload, producer_key_id
  ) values (
    snapshot_id_value, (snapshot->>'schemaVersion')::integer, snapshot->>'universeVersion',
    (snapshot->>'asOf')::timestamptz, (snapshot->>'generatedAt')::timestamptz,
    snapshot->>'mode', checksum_value, snapshot, signer_key_id
  );

  insert into market_data.quotes (
    snapshot_id, asset_id, role, price_text, currency, observed_at, delay_seconds, provider, mode, display_scope
  ) select snapshot_id_value, item->>'assetId', item->>'role', item->>'price', item->>'currency',
    (item->>'observedAt')::timestamptz, (item->>'delaySeconds')::bigint, item->>'provider', item->>'mode', item->>'displayScope'
  from jsonb_array_elements(snapshot->'quotes') item;
  get diagnostics quote_count = row_count;

  insert into market_data.coverage (snapshot_id, asset_id, status, market_state, reason)
  select snapshot_id_value, item->>'assetId', item->>'status', item->>'marketState', nullif(item->>'reason', '')
  from jsonb_array_elements(snapshot->'coverage') item;
  get diagnostics coverage_count = row_count;

  if coverage_count <> 21 or quote_count <> jsonb_array_length(snapshot->'quotes') then
    raise exception 'snapshot child row count mismatch';
  end if;

  insert into market_data.current_snapshot (pointer_key, snapshot_id, updated_at)
  values ('current', snapshot_id_value, now())
  on conflict (pointer_key) do update set snapshot_id = excluded.snapshot_id, updated_at = excluded.updated_at
  where (select as_of from market_data.snapshots where snapshot_id = excluded.snapshot_id)
    >= (select as_of from market_data.snapshots where snapshot_id = market_data.current_snapshot.snapshot_id);

  delete from market_data.ingest_nonces where created_at < now() - interval '10 minutes';
  return query select 'created'::text;
end;
$$;

create or replace view market_data.public_current_coverage as
select s.snapshot_id, s.as_of, s.generated_at, s.mode,
  c.asset_id, c.status, c.market_state, c.reason
from market_data.current_snapshot p
join market_data.snapshots s on s.snapshot_id = p.snapshot_id
join market_data.coverage c on c.snapshot_id = s.snapshot_id
where p.pointer_key = 'current';

comment on view market_data.public_current_coverage is
  'Public allowlist projection. It deliberately contains no quote price, currency, provider, or raw payload.';
