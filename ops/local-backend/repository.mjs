function iso(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function json(value, fallback) {
  if (value && typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return fallback }
}

function mapEvent(row) {
  return {
    id: String(row.id || ''), slug: String(row.slug || ''), market: String(row.market || ''),
    priority: String(row.priority || ''), titleZh: String(row.title_zh || ''), summaryZh: String(row.summary_zh || ''),
    whyItMattersZh: String(row.why_it_matters_zh || ''), watchFor: row.watch_for || null,
    invalidation: row.invalidation || null, eventType: String(row.event_type || ''),
    newsDirection: String(row.news_direction || ''), systemJudgment: String(row.system_judgment || ''),
    horizon: String(row.horizon || ''), occurredAt: iso(row.occurred_at), publishedAt: iso(row.published_at),
    sourceCount: Number(row.source_count || 0), sources: json(row.sources, []), assets: json(row.assets, []),
    reaction: json(row.reaction, null), snapshotId: String(row.snapshot_id || ''), snapshotAsOf: iso(row.snapshot_as_of),
  }
}

function mapStory(row) {
  return {
    id: String(row.id || ''), slug: String(row.slug || ''), category: String(row.category || ''),
    importance: String(row.importance || ''), titleZh: String(row.title_zh || ''), summaryZh: String(row.summary_zh || ''),
    whySelectedZh: String(row.why_selected_zh || ''), occurredAt: iso(row.occurred_at), publishedAt: iso(row.published_at),
    sourceCount: Number(row.source_count || 0), primarySource: json(row.primary_source, null),
  }
}

function integer(value, fallback, min, max) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

function cursor(value) {
  if (!value || !value.includes('|')) return null
  const [date, ...rest] = value.split('|')
  return Number.isNaN(Date.parse(date)) || !rest.join('|') ? null : [new Date(date).toISOString(), rest.join('|').slice(0, 160)]
}

export function createPublicRepository(query) {
  async function publication() {
    const rows = await query(`select snapshot_id, as_of from radar_system.publication_snapshots
      where radar_kind = 'market' and origin = 'research' and publication_state = 'published'
      order by as_of desc, snapshot_id desc limit 1`, [])
    return rows[0] ? { snapshotId: String(rows[0].snapshot_id), asOf: iso(rows[0].as_of) } : null
  }
  async function learningPublication() {
    const rows = await query(`select snapshot_id,as_of from radar_system.publication_snapshots where radar_kind='learning'
      and origin='research' and publication_state='published' order by as_of desc,snapshot_id desc limit 1`,[])
    return rows[0] ? { snapshotId:String(rows[0].snapshot_id),asOf:iso(rows[0].as_of) } : null
  }
  return {
    async marketSummary() {
      const published = await publication()
      const rows = await query(`select max(occurred_at) latest_event_at,
        count(*) filter (where occurred_at >= now() - interval '24 hours') event_count_24h,
        count(*) filter (where occurred_at >= now() - interval '24 hours' and priority='P0') p0_count_24h,
        count(*) filter (where occurred_at >= now() - interval '24 hours' and priority='P1') p1_count_24h
        from market_radar.public_events where snapshot_id=$1`, [published?.snapshotId || ''])
      const row = rows[0] || {}
      const latestEventAt=iso(row.latest_event_at)
      const freshnessMinutes=latestEventAt?Math.max(0,Math.round((Date.now()-new Date(latestEventAt).getTime())/60_000)):null
      const isDelayed=!published||freshnessMinutes===null||freshnessMinutes>90
      return { status: published&&!isDelayed ? 'healthy' : 'degraded', snapshotId: published?.snapshotId || null, asOf: published?.asOf || null,
        generatedAt: new Date().toISOString(), latestEventAt, freshnessMinutes,
        isDelayed, eventCount24h: Number(row.event_count_24h || 0), p0Count24h: Number(row.p0_count_24h || 0),
        p1Count24h: Number(row.p1_count_24h || 0), sources: [], message: !published ? '当前没有通过发布门禁的交易快照。' : isDelayed ? '交易雷达超过 90 分钟没有新的公开事件，请把当前内容视为延迟数据。' : undefined }
    },
    async marketEvents(url) {
      const published = await publication()
      if (!published) return { status: 'degraded', snapshotId: null, asOf: null, items: [], nextCursor: null }
      const limit = integer(url.searchParams.get('limit'), 20, 1, 50)
      const hours = integer(url.searchParams.get('window'), 24, 1, 168)
      const values = [published.snapshotId, hours]
      const where = [`snapshot_id=$1`, `occurred_at >= now() - ($2::text || ' hours')::interval`]
      for (const [key, column, allowed] of [['market','market',['crypto','us_equity','macro']], ['priority','priority',['P0','P1','P2']]]) {
        const value = url.searchParams.get(key)
        if (value && allowed.includes(value)) { values.push(value); where.push(`${column}=$${values.length}`) }
      }
      const parsedCursor = cursor(url.searchParams.get('cursor'))
      if (parsedCursor) { values.push(...parsedCursor); where.push(`(occurred_at,id)<($${values.length - 1}::timestamptz,$${values.length})`) }
      values.push(limit + 1)
      const rows = await query(`select * from market_radar.public_events where ${where.join(' and ')} order by occurred_at desc,id desc limit $${values.length}`, values)
      const selected = rows.slice(0, limit)
      const last = selected.at(-1)
      return { status: 'healthy', ...published, items: selected.map(mapEvent), nextCursor: rows.length > limit && last ? `${iso(last.occurred_at)}|${last.id}` : null }
    },
    async marketEvent(id) {
      const published = await publication()
      if (!published) return null
      const rows = await query('select * from market_radar.public_events where (id=$1 or slug=$1) and snapshot_id=$2 limit 1', [id, published.snapshotId])
      if (!rows[0]) return null
      const reports = await query('select * from market_radar.public_event_reports where event_id=$1 order by published_at desc nulls last,id desc', [rows[0].id])
      return { ...mapEvent(rows[0]), reports: reports.map(row => ({ id: String(row.id), sourceName: String(row.source_name), sourceUrl: String(row.source_url), title: String(row.title), excerpt: row.excerpt || null, publishedAt: iso(row.published_at), isPrimary: row.is_primary === true })) }
    },
    async marketDigests(url) {
      const published = await publication()
      if (!published) return { status: 'degraded', snapshotId: null, asOf: null, items: [] }
      const rows = await query('select * from market_radar.public_digests where snapshot_id=$1 order by published_at desc limit $2', [published.snapshotId, integer(url.searchParams.get('limit'), 7, 1, 30)])
      return { status: 'healthy', ...published, items: rows.map(row => ({ id: String(row.id), kind: row.kind, title: row.title, bodyZh: row.body_zh, periodStart: iso(row.period_start), periodEnd: iso(row.period_end), publishedAt: iso(row.published_at), snapshotId: row.snapshot_id, snapshotAsOf: iso(row.snapshot_as_of) })) }
    },
    async learningSummary() {
      const published=await learningPublication()
      const rows = await query(`select max(published_at) latest_story_at, count(*) filter (where occurred_at >= date_trunc('day',now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai') today_count from learning_radar.public_timeline_items where snapshot_id=$1`, [published?.snapshotId||''])
      const row = rows[0] || {}
      const latestStoryAt=iso(row.latest_story_at);const freshnessMinutes=latestStoryAt?Math.max(0,Math.round((Date.now()-new Date(latestStoryAt).getTime())/60_000)):null;const isDelayed=!published||freshnessMinutes===null||freshnessMinutes>120
      return { status: published&&!isDelayed?'healthy':'degraded', generatedAt: new Date().toISOString(), latestStoryAt, freshnessMinutes, isDelayed, todayCount: Number(row.today_count || 0), keyCount: 0, noteworthyCount: 0, sources: [],message:isDelayed?'学习雷达超过两小时未成功更新，请把当前内容视为延迟数据。':undefined }
    },
    async learningItems(url) {
      const published=await learningPublication(); if(!published) return {status:'degraded',items:[],nextCursor:null}
      const limit = integer(url.searchParams.get('limit'), 30, 1, 50)
      const rows = await query('select * from learning_radar.public_timeline_items where snapshot_id=$1 and occurred_at >= now() - ($2::text || \' hours\')::interval order by occurred_at desc,id desc limit $3', [published.snapshotId,integer(url.searchParams.get('window'),168,1,720), limit + 1])
      const selected = rows.slice(0, limit); const last = selected.at(-1)
      return { status: 'healthy', items: selected.map(mapStory), nextCursor: rows.length > limit && last ? `${iso(last.occurred_at)}|${last.id}` : null }
    },
    async learningStory(id) {
      const rows = await query(`select item.* from learning_radar.public_timeline_items item
        join radar_system.publication_snapshots publication on publication.snapshot_id=item.snapshot_id
        where (item.id=$1 or item.slug=$1) and publication.radar_kind='learning' and publication.origin='research'
          and publication.publication_state='published' order by publication.as_of desc limit 1`, [id])
      if (!rows[0]) return null
      const reports = await query('select * from learning_radar.public_story_reports where story_id=$1 order by published_at desc,id desc', [rows[0].id])
      const updates = await query('select * from learning_radar.public_story_updates where story_id=$1 order by occurred_at desc,id desc', [rows[0].id])
      return { ...mapStory(rows[0]), reports: reports.map(row => ({ id:String(row.id),sourceName:String(row.source_name),sourceUrl:String(row.source_url),title:String(row.title),excerpt:row.excerpt||null,publishedAt:iso(row.published_at),isPrimary:row.is_primary===true })), updates: updates.map(row => ({ id:String(row.id),titleZh:String(row.title_zh),bodyZh:String(row.body_zh),occurredAt:iso(row.occurred_at) })) }
    },
    async learningDigests(url) {
      const published=await learningPublication(); if(!published) return {status:'degraded',items:[]}
      const rows = await query('select * from learning_radar.public_digests where snapshot_id=$1 order by published_at desc limit $2',[published.snapshotId,integer(url.searchParams.get('limit'),7,1,30)])
      return { status:'healthy',items:rows.map(row=>({id:String(row.id),kind:row.kind,title:row.title,bodyZh:row.body_zh,periodStart:iso(row.period_start),periodEnd:iso(row.period_end),publishedAt:iso(row.published_at)})) }
    },
  }
}

export function createOutboxRepository(query) {
  return {
    async claim(kind, body) {
      const allowed = kind === 'market' ? ['p0','p1_batch','daily','us_premarket'] : ['daily']
      const kinds = Array.isArray(body.kinds) ? [...new Set(body.kinds)] : allowed
      if (!kinds.length || kinds.some(value => !allowed.includes(value))) throw Object.assign(new Error('invalid_kinds'), { status: 400 })
      const schema = kind === 'market' ? 'market_radar' : 'learning_radar'; const token = crypto.randomUUID()
      const ordering = kind === 'market' ? "case kind when 'p0' then 0 when 'p1_batch' then 1 else 2 end,created_at" : 'created_at'
      const rows = await query(`with candidate as (select id from ${schema}.outbox where ((status='pending' and available_at<=now()) or (status='leased' and lease_until<=now())) and kind=any($3::text[]) and kind<>'test' and origin='research' and publication_state='published' and snapshot_id is not null
        and exists(select 1 from radar_system.publication_snapshots publication where publication.snapshot_id=${schema}.outbox.snapshot_id and publication.radar_kind=$4 and publication.origin='research' and publication.publication_state='published')
        and payload::text !~* '(\\[preview[[:space:]]+pr|preview[[:space:]]*qa|test[[:space:]]*fixture|测试夹具|验收夹具)'
        order by ${ordering} for update skip locked limit 1) update ${schema}.outbox o set status='leased',lease_token=$1,lease_until=now()+($2::text||' seconds')::interval,updated_at=now() from candidate where o.id=candidate.id returning o.*`, [token, Math.min(300,Math.max(30,Number(body.leaseSeconds)||90)), kinds, kind])
      const row=rows[0]; return { item: row ? {id:row.id,kind:row.kind,channel:row.channel,idempotencyKey:row.idempotency_key,payload:row.payload,attempts:row.attempts,availableAt:row.available_at,leaseToken:row.lease_token,leaseUntil:row.lease_until} : null }
    },
    async ack(kind, body) {
      const id=typeof body.id==='string'?body.id.slice(0,160):''; const token=typeof body.leaseToken==='string'?body.leaseToken.slice(0,160):''
      const success=body.success===true; const provider=typeof body.providerMessageId==='string'?body.providerMessageId.slice(0,200):null; const error=typeof body.errorCode==='string'?body.errorCode.slice(0,120):null
      if(!id||!token||(success&&!provider)||(!success&&!error)) throw Object.assign(new Error('invalid_ack'),{status:400})
      const schema=kind==='market'?'market_radar':'learning_radar'
      const rows=await query(`with updated as (
        update ${schema}.outbox set attempts=attempts+1,status=case when $3 then 'sent' when attempts+1>=5 then 'dead_letter' else 'pending' end,sent_at=case when $3 then now() else sent_at end,available_at=case when $3 or attempts+1>=5 then available_at else now()+(power(2,attempts+1)::text||' minutes')::interval end,last_error=case when $3 then null else $4 end,last_error_message=case when $3 then null else $5 end,lease_token=null,lease_until=null,updated_at=now() where id=$1 and lease_token=$2 and status='leased' returning id,idempotency_key,attempts,status
      ), logged as (
        insert into ${schema}.delivery_logs (id,outbox_id,idempotency_key,attempt,status,provider_message_id,error_code,error_message)
        select $6,id,idempotency_key,attempts,case when $3 then 'sent' else 'failed' end,$7,$4,$5 from updated returning outbox_id
      ) select updated.* from updated join logged on logged.outbox_id=updated.id`,[id,token,success,error,typeof body.errorMessage==='string'?body.errorMessage.slice(0,500):null,crypto.randomUUID(),provider])
      if(!rows[0]) throw Object.assign(new Error('lease_mismatch'),{status:409}); return rows[0]
    },
  }
}
