create schema if not exists radar_system;

create schema if not exists radar_qa;

create table if not exists radar_system.publication_snapshots (
  snapshot_id text primary key check (snapshot_id ~ '^(learning|market)-[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9a-f]{16}$'),
  radar_kind text not null check (radar_kind in ('learning', 'market')),
  as_of timestamptz not null,
  origin text not null check (origin = 'research'),
  publication_state text not null check (publication_state in ('draft', 'published', 'archived')),
  payload_checksum text not null check (payload_checksum ~ '^[0-9a-f]{64}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  source_revision text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (radar_kind, snapshot_id)
);

alter table radar_system.publication_snapshots
  drop constraint if exists publication_snapshots_no_qa_content;

alter table radar_system.publication_snapshots
  add constraint publication_snapshots_no_qa_content check (
    payload::text !~* '(\[preview[[:space:]]+pr|preview[[:space:]]*qa|test[[:space:]]*fixture|fixture[[:space:]]*data|测试夹具|验收夹具)'
    and payload::text !~* 'xiuqiu(-site)?.{0,48}(pull request|pr[[:space:]]*#[0-9]+|ci run|github actions|vercel preview|neon preview)'
  );

create index if not exists radar_publication_snapshots_current_idx
  on radar_system.publication_snapshots (radar_kind, as_of desc, snapshot_id desc)
  where origin = 'research' and publication_state = 'published';

create table if not exists radar_qa.fixtures (
  id text primary key,
  radar_kind text not null check (radar_kind in ('learning', 'market')),
  fixture_kind text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour')
);

revoke all on schema radar_qa from public;

revoke all on all tables in schema radar_qa from public;

alter default privileges in schema radar_qa revoke all on tables from public;

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
  payload jsonb not null default '{}'::jsonb,
  payload_expires_at timestamptz not null default (now() + interval '14 days'),
  payload_purged_at timestamptz,
  normalized_at timestamptz,
  origin_verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_id)
);

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

alter table market_radar.event_sources
  add column if not exists title text;

alter table market_radar.event_sources
  add column if not exists excerpt text;

alter table market_radar.event_sources
  add column if not exists published_at timestamptz;

alter table market_radar.event_sources
  add column if not exists is_primary boolean not null default false;

insert into radar_qa.fixtures (id, radar_kind, fixture_kind, payload)
select 'learning-story:' || s.id, 'learning', 'story', jsonb_build_object(
  'record', to_jsonb(s),
  'sources', coalesce((select jsonb_agg(to_jsonb(ss)) from learning_radar.story_sources ss where ss.story_id = s.id), '[]'::jsonb),
  'updates', coalesce((select jsonb_agg(to_jsonb(su)) from learning_radar.story_updates su where su.story_id = s.id), '[]'::jsonb)
)
from learning_radar.stories s
where s.title_zh ~* '(\[preview[[:space:]]+pr|preview[[:space:]]*qa|test[[:space:]]*fixture|测试夹具|验收夹具)'
  or exists (
    select 1 from learning_radar.story_sources ss
    where ss.story_id = s.id and ss.source_url ~* '^https://github\.com/qianqiu0404/xiuqiu-site(?:/|$)'
  )
on conflict (id) do update set payload = excluded.payload, expires_at = now() + interval '1 hour';

insert into radar_qa.fixtures (id, radar_kind, fixture_kind, payload)
select 'market-event:' || e.id, 'market', 'event', jsonb_build_object(
  'record', to_jsonb(e),
  'sources', coalesce((select jsonb_agg(to_jsonb(es)) from market_radar.event_sources es where es.event_id = e.id), '[]'::jsonb),
  'assets', coalesce((select jsonb_agg(to_jsonb(ea)) from market_radar.event_assets ea where ea.event_id = e.id), '[]'::jsonb),
  'reaction', (select to_jsonb(mr) from market_radar.market_reactions mr where mr.event_id = e.id)
)
from market_radar.events e
where e.title_zh ~* '(\[preview[[:space:]]+pr|preview[[:space:]]*qa|test[[:space:]]*fixture|测试夹具|验收夹具)'
  or exists (
    select 1 from market_radar.event_sources es
    where es.event_id = e.id and es.source_url ~* '^https://github\.com/qianqiu0404/xiuqiu-site(?:/|$)'
  )
on conflict (id) do update set payload = excluded.payload, expires_at = now() + interval '1 hour';

delete from learning_radar.stories
where title_zh ~* '(\[preview[[:space:]]+pr|preview[[:space:]]*qa|test[[:space:]]*fixture|测试夹具|验收夹具)'
  or exists (
    select 1 from learning_radar.story_sources ss
    where ss.story_id = stories.id and ss.source_url ~* '^https://github\.com/qianqiu0404/xiuqiu-site(?:/|$)'
  );

delete from market_radar.events
where title_zh ~* '(\[preview[[:space:]]+pr|preview[[:space:]]*qa|test[[:space:]]*fixture|测试夹具|验收夹具)'
  or exists (
    select 1 from market_radar.event_sources es
    where es.event_id = events.id and es.source_url ~* '^https://github\.com/qianqiu0404/xiuqiu-site(?:/|$)'
  );

delete from learning_radar.raw_items
where title ~* '(\[preview[[:space:]]+pr|preview[[:space:]]*qa|test[[:space:]]*fixture|测试夹具|验收夹具)'
  or source_url ~* '^https://github\.com/qianqiu0404/xiuqiu-site(?:/|$)';

delete from market_radar.raw_items
where title ~* '(\[preview[[:space:]]+pr|preview[[:space:]]*qa|test[[:space:]]*fixture|测试夹具|验收夹具)'
  or source_url ~* '^https://github\.com/qianqiu0404/xiuqiu-site(?:/|$)';

delete from learning_radar.job_runs
where id like 'preview-pr81-%' or slot_key like 'preview-pr81-%';

delete from market_radar.job_runs
where id like 'preview-pr81-%' or slot_key like 'preview-pr81-%';

alter table learning_radar.stories
  drop constraint if exists learning_stories_no_qa_content;

alter table learning_radar.stories
  add constraint learning_stories_no_qa_content check (
    title_zh !~* '(\[preview[[:space:]]+pr|preview[[:space:]]*qa|test[[:space:]]*fixture|测试夹具|验收夹具)'
  );

alter table market_radar.events
  drop constraint if exists market_events_no_qa_content;

alter table market_radar.events
  add constraint market_events_no_qa_content check (
    title_zh !~* '(\[preview[[:space:]]+pr|preview[[:space:]]*qa|test[[:space:]]*fixture|测试夹具|验收夹具)'
  );

alter table market_radar.events
  add column if not exists origin text not null default 'research' check (origin = 'research');

alter table market_radar.events
  add column if not exists publication_state text not null default 'draft'
    check (publication_state in ('draft', 'published', 'archived'));

alter table market_radar.events
  add column if not exists snapshot_id text references radar_system.publication_snapshots(snapshot_id);

alter table market_radar.digests
  add column if not exists origin text not null default 'research' check (origin = 'research');

alter table market_radar.digests
  add column if not exists publication_state text not null default 'draft'
    check (publication_state in ('draft', 'published', 'archived'));

alter table market_radar.digests
  add column if not exists snapshot_id text references radar_system.publication_snapshots(snapshot_id);

alter table learning_radar.stories
  add column if not exists origin text not null default 'research' check (origin = 'research');

alter table learning_radar.stories
  add column if not exists publication_state text not null default 'draft'
    check (publication_state in ('draft', 'published', 'archived'));

alter table learning_radar.stories
  add column if not exists snapshot_id text references radar_system.publication_snapshots(snapshot_id);

alter table learning_radar.digests
  add column if not exists origin text not null default 'research' check (origin = 'research');

alter table learning_radar.digests
  add column if not exists publication_state text not null default 'draft'
    check (publication_state in ('draft', 'published', 'archived'));

alter table learning_radar.digests
  add column if not exists snapshot_id text references radar_system.publication_snapshots(snapshot_id);

alter table market_radar.outbox
  add column if not exists origin text not null default 'research' check (origin = 'research');

alter table market_radar.outbox
  add column if not exists publication_state text not null default 'draft'
    check (publication_state in ('draft', 'published', 'archived'));

alter table market_radar.outbox
  add column if not exists snapshot_id text references radar_system.publication_snapshots(snapshot_id);

alter table learning_radar.outbox
  add column if not exists origin text not null default 'research' check (origin = 'research');

alter table learning_radar.outbox
  add column if not exists publication_state text not null default 'draft'
    check (publication_state in ('draft', 'published', 'archived'));

alter table learning_radar.outbox
  add column if not exists snapshot_id text references radar_system.publication_snapshots(snapshot_id);

create or replace view market_radar.public_events as
select
  e.id, e.slug, e.market, e.priority, e.score, e.title_zh, e.summary_zh, e.why_it_matters_zh,
  e.event_type, e.news_direction, e.system_judgment, e.horizon, e.occurred_at, e.published_at,
  coalesce(source_summary.source_count, 0)::integer as source_count,
  coalesce(source_summary.sources, '[]'::jsonb) as sources,
  coalesce(asset_summary.assets, '[]'::jsonb) as assets,
  case when mr.event_id is null then null else jsonb_build_object(
    'status', mr.status, 'benchmark', mr.benchmark, 'return5m', mr.return_5m, 'return30m', mr.return_30m,
    'return4h', mr.return_4h, 'excess5m', mr.excess_5m, 'excess30m', mr.excess_30m, 'excess4h', mr.excess_4h
  ) end as reaction,
  e.watch_for_zh as watch_for,
  e.invalidation_zh as invalidation,
  e.snapshot_id,
  publication.as_of as snapshot_as_of
from market_radar.events e
join radar_system.publication_snapshots publication on publication.snapshot_id = e.snapshot_id
left join lateral (
  select count(*)::integer as source_count,
    jsonb_agg(jsonb_build_object('name', es.source_name, 'url', es.source_url) order by es.source_name, es.source_url) as sources
  from market_radar.event_sources es
  where es.event_id = e.id
    and es.source_url !~* '^https://github\.com/qianqiu0404/xiuqiu-site(?:/|$)'
) source_summary on true
left join lateral (
  select jsonb_agg(jsonb_build_object('namespace', ea.namespace, 'symbol', ea.symbol, 'relevance', ea.relevance)
    order by ea.relevance desc, ea.namespace, ea.symbol) as assets
  from market_radar.event_assets ea where ea.event_id = e.id
) asset_summary on true
left join market_radar.market_reactions mr on mr.event_id = e.id
where e.status = 'published'
  and e.origin = 'research'
  and e.publication_state = 'published'
  and publication.radar_kind = 'market'
  and publication.origin = 'research'
  and publication.publication_state = 'published'
  and e.priority in ('P0', 'P1', 'P2')
  and e.occurred_at >= statement_timestamp() - interval '7 days'
  and e.occurred_at <= statement_timestamp() + interval '1 hour'
  and e.title_zh !~* '(\[preview[[:space:]]+pr|preview[[:space:]]*qa|test[[:space:]]*fixture|测试夹具|验收夹具)'
  and coalesce(source_summary.source_count, 0) > 0;

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
join market_radar.public_events public_event on public_event.id = es.event_id
where es.source_url !~* '^https://github\.com/qianqiu0404/xiuqiu-site(?:/|$)';

create or replace view market_radar.public_digests as
select d.id, d.kind, d.title, d.body_zh, d.period_start, d.period_end, d.published_at,
  d.snapshot_id, publication.as_of as snapshot_as_of
from market_radar.digests d
join radar_system.publication_snapshots publication on publication.snapshot_id = d.snapshot_id
where d.visibility = 'public'
  and d.origin = 'research'
  and d.publication_state = 'published'
  and publication.radar_kind = 'market'
  and publication.origin = 'research'
  and publication.publication_state = 'published';

create or replace view learning_radar.public_timeline_items as
select
  s.id, s.slug, s.category, s.importance, s.title_zh, s.summary_zh, s.why_selected_zh,
  s.occurred_at, s.published_at,
  coalesce(source_summary.source_count, 0)::integer as source_count,
  source_summary.primary_source,
  s.snapshot_id,
  publication.as_of as snapshot_as_of
from learning_radar.stories s
join radar_system.publication_snapshots publication on publication.snapshot_id = s.snapshot_id
left join lateral (
  select count(*)::integer as source_count,
    (jsonb_agg(jsonb_build_object('name', ss.source_name, 'url', ss.source_url, 'publishedAt', ss.published_at)
      order by ss.is_primary desc, ss.published_at asc, ss.source_url asc) -> 0) as primary_source
  from learning_radar.story_sources ss
  where ss.story_id = s.id
    and ss.origin_verified_at is not null
    and ss.source_url !~* '^https://github\.com/qianqiu0404/xiuqiu-site(?:/|$)'
) source_summary on true
where s.status = 'published'
  and s.origin = 'research'
  and s.publication_state = 'published'
  and publication.radar_kind = 'learning'
  and publication.origin = 'research'
  and publication.publication_state = 'published'
  and s.published_at is not null
  and s.title_zh !~* '(\[preview[[:space:]]+pr|preview[[:space:]]*qa|test[[:space:]]*fixture|测试夹具|验收夹具)'
  and coalesce(source_summary.source_count, 0) > 0;

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
join learning_radar.public_timeline_items public_story on public_story.id = ss.story_id
where ss.origin_verified_at is not null
  and ss.source_url !~* '^https://github\.com/qianqiu0404/xiuqiu-site(?:/|$)';

create or replace view learning_radar.public_story_updates as
select u.id, u.story_id, u.title_zh, u.body_zh, u.occurred_at
from learning_radar.story_updates u
join learning_radar.public_timeline_items public_story on public_story.id = u.story_id;

create or replace view learning_radar.public_digests as
select d.id, d.kind, d.title, d.body_zh, d.period_start, d.period_end, d.published_at,
  d.snapshot_id, publication.as_of as snapshot_as_of
from learning_radar.digests d
join radar_system.publication_snapshots publication on publication.snapshot_id = d.snapshot_id
where d.visibility = 'public'
  and d.origin = 'research'
  and d.publication_state = 'published'
  and publication.radar_kind = 'learning'
  and publication.origin = 'research'
  and publication.publication_state = 'published'
  and d.published_at is not null;
