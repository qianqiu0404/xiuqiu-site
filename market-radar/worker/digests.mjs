const PRIORITY_WEIGHT = { P0: 3, P1: 2, P2: 1 }
const DIRECTION_SCORE = { bullish: 1, bearish: -1, mixed: 0, neutral: 0 }
const DIRECTION_LABEL = {
  bullish: '偏多观察', bearish: '偏空观察', mixed: '多空分歧', neutral: '中性观察',
}
const HORIZON_LABEL = { intraday: '盘中', days: '天级', weeks: '周级' }
const REACTION_LABEL = {
  confirmed: '行情已确认，继续观察相对基准能否延续',
  priced_in: '价格已有消化迹象，不把消息面当作新催化追逐',
  ignored: '市场暂未确认，维持观察而非行动信号',
  contradicted: '市场反应与新闻方向相反，信号降级',
  pending: '等待 30 分钟与 4 小时相对基准反应',
}

function valueArray(value) {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  try { return JSON.parse(value) } catch { return [] }
}

function compact(value, max = 100) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

function eventAssets(event, namespaces) {
  return valueArray(event.assets)
    .filter(asset => asset && namespaces.has(String(asset.namespace)))
    .map(asset => ({
      namespace: String(asset.namespace),
      symbol: String(asset.symbol || '').toUpperCase(),
      relevance: Number(asset.relevance || 0),
    }))
    .filter(asset => asset.symbol)
}

function eventReaction(event) {
  if (event.reaction && typeof event.reaction === 'object') return event.reaction
  if (typeof event.reaction !== 'string') return null
  try { return JSON.parse(event.reaction) } catch { return null }
}

function topHorizon(counts) {
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || 'days'
}

function confidenceFor(entry) {
  const hasConfirmedReaction = entry.events.some(event => eventReaction(event)?.status === 'confirmed')
  const hasMultipleSources = entry.events.some(event => Number(event.source_count || 0) >= 2)
  if (entry.bestPriority === 'P0' && hasConfirmedReaction && hasMultipleSources) return '高'
  if (entry.bestPriority === 'P0' || entry.bestPriority === 'P1' || hasConfirmedReaction) return '中'
  return '低'
}

function directionFor(entry) {
  if (entry.bullishWeight > 0 && entry.bearishWeight > 0) return 'mixed'
  if (entry.directionScore > 0.35) return 'bullish'
  if (entry.directionScore < -0.35) return 'bearish'
  return entry.hasMixed ? 'mixed' : 'neutral'
}

function invalidationFor(direction, reaction) {
  if (reaction?.status === 'contradicted') return '当前已被市场反应否定，等待新证据再升级'
  if (direction === 'bullish') return '若 4 小时相对基准收益不为正，降级为中性'
  if (direction === 'bearish') return '若 4 小时相对基准收益不为负，降级为中性'
  if (direction === 'mixed') return '方向未形成共识，任一侧缺少价格确认都不升级'
  return '没有方向性催化时不外推为交易信号'
}

export function summarizeAttentionAssets(events, maxAssets = 3) {
  const groups = new Map()
  const tradableNamespaces = new Set(['crypto', 'us_equity'])
  for (const event of events) {
    const priorityWeight = PRIORITY_WEIGHT[event.priority] || 0
    const direction = DIRECTION_SCORE[event.news_direction] ?? 0
    for (const asset of eventAssets(event, tradableNamespaces)) {
      const key = `${asset.namespace}:${asset.symbol}`
      const weight = priorityWeight + Math.max(0, Math.min(1, asset.relevance / 100))
      const entry = groups.get(key) || {
        namespace: asset.namespace, symbol: asset.symbol, attentionScore: 0, directionScore: 0,
        bullishWeight: 0, bearishWeight: 0, hasMixed: false, bestPriority: 'P2', horizons: new Map(), events: [],
      }
      entry.attentionScore += weight
      entry.directionScore += direction * weight
      if (direction > 0) entry.bullishWeight += weight
      if (direction < 0) entry.bearishWeight += weight
      if (event.news_direction === 'mixed') entry.hasMixed = true
      if ((PRIORITY_WEIGHT[event.priority] || 0) > (PRIORITY_WEIGHT[entry.bestPriority] || 0)) entry.bestPriority = event.priority
      entry.horizons.set(event.horizon, (entry.horizons.get(event.horizon) || 0) + weight)
      entry.events.push(event)
      groups.set(key, entry)
    }
  }

  return [...groups.values()]
    .map(entry => {
      entry.events.sort((left, right) => (Number(right.score) || 0) - (Number(left.score) || 0))
      const direction = directionFor(entry)
      const lead = entry.events[0]
      const reaction = eventReaction(lead)
      return {
        symbol: entry.symbol,
        namespace: entry.namespace,
        direction,
        directionLabel: DIRECTION_LABEL[direction],
        horizon: topHorizon(entry.horizons),
        confidence: confidenceFor(entry),
        priority: entry.bestPriority,
        attentionScore: entry.attentionScore,
        driver: compact(lead?.title_zh, 92),
        confirmation: REACTION_LABEL[reaction?.status] || REACTION_LABEL.pending,
        invalidation: invalidationFor(direction, reaction),
      }
    })
    .filter(asset => asset.priority === 'P0' || asset.priority === 'P1' || asset.direction !== 'neutral')
    .sort((left, right) => right.attentionScore - left.attentionScore)
    .slice(0, maxAssets)
}

function marketTone(attention) {
  if (!attention.length) return '暂无可执行方向'
  const directions = new Set(attention.map(asset => asset.direction))
  if (directions.size > 1 || directions.has('mixed')) return '分化，逐资产确认'
  return attention[0].directionLabel
}

function compactEventLine(event) {
  const assets = eventAssets(event, new Set(['crypto', 'us_equity', 'macro'])).map(asset => asset.symbol).join('/')
  const direction = DIRECTION_LABEL[event.news_direction] || DIRECTION_LABEL.neutral
  return `- ${event.priority} · ${assets || event.market} · ${direction} · ${compact(event.title_zh, 88)}`
}

export function buildDigestBody(events) {
  const attention = summarizeAttentionAssets(events)
  const counts = { P0: 0, P1: 0, P2: 0 }
  for (const event of events) if (event.priority in counts) counts[event.priority] += 1
  const lines = [
    '【结论先行】',
    `- 有效事件：${events.length}（P0 ${counts.P0} / P1 ${counts.P1} / P2 ${counts.P2}）`,
    `- 市场基调：${marketTone(attention)}`,
    `- 特别关注：${attention.length ? attention.map(asset => asset.symbol).join('、') : '暂无；不为凑结论而强行指定资产'}`,
    '',
    '【特别关注资产】',
  ]

  if (!attention.length) {
    lines.push('- 暂无达到方向与重要性门槛的资产。继续等待新催化和价格确认。')
  } else {
    attention.forEach((asset, index) => {
      lines.push(
        `${index + 1}. ${asset.symbol} · ${asset.directionLabel} · ${HORIZON_LABEL[asset.horizon] || asset.horizon} · 置信度${asset.confidence}`,
        `   驱动：${asset.driver}`,
        `   确认：${asset.confirmation}`,
        `   失效：${asset.invalidation}`,
      )
    })
  }

  const keyEvents = [...events]
    .sort((left, right) => (PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority]) || (Number(right.score) - Number(left.score)))
    .slice(0, 5)
  lines.push('', '【关键事件】', ...keyEvents.map(compactEventLine))
  lines.push('', '【边界】', '- 新闻方向不等于交易指令；没有行情确认时只观察，不接账户、不自动下单。')
  return { body: lines.join('\n'), attentionAssets: attention.map(asset => asset.symbol) }
}

async function createDigest(sql, { id, kind, title, periodStart, periodEnd, events, outboxKind }) {
  if (!events.length) return { created: false, reason: 'no_important_events' }
  const { body, attentionAssets } = buildDigestBody(events)
  const digestRows = await sql.query(`insert into market_radar.digests
    (id, kind, title, body_zh, visibility, period_start, period_end, published_at)
    values ($1,$2,$3,$4,'public',$5,$6,now()) on conflict (id) do nothing returning id`,
    [id, kind, title, body, periodStart, periodEnd])
  if (!digestRows[0]) return { created: false, reason: 'already_exists' }
  await sql.query(`insert into market_radar.outbox
    (id, digest_id, kind, idempotency_key, payload) values ($1,$2,$3,$4,$5::jsonb)
    on conflict (idempotency_key) do nothing`, [crypto.randomUUID(), id, outboxKind, `digest:${id}`, JSON.stringify({ digestId: id, title, body })])
  return { created: true, count: events.length, attentionAssets }
}

async function publicEvents(sql, start, end, priorities = ['P0', 'P1', 'P2']) {
  return sql.query(`select id, market, priority, score, title_zh, summary_zh, system_judgment,
      news_direction, horizon, source_count, assets, reaction, occurred_at
    from market_radar.public_events where occurred_at >= $1 and occurred_at < $2
    and priority = any($3::text[]) order by score desc, occurred_at desc limit 20`, [start, end, priorities])
}

export async function generateP1Batch(sql, now = new Date()) {
  const bucketEnd = new Date(Math.floor(now.getTime() / (30 * 60_000)) * 30 * 60_000)
  const bucketStart = new Date(bucketEnd.getTime() - 30 * 60_000)
  const id = `p1-v2-${bucketStart.toISOString().slice(0, 16).replace(/[:T]/g, '-')}`
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
    id: `daily-v2-${shanghaiDate}`, kind: 'daily', title: `交易雷达早报 · ${shanghaiDate}`,
    periodStart, periodEnd, events: await publicEvents(sql, periodStart, periodEnd), outboxKind: 'daily',
  })
}

export async function generateUsPremarketDigest(sql, now = new Date()) {
  const periodStart = new Date(now.getTime() - 16 * 60 * 60_000)
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  return createDigest(sql, {
    id: `us-premarket-v2-${date}`, kind: 'us_premarket', title: `美股盘前 45 分钟 · ${date}`,
    periodStart, periodEnd: now, events: await publicEvents(sql, periodStart, now, ['P0', 'P1']), outboxKind: 'us_premarket',
  })
}
