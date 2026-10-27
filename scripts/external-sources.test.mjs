import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { EXTERNAL_SOURCES, buildExternalSnapshotFiles, externalFreshness, fetchBoundedJson, parseExternalSnapshot } from '../shared/externalSources.ts'
import { createExternalLoader, externalSourceNotice } from '../src/data/externalSourceStatus.ts'
import { PARSERS, exitCode, formatReport, probeAll, readProbeOptions } from './external-sources.mjs'
import { diagnose } from './external-sources-issue.mjs'

const NOW = Date.parse('2026-10-24T12:00:00Z')
const HOUR = 3_600_000
const iso = offsetHours => new Date(NOW - offsetHours * HOUR).toISOString()

const grokIndex = (updated_at = iso(1)) => ({ schema_version: 1, bot_id: 'x-ai-digest', updated_at, records: [] })
const chatgptIndex = (updated_at = iso(1)) => ({ ...grokIndex(updated_at), bot_id: 'chatgpt-daily' })
const researchIndex = (updated_at = iso(1)) => ({
  schema_version: 1, source: { name: 'shared-research', home_url: 'https://shared-research.vercel.app/', revision: 'a'.repeat(40) },
  updated_at, record_count: 0, cards: [], briefs: [],
})

function jsonResponse(body, { status = 200, type = 'application/json' } = {}) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': type } })
}
function routedFetch(routes) {
  const calls = []
  const fetcher = async (url, init) => {
    calls.push(String(url))
    const handler = routes[String(url)]
    if (!handler) return jsonResponse({}, { status: 404 })
    return handler(init)
  }
  return { fetcher, calls }
}

test('external sources stay on the rewrite paths vercel.json and Vite serve', () => {
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  for (const def of Object.values(EXTERNAL_SOURCES)) {
    const prefix = def.livePath.split('/')[1]
    const rewrite = vercel.rewrites.find(r => r.source === `/${prefix}/:path*`)
    assert.ok(rewrite, `${def.id} rewrite exists`)
    assert.equal(rewrite.destination.replace(':path*', 'index.json'), def.upstream)
    assert.ok(!def.snapshotPath.startsWith('/data/'), 'snapshots stay outside the frozen public/data contract')
  }
})

test('freshness is fresh, stale, or unknown for missing and future timestamps', () => {
  assert.deepEqual(externalFreshness(iso(2), 48, NOW), { freshness: 'fresh', ageHours: 2 })
  assert.equal(externalFreshness(iso(49), 48, NOW).freshness, 'stale')
  assert.equal(externalFreshness(null, 48, NOW).freshness, 'unknown')
  assert.equal(externalFreshness('not a date', 48, NOW).freshness, 'unknown')
  assert.equal(externalFreshness(iso(-1), 48, NOW).freshness, 'unknown')
  assert.equal(externalFreshness(iso(-0.01), 48, NOW).freshness, 'fresh', 'small clock skew is tolerated')
})

test('bounded fetch accepts GitHub raw text/plain and rejects HTML, errors and oversize bodies', async () => {
  const ok = await fetchBoundedJson('u', async () => jsonResponse(grokIndex(), { type: 'text/plain; charset=utf-8' }), 1000)
  assert.equal(ok.status, 200)
  await assert.rejects(fetchBoundedJson('u', async () => jsonResponse('<html>', { type: 'text/html' }), 1000), /不支持的类型/)
  await assert.rejects(fetchBoundedJson('u', async () => jsonResponse({}, { status: 502 }), 1000), err => err.status === 502)
  await assert.rejects(fetchBoundedJson('u', async () => jsonResponse('x'.repeat(2 * 1024 * 1024 + 1)), 1000), /响应过大/)
})

test('bounded fetch reports a timeout instead of hanging', async () => {
  const hanging = (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))))
  await assert.rejects(fetchBoundedJson('u', hanging, 20), err => /超时/.test(err.message) && err.status === null)
})

test('probe reports ok, stale and failing sources and exits non-zero only on failure', async () => {
  const { fetcher } = routedFetch({
    [EXTERNAL_SOURCES.grok.upstream]: async () => jsonResponse(grokIndex(iso(72)), { type: 'text/plain' }),
    [EXTERNAL_SOURCES.research.upstream]: async () => jsonResponse(researchIndex()),
  })
  const probes = await probeAll({ fetcher, now: () => NOW })
  assert.deepEqual(probes.map(p => [p.source, p.ok, p.freshness]), [['grok', true, 'stale'], ['research', true, 'fresh']])
  assert.equal(exitCode(probes), 0, 'stale alone is a warning')
  assert.match(formatReport(probes), /\| Grok Bot 新闻 \| STALE \| 200 \|/)

  const broken = routedFetch({ [EXTERNAL_SOURCES.grok.upstream]: async () => jsonResponse({ schema_version: 2 }) })
  const failed = await probeAll({ fetcher: broken.fetcher, now: () => NOW })
  assert.equal(failed.every(p => !p.ok), true)
  assert.equal(exitCode(failed), 1)
  assert.match(formatReport(failed), /FAIL \| 404/)
})

test('probe can go through the site rewrites with --base', async () => {
  const { fetcher, calls } = routedFetch({})
  await probeAll({ base: 'https://example.org', fetcher, now: () => NOW })
  assert.deepEqual(calls.sort(), ['https://example.org/grok-news-data/index.json', 'https://example.org/research-data/index.json'])
})

test('ChatGPT probes are explicitly selected and do not expand the scheduled two-source default', async () => {
  assert.deepEqual(readProbeOptions([]), {})
  assert.deepEqual(readProbeOptions(['--base', 'https://example.org', '--source', 'chatgpt', '--source', 'chatgpt']), { base: 'https://example.org', sources: ['chatgpt'] })
  assert.throws(() => readProbeOptions(['--source', 'missing']), /未知资料源/)
  assert.throws(() => readProbeOptions(['--source']), /未知资料源/)
  assert.throws(() => readProbeOptions(['--base']), /需要站点地址/)
  const { fetcher, calls } = routedFetch({ [EXTERNAL_SOURCES.chatgpt.upstream]: async () => jsonResponse(chatgptIndex()) })
  const probes = await probeAll({ sources: ['chatgpt'], fetcher, now: () => NOW })
  assert.deepEqual(calls, [EXTERNAL_SOURCES.chatgpt.upstream])
  assert.deepEqual(probes.map(p => [p.source, p.ok, p.records]), [['chatgpt', true, 0]])
  assert.equal(exitCode(probes), 0)
  const missing = await probeAll({ sources: ['chatgpt'], fetcher: routedFetch({}).fetcher, now: () => NOW })
  assert.deepEqual(missing.map(p => [p.source, p.ok, p.status, p.records]), [['chatgpt', false, 404, null]])
  assert.equal(exitCode(missing), 1)
})

test('health diagnosis keeps required sources fail-closed without inventing an unselected ChatGPT failure', () => {
  const ok = source => ({ source, ok: true })
  assert.deepEqual(diagnose([ok('grok'), ok('research')], [ok('grok'), ok('research')]), [])
  const missingGrok = diagnose([ok('research')], [ok('research')])
  assert.equal(missingGrok.length, 1)
  assert.match(missingGrok[0], /Grok Bot 新闻.*都失败/)
  assert.equal(diagnose([], []).length, 2)
  const optedIn = diagnose([ok('grok'), ok('research'), { source: 'chatgpt', ok: false }], [ok('grok'), ok('research'), { source: 'chatgpt', ok: false }])
  assert.equal(optedIn.length, 1)
  assert.match(optedIn[0], /ChatGPT推荐.*都失败/)
})

test('ChatGPT snapshot is opt-in and an unconnected source never emits a fabricated empty index', async () => {
  const { fetcher, calls } = routedFetch({ [EXTERNAL_SOURCES.grok.upstream]: async () => jsonResponse(grokIndex()), [EXTERNAL_SOURCES.research.upstream]: async () => jsonResponse(researchIndex()) })
  const defaults = await buildExternalSnapshotFiles(PARSERS, { fetcher, now: () => NOW })
  assert.deepEqual(defaults.map(file => file.source), ['grok', 'research'])
  assert.equal(calls.includes(EXTERNAL_SOURCES.chatgpt.upstream), false)
  const files = await buildExternalSnapshotFiles(PARSERS, { sources: ['chatgpt'], fetcher, now: () => NOW })
  assert.equal(files[0].fileName, null)
  assert.equal(files[0].json, undefined)
  assert.match(files[0].error, /HTTP 404/)
  const connected = await buildExternalSnapshotFiles(PARSERS, { sources: ['chatgpt'], fetcher: async () => jsonResponse(chatgptIndex()), now: () => NOW })
  assert.equal(connected[0].fileName, 'external-snapshots/chatgpt-news.json')
  assert.equal(parseExternalSnapshot(JSON.parse(connected[0].json), 'chatgpt', PARSERS.chatgpt).data.bot_id, 'chatgpt-daily')
})

test('an unavailable ChatGPT index and absent snapshot preserve the source error', async () => {
  const failure = new Error('ChatGPT source HTTP 404')
  const { fetcher, calls } = routedFetch({})
  const load = createExternalLoader('chatgpt', async () => { throw failure }, PARSERS.chatgpt, fetcher)
  await assert.rejects(load(), error => error === failure)
  assert.deepEqual(calls, [EXTERNAL_SOURCES.chatgpt.snapshotPath])
})

test('build snapshots wrap valid upstream data and skip a failing source without throwing', async () => {
  const { fetcher } = routedFetch({ [EXTERNAL_SOURCES.research.upstream]: async () => jsonResponse(researchIndex()) })
  const files = await buildExternalSnapshotFiles(PARSERS, { fetcher, now: () => NOW })
  const grok = files.find(f => f.source === 'grok'), research = files.find(f => f.source === 'research')
  assert.equal(grok.fileName, null)
  assert.match(grok.error, /HTTP 404/)
  assert.equal(research.fileName, 'external-snapshots/research.json')
  const parsed = parseExternalSnapshot(JSON.parse(research.json), 'research', PARSERS.research)
  assert.equal(parsed.fetched_at, new Date(NOW).toISOString())
  assert.equal(parsed.data.source.name, 'shared-research')
  assert.throws(() => parseExternalSnapshot(JSON.parse(research.json), 'grok', PARSERS.grok), /来源不匹配/)
})

test('loader prefers live data, falls back to the snapshot, and rethrows the live error when both fail', async () => {
  const snapshot = { schema_version: 1, source: 'grok', fetched_at: iso(6), data: grokIndex(iso(7)) }
  let snapshotOk = true, snapshotCalls = 0
  const fetcher = async url => {
    assert.equal(url, EXTERNAL_SOURCES.grok.snapshotPath)
    snapshotCalls++
    return snapshotOk ? jsonResponse(snapshot) : jsonResponse({}, { status: 404 })
  }
  let liveOk = true
  const live = async () => { if (!liveOk) throw new Error('live down'); return PARSERS.grok(grokIndex()) }
  const load = createExternalLoader('grok', live, PARSERS.grok, fetcher)

  assert.equal((await load()).origin, 'live')
  assert.equal(snapshotCalls, 0, 'snapshot is not fetched while live works')

  liveOk = false
  const fallback = await load()
  assert.deepEqual([fallback.origin, fallback.fetchedAt], ['snapshot', iso(6)])
  await load()
  assert.equal(snapshotCalls, 1, 'snapshot is cached once loaded')

  const fresh = createExternalLoader('grok', live, PARSERS.grok, fetcher)
  snapshotOk = false
  await assert.rejects(fresh(), /live down/)
  snapshotOk = true
  assert.equal((await fresh()).origin, 'snapshot', 'a failed snapshot read is retried later')
})

test('notices stay silent when live and current, and explain stale or snapshot data', () => {
  assert.equal(externalSourceNotice('grok', { value: { updated_at: iso(1) }, origin: 'live', fetchedAt: null }, NOW).tone, 'ok')
  assert.equal(externalSourceNotice('grok', { value: { updated_at: null }, origin: 'live', fetchedAt: null }, NOW).tone, 'ok')

  const stale = externalSourceNotice('research', { value: { updated_at: iso(96) }, origin: 'live', fetchedAt: null }, NOW)
  assert.equal(stale.tone, 'warn')
  assert.equal(stale.text, '共享研究已有 4 天没有新资料，资料源可能暂停更新。')

  const snap = externalSourceNotice('grok', { value: { updated_at: iso(7) }, origin: 'snapshot', fetchedAt: iso(6) }, NOW)
  assert.equal(snap.tone, 'warn')
  assert.equal(snap.text, 'Grok Bot 新闻实时源暂不可用，当前显示站点发布时保存的副本（6 小时前），新资料要等实时源恢复。')
})

test('build snapshots retry a failed source once and keep the network cause in the error', async () => {
  let attempts = 0
  const fetcher = async url => {
    if (url === EXTERNAL_SOURCES.grok.upstream) return jsonResponse(grokIndex())
    attempts++
    if (attempts === 1) throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } })
    return jsonResponse(researchIndex())
  }
  const files = await buildExternalSnapshotFiles(PARSERS, { fetcher, now: () => NOW })
  assert.equal(attempts, 2)
  assert.deepEqual(files.map(f => [f.source, f.error]), [['grok', null], ['research', null]])

  const down = async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } }) }
  const failed = await buildExternalSnapshotFiles(PARSERS, { fetcher: down, now: () => NOW })
  assert.deepEqual(failed.map(f => f.error), ['fetch failed (ENOTFOUND)', 'fetch failed (ENOTFOUND)'])
})

test('snapshot age under an hour does not read as zero hours', () => {
  const notice = externalSourceNotice('research', { value: { updated_at: iso(2) }, origin: 'snapshot', fetchedAt: iso(0.2) }, NOW)
  assert.match(notice.text, /（不到 1 小时前）/)
})
