update market_radar.event_sources es
set
  title = coalesce(es.title, r.title),
  published_at = coalesce(es.published_at, r.published_at)
from market_radar.raw_items r
where r.id = es.raw_item_id
  and (es.title is null or es.published_at is null);

with ranked_sources as (
  select
    es.event_id,
    es.raw_item_id,
    row_number() over (
      partition by es.event_id
      order by
        case when es.source_name in ('sec_edgar', 'federal_reserve', 'github_releases') then 0 else 1 end,
        coalesce(es.published_at, r.published_at, r.created_at) asc,
        es.raw_item_id asc
    ) as source_rank
  from market_radar.event_sources es
  join market_radar.raw_items r on r.id = es.raw_item_id
)
update market_radar.event_sources es
set is_primary = ranked_sources.source_rank = 1
from ranked_sources
where es.event_id = ranked_sources.event_id
  and es.raw_item_id = ranked_sources.raw_item_id
  and es.is_primary is distinct from (ranked_sources.source_rank = 1);

create unique index if not exists market_radar_event_sources_one_primary_idx
  on market_radar.event_sources (event_id)
  where is_primary;

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
where e.status = 'published' and e.priority in ('P0', 'P1', 'P2')
  and e.occurred_at >= now() - interval '7 days'
  and exists (
    select 1 from market_radar.event_sources verified_source
    where verified_source.event_id = e.id and verified_source.is_primary = true
  )
group by e.id, mr.event_id;

create or replace view market_radar.public_event_reports as
select
  md5(es.event_id || ':' || es.raw_item_id) as id,
  es.event_id,
  es.source_name,
  es.source_url,
  es.title,
  es.excerpt,
  es.published_at,
  es.is_primary
from market_radar.event_sources es
join market_radar.public_events public_event on public_event.id = es.event_id;
