create schema if not exists market_radar;

create table if not exists market_radar.raw_items (
  id text primary key,
  provider text not null,
  provider_id text not null,
  market text not null check (market in ('crypto', 'us_equity', 'macro')),
  source_url text not null,
  title text not null,
  published_at timestamptz not null,
  payload jsonb not null,
  payload_expires_at timestamptz not null default (now() + interval '14 days'),
  payload_purged_at timestamptz,
  normalized_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_id)
);

create table if not exists market_radar.events (
  id text primary key,
  slug text not null unique,
  cluster_key text not null,
  market text not null check (market in ('crypto', 'us_equity', 'macro')),
  status text not null check (status in ('draft', 'published', 'rejected')),
  priority text check (priority in ('P0', 'P1', 'P2', 'P3')),
  score integer not null check (score between 0 and 100),
  title_zh text not null,
  summary_zh text not null,
  why_it_matters_zh text not null,
  event_type text not null,
  news_direction text not null check (news_direction in ('bullish', 'bearish', 'mixed', 'neutral')),
  system_judgment text not null,
  horizon text not null check (horizon in ('intraday', 'days', 'weeks')),
  ai_schema_version text,
  occurred_at timestamptz not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_radar_events_published_idx on market_radar.events (published_at desc) where status = 'published';
create index if not exists market_radar_events_cluster_idx on market_radar.events (cluster_key, occurred_at desc);

create table if not exists market_radar.event_sources (
  event_id text not null references market_radar.events(id) on delete cascade,
  raw_item_id text not null references market_radar.raw_items(id) on delete cascade,
  source_name text not null,
  source_url text not null,
  primary key (event_id, raw_item_id)
);

create table if not exists market_radar.event_assets (
  event_id text not null references market_radar.events(id) on delete cascade,
  namespace text not null check (namespace in ('crypto', 'us_equity', 'macro')),
  symbol text not null,
  relevance integer not null check (relevance between 0 and 100),
  primary key (event_id, namespace, symbol)
);

create table if not exists market_radar.market_reactions (
  event_id text primary key references market_radar.events(id) on delete cascade,
  status text not null check (status in ('pending', 'confirmed', 'priced_in', 'ignored', 'contradicted')),
  benchmark text,
  event_price numeric,
  price_5m numeric,
  price_30m numeric,
  price_4h numeric,
  benchmark_event_price numeric,
  benchmark_5m numeric,
  benchmark_30m numeric,
  benchmark_4h numeric,
  return_5m numeric,
  return_30m numeric,
  return_4h numeric,
  excess_5m numeric,
  excess_30m numeric,
  excess_4h numeric,
  updated_at timestamptz not null default now()
);

create table if not exists market_radar.digests (
  id text primary key,
  kind text not null check (kind in ('daily', 'us_premarket', 'p1_batch', 'trial_report')),
  title text not null,
  body_zh text not null,
  visibility text not null default 'public' check (visibility in ('public', 'internal')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  published_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists market_radar.outbox (
  id text primary key,
  event_id text references market_radar.events(id) on delete set null,
  digest_id text references market_radar.digests(id) on delete set null,
  kind text not null check (kind in ('p0', 'p1_batch', 'daily', 'us_premarket', 'test')),
  channel text not null default 'weixin',
  idempotency_key text not null unique,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'leased', 'sent', 'dead_letter')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_token text,
  lease_until timestamptz,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_radar_outbox_claim_idx on market_radar.outbox (status, available_at, created_at);

create table if not exists market_radar.delivery_logs (
  id text primary key,
  outbox_id text not null references market_radar.outbox(id) on delete cascade,
  attempt integer not null,
  status text not null,
  provider_message_id text,
  error_code text,
  created_at timestamptz not null default now()
);

create table if not exists market_radar.feedback (
  id text primary key,
  event_id text not null references market_radar.events(id) on delete cascade,
  value text not null check (value in ('useful', 'noise', 'missed_context', 'wrong_direction')),
  note text,
  idempotency_key text not null unique,
  client_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists market_radar.trial_metrics (
  day date primary key,
  metrics jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists market_radar.source_cursors (
  source text not null,
  group_key text not null,
  cursor text,
  last_success_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (source, group_key)
);

create table if not exists market_radar.worker_locks (
  lock_key text primary key,
  lease_token text not null,
  lease_until timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists market_radar.job_runs (
  id text primary key,
  slot_key text not null unique,
  source text not null,
  group_key text not null,
  status text not null check (status in ('running', 'succeeded', 'failed', 'skipped')),
  item_count integer not null default 0,
  error_code text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists market_radar_raw_payload_expiry_idx
  on market_radar.raw_items (payload_expires_at)
  where payload_purged_at is null;

create or replace view market_radar.public_events as
select
  e.id, e.slug, e.market, e.priority, e.score, e.title_zh, e.summary_zh, e.why_it_matters_zh,
  e.event_type, e.news_direction, e.system_judgment, e.horizon, e.occurred_at, e.published_at,
  count(distinct es.raw_item_id)::integer as source_count,
  coalesce(jsonb_agg(distinct jsonb_build_object('name', es.source_name, 'url', es.source_url))
    filter (where es.raw_item_id is not null), '[]'::jsonb) as sources,
  coalesce(jsonb_agg(distinct jsonb_build_object('namespace', ea.namespace, 'symbol', ea.symbol, 'relevance', ea.relevance))
    filter (where ea.symbol is not null), '[]'::jsonb) as assets,
  case when mr.event_id is null then null else jsonb_build_object(
    'status', mr.status, 'benchmark', mr.benchmark, 'return5m', mr.return_5m, 'return30m', mr.return_30m,
    'return4h', mr.return_4h, 'excess5m', mr.excess_5m, 'excess30m', mr.excess_30m, 'excess4h', mr.excess_4h
  ) end as reaction
from market_radar.events e
left join market_radar.event_sources es on es.event_id = e.id
left join market_radar.event_assets ea on ea.event_id = e.id
left join market_radar.market_reactions mr on mr.event_id = e.id
where e.status = 'published' and e.priority in ('P0', 'P1', 'P2')
group by e.id, mr.event_id;
