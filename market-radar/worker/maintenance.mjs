export async function cleanupRetention(sql) {
  const purgedPayloads = await sql.query(`update market_radar.raw_items
    set payload_fingerprint = coalesce(payload_fingerprint, md5(payload::text)),
      payload = '{"retained":false}'::jsonb,
      payload_purged_at = now()
    where payload_expires_at < now() and payload_purged_at is null
    returning id`)

  const deletedEvents = await sql.query(`delete from market_radar.events
    where occurred_at < now() - interval '1 year' returning id`)
  await sql.query(`delete from market_radar.digests where created_at < now() - interval '1 year'`)
  await sql.query(`delete from market_radar.feedback where created_at < now() - interval '1 year'`)
  await sql.query(`delete from market_radar.trial_metrics where day < current_date - 365`)
  await sql.query(`delete from market_radar.outbox
    where created_at < now() - interval '1 year' and status in ('sent', 'dead_letter')`)
  await sql.query(`delete from market_radar.job_runs where started_at < now() - interval '30 days'`)
  await sql.query(`delete from market_radar.raw_items r
    where r.created_at < now() - interval '1 year'
      and not exists (select 1 from market_radar.event_sources es where es.raw_item_id = r.id)`)

  return { purgedPayloads: purgedPayloads.length, deletedEvents: deletedEvents.length }
}

export async function recordDailyMetrics(sql, day = new Date()) {
  const dayString = day.toISOString().slice(0, 10)
  const rows = await sql.query(`with event_stats as (
      select
        count(*) filter (where status = 'published')::integer as published,
        count(*) filter (where priority = 'P0' and status = 'published')::integer as p0,
        count(*) filter (where priority = 'P1' and status = 'published')::integer as p1,
        count(*) filter (where status = 'rejected')::integer as rejected,
        count(*) filter (where status = 'published' and not exists (
          select 1 from market_radar.event_sources es where es.event_id = events.id
        ))::integer as missing_sources
      from market_radar.events
      where occurred_at >= $1::date and occurred_at < $1::date + interval '1 day'
    ), run_stats as (
      select
        count(*)::integer as runs,
        count(*) filter (where status = 'succeeded')::integer as successful_runs
      from market_radar.job_runs
      where started_at >= $1::date and started_at < $1::date + interval '1 day'
    ), feedback_stats as (
      select
        count(*)::integer as feedback,
        count(*) filter (where value = 'useful')::integer as useful
      from market_radar.feedback
      where created_at >= $1::date and created_at < $1::date + interval '1 day'
    )
    select jsonb_build_object(
      'published', es.published, 'p0', es.p0, 'p1', es.p1, 'rejected', es.rejected,
      'missingSources', es.missing_sources, 'runs', rs.runs, 'successfulRuns', rs.successful_runs,
      'collectionSuccessRate', case when rs.runs = 0 then null else round(rs.successful_runs::numeric / rs.runs, 4) end,
      'feedback', fs.feedback, 'useful', fs.useful,
      'usefulRate', case when fs.feedback = 0 then null else round(fs.useful::numeric / fs.feedback, 4) end
    ) as metrics
    from event_stats es cross join run_stats rs cross join feedback_stats fs`, [dayString])
  const metrics = rows[0]?.metrics || {}
  await sql.query(`insert into market_radar.trial_metrics (day, metrics)
    values ($1::date, $2::jsonb)
    on conflict (day) do update set metrics = excluded.metrics, updated_at = now()`,
  [dayString, JSON.stringify(metrics)])
  return metrics
}
