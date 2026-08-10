import { createServer as createHttpServer } from 'node:http'
import { createServer as createViteServer } from 'vite'
import { mapPublicEventReportRow, mapPublicEventRow } from '../src/market-radar/public-event.ts'
import { publicEventReportRow, publicEventRowV2 } from './fixtures/market-radar-public-event-row.mjs'

const args = new Map(process.argv.slice(2).map(value => value.split('=')))
const port = Number(args.get('--port') || 4176)
if (!Number.isInteger(port)) throw new Error('Usage: node scripts/market-radar-browser-fixture.mjs --port=4176')
let mode = 'live'
const modes = new Set(['live', '503', 'unconfigured', 'degraded', 'summary-503', 'summary-unconfigured', 'summary-invalid', 'invalid'])

const base = {
  ...publicEventRowV2,
  occurred_at: '2026-08-10T02:00:00.000Z',
  published_at: '2026-08-10T02:08:00.000Z',
}
const rows = [
  { ...base, id: 'fixture-p0-event', slug: 'fixture-p0-event', priority: 'P0', title_zh: '关键政策发布进入公开验证窗口',
    summary_zh: '正式来源已发布政策文本，当前只记录可核对事实。', why_it_matters_zh: '它可能影响宏观流动性预期，但市场方向必须独立验证。',
    market: 'macro', assets: [{ namespace: 'macro', symbol: 'DXY', relevance: 100 }] },
  { ...base, id: 'fixture-event-v2', slug: '2026-08-10-btc-client-release-fixture', occurred_at: '2026-08-10T04:00:00.000Z', published_at: '2026-08-10T04:08:00.000Z' },
  { ...base, id: 'fixture-p2-event', slug: 'fixture-p2-event', priority: 'P2', occurred_at: '2026-08-09T04:00:00.000Z',
    published_at: '2026-08-09T04:08:00.000Z', title_zh: '次要公开事件保留渐进披露', summary_zh: '公开来源已确认事件发生。',
    why_it_matters_zh: '保留来源和判断边界，避免把低优先级事件放大。' },
].map(mapPublicEventRow)

const mappedReport = mapPublicEventReportRow(publicEventReportRow)
if (!mappedReport) throw new Error('Production report mapper rejected committed fixture')
const details = new Map(rows.map((event, index) => [event.id, {
  ...event,
  reports: index === 0 ? [{ ...mappedReport, id: 'fixture-report-primary', isPrimary: true }] : [],
}]))

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
  if (url.pathname === '/__fixture') {
    const requested = url.searchParams.get('mode') || ''
    if (!modes.has(requested)) return json(res, 400, { mode, error: 'invalid_mode' })
    mode = requested
    return json(res, 200, { mode })
  }
  if (!url.pathname.startsWith('/api/market-radar/')) return vite.middlewares(req, res, () => undefined)
  if (mode === '503') return json(res, 503, { code: 'data_delayed', message: 'Fixture service delayed.' })
  if (mode === 'summary-503' && url.pathname === '/api/market-radar/summary') {
    return json(res, 503, { code: 'summary_delayed', message: 'Fixture summary delayed.' })
  }
  if (mode === 'summary-invalid' && url.pathname === '/api/market-radar/summary') {
    return json(res, 200, { status: 'healthy', generatedAt: '2026-02-30T08:00:00+08:00' })
  }
  if (url.pathname === '/api/market-radar/summary') return json(res, 200, {
    status: mode === 'degraded' ? 'degraded' : mode === 'unconfigured' || mode === 'summary-unconfigured' ? 'unconfigured' : 'healthy',
    generatedAt: '2026-08-11T02:10:00.000Z', latestEventAt: rows[1].occurredAt,
    freshnessMinutes: mode === 'degraded' ? 180 : 8, isDelayed: mode === 'degraded',
    eventCount24h: 3, p0Count24h: 1, p1Count24h: 1,
    sources: [{ source: 'fixture', health: mode === 'degraded' ? 'degraded' : mode === 'summary-unconfigured' ? 'unconfigured' : 'healthy', lastSuccessAt: rows[1].publishedAt }],
    message: mode === 'degraded' ? 'Fixture source is delayed.' : mode === 'summary-unconfigured' ? 'Fixture summary is unconfigured.' : null,
  })
  if (url.pathname === '/api/market-radar/events') {
    if (mode === 'unconfigured') return json(res, 200, { status: 'unconfigured', items: [], nextCursor: null, message: 'Fixture unconfigured.' })
    if (mode === 'invalid') return json(res, 200, { status: 'healthy', items: [{ ...rows[0], sourceCount: 0 }], nextCursor: null, message: null })
    return json(res, 200, { status: mode === 'degraded' ? 'degraded' : 'healthy', items: rows, nextCursor: null,
      message: mode === 'degraded' ? 'Fixture source is delayed.' : null })
  }
  const id = decodeURIComponent(url.pathname.slice('/api/market-radar/events/'.length))
  const detail = details.get(id)
  if (detail) return json(res, 200, detail)
  return json(res, 404, { code: 'event_not_found', message: 'Event not found.' })
})

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Market Radar browser fixture listening on http://127.0.0.1:${port}\n`)
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
