grant execute on function radar_system.meaningful_timeline_boundary(text) to public;

create or replace view learning_radar.public_timeline_items as
select
  s.id, s.slug, s.category, s.importance, s.title_zh, s.summary_zh, s.why_selected_zh,
  s.occurred_at, s.published_at,
  coalesce(source_summary.source_count, 0)::integer as source_count,
  source_summary.primary_source
from learning_radar.stories s
left join lateral (
  select count(*)::integer as source_count,
    (jsonb_agg(jsonb_build_object('name', ss.source_name, 'url', ss.source_url,
      'publishedAt', ss.published_at) order by ss.is_primary desc, ss.published_at asc) -> 0) as primary_source
  from learning_radar.story_sources ss
  where ss.story_id = s.id and ss.origin_verified_at is not null and ss.verification_state = 'verified'
) source_summary on true
where s.status = 'published' and s.published_at is not null and s.verification_state = 'verified'
  and s.has_conflict = false and jsonb_array_length(s.conflict_evidence) = 0
  and coalesce(source_summary.source_count, 0) > 0
  and (
    (s.publication_basis = 'official_primary' and exists (
      select 1 from learning_radar.story_sources official_source
      where official_source.story_id = s.id and official_source.origin_verified_at is not null
        and official_source.verification_state = 'verified' and official_source.is_official = true
        and coalesce(official_source.discovered_via, '') !~* '^https://([^.]+\.)*aihot\.virxact\.com(?:/|$)'
    ))
    or (s.publication_basis = 'independent_domains' and (
      select count(distinct confirmed_source.registrable_domain)
      from learning_radar.story_sources confirmed_source
      where confirmed_source.story_id = s.id and confirmed_source.origin_verified_at is not null
        and confirmed_source.verification_state = 'verified' and confirmed_source.registrable_domain is not null
    ) >= 2)
    or (s.publication_basis = 'manual_review' and s.ai_schema_version = 'learning-v1'
      and btrim(s.title_zh) <> '' and btrim(s.summary_zh) <> '' and btrim(s.why_selected_zh) <> ''
      and exists (
        select 1 from learning_radar.story_sources manual_source
        where manual_source.story_id = s.id and manual_source.origin_verified_at is not null
          and manual_source.verification_state = 'verified'
          and manual_source.source_url !~* '^https://([^.]+\.)*aihot\.virxact\.com(?::[0-9]+)?(?:/|$)'
      )
      and exists (
        select 1 from learning_radar.review_decisions approved_review
        where approved_review.story_id = s.id and approved_review.decision = 'approve'
          and approved_review.previous_status = 'draft' and approved_review.new_status = 'published'
          and approved_review.workflow_run_id ~ '^[0-9]{1,20}$'
          and approved_review.release_sha ~ '^[0-9a-f]{40}$'
          and approved_review.input_hash ~ '^[0-9a-f]{64}$'
          and btrim(approved_review.requested_by) <> '' and btrim(approved_review.approved_by) <> ''
          and lower(approved_review.requested_by) <> lower(approved_review.approved_by)
      ))
  );
