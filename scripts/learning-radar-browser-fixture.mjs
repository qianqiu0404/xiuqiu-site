import { createServer as createHttpServer } from 'node:http'
import { createServer as createViteServer } from 'vite'
import {
  mapPublicStoryReportRow,
  mapPublicStoryUpdateRow,
  mapPublicTimelineItemRow,
} from '../src/learning-radar/public-story.ts'
import {
  publicLearningReportRow,
  publicLearningTimelineRow,
  publicLearningUpdateRow,
} from './fixtures/learning-radar-public-story-row.mjs'

const args = new Map(process.argv.slice(2).map(value => value.split('=')))
const mode = args.get('--mode') || 'live'
const port = Number(args.get('--port') || 4175)
if (!['live', '503', 'unconfigured', 'degraded', 'summary-503'].includes(mode) || !Number.isInteger(port)) {
  throw new Error('Usage: node scripts/learning-radar-browser-fixture.mjs --mode=live|503|unconfigured|degraded|summary-503 --port=4175')
}

const baseRow = { ...publicLearningTimelineRow, importance: 'key', occurred_at: '2026-08-10T01:00:00.000Z' }
const rows = [
  baseRow,
  { ...baseRow, id: 'learning-story-2', slug: 'wallet-intent-boundary', category: 'web3_wallet', importance: 'noteworthy',
    title_zh: '钱包签名前先绑定链与调用意图', summary_zh: '链、合约与调用选择器必须共同进入确认边界。',
    why_selected_zh: '这直接影响钱包签名确认与策略审计。', occurred_at: '2026-08-10T03:00:00.000Z' },
  { ...baseRow, id: 'learning-story-4', slug: 'ai-evaluation-boundary', category: 'ai', importance: 'key',
    title_zh: '把专家纠错沉淀成可回归的评测', summary_zh: '接受、拒绝与改写原因应进入结构化评测，而不是只保留最终答案。',
    why_selected_zh: '它能把一次人工判断转成可复验的工程约束。', occurred_at: '2026-08-10T10:00:00.000Z' },
  { ...baseRow, id: 'learning-story-3', slug: 'future-tool-release', category: 'engineering_tools', importance: 'watch',
    title_zh: '工程工具发布窗口等待确认', summary_zh: '该事项尚未发生，因此单列在未来时间线。',
    why_selected_zh: '保留已确认的未来发布时间，不把它计入今日已发生内容。', occurred_at: '2099-08-12T03:00:00.000Z' },
].map(mapPublicTimelineItemRow)

const report = mapPublicStoryReportRow(publicLearningReportRow)
const update = mapPublicStoryUpdateRow(publicLearningUpdateRow)
if (!report || !update) throw new Error('Production fixture mapper rejected committed public rows')
const stories = rows.map((item, index) => ({
  ...item,
  reports: index === 0 ? [report] : [],
  updates: index === 0 ? [update] : [],
}))

function json(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

const hmrPort = port + 20_000
const vite = await createViteServer({ server: { middlewareMode: true, hmr: { port: hmrPort, clientPort: hmrPort } }, appType: 'spa' })
const server = createHttpServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
  if (!url.pathname.startsWith('/api/learning-radar/')) return vite.middlewares(req, res, () => undefined)
  if (mode === '503') return json(res, 503, { code: 'data_delayed', message: 'Fixture service delayed.' })
  if (mode === 'summary-503' && url.pathname === '/api/learning-radar/summary') {
    return json(res, 503, { code: 'summary_delayed', message: 'Fixture summary delayed.' })
  }
  if (url.pathname === '/api/learning-radar/summary') return json(res, 200, {
    status: mode === 'degraded' ? 'degraded' : mode === 'unconfigured' ? 'unconfigured' : 'healthy',
    generatedAt: '2026-08-11T08:30:00.000Z', latestStoryAt: rows[0].publishedAt,
    freshnessMinutes: mode === 'degraded' ? 180 : 10, isDelayed: mode === 'degraded',
    todayCount: 0, keyCount: 1, noteworthyCount: 1,
    sources: [{ source: 'fixture', health: mode === 'degraded' ? 'degraded' : 'healthy', lastSuccessAt: rows[0].publishedAt }],
    message: mode === 'degraded' ? 'Fixture source is delayed.' : undefined,
  })
  if (url.pathname === '/api/learning-radar/items') {
    if (mode === 'unconfigured') return json(res, 200, { status: 'unconfigured', items: [], nextCursor: null, message: 'Fixture unconfigured.' })
    const category = url.searchParams.get('category')
    const selected = category ? rows.filter(item => item.category === category) : rows
    return json(res, 200, { status: mode === 'degraded' ? 'degraded' : 'healthy', items: selected, nextCursor: null,
      message: mode === 'degraded' ? 'Fixture source is delayed.' : undefined })
  }
  const storySlug = decodeURIComponent(url.pathname.slice('/api/learning-radar/stories/'.length))
  if (storySlug === 'slow-story') {
    return setTimeout(() => json(res, 200, { ...stories[0], slug: storySlug, titleZh: '不应覆写离开后的 SEO' }), 800)
  }
  const story = stories.find(item => storySlug === item.slug || storySlug === item.id)
  if (story) return json(res, 200, story)
  return json(res, 404, { code: 'story_not_found', message: 'Story not found.' })
})

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Learning Radar browser fixture (${mode}) listening on http://127.0.0.1:${port}\n`)
})

function close() {
  server.closeAllConnections?.()
  server.close()
  const forceExit = setTimeout(() => process.exit(0), 500)
  void vite.close().finally(() => {
    clearTimeout(forceExit)
    process.exit(0)
  })
}
process.on('SIGINT', close)
process.on('SIGTERM', close)
