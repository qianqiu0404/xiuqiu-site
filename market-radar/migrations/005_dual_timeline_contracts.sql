alter table market_radar.event_sources
  add column if not exists title text;

alter table market_radar.event_sources
  add column if not exists excerpt text;

alter table market_radar.event_sources
  add column if not exists published_at timestamptz;

alter table market_radar.event_sources
  add column if not exists is_primary boolean not null default false;

drop view if exists market_radar.public_events;

create view market_radar.public_events as
select
  e.id, e.slug, e.market, e.priority, e.title_zh, e.summary_zh, e.why_it_matters_zh,
  e.event_type, e.news_direction, e.system_judgment, e.horizon, e.occurred_at, e.published_at,
  count(distinct es.raw_item_id)::integer as source_count,
  coalesce(jsonb_agg(distinct jsonb_build_object('name', es.source_name, 'url', es.source_url))
    filter (where es.raw_item_id is not null), '[]'::jsonb) as sources,
  coalesce(jsonb_agg(distinct jsonb_build_object('namespace', ea.namespace, 'symbol', ea.symbol, 'relevance', ea.relevance))
    filter (where ea.symbol is not null), '[]'::jsonb) as assets,
  case when mr.event_id is null then null else jsonb_build_object(
    'status', mr.status, 'benchmark', mr.benchmark, 'return5m', mr.return_5m, 'return30m', mr.return_30m,
    'return4h', mr.return_4h, 'excess5m', mr.excess_5m, 'excess30m', mr.excess_30m, 'excess4h', mr.excess_4h
  ) end as reaction,
  e.watch_for_zh as watch_for,
  e.invalidation_zh as invalidation
from market_radar.events e
left join market_radar.event_sources es on es.event_id = e.id
left join market_radar.event_assets ea on ea.event_id = e.id
left join market_radar.market_reactions mr on mr.event_id = e.id
where e.status = 'published' and e.priority in ('P0', 'P1', 'P2')
  and e.occurred_at >= now() - interval '7 days'
group by e.id, mr.event_id;

create or replace view market_radar.public_event_reports as
select
  md5(es.event_id || ':' || es.raw_item_id) as id,
  es.event_id,
  es.source_name,
  es.source_url,
  coalesce(es.title, es.source_name) as title,
  es.excerpt,
  es.published_at,
  es.is_primary
from market_radar.event_sources es
join market_radar.events e on e.id = es.event_id
where e.status = 'published'
  and e.priority in ('P0', 'P1', 'P2')
  and e.occurred_at >= now() - interval '7 days';

create schema if not exists learning_radar;

create table if not exists learning_radar.raw_items (
  id text primary key,
  provider text not null,
  provider_id text not null,
  source_url text not null,
  source_domain text not null,
  title text not null,
  excerpt text,
  published_at timestamptz not null,
  payload jsonb not null,
  payload_expires_at timestamptz not null default (now() + interval '14 days'),
  payload_purged_at timestamptz,
  normalized_at timestamptz,
  origin_verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_id)
);

create index if not exists learning_radar_raw_payload_expiry_idx
  on learning_radar.raw_items (payload_expires_at)
  where payload_purged_at is null;

create table if not exists learning_radar.stories (
  id text primary key,
  slug text not null unique,
  cluster_key text not null,
  category text not null check (category in ('ai', 'web3_wallet', 'engineering_tools', 'reading')),
  status text not null check (status in ('draft', 'published', 'rejected')),
  importance text check (importance in ('key', 'noteworthy', 'watch')),
  internal_score integer check (internal_score between 0 and 100),
  title_zh text not null,
  summary_zh text not null,
  why_selected_zh text not null,
  ai_schema_version text,
  occurred_at timestamptz not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learning_radar_stories_public_idx
  on learning_radar.stories (occurred_at desc, id desc)
  where status = 'published';

create index if not exists learning_radar_stories_cluster_idx
  on learning_radar.stories (cluster_key, occurred_at desc);

create table if not exists learning_radar.story_sources (
  story_id text not null references learning_radar.stories(id) on delete cascade,
  raw_item_id text not null references learning_radar.raw_items(id) on delete cascade,
  source_name text not null,
  source_url text not null,
  title text not null,
  excerpt text,
  published_at timestamptz not null,
  is_primary boolean not null default false,
  origin_verified_at timestamptz,
  primary key (story_id, raw_item_id)
);

create table if not exists learning_radar.story_updates (
  id text primary key,
  story_id text not null references learning_radar.stories(id) on delete cascade,
  title_zh text not null,
  body_zh text not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists learning_radar_story_updates_timeline_idx
  on learning_radar.story_updates (story_id, occurred_at desc, id desc);

create table if not exists learning_radar.review_decisions (
  id text primary key,
  story_id text not null references learning_radar.stories(id) on delete cascade,
  decision text not null check (decision in ('approve', 'reject')),
  actor text not null,
  note text,
  decided_at timestamptz not null default now()
);

create index if not exists learning_radar_review_decisions_story_idx
  on learning_radar.review_decisions (story_id, decided_at desc);

create table if not exists learning_radar.digests (
  id text primary key,
  kind text not null check (kind in ('daily', 'weekly')),
  title text not null,
  body_zh text not null,
  visibility text not null default 'internal' check (visibility in ('public', 'internal')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists learning_radar.source_cursors (
  source text not null,
  group_key text not null,
  cursor text,
  last_success_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (source, group_key)
);

create table if not exists learning_radar.job_runs (
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

create or replace view learning_radar.public_timeline_items as
select
  s.id,
  s.slug,
  s.category,
  s.importance,
  s.title_zh,
  s.summary_zh,
  s.why_selected_zh,
  s.occurred_at,
  s.published_at,
  coalesce(source_summary.source_count, 0)::integer as source_count,
  source_summary.primary_source
from learning_radar.stories s
left join lateral (
  select
    count(*)::integer as source_count,
    (jsonb_agg(jsonb_build_object(
      'name', ss.source_name,
      'url', ss.source_url,
      'publishedAt', ss.published_at
    ) order by ss.is_primary desc, ss.published_at asc) -> 0) as primary_source
  from learning_radar.story_sources ss
  where ss.story_id = s.id and ss.origin_verified_at is not null
) source_summary on true
where s.status = 'published' and s.published_at is not null;

create or replace view learning_radar.public_story_reports as
select
  md5(ss.story_id || ':' || ss.raw_item_id) as id,
  ss.story_id,
  ss.source_name,
  ss.source_url,
  ss.title,
  ss.excerpt,
  ss.published_at,
  ss.is_primary
from learning_radar.story_sources ss
join learning_radar.stories s on s.id = ss.story_id
where s.status = 'published'
  and s.published_at is not null
  and ss.origin_verified_at is not null;

create or replace view learning_radar.public_story_updates as
select
  u.id,
  u.story_id,
  u.title_zh,
  u.body_zh,
  u.occurred_at
from learning_radar.story_updates u
join learning_radar.stories s on s.id = u.story_id
where s.status = 'published' and s.published_at is not null;

create or replace view learning_radar.public_digests as
select id, kind, title, body_zh, period_start, period_end, published_at
from learning_radar.digests
where visibility = 'public' and published_at is not null;
