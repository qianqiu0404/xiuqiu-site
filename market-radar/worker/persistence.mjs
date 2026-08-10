import {
  clusterKey,
  hasCompleteAiV2Boundaries,
  isFreshForPublic,
  mapAssets,
  normalizeMarketSourceReport,
  normalizeTitle,
  priorityForScore,
  scoreEvent,
  titleSimilarity,
} from './core.mjs'

function rows(result) {
  return Array.isArray(result) ? result : result?.rows || []
}

async function query(client, statement, values = []) {
  return rows(await client.query(statement, values))
}

export async function findMarketEventCandidate(client, item) {
  const attached = await query(client, `select e.id, e.title_zh, e.score, e.priority, e.status,
      e.ai_schema_version, e.watch_for_zh, e.invalidation_zh
    from market_radar.events e
    join market_radar.event_sources es on es.event_id = e.id
    join market_radar.raw_items r on r.id = es.raw_item_id
    where r.provider = $1 and r.provider_id = $2
    limit 1`, [item.provider, item.providerId])
  if (attached[0]) return attached[0]

  const key = clusterKey(item.title, item.publishedAt)
  const candidates = await query(client, `select e.id, e.title_zh, e.score, e.priority, e.status,
      e.ai_schema_version, e.watch_for_zh, e.invalidation_zh,
      e.cluster_key = $1 as exact_cluster,
      coalesce(jsonb_agg(distinct r.title) filter (where r.title is not null), '[]'::jsonb) as source_titles
    from market_radar.events e
    left join market_radar.event_sources es on es.event_id = e.id
    left join market_radar.raw_items r on r.id = es.raw_item_id
    where e.market = $2
      and e.occurred_at >= $3::timestamptz - interval '48 hours'
      and e.occurred_at <= $3::timestamptz + interval '48 hours'
    group by e.id
    order by (e.cluster_key = $1) desc, e.occurred_at desc, e.id desc
    limit 30`, [key, item.market, item.publishedAt])
  return candidates.find(candidate => {
    const originalTitles = Array.isArray(candidate.source_titles) ? candidate.source_titles : []
    const similarity = Math.max(
      titleSimilarity(candidate.title_zh, item.title),
      ...originalTitles.map(title => titleSimilarity(title, item.title)),
    )
    return candidate.exact_cluster === true || similarity >= 0.45
  }) || null
}

async function upsertRawItem(client, item, serializedPayload) {
  const previous = await query(client, `select id, title,
      payload_purged_at is not null and payload_fingerprint is null as needs_payload_baseline,
      source_url is distinct from $3
        or title is distinct from $4
        or published_at is distinct from $5::timestamptz as structure_changed,
      case
        when payload_fingerprint is not null then payload_fingerprint is distinct from md5(($6::jsonb)::text)
        when payload_purged_at is null then md5(payload::text) is distinct from md5(($6::jsonb)::text)
        else false
      end as payload_changed
    from market_radar.raw_items where provider = $1 and provider_id = $2
    for update`, [
      item.provider, item.providerId, item.sourceUrl, item.title, item.publishedAt, serializedPayload,
    ])
  const previousRow = previous[0]
  const needsPayloadBaseline = previousRow?.needs_payload_baseline === true
  const revisionDetected = previousRow?.structure_changed === true || previousRow?.payload_changed === true
  const restorePayload = revisionDetected && !needsPayloadBaseline
  const id = previous[0]?.id || crypto.randomUUID()
  const saved = await query(client, `insert into market_radar.raw_items
    (id, provider, provider_id, market, source_url, title, published_at, payload, payload_fingerprint, normalized_at)
    values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,md5(($8::jsonb)::text),now())
    on conflict (provider, provider_id) do update set
      market = excluded.market,
      source_url = excluded.source_url,
      title = excluded.title,
      published_at = excluded.published_at,
      payload = case when $9::boolean then excluded.payload else market_radar.raw_items.payload end,
      payload_fingerprint = case
        when $9::boolean or $10::boolean then excluded.payload_fingerprint
        else market_radar.raw_items.payload_fingerprint
      end,
      payload_expires_at = case when $9::boolean then now() + interval '14 days' else market_radar.raw_items.payload_expires_at end,
      payload_purged_at = case when $9::boolean then null else market_radar.raw_items.payload_purged_at end,
      normalized_at = now()
    returning id`, [
      id, item.provider, item.providerId, item.market, item.sourceUrl, item.title,
      item.publishedAt, serializedPayload, restorePayload, needsPayloadBaseline,
    ])
  const old = previousRow
  return {
    id: saved[0].id,
    inserted: !old,
    revised: revisionDetected,
  }
}

async function upsertEventSource(client, { eventId, rawId, item, now }) {
  const report = normalizeMarketSourceReport(item.sourceReport, { now })
  const existingRows = await query(client, `select raw_item_id, is_primary
    from market_radar.event_sources where event_id = $1
    order by is_primary desc, raw_item_id asc for update`, [eventId])
  const existing = existingRows.find(source => source.raw_item_id === rawId)
  await query(client, `insert into market_radar.event_sources
    (event_id, raw_item_id, source_name, source_url, title, excerpt, published_at, is_primary)
    values ($1,$2,$3,$4,$5,$6,$7,$8)
    on conflict (event_id, raw_item_id) do update set
      source_name = excluded.source_name,
      source_url = excluded.source_url,
      title = coalesce(excluded.title, market_radar.event_sources.title),
      excerpt = coalesce(excluded.excerpt, market_radar.event_sources.excerpt),
      published_at = coalesce(excluded.published_at, market_radar.event_sources.published_at),
      is_primary = market_radar.event_sources.is_primary`, [
      eventId, rawId, item.provider, item.sourceUrl,
      report.title, report.excerpt, report.publishedAt, false,
    ])
  const primary = await query(client, `select es.raw_item_id
    from market_radar.event_sources es
    join market_radar.raw_items r on r.id = es.raw_item_id
    where es.event_id = $1
    order by
      case when es.source_name in ('sec_edgar', 'federal_reserve', 'github_releases') then 0 else 1 end,
      coalesce(es.published_at, r.published_at, r.created_at) asc,
      es.raw_item_id asc
    limit 1`, [eventId])
  await query(client, `update market_radar.event_sources set is_primary = false
    where event_id = $1 and is_primary = true and raw_item_id <> $2`, [eventId, primary[0].raw_item_id])
  await query(client, `update market_radar.event_sources set is_primary = true
    where event_id = $1 and raw_item_id = $2 and is_primary = false`, [eventId, primary[0].raw_item_id])
  return { added: !existing, report, isPrimary: primary[0]?.raw_item_id === rawId }
}

async function upsertAssets(client, eventId, assets) {
  for (const asset of assets) {
    await query(client, `insert into market_radar.event_assets (event_id, namespace, symbol, relevance)
      values ($1,$2,$3,$4) on conflict (event_id, namespace, symbol) do update
      set relevance = greatest(market_radar.event_assets.relevance, excluded.relevance)`, [
      eventId, asset.namespace, asset.symbol, asset.relevance,
    ])
  }
}

async function enqueueP0(client, eventId, payload) {
  await query(client, `insert into market_radar.outbox
    (id, event_id, kind, idempotency_key, payload, available_at)
    values ($1,$2,'p0',$3,$4::jsonb,now()) on conflict (idempotency_key) do nothing`, [
    crypto.randomUUID(), eventId, `market:p0:${eventId}`,
    JSON.stringify({ ...payload, pageUrl: `/market-radar/events/${eventId}` }),
  ])
}

export async function persistMarketItem(client, item, {
  summary = null,
  now = new Date(),
} = {}) {
  const serializedPayload = JSON.stringify(item.payload)
  const assets = mapAssets(`${item.title} ${item.summary}`, item.explicitSymbols)
  const key = clusterKey(item.title, item.publishedAt)
  await client.query('begin')
  try {
    const raw = await upsertRawItem(client, item, serializedPayload)
    const existing = await findMarketEventCandidate(client, item)
    if (existing) {
      const source = await upsertEventSource(client, { eventId: existing.id, rawId: raw.id, item, now })
      const countRows = await query(client, `select count(*)::integer as count
        from market_radar.event_sources where event_id = $1`, [existing.id])
      const scored = scoreEvent({
        source: item.provider,
        assets,
        occurredAt: item.publishedAt,
        sourceCount: countRows[0]?.count || 1,
        text: `${item.title} ${item.summary}`,
      })
      const score = Math.max(Number(existing.score), scored)
      const priority = priorityForScore(score)
      const publishable = hasCompleteAiV2Boundaries(existing) && score >= 50 && isFreshForPublic(item.publishedAt, now)
      await upsertAssets(client, existing.id, assets)
      await query(client, `update market_radar.events set score = $2, priority = $3,
        status = case when $4::boolean then 'published' else status end,
        published_at = case when $4::boolean then coalesce(published_at, now()) else published_at end,
        occurred_at = least(occurred_at, $5::timestamptz),
        updated_at = now() where id = $1`, [existing.id, score, priority, publishable, item.publishedAt])
      if (publishable && priority === 'P0' && existing.priority !== 'P0') {
        await enqueueP0(client, existing.id, {
          eventId: existing.id,
          priority,
          title: existing.title_zh,
          summary: item.summary,
          sourceUrl: item.sourceUrl,
        })
      }
      await client.query('commit')
      return {
        eventId: existing.id,
        inserted: raw.inserted,
        revised: raw.revised,
        sourceAdded: source.added,
        published: publishable,
      }
    }

    const score = scoreEvent({
      source: item.provider,
      assets,
      occurredAt: item.publishedAt,
      text: `${item.title} ${item.summary}`,
    })
    const priority = priorityForScore(score)
    const publishable = Boolean(summary) && score >= 50 && isFreshForPublic(item.publishedAt, now)
    const id = crypto.randomUUID()
    const slug = `${new Date(item.publishedAt).toISOString().slice(0, 10)}-${normalizeTitle(item.title).replace(/ /g, '-').slice(0, 90)}-${id.slice(0, 6)}`
    await query(client, `insert into market_radar.events
      (id, slug, cluster_key, market, status, priority, score, title_zh, summary_zh, why_it_matters_zh,
       event_type, news_direction, system_judgment, horizon, ai_schema_version, occurred_at, published_at,
       watch_for_zh, invalidation_zh)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`, [
      id, slug, key, item.market, publishable ? 'published' : (score < 30 ? 'rejected' : 'draft'),
      priority === 'rejected' ? null : priority, score,
      summary?.titleZh || item.title.slice(0, 160), summary?.summaryZh || '', summary?.whyItMattersZh || '',
      summary?.eventType || 'unclassified', summary?.direction || 'neutral', summary?.systemJudgment || '等待结构化验证',
      summary?.horizon || 'days', summary ? 'v2' : null, item.publishedAt, publishable ? now.toISOString() : null,
      summary?.watchFor || null, summary?.invalidation || null,
    ])
    const source = await upsertEventSource(client, { eventId: id, rawId: raw.id, item, now })
    await upsertAssets(client, id, assets)
    await query(client, `insert into market_radar.market_reactions (event_id, status)
      values ($1, 'pending')`, [id])
    if (publishable && priority === 'P0') {
      await enqueueP0(client, id, {
        eventId: id,
        priority,
        title: summary.titleZh,
        summary: summary.summaryZh,
        sourceUrl: item.sourceUrl,
      })
    }
    await client.query('commit')
    return {
      eventId: id,
      inserted: raw.inserted,
      revised: raw.revised,
      sourceAdded: source.added,
      published: publishable,
    }
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    throw error
  }
}
