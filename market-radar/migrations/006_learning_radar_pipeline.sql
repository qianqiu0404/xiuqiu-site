alter table learning_radar.raw_items
  add column if not exists is_official boolean not null default false;

alter table learning_radar.raw_items
  add column if not exists discovered_via text;

alter table learning_radar.raw_items
  add column if not exists verification_state text not null default 'unverified'
    check (verification_state in ('verified', 'unverified'));

alter table learning_radar.raw_items
  add column if not exists verification_error text;

alter table learning_radar.stories
  add column if not exists publication_basis text
    check (publication_basis in ('official_primary', 'independent_domains'));

alter table learning_radar.stories
  add column if not exists verification_state text not null default 'pending'
    check (verification_state in ('pending', 'verified', 'conflict'));

alter table learning_radar.stories
  add column if not exists has_conflict boolean not null default false;

alter table learning_radar.stories
  add column if not exists conflict_evidence jsonb not null default '[]'::jsonb
    check (jsonb_typeof(conflict_evidence) = 'array');

alter table learning_radar.story_sources
  add column if not exists source_domain text;

alter table learning_radar.story_sources
  add column if not exists registrable_domain text;

alter table learning_radar.story_sources
  add column if not exists is_official boolean not null default false;

alter table learning_radar.story_sources
  add column if not exists discovered_via text;

alter table learning_radar.story_sources
  add column if not exists verification_state text not null default 'unverified'
    check (verification_state in ('verified', 'unverified'));

create index if not exists learning_radar_story_sources_publication_idx
  on learning_radar.story_sources (story_id, verification_state, is_official, registrable_domain);

create table if not exists learning_radar.worker_locks (
  lock_key text primary key,
  lease_token text not null,
  lease_until timestamptz not null,
  updated_at timestamptz not null default now()
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
  where ss.story_id = s.id
    and ss.origin_verified_at is not null
    and ss.verification_state = 'verified'
) source_summary on true
where s.status = 'published'
  and s.published_at is not null
  and s.verification_state = 'verified'
  and s.has_conflict = false
  and jsonb_array_length(s.conflict_evidence) = 0
  and coalesce(source_summary.source_count, 0) > 0
  and (
    (
      s.publication_basis = 'official_primary'
      and exists (
        select 1
        from learning_radar.story_sources official_source
        where official_source.story_id = s.id
          and official_source.origin_verified_at is not null
          and official_source.verification_state = 'verified'
          and official_source.is_official = true
          and coalesce(official_source.discovered_via, '') !~* '^https://([^.]+\.)*aihot\.virxact\.com(?:/|$)'
      )
    )
    or (
      s.publication_basis = 'independent_domains'
      and (
        select count(distinct confirmed_source.registrable_domain)
        from learning_radar.story_sources confirmed_source
        where confirmed_source.story_id = s.id
          and confirmed_source.origin_verified_at is not null
          and confirmed_source.verification_state = 'verified'
          and confirmed_source.registrable_domain is not null
      ) >= 2
    )
  );

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
  and ss.verification_state = 'verified';

create or replace view learning_radar.public_story_updates as
select
  u.id,
  u.story_id,
  u.title_zh,
  u.body_zh,
  u.occurred_at
from learning_radar.story_updates u
join learning_radar.public_timeline_items public_story on public_story.id = u.story_id;
