function shanghaiDate(now) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

function compact(value, max = 120) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

export function buildLearningDailyDigest(stories, date) {
  const counts = { key: 0, noteworthy: 0, watch: 0 }
  stories.forEach(story => { if (story.importance in counts) counts[story.importance] += 1 })
  const lines = [
    `学习情报日报 · ${date}`,
    `今日精选 ${stories.length} 条（关键 ${counts.key} / 值得关注 ${counts.noteworthy} / 观察 ${counts.watch}）`,
    '',
  ]
  if (!stories.length) lines.push('今日暂无满足来源验证和发布门的内容。')
  stories.slice(0, 3).forEach((story, index) => {
    lines.push(`${index + 1}. ${compact(story.title_zh, 100)}`, `   ${compact(story.why_selected_zh, 180)}`)
  })
  return lines.join('\n')
}

export async function generateLearningDailyDigest(client, now = new Date()) {
  const date = shanghaiDate(now)
  const periodEnd = new Date(now)
  const periodStart = new Date(periodEnd.getTime() - 24 * 60 * 60_000)
  const publication = (await client.query(`select snapshot_id from radar_system.publication_snapshots
    where radar_kind = 'learning' and origin = 'research' and publication_state = 'published'
    order by as_of desc, snapshot_id desc limit 1 for share`)).rows[0]
  if (!publication) throw new Error('learning_published_snapshot_missing')
  const rows = (await client.query(`select id, importance, title_zh, why_selected_zh, occurred_at
    from learning_radar.public_timeline_items
    where occurred_at >= $1 and occurred_at < $2 and snapshot_id = $3
    order by case importance when 'key' then 1 when 'noteworthy' then 2 else 3 end,
      occurred_at desc limit 30`, [periodStart, periodEnd, publication.snapshot_id])).rows
  const digestId = `learning-daily-${date}`
  const title = `学习情报日报 · ${date}`
  const body = buildLearningDailyDigest(rows, date)
  const result = await client.query(`insert into learning_radar.digests
    (id, kind, title, body_zh, visibility, period_start, period_end, published_at,
      origin, publication_state, snapshot_id)
    values ($1,'daily',$2,$3,'public',$4,$5,now(),'research','published',$6)
    on conflict (id) do nothing returning id`, [
      digestId, title, body, periodStart, periodEnd, publication.snapshot_id,
    ])
  const created = result.rows.length === 1
  let stored = created ? { id: digestId, title, body_zh: body } : null
  if (!stored) {
    stored = (await client.query(`select id, title, body_zh from learning_radar.digests
      where id = $1 and kind = 'daily' and visibility = 'public'
        and origin = 'research' and publication_state = 'published' and snapshot_id = $2
        and title = $3 and body_zh = $4`,
    [digestId, publication.snapshot_id, title, body])).rows[0] || null
  }
  if (!stored) throw new Error('learning_digest_metadata_conflict')

  const payload = {
    digestId: stored.id,
    date,
    title: stored.title,
    body: stored.body_zh,
    pageUrl: `/radar/${date}`,
    itemCount: rows.length,
  }
  const outbox = await client.query(`insert into learning_radar.outbox
    (id, kind, idempotency_key, payload, available_at, origin, publication_state, snapshot_id)
    values ($1,'daily',$2,$3::jsonb,now(),'research','published',$4)
    on conflict (idempotency_key) do nothing returning id`, [
      crypto.randomUUID(), `learning:daily:${date}`, JSON.stringify(payload), publication.snapshot_id,
    ])
  const outboxCreated = outbox.rows.length === 1
  if (!outboxCreated) {
    const existing = (await client.query(`select id from learning_radar.outbox
      where idempotency_key = $1 and kind = 'daily' and origin = 'research'
        and publication_state = 'published' and snapshot_id = $2
        and payload->>'digestId' = $3 and payload->>'title' = $4 and payload->>'body' = $5
        and payload->>'pageUrl' = $6 and payload->>'date' = $7`,
    [`learning:daily:${date}`, publication.snapshot_id, stored.id, stored.title, stored.body_zh, `/radar/${date}`, date])).rows[0]
    if (!existing) throw new Error('learning_outbox_metadata_conflict')
  }
  return {
    created,
    outboxCreated,
    repaired: !created && outboxCreated,
    id: digestId,
    count: rows.length,
  }
}

export async function runLearningDailyDigest(client, now = new Date()) {
  const digestSlot = `learning:digest:daily:${shanghaiDate(now)}`
  await client.query('begin')
  try {
    const started = await client.query(`insert into learning_radar.job_runs
      (id, slot_key, source, group_key, status, started_at)
      values ($1,$2,'learning_digest','daily','running',now())
      on conflict (slot_key) do nothing returning id`, [crypto.randomUUID(), digestSlot])
    const digest = await generateLearningDailyDigest(client, now)
    if (started.rows[0]) {
      await client.query(`update learning_radar.job_runs set status = 'succeeded', item_count = $2,
        finished_at = now() where id = $1`, [started.rows[0].id, digest.count])
    }
    await client.query('commit')
    return started.rows[0]
      ? digest
      : { ...digest, reason: digest.repaired ? 'repaired_missing_outbox' : 'already_exists' }
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    const errorCode = error instanceof Error ? error.message.slice(0, 160) : 'digest_failed'
    await client.query('begin')
    try {
      await client.query(`insert into learning_radar.job_runs
        (id, slot_key, source, group_key, status, error_code, started_at, finished_at)
        values ($1,$2,'learning_digest','daily','failed',$3,now(),now())
        on conflict (slot_key) do nothing`,
      [crypto.randomUUID(), digestSlot, errorCode])
      await client.query('commit')
    } catch (recordError) {
      await client.query('rollback').catch(() => undefined)
      throw recordError
    }
    return { created: false, error: errorCode }
  }
}
