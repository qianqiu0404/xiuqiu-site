const PRIORITY_WEIGHT = { P0: 3, P1: 2, P2: 1 }

function compact(value, max = 132) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

export function shanghaiDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

export function buildLearningDailyNotification(radar) {
  const ordered = [
    radar.marketSignals?.[0], radar.aiTip, radar.web3Design, radar.vibeProject, radar.readingPick,
    ...(radar.marketSignals || []).slice(1),
  ].filter(Boolean)
  const seen = new Set()
  const highlights = ordered.filter(item => {
    const key = String(item.title || '')
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 3)
  const itemCount = (radar.marketSignals || []).length
    + [radar.aiTip, radar.web3Design, radar.vibeProject, radar.readingPick].filter(Boolean).length
  const lines = ['【今日先看】']
  if (!highlights.length) {
    lines.push('- 今日没有通过来源与隐私门禁的新条目。')
  } else {
    highlights.forEach((item, index) => {
      lines.push(`${index + 1}. ${compact(item.title, 88)}`, `   关键：${compact(item.summary)}`)
    })
  }
  lines.push('', `完整雷达共 ${itemCount} 项；微信只展示前三项，详细来源与边界请打开网页。`)
  return {
    kind: 'daily',
    idempotencyKey: `learning:daily:${radar.date}`,
    payload: {
      date: radar.date,
      title: `学习雷达早报 · ${radar.date}`,
      body: lines.join('\n'),
      pageUrl: `/radar/${radar.date}`,
      itemCount,
    },
  }
}

export function buildMarketDailyNotification(radar) {
  const events = [...(radar.events || [])]
    .sort((left, right) => (PRIORITY_WEIGHT[right.priority] || 0) - (PRIORITY_WEIGHT[left.priority] || 0))
    .slice(0, 3)
  const lines = ['【结论先行】']
  if (!events.length) {
    lines.push('- 今日暂无达到公开门槛的重要事件。系统正常运行，不为凑数强行指定方向。')
  } else {
    lines.push(`- 公开快照共 ${radar.events.length} 项，微信展示优先级最高的前三项。`, '', '【重点观察】')
    events.forEach((event, index) => {
      lines.push(
        `${index + 1}. ${event.priority} · ${compact(event.title, 88)}`,
        `   关注：${compact(event.whyWatch)}`,
      )
    })
  }
  lines.push('', '【边界】', '- 公开事实与系统观察分开；不接账户、不自动下单。')
  return {
    kind: 'daily',
    idempotencyKey: `market:daily:${radar.date}`,
    payload: {
      date: radar.date,
      title: `交易雷达早报 · ${radar.date}`,
      body: lines.join('\n'),
      pageUrl: `/market-radar/${radar.date}`,
      eventCount: radar.events?.length || 0,
    },
  }
}
