alter table learning_radar.stories
  drop constraint if exists stories_publication_basis_check;

alter table learning_radar.stories
  add constraint stories_publication_basis_check
  check (publication_basis in ('official_primary', 'independent_domains', 'manual_review'));

alter table learning_radar.review_decisions
  add column if not exists workflow_run_id text;

alter table learning_radar.review_decisions
  add column if not exists release_sha text;

alter table learning_radar.review_decisions
  add column if not exists previous_status text;

alter table learning_radar.review_decisions
  add column if not exists new_status text;

alter table learning_radar.review_decisions
  add column if not exists requested_by text;

alter table learning_radar.review_decisions
  add column if not exists approved_by text;

alter table learning_radar.review_decisions
  add column if not exists expected_version timestamptz;

alter table learning_radar.review_decisions
  add column if not exists input_hash text;

update learning_radar.review_decisions
set
  workflow_run_id = coalesce(workflow_run_id, 'legacy-' || id),
  release_sha = coalesce(release_sha, repeat('0', 40)),
  previous_status = coalesce(previous_status, 'draft'),
  new_status = coalesce(new_status, case when decision = 'approve' then 'published' else 'rejected' end),
  requested_by = coalesce(requested_by, actor),
  approved_by = coalesce(approved_by, actor),
  expected_version = coalesce(expected_version, decided_at),
  input_hash = coalesce(input_hash, repeat('0', 64))
where workflow_run_id is null
   or release_sha is null
   or previous_status is null
   or new_status is null
   or requested_by is null
   or approved_by is null
   or expected_version is null
   or input_hash is null;

alter table learning_radar.review_decisions
  alter column workflow_run_id set not null;

alter table learning_radar.review_decisions
  alter column release_sha set not null;

alter table learning_radar.review_decisions
  alter column previous_status set not null;

alter table learning_radar.review_decisions
  alter column new_status set not null;

alter table learning_radar.review_decisions
  alter column requested_by set not null;

alter table learning_radar.review_decisions
  alter column approved_by set not null;

alter table learning_radar.review_decisions
  alter column expected_version set not null;

alter table learning_radar.review_decisions
  alter column input_hash set not null;

alter table learning_radar.review_decisions
  drop constraint if exists learning_review_status_check;

alter table learning_radar.review_decisions
  add constraint learning_review_status_check
  check (previous_status in ('draft', 'published', 'rejected') and new_status in ('published', 'rejected'));

alter table learning_radar.review_decisions
  drop constraint if exists learning_review_release_sha_check;

alter table learning_radar.review_decisions
  add constraint learning_review_release_sha_check
  check (release_sha ~ '^[0-9a-f]{40}$');

alter table learning_radar.review_decisions
  drop constraint if exists learning_review_input_hash_check;

alter table learning_radar.review_decisions
  add constraint learning_review_input_hash_check
  check (input_hash ~ '^[0-9a-f]{64}$');

alter table learning_radar.review_decisions
  drop constraint if exists learning_review_identity_check;

alter table learning_radar.review_decisions
  add constraint learning_review_identity_check
  check (
    workflow_run_id like 'legacy-%'
    or (
      workflow_run_id ~ '^[0-9]{1,20}$'
      and requested_by ~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}$'
      and approved_by ~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}$'
      and requested_by <> approved_by
    )
  );

create unique index if not exists learning_radar_review_run_idx
  on learning_radar.review_decisions (workflow_run_id);

create table if not exists market_radar.review_decisions (
  id text primary key,
  event_id text not null references market_radar.events(id) on delete cascade,
  decision text not null check (decision in ('approve', 'reject')),
  actor text not null,
  requested_by text not null check (requested_by ~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}$'),
  approved_by text not null check (approved_by ~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}$'),
  note text,
  workflow_run_id text not null check (workflow_run_id ~ '^[0-9]{1,20}$'),
  release_sha text not null check (release_sha ~ '^[0-9a-f]{40}$'),
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  expected_version timestamptz not null,
  previous_status text not null check (previous_status in ('draft', 'published', 'rejected')),
  new_status text not null check (new_status in ('published', 'rejected')),
  decided_at timestamptz not null default now(),
  constraint market_review_distinct_actors_check check (requested_by <> approved_by)
);

create unique index if not exists market_radar_review_run_idx
  on market_radar.review_decisions (workflow_run_id);

create index if not exists market_radar_review_decisions_event_idx
  on market_radar.review_decisions (event_id, decided_at desc);

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
    or (
      s.publication_basis = 'manual_review'
      and s.ai_schema_version = 'learning-v1'
      and btrim(s.title_zh) <> ''
      and btrim(s.summary_zh) <> ''
      and btrim(s.why_selected_zh) <> ''
      and exists (
        select 1
        from learning_radar.story_sources manual_source
        where manual_source.story_id = s.id
          and manual_source.origin_verified_at is not null
          and manual_source.verification_state = 'verified'
          and manual_source.source_url !~* '^https://([^.]+\.)*aihot\.virxact\.com(?::[0-9]+)?(?:/|$)'
      )
      and exists (
        select 1
        from learning_radar.review_decisions approved_review
        where approved_review.story_id = s.id
          and approved_review.decision = 'approve'
          and approved_review.previous_status = 'draft'
          and approved_review.new_status = 'published'
          and approved_review.workflow_run_id ~ '^[0-9]{1,20}$'
          and approved_review.release_sha ~ '^[0-9a-f]{40}$'
          and approved_review.input_hash ~ '^[0-9a-f]{64}$'
          and btrim(approved_review.requested_by) <> ''
          and btrim(approved_review.approved_by) <> ''
          and approved_review.requested_by <> approved_review.approved_by
      )
    )
  );

create or replace view market_radar.public_events as
select
  e.id, e.slug, e.market, e.priority, null::integer as score, e.title_zh, e.summary_zh, e.why_it_matters_zh,
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
where e.status = 'published'
  and e.priority in ('P0', 'P1', 'P2')
  and e.occurred_at >= now() - interval '7 days'
  and e.occurred_at <= now() + interval '1 hour'
  and e.ai_schema_version = 'v2'
  and btrim(coalesce(e.watch_for_zh, '')) <> ''
  and btrim(coalesce(e.invalidation_zh, '')) <> ''
  and lower(btrim(e.watch_for_zh)) not in ('na', 'none', 'null', 'unknown', '无', '暂无', '未知', '待定', '待补充', '待观察', '等待结构化验证')
  and lower(btrim(e.invalidation_zh)) not in ('na', 'none', 'null', 'unknown', '无', '暂无', '未知', '待定', '待补充', '待观察', '等待结构化验证')
  and e.watch_for_zh !~* '(待补充|占位|稍后补充|todo|tbd|placeholder)'
  and e.invalidation_zh !~* '(待补充|占位|稍后补充|todo|tbd|placeholder)'
  and (
    select count(*) from market_radar.event_sources primary_source
    where primary_source.event_id = e.id and primary_source.is_primary = true
  ) = 1
group by e.id, mr.event_id;

create or replace function radar_system.review_timeline(
  p_domain text,
  p_target_id text,
  p_decision text,
  p_note text,
  p_requested_by text,
  p_approved_by text,
  p_workflow_run_id text,
  p_expected_version timestamptz,
  p_release_sha text
)
returns table (new_status text, replayed boolean, decided_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog
as $timeline_review$
declare
  v_now timestamptz := statement_timestamp();
  v_input_hash text;
  v_existing_hash text;
  v_existing_status text;
  v_existing_decided_at timestamptz;
  v_status text;
  v_updated_at timestamptz;
  v_priority text;
  v_title text;
  v_summary text;
  v_why text;
  v_ai_schema text;
  v_watch text;
  v_invalidation text;
  v_event_type text;
  v_judgment text;
  v_occurred_at timestamptz;
  v_verification_state text;
  v_has_conflict boolean;
  v_conflict_evidence jsonb;
  v_verified_sources integer;
  v_primary_sources integer;
  v_total_sources integer;
  v_row_count integer;
begin
  if p_domain is null or p_domain not in ('learning', 'market') then raise exception 'invalid_domain'; end if;
  if p_decision is null or p_decision not in ('approve', 'reject') then raise exception 'invalid_decision'; end if;
  if p_target_id is null or p_target_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then raise exception 'invalid_target_id'; end if;
  if p_requested_by is null or p_requested_by !~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}$' then raise exception 'invalid_requested_by'; end if;
  if p_approved_by is null or p_approved_by !~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}$' then raise exception 'invalid_approved_by'; end if;
  if p_requested_by = p_approved_by then raise exception 'requester_cannot_approve'; end if;
  if p_workflow_run_id is null or p_workflow_run_id !~ '^[0-9]{1,20}$' then raise exception 'invalid_workflow_run'; end if;
  if p_release_sha is null or p_release_sha !~ '^[0-9a-f]{40}$' then raise exception 'invalid_release_sha'; end if;
  if p_expected_version is null then raise exception 'invalid_expected_version'; end if;
  if p_note is not null and (char_length(p_note) > 1000 or p_note ~ '[[:cntrl:]]') then raise exception 'invalid_note'; end if;

  v_input_hash := encode(sha256(convert_to(jsonb_build_object(
    'domain', p_domain,
    'target_id', p_target_id,
    'decision', p_decision,
    'note', p_note,
    'requested_by', p_requested_by,
    'approved_by', p_approved_by,
    'workflow_run_id', p_workflow_run_id,
    'expected_version', p_expected_version,
    'release_sha', p_release_sha
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(hashtextextended('timeline-review:' || p_domain || ':' || p_workflow_run_id, 0));

  if p_domain = 'learning' then
    select rd.input_hash, rd.new_status, rd.decided_at
      into v_existing_hash, v_existing_status, v_existing_decided_at
    from learning_radar.review_decisions rd
    where rd.workflow_run_id = p_workflow_run_id
    for update;
    if found then
      if v_existing_hash <> v_input_hash then raise exception 'workflow_run_reused'; end if;
      return query select v_existing_status, true, v_existing_decided_at;
      return;
    end if;

    select s.status, s.updated_at, s.title_zh, s.summary_zh, s.why_selected_zh,
        s.ai_schema_version, s.verification_state, s.has_conflict, s.conflict_evidence
      into v_status, v_updated_at, v_title, v_summary, v_why,
        v_ai_schema, v_verification_state, v_has_conflict, v_conflict_evidence
    from learning_radar.stories s where s.id = p_target_id for update;
    if not found then raise exception 'target_not_found'; end if;
    if v_status <> 'draft' then raise exception 'status_changed'; end if;
    if v_updated_at <> p_expected_version then raise exception 'version_changed'; end if;

    if p_decision = 'approve' then
      select count(*) filter (
          where ss.origin_verified_at is not null
            and ss.verification_state = 'verified'
            and ss.source_url !~* '^https://([^.]+\.)*aihot\.virxact\.com(?::[0-9]+)?(?:/|$)'
        )::integer into v_verified_sources
      from learning_radar.story_sources ss where ss.story_id = p_target_id;
      if v_ai_schema is distinct from 'learning-v1'
        or btrim(coalesce(v_title, '')) = ''
        or btrim(coalesce(v_summary, '')) = ''
        or btrim(coalesce(v_why, '')) = ''
        or coalesce(v_verification_state, '') not in ('pending', 'verified')
        or v_has_conflict is distinct from false
        or coalesce(jsonb_typeof(v_conflict_evidence), '') <> 'array'
        or coalesce(jsonb_array_length(v_conflict_evidence), -1) <> 0
        or v_verified_sources < 1
      then raise exception 'unsafe_learning_draft'; end if;
    end if;

    v_existing_status := case when p_decision = 'approve' then 'published' else 'rejected' end;
    update learning_radar.stories set
      status = v_existing_status,
      published_at = case when v_existing_status = 'published' then coalesce(published_at, v_now) else null end,
      publication_basis = case when v_existing_status = 'published' then 'manual_review' else publication_basis end,
      verification_state = case when v_existing_status = 'published' then 'verified' else verification_state end,
      updated_at = v_now
    where id = p_target_id and status = 'draft' and updated_at = p_expected_version;
    get diagnostics v_row_count = row_count;
    if v_row_count <> 1 then raise exception 'version_changed'; end if;

    insert into learning_radar.review_decisions
      (id, story_id, decision, actor, requested_by, approved_by, note, workflow_run_id,
        release_sha, input_hash, expected_version, previous_status, new_status, decided_at)
    values ('timeline-review:' || p_domain || ':' || p_workflow_run_id, p_target_id, p_decision,
      p_requested_by, p_requested_by, p_approved_by, p_note, p_workflow_run_id,
      p_release_sha, v_input_hash, p_expected_version, 'draft', v_existing_status, v_now);
  else
    select rd.input_hash, rd.new_status, rd.decided_at
      into v_existing_hash, v_existing_status, v_existing_decided_at
    from market_radar.review_decisions rd
    where rd.workflow_run_id = p_workflow_run_id
    for update;
    if found then
      if v_existing_hash <> v_input_hash then raise exception 'workflow_run_reused'; end if;
      return query select v_existing_status, true, v_existing_decided_at;
      return;
    end if;

    select e.status, e.updated_at, e.priority, e.title_zh, e.summary_zh, e.why_it_matters_zh,
        e.ai_schema_version, e.watch_for_zh, e.invalidation_zh, e.event_type,
        e.system_judgment, e.occurred_at
      into v_status, v_updated_at, v_priority, v_title, v_summary, v_why,
        v_ai_schema, v_watch, v_invalidation, v_event_type, v_judgment, v_occurred_at
    from market_radar.events e where e.id = p_target_id for update;
    if not found then raise exception 'target_not_found'; end if;
    if v_status <> 'draft' then raise exception 'status_changed'; end if;
    if v_updated_at <> p_expected_version then raise exception 'version_changed'; end if;

    if p_decision = 'approve' then
      select count(*)::integer, count(*) filter (where es.is_primary)::integer
        into v_total_sources, v_primary_sources
      from market_radar.event_sources es where es.event_id = p_target_id;
      if coalesce(v_priority, '') not in ('P0', 'P1', 'P2')
        or v_ai_schema is distinct from 'v2'
        or btrim(coalesce(v_title, '')) = ''
        or btrim(coalesce(v_summary, '')) = ''
        or btrim(coalesce(v_why, '')) = ''
        or btrim(coalesce(v_event_type, '')) = ''
        or btrim(coalesce(v_judgment, '')) = ''
        or btrim(coalesce(v_watch, '')) = ''
        or btrim(coalesce(v_invalidation, '')) = ''
        or lower(btrim(v_watch)) in ('na', 'none', 'null', 'unknown', '无', '暂无', '未知', '待定', '待补充', '待观察', '等待结构化验证')
        or lower(btrim(v_invalidation)) in ('na', 'none', 'null', 'unknown', '无', '暂无', '未知', '待定', '待补充', '待观察', '等待结构化验证')
        or v_watch ~* '(待补充|占位|稍后补充|todo|tbd|placeholder)'
        or v_invalidation ~* '(待补充|占位|稍后补充|todo|tbd|placeholder)'
        or v_occurred_at < v_now - interval '7 days'
        or v_occurred_at > v_now + interval '1 hour'
        or v_total_sources < 1
        or v_primary_sources <> 1
      then raise exception 'unsafe_market_draft'; end if;
    end if;

    v_existing_status := case when p_decision = 'approve' then 'published' else 'rejected' end;
    update market_radar.events set
      status = v_existing_status,
      published_at = case when v_existing_status = 'published' then coalesce(published_at, v_now) else null end,
      updated_at = v_now
    where id = p_target_id and status = 'draft' and updated_at = p_expected_version;
    get diagnostics v_row_count = row_count;
    if v_row_count <> 1 then raise exception 'version_changed'; end if;

    insert into market_radar.review_decisions
      (id, event_id, decision, actor, requested_by, approved_by, note, workflow_run_id,
        release_sha, input_hash, expected_version, previous_status, new_status, decided_at)
    values ('timeline-review:' || p_domain || ':' || p_workflow_run_id, p_target_id, p_decision,
      p_requested_by, p_requested_by, p_approved_by, p_note, p_workflow_run_id,
      p_release_sha, v_input_hash, p_expected_version, 'draft', v_existing_status, v_now);
  end if;

  return query select v_existing_status, false, v_now;
end
$timeline_review$;

revoke all on function radar_system.review_timeline(text, text, text, text, text, text, text, timestamptz, text)
  from public;
