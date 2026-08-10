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
  const rows = (await client.query(`select id, importance, title_zh, why_selected_zh, occurred_at
    from learning_radar.public_timeline_items
    where occurred_at >= $1 and occurred_at < $2
    order by case importance when 'key' then 1 when 'noteworthy' then 2 else 3 end,
      occurred_at desc limit 30`, [periodStart, periodEnd])).rows
  const result = await client.query(`insert into learning_radar.digests
    (id, kind, title, body_zh, visibility, period_start, period_end, published_at)
    values ($1,'daily',$2,$3,'public',$4,$5,now()) on conflict (id) do nothing returning id`, [
      `learning-daily-${date}`, `学习情报日报 · ${date}`,
      buildLearningDailyDigest(rows, date), periodStart, periodEnd,
    ])
  return { created: result.rows.length === 1, id: `learning-daily-${date}`, count: rows.length }
}
