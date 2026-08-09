alter table market_radar.events
  add column if not exists watch_for_zh text;

alter table market_radar.events
  add column if not exists invalidation_zh text;

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
