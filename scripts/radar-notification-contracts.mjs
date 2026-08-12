import { buildMarketResearchPack } from './market-radar-contracts.mjs'

const PRIORITY_WEIGHT = { P0: 3, P1: 2, P2: 1 }
const MARKET_DAILY_BODY_LIMIT = 1800
const MARKET_QUANT_BODY_LIMIT = 1600
const MARKET_SITE_URL = 'https://xiuqiu-site.vercel.app'
const MARKET_FOOTER = '仅供研究，不构成投资建议。'

function compact(value, max = 132) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

function publicationMetadata(radar) {
  const snapshot = typeof radar?.snapshotId === 'string'
    ? radar.snapshotId.match(/^(learning|market)-(\d{4}-\d{2}-\d{2})-[0-9a-f]{16}$/)
    : null
  if (!snapshot || snapshot[2] !== radar.date) {
    throw new Error('Radar notification requires a valid snapshotId.')
  }
  if (typeof radar.asOf !== 'string' || Number.isNaN(Date.parse(radar.asOf))) throw new Error('Radar notification requires a valid asOf.')
  if (radar.origin !== 'research' || radar.publicationState !== 'published') {
    throw new Error('Radar notification requires published research content.')
  }
  return {
    snapshotId: radar.snapshotId,
    asOf: new Date(radar.asOf).toISOString(),
    origin: radar.origin,
    publicationState: radar.publicationState,
  }
}

function assertBodyLength(body, max, label) {
  if (body.length > max) throw new Error(`${label} exceeds the ${max}-character notification boundary.`)
  return body
}

export function renderMarketNotificationMessage(payload) {
  const lines = [`# ${String(payload.title || '交易雷达')}`]
  const body = String(payload.body || '').trim()
  if (body) lines.push('', body)
  const sourceUrl = String(payload.sourceUrl || '').trim()
  if (sourceUrl) lines.push('', `原始来源：${sourceUrl}`)
  const safeSources = Array.isArray(payload.sourceUrls)
    ? payload.sourceUrls.filter(value => {
        try { return new URL(String(value)).protocol === 'https:' } catch { return false }
      })
    : []
  if (safeSources.length) lines.push('', '依据来源：', ...safeSources.slice(0, 8).map(value => `- ${value}`))
  const pageUrl = new URL(String(payload.pageUrl || '/market-radar'), MARKET_SITE_URL).href
  lines.push('', `完整页面：${pageUrl}`, '', MARKET_FOOTER)
  return lines.join('\n')
}

function assertRenderedLength(payload, max, label) {
  const rendered = renderMarketNotificationMessage(payload)
  if (rendered.length > max) throw new Error(`${label} exceeds the ${max}-character final rendered notification boundary.`)
}

export function shanghaiDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

export function buildLearningDailyNotification(radar) {
  if (radar?.schemaVersion === 2) throw new Error('Learning Radar v2 notifications are disabled until M4.')
  const publication = publicationMetadata(radar)
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
      ...publication,
      date: radar.date,
      title: `学习雷达早报 · ${radar.date}`,
      body: lines.join('\n'),
      pageUrl: `/radar/${radar.date}`,
      itemCount,
    },
  }
}

export function buildMarketDailyNotification(radar) {
  const publication = publicationMetadata(radar)
  let researchPack
  const events = [...(radar.events || [])]
    .sort((left, right) => (PRIORITY_WEIGHT[right.priority] || 0) - (PRIORITY_WEIGHT[left.priority] || 0))
    .slice(0, 3)
  const lines = [radar.schemaVersion === 2 ? '【30秒结论】' : '【结论先行】']
  if (radar.schemaVersion === 2) {
    lines.push(`- ${compact(radar.summary, 220)}`)
    const quantStatus = radar.quantStrategy?.status === 'historical_samples_insufficient'
      ? '量化样本门禁关闭，不显示精确概率'
      : radar.quantStrategy ? '量化状态见下一条独立简报' : '本期无量化简报'
    lines.push(`- 证据截至 ${publication.asOf}；${quantStatus}。`)
  }
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
  if (radar.schemaVersion === 2) {
    researchPack = buildMarketResearchPack(radar, publication)
    lines.push('', '【继续问强模型】')
    researchPack.questions.forEach(question => lines.push(`${question.id}. ${compact(question.shortQuestion, 180)}`))
    lines.push('', '回复“深挖1/2/3”获取可复制研究提示词。')
  }
  lines.push('', '【边界】', '- 公开事实与系统观察分开；不接账户、不自动下单。')
  const body = assertBodyLength(lines.join('\n'), MARKET_DAILY_BODY_LIMIT, 'Market daily body')
  const quant = radar.quantStrategy ? buildMarketQuantNotification(radar) : null
  const payload = {
    ...publication,
    date: radar.date,
    title: `交易雷达早报 · ${radar.date}`,
    body,
    pageUrl: `/market-radar/${radar.date}`,
    eventCount: radar.events?.length || 0,
    researchPackManifest: researchPack ? {
      schemaVersion: researchPack.schemaVersion,
      date: researchPack.date,
      snapshotId: researchPack.snapshotId,
      asOf: researchPack.asOf,
      pageUrl: researchPack.pageUrl,
      questions: researchPack.questions.map(question => ({
        id: question.id,
        promptChecksum: question.promptChecksum,
      })),
    } : null,
    followUp: quant ? {
      kind: quant.kind,
      idempotencyKey: quant.idempotencyKey,
      ...quant.payload,
    } : null,
  }
  assertRenderedLength(payload, MARKET_DAILY_BODY_LIMIT, 'Market daily message')
  return {
    kind: 'daily',
    idempotencyKey: `market:daily:${radar.date}`,
    payload,
  }
}

export function buildMarketQuantNotification(radar) {
  const publication = publicationMetadata(radar)
  const strategy = radar.quantStrategy
  if (!strategy) throw new Error(`Market radar ${radar.date} has no quantStrategy.`)
  const bySymbol = new Map(strategy.assets.map(asset => [asset.symbol, asset]))
  const formatAsset = symbol => {
    const asset = bySymbol.get(symbol)
    if (!asset) throw new Error(`Market quant strategy is missing ${symbol}.`)
    if (strategy.status === 'historical_samples_insufficient') {
      const quality = { strong: '强', medium: '中', weak: '弱' }[asset.signalQuality] || '弱'
      return `• ${symbol}：信号质量 ${quality}｜历史样本不足｜不显示精确概率`
    }
    return `• ${symbol}：上涨 ${asset.up}%｜震荡 ${asset.sideways}%｜下跌 ${asset.down}%`
  }
  const lines = [
    strategy.status === 'historical_samples_insufficient'
      ? `口径：未来 ${strategy.horizonTradingDays} 个交易日的量化验证状态。${strategy.methodology}`
      : `口径：未来 ${strategy.horizonTradingDays} 个交易日，上涨／震荡／下跌情景权重。${strategy.methodology}`,
    '',
    '美股 ETF',
    formatAsset('SPY'),
    formatAsset('QQQ'),
    '',
    '币圈',
    formatAsset('BTC'),
    formatAsset('ETH'),
    '',
    '黄金 ETF',
    formatAsset('GLD'),
    '',
    `为什么这样分配：${strategy.rationale}`,
    '',
    `接下来验证：${strategy.nextValidation}`,
    '',
    `失效条件：${strategy.invalidation}`,
  ]
  const body = assertBodyLength(lines.join('\n'), MARKET_QUANT_BODY_LIMIT, 'Market quant body')
  const payload = {
    ...publication,
    date: radar.date,
    title: `${strategy.status === 'historical_samples_insufficient' ? '交易雷达量化简报' : '交易雷达概率简报'} · ${radar.date}`,
    body,
    pageUrl: `/market-radar/${radar.date}`,
    sourceUrls: [...strategy.sourceUrls].slice(0, 2),
    horizonTradingDays: strategy.horizonTradingDays,
    probabilityStatus: strategy.status,
  }
  assertRenderedLength(payload, MARKET_QUANT_BODY_LIMIT, 'Market quant message')
  return {
    kind: 'quant',
    idempotencyKey: `market:quant:${radar.date}`,
    payload,
  }
}
