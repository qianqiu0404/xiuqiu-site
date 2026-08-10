import {
  areLearningItemsInSameCluster,
  decideLearningPublication,
  detectLearningSourceConflicts,
  encodeLearningSourceCursor,
  learningClusterKey,
  newestLearningCursor,
  parseLearningSourceCursor,
  selectItemsAfterCursor,
} from './core.mjs'

function rows(result) {
  return Array.isArray(result) ? result : result?.rows || []
}

async function query(client, statement, values = []) {
  return rows(await client.query(statement, values))
}

export async function claimLearningWorkerLease(client, {
  token = crypto.randomUUID(),
  leaseMinutes = 20,
} = {}) {
  const claimed = await query(client, `insert into learning_radar.worker_locks (lock_key, lease_token, lease_until)
    values ('learning-radar-worker', $1, now() + ($2::text || ' minutes')::interval)
    on conflict (lock_key) do update set
      lease_token = excluded.lease_token,
      lease_until = excluded.lease_until,
      updated_at = now()
    where learning_radar.worker_locks.lease_until <= now()
    returning lease_token`, [token, leaseMinutes])
  return claimed[0]?.lease_token === token ? token : null
}

export async function releaseLearningWorkerLease(client, token) {
  if (!token) return
  await query(client, `delete from learning_radar.worker_locks
    where lock_key = 'learning-radar-worker' and lease_token = $1`, [token])
}

async function findStory(client, item, rawId) {
  const attached = await query(client, `select s.*, jsonb_agg(jsonb_build_object(
      'title', ss.title, 'category', s.category, 'publishedAt', ss.published_at
    )) as source_items
    from learning_radar.stories s
    join learning_radar.story_sources ss on ss.story_id = s.id
    where ss.raw_item_id = $1
    group by s.id limit 1`, [rawId])
  if (attached[0]) return attached[0]
  const candidates = await query(client, `select s.*, coalesce(jsonb_agg(jsonb_build_object(
      'title', ss.title, 'category', s.category, 'publishedAt', ss.published_at
    )) filter (where ss.raw_item_id is not null), '[]'::jsonb) as source_items
    from learning_radar.stories s
    left join learning_radar.story_sources ss on ss.story_id = s.id
    where s.category = $1
      and s.occurred_at >= $2::timestamptz - interval '48 hours'
      and s.occurred_at <= $2::timestamptz + interval '48 hours'
    group by s.id order by s.occurred_at desc limit 30`, [item.category, item.publishedAt])
  return candidates.find(candidate => (candidate.source_items || []).some(source => (
    areLearningItemsInSameCluster(item, source)
  ))) || null
}

async function upsertRawItem(client, item) {
  const payloadJson = JSON.stringify(item.rawPayload)
  const previous = await query(client, `select id, title,
      payload_purged_at is not null and payload_fingerprint is null as needs_payload_baseline,
      source_url is distinct from $3
        or title is distinct from $4
        or excerpt is distinct from $5
        or published_at is distinct from $6::timestamptz as structure_changed,
      case
        when payload_fingerprint is not null then payload_fingerprint is distinct from md5(($7::jsonb)::text)
        when payload_purged_at is null then md5(payload::text) is distinct from md5(($7::jsonb)::text)
        else false
      end as payload_changed
    from learning_radar.raw_items
    where provider = $1 and provider_id = $2
    for update`, [
      item.provider, item.providerId, item.sourceUrl, item.title, item.excerpt, item.publishedAt, payloadJson,
    ])
  const previousRow = previous[0]
  const needsPayloadBaseline = previousRow?.needs_payload_baseline === true
  const revisionDetected = previousRow?.structure_changed === true || previousRow?.payload_changed === true
  const restorePayload = revisionDetected && !needsPayloadBaseline
  const id = previous[0]?.id || crypto.randomUUID()
  const result = await query(client, `insert into learning_radar.raw_items
    (id, provider, provider_id, source_url, source_domain, title, excerpt, published_at, payload,
      payload_fingerprint, normalized_at, origin_verified_at, is_official, discovered_via, verification_state, verification_error)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,md5(($9::jsonb)::text),now(),$10,$11,$12,$13,$14)
    on conflict (provider, provider_id) do update set
      source_url = excluded.source_url,
      source_domain = excluded.source_domain,
      title = excluded.title,
      excerpt = excluded.excerpt,
      published_at = excluded.published_at,
      payload = case when $15::boolean then excluded.payload else learning_radar.raw_items.payload end,
      payload_fingerprint = case
        when $15::boolean or $16::boolean then excluded.payload_fingerprint
        else learning_radar.raw_items.payload_fingerprint
      end,
      payload_expires_at = case when $15::boolean then now() + interval '14 days' else learning_radar.raw_items.payload_expires_at end,
      payload_purged_at = case when $15::boolean then null else learning_radar.raw_items.payload_purged_at end,
      normalized_at = now(),
      origin_verified_at = excluded.origin_verified_at,
      is_official = excluded.is_official,
      discovered_via = excluded.discovered_via,
      verification_state = excluded.verification_state,
      verification_error = excluded.verification_error
    returning id`, [
      id, item.provider, item.providerId, item.sourceUrl, item.sourceDomain, item.title, item.excerpt,
      item.publishedAt, payloadJson, item.originVerifiedAt, item.isOfficial,
      item.discoveredVia, item.verificationState, item.verificationError, restorePayload, needsPayloadBaseline,
    ])
  return {
    id: result[0].id,
    inserted: !previousRow,
    titleChanged: Boolean(previousRow && previousRow.title !== item.title),
  }
}

async function storySources(client, storyId) {
  return query(client, `select source_name as "sourceName", source_url as "sourceUrl",
      title, excerpt, source_domain as "sourceDomain",
      registrable_domain as "registrableDomain", published_at as "publishedAt",
      origin_verified_at as "originVerifiedAt", is_official as "isOfficial",
      discovered_via as "discoveredVia", verification_state as "verificationState"
    from learning_radar.story_sources where story_id = $1`, [storyId])
}

export async function persistPreparedLearningItem(client, prepared, { now = new Date() } = {}) {
  const { item } = prepared
  const raw = await upsertRawItem(client, item)
  let story = await findStory(client, item, raw.id)
  const isNewStory = !story
  if (!story) {
    const id = crypto.randomUUID()
    const slugStem = learningClusterKey(item).replace(/[^a-z0-9\u4e00-\u9fff-]+/g, '-').slice(0, 90)
    const analysis = prepared.analysis
    await query(client, `insert into learning_radar.stories
      (id, slug, cluster_key, category, status, importance, internal_score, title_zh, summary_zh,
        why_selected_zh, ai_schema_version, occurred_at, verification_state, has_conflict)
      values ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10,$11,'pending',$12)`, [
        id, `${new Date(item.publishedAt).toISOString().slice(0, 10)}-${slugStem}-${id.slice(0, 6)}`,
        learningClusterKey(item), item.category,
        analysis?.importance || 'watch', analysis?.internalScore ?? null,
        analysis?.titleZh || item.title.slice(0, 160), analysis?.summaryZh || '', analysis?.whySelectedZh || '',
        analysis ? 'learning-v1' : null, item.publishedAt, analysis?.hasConflict === true,
      ])
    story = (await query(client, 'select * from learning_radar.stories where id = $1', [id]))[0]
  }

  const currentSources = await storySources(client, story.id)
  const isPrimary = currentSources.length === 0 || item.isOfficial
  await query(client, `insert into learning_radar.story_sources
    (story_id, raw_item_id, source_name, source_url, title, excerpt, published_at, is_primary,
      origin_verified_at, source_domain, registrable_domain, is_official, discovered_via, verification_state)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    on conflict (story_id, raw_item_id) do update set
      source_name = excluded.source_name,
      source_url = excluded.source_url,
      title = excluded.title,
      excerpt = excluded.excerpt,
      published_at = excluded.published_at,
      is_primary = learning_radar.story_sources.is_primary or excluded.is_primary,
      origin_verified_at = excluded.origin_verified_at,
      source_domain = excluded.source_domain,
      registrable_domain = excluded.registrable_domain,
      is_official = excluded.is_official,
      discovered_via = excluded.discovered_via,
      verification_state = excluded.verification_state`, [
        story.id, raw.id, item.sourceName, item.sourceUrl, item.title, item.excerpt, item.publishedAt,
        isPrimary, item.originVerifiedAt, item.sourceDomain, item.registrableDomain, item.isOfficial,
        item.discoveredVia, item.verificationState,
      ])

  const sources = await storySources(client, story.id)
  const deterministicConflict = detectLearningSourceConflicts(sources)
  const newEvidence = [...deterministicConflict.evidence]
  if (prepared.analysis?.hasConflict === true) {
    newEvidence.push({ kind: 'ai_reported_conflict', sourceUrl: item.sourceUrl })
  }
  const existingEvidence = Array.isArray(story.conflict_evidence) ? story.conflict_evidence : []
  const conflictEvidence = [...new Map([...existingEvidence, ...newEvidence]
    .map(evidence => [JSON.stringify(evidence), evidence])).values()].slice(0, 50)
  const conflict = story.has_conflict === true || conflictEvidence.length > 0
  const publicationAnalysis = prepared.analysis
    ? { ...prepared.analysis, hasConflict: conflict }
    : null
  const decision = decideLearningPublication({ analysis: publicationAnalysis, sources, now })
  const shouldPublish = story.status !== 'rejected'
    && (decision.publish || story.status === 'published') && !conflict
  await query(client, `update learning_radar.stories set
      status = case
        when status = 'rejected' then 'rejected'
        when status = 'published' or $2::boolean then 'published'
        else status
      end,
      importance = coalesce($3, importance),
      internal_score = coalesce($4, internal_score),
      title_zh = coalesce($5, title_zh),
      summary_zh = coalesce($6, summary_zh),
      why_selected_zh = coalesce($7, why_selected_zh),
      ai_schema_version = case when $8::boolean then 'learning-v1' else ai_schema_version end,
      publication_basis = case when $2::boolean then $9 else publication_basis end,
      verification_state = case
        when $10::boolean then 'conflict'
        when $2::boolean then 'verified'
        else verification_state
      end,
      has_conflict = has_conflict or $10::boolean,
      conflict_evidence = $12::jsonb,
      published_at = case
        when status = 'rejected' then null
        when $2::boolean then coalesce(published_at, now())
        else published_at
      end,
      occurred_at = least(occurred_at, $11::timestamptz),
      updated_at = now()
    where id = $1`, [
      story.id, decision.publish, prepared.analysis?.importance ?? null, prepared.analysis?.internalScore ?? null,
      prepared.analysis?.titleZh ?? null, prepared.analysis?.summaryZh ?? null,
      prepared.analysis?.whySelectedZh ?? null, Boolean(prepared.analysis), decision.basis, conflict, item.publishedAt,
      JSON.stringify(conflictEvidence),
    ])

  if (!isNewStory && (raw.inserted || raw.titleChanged)) {
    await query(client, `insert into learning_radar.story_updates
      (id, story_id, title_zh, body_zh, occurred_at)
      values ($1,$2,$3,$4,$5) on conflict (id) do nothing`, [
        `source-update:${story.id}:${raw.id}`,
        story.id,
        raw.titleChanged ? '来源标题已修正' : '新增交叉来源',
        item.excerpt || item.title,
        item.publishedAt,
      ])
  }
  return {
    storyId: story.id, inserted: raw.inserted,
    published: decision.publish && story.status !== 'rejected', basis: decision.basis,
    reason: decision.reason, visible: shouldPublish, conflictEvidence,
  }
}

async function recordFailedRun(client, { slotKey, source, groupKey, errorCode }) {
  await client.query('begin')
  try {
    await client.query(`insert into learning_radar.job_runs
      (id, slot_key, source, group_key, status, item_count, error_code, started_at, finished_at)
      values ($1,$2,$3,$4,'failed',0,$5,now(),now())
      on conflict (slot_key) do nothing`,
    [crypto.randomUUID(), slotKey, source, groupKey, errorCode])
    await client.query('commit')
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    throw error
  }
}

export async function persistLearningSourceBatch(client, {
  source,
  groupKey,
  slot,
  preparedItems = [],
  collectionError = null,
  now = new Date(),
}) {
  const slotKey = `learning:${source}:${groupKey}:${slot}`
  if (collectionError) {
    await recordFailedRun(client, { slotKey, source, groupKey, errorCode: collectionError })
    return { source, failed: true, error: collectionError, cursorAdvanced: false }
  }
  await client.query('begin')
  try {
    const started = await query(client, `insert into learning_radar.job_runs
      (id, slot_key, source, group_key, status, started_at)
      values ($1,$2,$3,$4,'running',now()) on conflict (slot_key) do nothing returning id`,
    [crypto.randomUUID(), slotKey, source, groupKey])
    if (!started[0]) {
      await client.query('rollback')
      return { source, skipped: true, cursorAdvanced: false }
    }
    const cursorRows = await query(client, `select cursor from learning_radar.source_cursors
      where source = $1 and group_key = $2`, [source, groupKey])
    const previousCursor = parseLearningSourceCursor(cursorRows[0]?.cursor)
    const selected = preparedItems.filter(prepared => (
      selectItemsAfterCursor([prepared.item], previousCursor).length === 1
    ))
    const partialErrors = [...new Set(selected.map(prepared => prepared.aiError).filter(Boolean))]
      .sort().slice(0, 5)
    const outcomes = []
    for (const prepared of selected) outcomes.push(await persistPreparedLearningItem(client, prepared, { now }))
    const newest = newestLearningCursor(preparedItems.map(prepared => prepared.item), previousCursor)
    if (newest) {
      await client.query(`insert into learning_radar.source_cursors (source, group_key, cursor, last_success_at)
        values ($1,$2,$3,now()) on conflict (source, group_key) do update set
          cursor = excluded.cursor, last_success_at = excluded.last_success_at, updated_at = now()`,
      [source, groupKey, encodeLearningSourceCursor(newest)])
    }
    await client.query(`update learning_radar.job_runs set
      status = 'succeeded', item_count = $2, error_code = $3, finished_at = now() where id = $1`, [
      started[0].id, selected.length, partialErrors.length ? `partial:${partialErrors.join(',')}` : null,
    ])
    await client.query('commit')
    return {
      source,
      items: selected.length,
      inserted: outcomes.filter(outcome => outcome.inserted).length,
      published: outcomes.filter(outcome => outcome.published).length,
      cursorAdvanced: Boolean(newest),
      partialErrors,
    }
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    const errorCode = error instanceof Error ? error.message.slice(0, 160) : 'persistence_failed'
    await recordFailedRun(client, { slotKey, source, groupKey, errorCode })
    return { source, failed: true, error: errorCode, cursorAdvanced: false }
  }
}
