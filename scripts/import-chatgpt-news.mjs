// Offline conversion only. Private Markdown and the ledger stay outside the
// repository; publishing is a separate explicit producer-aware command.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, renameSync, unlinkSync, openSync, closeSync, existsSync, lstatSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMarkdownFrontmatter } from './frontmatter.mjs'
import { CHATGPT_BOT_ID, parseNewsItem, parseNewsBatch, grokSourceUrl } from '../shared/grokNews.ts'

const digest = value => createHash('sha256').update(value).digest('hex')
const json = value => `${JSON.stringify(value, null, 2)}\n`
const fingerprint = item => digest(JSON.stringify(parseNewsItem(item, 'chatgpt')))
const MAX_INPUT_BYTES = 1024 * 1024
const PRIVATE_TEXT = /(?:你|您|\byour\b|\byou\b|\/Users\/|\/Volumes\/|[\w.+-]+@[\w.-]+\.[a-z]{2,}|chatgpt\.com\/c\/|chat\.openai\.com|mail\.google\.com)/i

function checkedDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('简报日期必须是有效YYYY-MM-DD')
  return value
}
function calendarDate(value, timeZone = 'Asia/Taipei') {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}
function recommendedTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    || !Number.isFinite(Date.parse(value))) throw new Error('推荐时间未知或缺少时区；保留原稿，不用计划时间或导入时间补造')
  checkedDate(value.slice(0, 10))
  return new Date(value).toISOString()
}
export function canonicalNewsUrl(value) {
  const url = new URL(grokSourceUrl(value))
  if (/(?:^|\.)(?:chatgpt\.com|chat\.openai\.com|mail\.google\.com)$/.test(url.hostname)) throw new Error('原始出处不能是私人对话或邮箱')
  for (const key of url.searchParams.keys()) if (/^(?:token|access_token|api_?key|auth|authorization|signature|sig|password)$/i.test(key)) throw new Error('原始出处不能携带访问凭据')
  url.hash = ''
  for (const key of [...url.searchParams.keys()]) if (/^utm_/i.test(key) || ['gclid', 'fbclid'].includes(key)) url.searchParams.delete(key)
  url.searchParams.sort()
  return url.href
}
function publicText(value) {
  const result = value.replace(/::?chatgpt-content-reference\{[^}]*\}/g, '')
    .replace(/[\s\S]*?/g, '').replace(/\*\*|__/g, '').trim()
  if (PRIVATE_TEXT.test(result) || /<\/?[a-z][^>]*>/i.test(result)) throw new Error('公开选段含个人信息、私人上下文或HTML；请先人工整理')
  return result
}
function safeItem(item) {
  for (const value of [item.title, item.summary, item.source_name, item.bot_analysis].filter(Boolean)) publicText(value)
  publicText(decodeURIComponent(item.source_url))
  return parseNewsItem(item, 'chatgpt')
}
const identityKey = (day, url) => digest(`${day}\0${url}`)
const sameContent = (left, right) => fingerprint({ ...left, revision: 1 }) === fingerprint({ ...right, revision: 1 })

export function parseChatgptMarkdown(raw, sourceName = 'ChatGPT Markdown') {
  if (Buffer.byteLength(raw) > MAX_INPUT_BYTES) throw new Error('原稿超过1MiB，未转换')
  const { meta, body } = parseMarkdownFrontmatter(raw, sourceName)
  if (meta.producer !== CHATGPT_BOT_ID) throw new Error('原稿必须明确producer: chatgpt-daily')
  if (meta.timezone != null && meta.timezone !== 'Asia/Taipei') throw new Error('原稿时区约定为Asia/Taipei；其他时区请先核对简报日期')
  const date = checkedDate(meta.edition_date), collectedAt = recommendedTime(meta.recommended_at)
  if (calendarDate(collectedAt) !== date) throw new Error('简报日期与原消息的实际推荐时间不一致')
  const headers = [...body.matchAll(/^##\s+(?:[①-⑳]|\d+[.、)])\s+(.+)\r?$/gm)]
  if (!headers.length) throw new Error('未识别新闻条目；请保留编号标题、新闻摘要和原始来源')
  if (headers.length > 50) throw new Error('每批最多50条，未转换')
  const rows = [], skipped = [], seen = new Map()
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i], section = body.slice(header.index + header[0].length, headers[i + 1]?.index ?? body.length).split(/^#\s/m)[0]
    const sourceLine = section.match(/^\*\*原始(?:来源|数据)：\*\*\s*(.+)$/m)?.[1]
    const link = sourceLine?.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/)
    if (!link) { skipped.push({ position: i + 1, reason: 'missing_original_source' }); continue }
    const summaryHeader = section.match(/^ {0,3}###[ \t]+新闻摘要[ \t]*\r?\n/m)
    const summary = summaryHeader && section.slice(summaryHeader.index + summaryHeader[0].length)
      .split(/^ {0,3}(?:#{1,6}[ \t]|image_group|\*\*原始|---[ \t]*$)/m)[0]
    if (!summary?.trim()) throw new Error(`第${i + 1}条缺少新闻摘要；不自动摘取私人推荐理由`)
    const title = header[1].includes('：') ? header[1].slice(header[1].indexOf('：') + 1) : header[1]
    const category = header[1].split('：')[0]
    const domain = /web3/i.test(category) ? 'web3' : /crypto|市场|宏观|金融/i.test(category) ? 'market' : /\bAI\b|大模型/i.test(category) ? 'ai' : 'research'
    const row = { title: publicText(title), summary: publicText(summary), source_url: canonicalNewsUrl(link[2]), source_name: publicText(link[1].split(/[:：]/)[0]), domain, section }
    const comparison = JSON.stringify({ ...row, section: undefined })
    if (seen.has(row.source_url)) {
      if (seen.get(row.source_url) !== comparison) throw new Error('同批相同原始出处存在不同内容，不能静默选取其中一条')
      skipped.push({ position: i + 1, reason: 'duplicate_original_source' }); continue
    }
    seen.set(row.source_url, comparison); rows.push(row)
  }
  return { date, collectedAt, sourceMessageId: typeof meta.message_id === 'string' ? meta.message_id : null, rows, skipped, sourceCount: headers.length }
}

function parseLedger(value) {
  if (!value || value.schema_version !== 1 || value.bot_id !== CHATGPT_BOT_ID || !value.records || typeof value.records !== 'object' || Array.isArray(value.records)) throw new Error('私有ledger格式不正确')
  const state = JSON.parse(JSON.stringify(value)), ids = new Set()
  for (const [key, row] of Object.entries(state.records)) {
    if (!Array.isArray(row.revisions) || !row.revisions.length || key !== identityKey(checkedDate(row.edition_date), canonicalNewsUrl(row.source_url))) throw new Error('ledger身份索引不一致')
    for (const [i, revision] of row.revisions.entries()) {
      const item = safeItem(revision.item)
      if (item.revision !== i + 1 || item.origin_id !== row.origin_id || item.source_url !== row.source_url || revision.fingerprint !== fingerprint(item)
        || item.collected_at !== row.revisions[0].item.collected_at) throw new Error('ledger不可变版本或首次推荐时间不一致')
    }
    if (ids.has(row.origin_id)) throw new Error('ledger存在跨来源重复身份')
    ids.add(row.origin_id)
  }
  return state
}

export function convertChatgptMarkdown(raw, { ledger, seed, now = new Date(), sourceName } = {}) {
  const input = parseChatgptMarkdown(raw, sourceName)
  const state = ledger ? parseLedger(ledger) : { schema_version: 1, bot_id: CHATGPT_BOT_ID, records: {} }
  const firstSeenAt = new Date(now).toISOString()
  if (seed) {
    for (const value of parseNewsBatch(seed, 'chatgpt')) {
      const item = safeItem(value), url = canonicalNewsUrl(item.source_url)
      if (item.revision !== 1 || url !== item.source_url) throw new Error('seed必须是canonical来源URL的首版完整候选；后续修订使用ledger')
      const day = calendarDate(item.collected_at), key = identityKey(day, url), previous = state.records[key]
      if (previous) {
        if (previous.revisions[0].fingerprint !== fingerprint(item)) throw new Error('seed与ledger首版冲突')
      } else {
        if (ledger) throw new Error('已有ledger不能追加未经确认的seed身份')
        state.records[key] = { edition_date: day, source_url: url, origin_id: item.origin_id, first_seen_at: firstSeenAt, revisions: [{ item, fingerprint: fingerprint(item), source_message_id: null }] }
      }
    }
  }
  const items = [], changes = { added: 0, revised: 0, unchanged: 0, staleIgnored: 0 }
  for (const row of input.rows) {
    const key = identityKey(input.date, row.source_url), previous = state.records[key], latest = previous?.revisions.at(-1)?.item
    const preservedAnalysis = latest?.bot_analysis && row.section.replace(/\*\*|__/g, '').includes(latest.bot_analysis) ? latest.bot_analysis : null
    const item = safeItem({ origin_id: previous?.origin_id ?? `chatgpt-daily:${calendarDate(firstSeenAt)}:${key.slice(0, 20)}`, revision: latest?.revision ?? 1,
      bot_id: CHATGPT_BOT_ID, visibility: 'public', review_status: 'unreviewed', collected_at: latest?.collected_at ?? input.collectedAt,
      published_at: null, event_date: null, domain: row.domain === 'research' && latest ? latest.domain : row.domain,
      title: row.title, summary: row.summary, source_url: row.source_url, source_name: row.source_name,
      source_access: 'not_checked', source_excerpt: null, bot_analysis: preservedAnalysis })
    if (latest && sameContent(item, latest)) { changes.unchanged++; items.push(latest); continue }
    // Replaying a known older edition must not undo a later correction. Match
    // only public fields; private recommendation reasons never enter history.
    const historical = previous?.revisions.slice(0, -1).some(({ item: old }) => sameContent({ ...item,
      domain: row.domain === 'research' ? old.domain : row.domain,
      bot_analysis: old.bot_analysis && row.section.replace(/\*\*|__/g, '').includes(old.bot_analysis) ? old.bot_analysis : null,
    }, old))
    if (historical) { changes.staleIgnored++; items.push(latest); continue }
    if (latest) { item.revision = latest.revision + 1; changes.revised++ } else changes.added++
    const record = previous ?? { edition_date: input.date, source_url: row.source_url, origin_id: item.origin_id, first_seen_at: firstSeenAt, revisions: [] }
    record.revisions.push({ item, fingerprint: fingerprint(item), source_message_id: input.sourceMessageId })
    state.records[key] = record; items.push(item)
  }
  parseLedger(state)
  const batch = items.length ? { schema_version: 1, bot_id: CHATGPT_BOT_ID, items } : null
  if (batch) parseNewsBatch(batch, 'chatgpt')
  return { batch, ledger: state, receipt: { status: !batch ? 'no_eligible_items' : changes.added || changes.revised ? 'converted' : 'unchanged',
    editionDate: input.date, sourceRecommendedAt: input.collectedAt, candidateTimeBasis: 'first_recommendation_per_item', sourceCount: input.sourceCount, eligible: items.length, skipped: input.skipped, ...changes,
    candidateSha256: batch ? digest(json(batch)) : null, sourceAccess: 'not_checked', network: false, published: false } }
}

function readJson(path, maximum = 16 * MAX_INPUT_BYTES) {
  if (statSync(path).size > maximum) throw new Error('私有状态文件过大')
  return JSON.parse(readFileSync(path, 'utf8'))
}
export function atomicWrite(path, text) {
  const temp = `${path}.tmp-${process.pid}-${Date.now()}`
  try { writeFileSync(temp, text, { flag: 'wx', mode: 0o600 }); renameSync(temp, path) }
  finally { if (existsSync(temp)) unlinkSync(temp) }
}
export function writeImportPlan(plan, { ledgerPath, outputPath }, write = atomicWrite) {
  if (!plan.batch) return
  // Save identities first. If candidate writing fails, the same input recovers
  // from this ledger without allocating another ID or revision.
  for (const [path, value] of [[ledgerPath, plan.ledger], [outputPath, plan.batch]]) {
    const text = json(value)
    if (!existsSync(path) || readFileSync(path, 'utf8') !== text) write(path, text)
    if (readFileSync(path, 'utf8') !== text) throw new Error('导入文件写后核对失败，未确认成功')
  }
}
export function importChatgptFile({ inputPath, ledgerPath, outputPath, seedPath, write = false, now }) {
  const paths = [inputPath, ledgerPath, outputPath].map(path => resolve(path))
  if (new Set(paths).size !== 3) throw new Error('原稿、ledger和候选必须使用不同文件')
  if (seedPath && paths.includes(resolve(seedPath))) throw new Error('seed必须是独立的历史候选，不能与输入/输出/ledger相同')
  if (statSync(inputPath).size > MAX_INPUT_BYTES) throw new Error('原稿超过1MiB，未转换')
  const raw = readFileSync(inputPath, 'utf8')
  for (const path of [ledgerPath, outputPath]) {
    if (!statSync(dirname(path)).isDirectory()) throw new Error('请先建立私有文件夹')
    if (existsSync(path) && (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink())) throw new Error('不能覆盖非普通状态文件')
  }
  if (!existsSync(ledgerPath) && existsSync(outputPath) && !seedPath) throw new Error('已有候选但ledger缺失；请恢复状态或提供首版seed，不能重新分配ID')
  let lock
  const lockPath = `${ledgerPath}.lock`
  try {
    if (write) { lock = openSync(lockPath, 'wx', 0o600); writeFileSync(lock, `${process.pid}\n`) }
    const plan = convertChatgptMarkdown(raw, { ledger: existsSync(ledgerPath) ? readJson(ledgerPath) : undefined,
      seed: seedPath ? readJson(seedPath, MAX_INPUT_BYTES) : undefined, now, sourceName: inputPath })
    if (write) writeImportPlan(plan, { ledgerPath, outputPath })
    return { ...plan.receipt, mode: write ? 'local_written_and_read_back' : 'check_only', written: write && !!plan.batch }
  } finally {
    if (lock !== undefined) { closeSync(lock); unlinkSync(lockPath) }
  }
}

function cliArgs(args) {
  const values = {}, allowed = new Set(['--input', '--ledger', '--output', '--seed'])
  let write = false
  for (let i = 0; i < args.length; i++) {
    const key = args[i]
    if (key === '--write') { if (write) throw new Error('重复--write'); write = true; continue }
    if (!allowed.has(key) || values[key] || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('未知、重复或缺失参数')
    values[key] = args[++i]
  }
  if (!values['--input'] || !values['--ledger'] || !values['--output']) throw new Error('用法：--input 私有原稿.md --ledger 私有状态.json --output 候选.json [--seed 首版候选.json] [--write]；默认仅检查')
  return { inputPath: values['--input'], ledgerPath: values['--ledger'], outputPath: values['--output'], seedPath: values['--seed'], write }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { console.log(JSON.stringify(importChatgptFile(cliArgs(process.argv.slice(2))))) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
