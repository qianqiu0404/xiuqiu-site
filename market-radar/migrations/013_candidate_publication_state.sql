alter table market_radar.events
  drop constraint if exists events_status_check;

alter table market_radar.events
  add constraint events_status_check
  check (status in ('draft', 'approved', 'published', 'rejected'));

alter table learning_radar.stories
  drop constraint if exists stories_status_check;

alter table learning_radar.stories
  add constraint stories_status_check
  check (status in ('draft', 'approved', 'published', 'rejected'));

alter table market_radar.events
  add column if not exists approved_at timestamptz;

alter table learning_radar.stories
  add column if not exists approved_at timestamptz;

alter table learning_radar.review_decisions
  drop constraint if exists learning_review_status_check;

alter table learning_radar.review_decisions
  add constraint learning_review_status_check
  check (
    previous_status in ('draft', 'approved', 'published', 'rejected')
    and new_status in ('approved', 'published', 'rejected')
  );

alter table market_radar.review_decisions
  drop constraint if exists review_decisions_previous_status_check;

alter table market_radar.review_decisions
  drop constraint if exists review_decisions_new_status_check;

alter table market_radar.review_decisions
  drop constraint if exists market_review_decisions_previous_status_check;

alter table market_radar.review_decisions
  drop constraint if exists market_review_decisions_new_status_check;

alter table market_radar.review_decisions
  add constraint market_review_decisions_previous_status_check
  check (previous_status in ('draft', 'approved', 'published', 'rejected'));

alter table market_radar.review_decisions
  add constraint market_review_decisions_new_status_check
  check (new_status in ('approved', 'published', 'rejected'));

alter table radar_system.timeline_review_runs
  drop constraint if exists timeline_review_runs_new_status_check;

alter table radar_system.timeline_review_runs
  add constraint timeline_review_runs_new_status_check
  check (new_status in ('approved', 'published', 'rejected'));

update learning_radar.stories
set status = 'approved', approved_at = coalesce(approved_at, published_at, updated_at, created_at),
  published_at = null, publication_state = 'draft', updated_at = now()
where status = 'published' and snapshot_id is null;

update market_radar.events
set status = 'approved', approved_at = coalesce(approved_at, published_at, updated_at, created_at),
  published_at = null, publication_state = 'draft', updated_at = now()
where status = 'published' and snapshot_id is null;

alter table radar_system.publication_snapshots
  drop constraint if exists publication_snapshots_kind_id_check;

alter table radar_system.publication_snapshots
  add constraint publication_snapshots_kind_id_check
  check (snapshot_id like radar_kind || '-%');

create unique index if not exists radar_publication_snapshots_kind_as_of_idx
  on radar_system.publication_snapshots (radar_kind, as_of);

create or replace function radar_system.snapshot_created_in_current_transaction(p_snapshot_id text)
returns boolean
language sql
security definer
set search_path = pg_catalog
as $snapshot_current_transaction$
  select exists (
    select 1 from radar_system.publication_snapshots publication
    where publication.snapshot_id = p_snapshot_id
      and publication.origin = 'research'
      and publication.publication_state = 'published'
      and publication.xmin::text = pg_current_xact_id()::text
  )
$snapshot_current_transaction$;

create or replace function radar_system.protect_publication_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $protect_publication_snapshot$
begin
  if tg_op = 'UPDATE'
    and (to_jsonb(new) - 'created_at' - 'updated_at')
      is not distinct from (to_jsonb(old) - 'created_at' - 'updated_at')
  then return new; end if;
  if old.origin = 'research' and old.publication_state = 'published' then
    raise exception 'published_radar_snapshot_immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$protect_publication_snapshot$;

create or replace function radar_system.protect_snapshot_member()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $protect_snapshot_member$
declare
  v_old_snapshot text;
  v_new_snapshot text;
  v_old_protected boolean := false;
  v_new_protected boolean := false;
  v_existing boolean := false;
begin
  if tg_op <> 'INSERT' then
    v_old_snapshot := old.snapshot_id;
    v_old_protected := old.status = 'published' and old.origin = 'research'
      and old.publication_state = 'published' and old.snapshot_id is not null;
  end if;
  if tg_op <> 'DELETE' then
    v_new_snapshot := new.snapshot_id;
    v_new_protected := new.status = 'published' and new.origin = 'research'
      and new.publication_state = 'published' and new.snapshot_id is not null;
  end if;
  if tg_op = 'UPDATE'
    and (to_jsonb(new) - 'created_at' - 'updated_at')
      is not distinct from (to_jsonb(old) - 'created_at' - 'updated_at')
  then return new; end if;
  if v_old_protected or v_new_protected then
    if tg_op = 'INSERT' then
      if tg_table_schema = 'market_radar' then
        select exists(select 1 from market_radar.events event where event.id = new.id) into v_existing;
      else
        select exists(select 1 from learning_radar.stories story where story.id = new.id) into v_existing;
      end if;
      if v_existing or radar_system.snapshot_created_in_current_transaction(v_new_snapshot) then return new; end if;
    end if;
    raise exception 'published_radar_snapshot_immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$protect_snapshot_member$;

create or replace function radar_system.protect_snapshot_child()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $protect_snapshot_child$
declare
  v_old_snapshot text;
  v_new_snapshot text;
  v_existing boolean := false;
begin
  if tg_op = 'UPDATE'
    and (to_jsonb(new) - 'created_at' - 'updated_at')
      is not distinct from (to_jsonb(old) - 'created_at' - 'updated_at')
  then return new; end if;

  if tg_op <> 'INSERT' then
    if tg_table_schema = 'market_radar' and tg_table_name = 'raw_items' then
      v_old_snapshot := old.payload ->> 'snapshotId';
    elsif tg_table_schema = 'market_radar' and tg_table_name in ('event_sources', 'event_assets', 'market_reactions') then
      select event.snapshot_id into v_old_snapshot from market_radar.events event
      where event.id = old.event_id and event.status = 'published' and event.origin = 'research'
        and event.publication_state = 'published' and event.snapshot_id is not null;
    elsif tg_table_schema = 'learning_radar' and tg_table_name = 'raw_items' then
      v_old_snapshot := old.payload ->> 'snapshotId';
    elsif tg_table_schema = 'learning_radar' and tg_table_name in ('story_sources', 'story_updates') then
      select story.snapshot_id into v_old_snapshot from learning_radar.stories story
      where story.id = old.story_id and story.status = 'published' and story.origin = 'research'
        and story.publication_state = 'published' and story.snapshot_id is not null;
    end if;
  end if;

  if tg_op <> 'DELETE' then
    if tg_table_schema = 'market_radar' and tg_table_name = 'raw_items' then
      v_new_snapshot := new.payload ->> 'snapshotId';
    elsif tg_table_schema = 'market_radar' and tg_table_name in ('event_sources', 'event_assets', 'market_reactions') then
      select event.snapshot_id into v_new_snapshot from market_radar.events event
      where event.id = new.event_id and event.status = 'published' and event.origin = 'research'
        and event.publication_state = 'published' and event.snapshot_id is not null;
    elsif tg_table_schema = 'learning_radar' and tg_table_name = 'raw_items' then
      v_new_snapshot := new.payload ->> 'snapshotId';
    elsif tg_table_schema = 'learning_radar' and tg_table_name in ('story_sources', 'story_updates') then
      select story.snapshot_id into v_new_snapshot from learning_radar.stories story
      where story.id = new.story_id and story.status = 'published' and story.origin = 'research'
        and story.publication_state = 'published' and story.snapshot_id is not null;
    end if;
  end if;

  if v_old_snapshot is not null or v_new_snapshot is not null then
    if tg_op = 'INSERT' then
      if tg_table_schema = 'market_radar' and tg_table_name = 'raw_items' then
        select exists(select 1 from market_radar.raw_items item where item.id = new.id) into v_existing;
      elsif tg_table_schema = 'market_radar' and tg_table_name = 'event_sources' then
        select exists(select 1 from market_radar.event_sources source
          where source.event_id = new.event_id and source.raw_item_id = new.raw_item_id) into v_existing;
      elsif tg_table_schema = 'market_radar' and tg_table_name = 'event_assets' then
        select exists(select 1 from market_radar.event_assets asset
          where asset.event_id = new.event_id and asset.namespace = new.namespace and asset.symbol = new.symbol)
        into v_existing;
      elsif tg_table_schema = 'market_radar' and tg_table_name = 'market_reactions' then
        select exists(select 1 from market_radar.market_reactions reaction where reaction.event_id = new.event_id)
        into v_existing;
      elsif tg_table_schema = 'learning_radar' and tg_table_name = 'raw_items' then
        select exists(select 1 from learning_radar.raw_items item where item.id = new.id) into v_existing;
      elsif tg_table_schema = 'learning_radar' and tg_table_name = 'story_sources' then
        select exists(select 1 from learning_radar.story_sources source
          where source.story_id = new.story_id and source.raw_item_id = new.raw_item_id) into v_existing;
      elsif tg_table_schema = 'learning_radar' and tg_table_name = 'story_updates' then
        select exists(select 1 from learning_radar.story_updates update_row where update_row.id = new.id)
        into v_existing;
      end if;
      if v_existing or radar_system.snapshot_created_in_current_transaction(v_new_snapshot) then return new; end if;
    end if;
    raise exception 'published_radar_snapshot_immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$protect_snapshot_child$;

drop trigger if exists protect_publication_snapshot on radar_system.publication_snapshots;
create trigger protect_publication_snapshot
before update or delete on radar_system.publication_snapshots
for each row execute function radar_system.protect_publication_snapshot();

drop trigger if exists protect_snapshot_member on market_radar.events;
create trigger protect_snapshot_member
before insert or update or delete on market_radar.events
for each row execute function radar_system.protect_snapshot_member();

drop trigger if exists protect_snapshot_member on learning_radar.stories;
create trigger protect_snapshot_member
before insert or update or delete on learning_radar.stories
for each row execute function radar_system.protect_snapshot_member();

drop trigger if exists protect_snapshot_child on market_radar.raw_items;
create trigger protect_snapshot_child before insert or update or delete on market_radar.raw_items
for each row execute function radar_system.protect_snapshot_child();

drop trigger if exists protect_snapshot_child on market_radar.event_sources;
create trigger protect_snapshot_child before insert or update or delete on market_radar.event_sources
for each row execute function radar_system.protect_snapshot_child();

drop trigger if exists protect_snapshot_child on market_radar.event_assets;
create trigger protect_snapshot_child before insert or update or delete on market_radar.event_assets
for each row execute function radar_system.protect_snapshot_child();

drop trigger if exists protect_snapshot_child on market_radar.market_reactions;
create trigger protect_snapshot_child before insert or update or delete on market_radar.market_reactions
for each row execute function radar_system.protect_snapshot_child();

drop trigger if exists protect_snapshot_child on learning_radar.raw_items;
create trigger protect_snapshot_child before insert or update or delete on learning_radar.raw_items
for each row execute function radar_system.protect_snapshot_child();

drop trigger if exists protect_snapshot_child on learning_radar.story_sources;
create trigger protect_snapshot_child before insert or update or delete on learning_radar.story_sources
for each row execute function radar_system.protect_snapshot_child();

drop trigger if exists protect_snapshot_child on learning_radar.story_updates;
create trigger protect_snapshot_child before insert or update or delete on learning_radar.story_updates
for each row execute function radar_system.protect_snapshot_child();

revoke all on function radar_system.snapshot_created_in_current_transaction(text) from public;
revoke all on function radar_system.protect_publication_snapshot() from public;
revoke all on function radar_system.protect_snapshot_member() from public;
revoke all on function radar_system.protect_snapshot_child() from public;

create or replace view market_radar.public_events as
select
  e.id, e.slug, e.market, e.priority, null::integer as score, e.title_zh, e.summary_zh, e.why_it_matters_zh,
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

create or replace function radar_system.review_timeline(
  p_domain text, p_target_id text, p_decision text, p_note text, p_requested_by text,
  p_approved_by text, p_workflow_run_id text, p_expected_version timestamptz, p_release_sha text
)
returns table (new_status text, replayed boolean, decided_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog
as $timeline_review$
declare
  v_now timestamptz := statement_timestamp();
  v_input_hash text; v_existing_hash text; v_existing_status text; v_existing_decided_at timestamptz;
  v_status text; v_updated_at timestamptz; v_priority text; v_title text; v_summary text; v_why text;
  v_ai_schema text; v_watch text; v_invalidation text; v_event_type text; v_judgment text;
  v_occurred_at timestamptz; v_verification_state text; v_has_conflict boolean;
  v_conflict_evidence jsonb; v_verified_sources integer; v_primary_sources integer;
  v_total_sources integer; v_row_count integer; v_snapshot_id text; v_publication_state text;
begin
  if p_domain is null or p_domain not in ('learning', 'market') then raise exception 'invalid_domain'; end if;
  if p_decision is null or p_decision not in ('approve', 'reject') then raise exception 'invalid_decision'; end if;
  if p_target_id is null or p_target_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then raise exception 'invalid_target_id'; end if;
  if p_requested_by is null or p_requested_by !~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}$' then raise exception 'invalid_requested_by'; end if;
  if p_approved_by is null or p_approved_by !~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}$' then raise exception 'invalid_approved_by'; end if;
  p_requested_by := lower(p_requested_by); p_approved_by := lower(p_approved_by);
  if p_requested_by = p_approved_by then raise exception 'requester_cannot_approve'; end if;
  if p_workflow_run_id is null or p_workflow_run_id !~ '^[0-9]{1,20}$' then raise exception 'invalid_workflow_run'; end if;
  if p_release_sha is null or p_release_sha !~ '^[0-9a-f]{40}$' then raise exception 'invalid_release_sha'; end if;
  if p_expected_version is null then raise exception 'invalid_expected_version'; end if;
  if p_note is not null and (char_length(p_note) > 1000 or p_note ~ '[[:cntrl:]]') then raise exception 'invalid_note'; end if;

  v_existing_status := case when p_decision = 'approve' then 'approved' else 'rejected' end;
  v_input_hash := encode(sha256(convert_to(jsonb_build_object(
    'domain', p_domain, 'target_id', p_target_id, 'decision', p_decision, 'note', p_note,
    'requested_by', p_requested_by, 'approved_by', p_approved_by, 'workflow_run_id', p_workflow_run_id,
    'expected_version', p_expected_version, 'release_sha', p_release_sha
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(hashtextextended('timeline-review-run:' || p_workflow_run_id, 0));
  insert into radar_system.timeline_review_runs
    (workflow_run_id, domain, target_id, decision, input_hash, new_status, created_at, decided_at)
  values (p_workflow_run_id, p_domain, p_target_id, p_decision, v_input_hash, v_existing_status, v_now, v_now)
  on conflict (workflow_run_id) do nothing;
  if not found then
    select r.input_hash, r.new_status, r.decided_at into v_existing_hash, v_existing_status, v_existing_decided_at
    from radar_system.timeline_review_runs r where r.workflow_run_id = p_workflow_run_id for update;
    if v_existing_hash <> v_input_hash then raise exception 'workflow_run_reused'; end if;
    return query select v_existing_status, true, v_existing_decided_at; return;
  end if;

  if p_domain = 'learning' then
    select s.status, s.updated_at, s.title_zh, s.summary_zh, s.why_selected_zh, s.ai_schema_version,
      s.verification_state, s.has_conflict, s.conflict_evidence, s.snapshot_id, s.publication_state
    into v_status, v_updated_at, v_title, v_summary, v_why, v_ai_schema,
      v_verification_state, v_has_conflict, v_conflict_evidence, v_snapshot_id, v_publication_state
    from learning_radar.stories s where s.id = p_target_id for update;
    if not found then raise exception 'target_not_found'; end if;
    if v_status <> 'draft' then raise exception 'status_changed'; end if;
    if v_snapshot_id is not null or v_publication_state <> 'draft' then raise exception 'candidate_already_snapshot_bound'; end if;
    if v_updated_at <> p_expected_version then raise exception 'version_changed'; end if;
    if p_decision = 'approve' then
      select count(*) filter (where ss.origin_verified_at is not null and ss.verification_state = 'verified'
        and ss.source_url !~* '^https://([^.]+\.)*aihot\.virxact\.com(?::[0-9]+)?(?:/|$)'
        and ss.published_at >= v_now - interval '30 days' and ss.published_at <= v_now + interval '1 hour')::integer
      into v_verified_sources from learning_radar.story_sources ss where ss.story_id = p_target_id;
      if v_ai_schema is distinct from 'learning-v1' or btrim(coalesce(v_title, '')) = ''
        or btrim(coalesce(v_summary, '')) = '' or btrim(coalesce(v_why, '')) = ''
        or coalesce(v_verification_state, '') not in ('pending', 'verified') or v_has_conflict is distinct from false
        or coalesce(jsonb_typeof(v_conflict_evidence), '') <> 'array'
        or coalesce(jsonb_array_length(v_conflict_evidence), -1) <> 0 or v_verified_sources < 1
      then raise exception 'unsafe_learning_draft'; end if;
    end if;
    update learning_radar.stories set status = v_existing_status,
      approved_at = case when v_existing_status = 'approved' then v_now else approved_at end,
      published_at = null,
      publication_basis = case when v_existing_status = 'approved' then 'manual_review' else publication_basis end,
      verification_state = case when v_existing_status = 'approved' then 'verified' else verification_state end,
      updated_at = v_now
    where id = p_target_id and status = 'draft' and updated_at = p_expected_version
      and snapshot_id is null and publication_state = 'draft';
    get diagnostics v_row_count = row_count; if v_row_count <> 1 then raise exception 'version_changed'; end if;
    insert into learning_radar.review_decisions
      (id, story_id, decision, actor, requested_by, approved_by, note, workflow_run_id, release_sha,
       input_hash, expected_version, previous_status, new_status, decided_at)
    values ('timeline-review:' || p_domain || ':' || p_workflow_run_id, p_target_id, p_decision,
      p_requested_by, p_requested_by, p_approved_by, p_note, p_workflow_run_id, p_release_sha,
      v_input_hash, p_expected_version, 'draft', v_existing_status, v_now);
  else
    select e.status, e.updated_at, e.priority, e.title_zh, e.summary_zh, e.why_it_matters_zh,
      e.ai_schema_version, e.watch_for_zh, e.invalidation_zh, e.event_type, e.system_judgment, e.occurred_at,
      e.snapshot_id, e.publication_state
    into v_status, v_updated_at, v_priority, v_title, v_summary, v_why,
      v_ai_schema, v_watch, v_invalidation, v_event_type, v_judgment, v_occurred_at,
      v_snapshot_id, v_publication_state
    from market_radar.events e where e.id = p_target_id for update;
    if not found then raise exception 'target_not_found'; end if;
    if v_status <> 'draft' then raise exception 'status_changed'; end if;
    if v_snapshot_id is not null or v_publication_state <> 'draft' then raise exception 'candidate_already_snapshot_bound'; end if;
    if v_updated_at <> p_expected_version then raise exception 'version_changed'; end if;
    if p_decision = 'approve' then
      select count(*)::integer, count(*) filter (where es.is_primary)::integer
      into v_total_sources, v_primary_sources from market_radar.event_sources es where es.event_id = p_target_id;
      if coalesce(v_priority, '') not in ('P0', 'P1', 'P2') or v_ai_schema is distinct from 'v2'
        or btrim(coalesce(v_title, '')) = '' or btrim(coalesce(v_summary, '')) = '' or btrim(coalesce(v_why, '')) = ''
        or btrim(coalesce(v_event_type, '')) = '' or btrim(coalesce(v_judgment, '')) = ''
        or not radar_system.meaningful_timeline_boundary(v_watch)
        or not radar_system.meaningful_timeline_boundary(v_invalidation)
        or v_occurred_at < v_now - interval '7 days' or v_occurred_at > v_now + interval '1 hour'
        or v_total_sources < 1 or v_primary_sources <> 1
      then raise exception 'unsafe_market_draft'; end if;
    end if;
    update market_radar.events set status = v_existing_status,
      approved_at = case when v_existing_status = 'approved' then v_now else approved_at end,
      published_at = null, updated_at = v_now
    where id = p_target_id and status = 'draft' and updated_at = p_expected_version
      and snapshot_id is null and publication_state = 'draft';
    get diagnostics v_row_count = row_count; if v_row_count <> 1 then raise exception 'version_changed'; end if;
    insert into market_radar.review_decisions
      (id, event_id, decision, actor, requested_by, approved_by, note, workflow_run_id, release_sha,
       input_hash, expected_version, previous_status, new_status, decided_at)
    values ('timeline-review:' || p_domain || ':' || p_workflow_run_id, p_target_id, p_decision,
      p_requested_by, p_requested_by, p_approved_by, p_note, p_workflow_run_id, p_release_sha,
      v_input_hash, p_expected_version, 'draft', v_existing_status, v_now);
  end if;
  return query select v_existing_status, false, v_now;
end
$timeline_review$;

revoke all on function radar_system.review_timeline(text, text, text, text, text, text, text, timestamptz, text)
  from public;
