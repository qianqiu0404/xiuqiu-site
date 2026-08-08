function compactEventLine(event) {
  const assets = Array.isArray(event.assets) ? event.assets.map(asset => asset.symbol).join('/') : ''
  return `- ${event.priority} · ${assets || event.market} · ${event.title_zh}\n  ${event.summary_zh}`
}

async function createDigest(sql, { id, kind, title, periodStart, periodEnd, events, outboxKind }) {
  if (!events.length) return { created: false, reason: 'no_important_events' }
  const body = events.map(compactEventLine).join('\n')
  const digestRows = await sql.query(`insert into market_radar.digests
    (id, kind, title, body_zh, visibility, period_start, period_end, published_at)
    values ($1,$2,$3,$4,'public',$5,$6,now()) on conflict (id) do nothing returning id`,
    [id, kind, title, body, periodStart, periodEnd])
  if (!digestRows[0]) return { created: false, reason: 'already_exists' }
  await sql.query(`insert into market_radar.outbox
    (id, digest_id, kind, idempotency_key, payload) values ($1,$2,$3,$4,$5::jsonb)
    on conflict (idempotency_key) do nothing`, [crypto.randomUUID(), id, outboxKind, `digest:${id}`, JSON.stringify({ digestId: id, title, body })])
  return { created: true, count: events.length }
}

async function publicEvents(sql, start, end, priorities = ['P0', 'P1', 'P2']) {
  return sql.query(`select id, market, priority, title_zh, summary_zh, assets
    from market_radar.public_events where published_at >= $1 and published_at < $2
    and priority = any($3::text[]) order by score desc, published_at desc limit 20`, [start, end, priorities])
}

export async function generateP1Batch(sql, now = new Date()) {
  const bucketEnd = new Date(Math.floor(now.getTime() / (30 * 60_000)) * 30 * 60_000)
  const bucketStart = new Date(bucketEnd.getTime() - 30 * 60_000)
  const id = `p1-${bucketStart.toISOString().slice(0, 16).replace(/[:T]/g, '-')}`
  return createDigest(sql, {
    id, kind: 'p1_batch', title: '交易雷达 · P1 事件聚合', periodStart: bucketStart, periodEnd: bucketEnd,
    events: await publicEvents(sql, bucketStart, bucketEnd, ['P1']), outboxKind: 'p1_batch',
  })
}

export async function generateDailyDigest(sql, now = new Date()) {
  const periodEnd = now
  const periodStart = new Date(now.getTime() - 24 * 60 * 60_000)
  const shanghaiDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  return createDigest(sql, {
    id: `daily-${shanghaiDate}`, kind: 'daily', title: `交易雷达早报 · ${shanghaiDate}`,
    periodStart, periodEnd, events: await publicEvents(sql, periodStart, periodEnd), outboxKind: 'daily',
  })
}

export async function generateUsPremarketDigest(sql, now = new Date()) {
  const periodStart = new Date(now.getTime() - 16 * 60 * 60_000)
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  return createDigest(sql, {
    id: `us-premarket-${date}`, kind: 'us_premarket', title: `美股盘前 45 分钟 · ${date}`,
    periodStart, periodEnd: now, events: await publicEvents(sql, periodStart, now, ['P0', 'P1']), outboxKind: 'us_premarket',
  })
}
