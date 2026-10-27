import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { canonicalNewsUrl, convertChatgptMarkdown, importChatgptFile, writeImportPlan, atomicWrite } from './import-chatgpt-news.mjs'

const now = '2026-10-27T03:00:00.000Z'
const source = 'https://example.org/news/item'
const article = ({ title = '公开测试进展', summary = '这是虚构测试摘要，不是真实新闻。', url = source, category = 'AI 动态', reason = '你的职业计划、邮箱 person@example.net 和 /Users/private 都不应公开。' } = {}) => `## ① ${category}：${title}

### 新闻摘要
${summary}

### 推荐理由
${reason}

**原始来源：** [测试机构：完整标题](${url})
`
const markdown = ({ content = article(), date = '2026-10-26', time = '2026-10-26T01:06:48.994Z', message = 'fixture-message-1' } = {}) => `---
producer: "chatgpt-daily"
edition_date: "${date}"
recommended_at: "${time}"
timezone: "Asia/Taipei"
message_id: "${message}"
content_scope: "private_original"
---

# 离线测试简报
${content}
`
const convert = (raw = markdown(), options = {}) => convertChatgptMarkdown(raw, { now, ...options })
const createFiles = (t, raw = markdown()) => {
  const folder = mkdtempSync(join(tmpdir(), 'chatgpt-import-'))
  t.after(() => rmSync(folder, { recursive: true, force: true }))
  const files = { inputPath: join(folder, 'private.md'), ledgerPath: join(folder, 'ledger.json'), outputPath: join(folder, 'candidate.json'), now }
  writeFileSync(files.inputPath, raw)
  return files
}

test('offline extraction uses the actual message time and excludes private recommendation reasons', () => {
  const plan = convert()
  assert.equal(plan.batch.bot_id, 'chatgpt-daily')
  assert.equal(plan.batch.items.length, 1)
  const item = plan.batch.items[0]
  assert.equal(item.collected_at, '2026-10-26T01:06:48.994Z')
  assert.equal(item.published_at, null)
  assert.equal(item.event_date, null)
  assert.equal(item.source_access, 'not_checked')
  assert.equal(item.review_status, 'unreviewed')
  assert.equal(item.bot_analysis, null)
  assert.equal(item.source_name, '测试机构')
  assert.equal(item.domain, 'ai')
  assert.match(item.origin_id, /^chatgpt-daily:2026-10-27:[a-f0-9]{20}$/)
  assert.doesNotMatch(JSON.stringify(plan.batch), /职业|邮箱|person@|\/Users|fixture-message/)
  assert.equal(plan.receipt.network, false)
  assert.equal(plan.receipt.published, false)
})

test('unknown, invalid and edition-mismatched timestamps fail without creating state', t => {
  for (const time of ['unknown', '2026-10-26T08:30:00', '2026-02-30T01:00:00Z', '2026-10-25T01:00:00Z']) {
    const files = createFiles(t, markdown({ time }))
    assert.throws(() => importChatgptFile({ ...files, write: true }))
    assert.equal(existsSync(files.ledgerPath), false)
    assert.equal(existsSync(files.outputPath), false)
    assert.equal(existsSync(`${files.ledgerPath}.lock`), false)
  }
  assert.equal(convert(markdown({ time: '2026-10-25T17:06:48.994Z' })).batch.items[0].collected_at, '2026-10-25T17:06:48.994Z')
  assert.throws(() => convert(markdown({ date: '2026-02-30' })), /日期/)
})

test('canonical source deduplication drops exact repeats and rejects contradictory duplicates', () => {
  const same = article({ url: `${source}?utm_source=fixture#top` })
  const plan = convert(markdown({ content: article() + same }))
  assert.equal(plan.batch.items.length, 1)
  assert.deepEqual(plan.receipt.skipped, [{ position: 2, reason: 'duplicate_original_source' }])
  assert.equal(canonicalNewsUrl('https://example.org/a?z=2&utm_medium=test&a=1#section'), 'https://example.org/a?a=1&z=2')
  assert.throws(() => convert(markdown({ content: article() + article({ summary: '与首条冲突的测试摘要。' }) })), /不同内容/)
})

test('missing original sources stay private and all-missing input produces no candidate', t => {
  const withoutSource = article().replace(/^\*\*原始来源：\*\*.*$/m, '')
  const plan = convert(markdown({ content: withoutSource }))
  assert.equal(plan.batch, null)
  assert.equal(plan.receipt.status, 'no_eligible_items')
  assert.equal(plan.receipt.skipped[0].reason, 'missing_original_source')
  const files = createFiles(t, markdown({ content: withoutSource }))
  assert.equal(importChatgptFile({ ...files, write: true }).written, false)
  assert.equal(existsSync(files.outputPath), false)
  assert.equal(existsSync(files.ledgerPath), false)
  assert.throws(() => convert(markdown({ content: article().replace('### 新闻摘要', '### 其他内容') })), /缺少新闻摘要/)
})

test('public excerpts reject private addresses, personal advice, local URLs, HTML and credentials', () => {
  for (const summary of ['你的个人项目记录', 'Contact person@example.net', '/Volumes/Private/data', '<script>alert(1)</script>', `sk-${'a'.repeat(30)}`]) {
    assert.throws(() => convert(markdown({ content: article({ summary }) })))
  }
  for (const url of ['https://chatgpt.com/c/private-id', 'https://mail.google.com/mail/u/0/#inbox', 'http://127.0.0.1/source', 'https://example.org/news?access_token=private']) {
    assert.throws(() => convert(markdown({ content: article({ url }) })))
  }
  assert.throws(() => convert(markdown({ content: article().repeat(51) })), /最多50条/)
  assert.throws(() => convert('a'.repeat(1024 * 1024 + 1)), /超过1MiB/)
})

test('any subsequent heading ends the public summary, including a changed private-reason heading level', () => {
  for (const heading of ['##', '###', '####', '  ##']) {
    const raw = markdown({ content: article({ reason: '当前内部项目与客户资料仅供团队参考。' }).replace('### 推荐理由', `${heading} 推荐理由`) })
    assert.equal(convert(raw).batch.items[0].summary, '这是虚构测试摘要，不是真实新闻。')
    assert.doesNotMatch(JSON.stringify(convert(raw).batch), /内部项目|客户资料/)
  }
  assert.throws(() => convert(markdown().replace('timezone: "Asia/Taipei"', 'timezone: "UTC"')), /时区约定/)
})

test('same-source replay is byte-stable and a new message corrects the same identity with immutable history', () => {
  const first = convert()
  const replay = convert(markdown(), { ledger: first.ledger, now: '2026-10-28T03:00:00Z' })
  assert.deepEqual(replay.batch, first.batch)
  assert.deepEqual(replay.ledger, first.ledger)
  assert.equal(replay.receipt.unchanged, 1)
  const corrected = convert(markdown({ message: 'fixture-message-2', time: '2026-10-26T02:00:00Z', content: article({ summary: '修正后的公开测试摘要。', url: `${source}?utm_source=changed` }) }), { ledger: first.ledger })
  assert.equal(corrected.receipt.revised, 1)
  assert.equal(corrected.batch.items[0].origin_id, first.batch.items[0].origin_id)
  assert.equal(corrected.batch.items[0].revision, 2)
  assert.equal(corrected.batch.items[0].collected_at, first.batch.items[0].collected_at)
  assert.equal(corrected.receipt.sourceRecommendedAt, '2026-10-26T02:00:00.000Z')
  assert.equal(corrected.receipt.candidateTimeBasis, 'first_recommendation_per_item')
  assert.deepEqual(Object.values(corrected.ledger.records)[0].revisions[0], Object.values(first.ledger.records)[0].revisions[0])
  const oldReplay = convert(markdown(), { ledger: corrected.ledger })
  assert.equal(oldReplay.receipt.staleIgnored, 1)
  assert.deepEqual(oldReplay.batch, corrected.batch)
  assert.deepEqual(oldReplay.ledger, corrected.ledger)
})

test('explicit first-version seed preserves already assigned IDs and only retains analysis present in the source', () => {
  const first = convert()
  const item = { ...first.batch.items[0], origin_id: 'chatgpt-daily:legacy:stable-id', bot_analysis: '通用风险说明。' }
  const seed = { ...first.batch, items: [item] }
  const raw = markdown({ content: article({ reason: '通用风险说明。 你的个人计划不公开。' }) })
  const migrated = convert(raw, { seed })
  assert.deepEqual(migrated.batch.items, [item])
  assert.equal(migrated.receipt.revised, 0)
  assert.equal(migrated.receipt.unchanged, 1)
  assert.deepEqual(convert(raw, { ledger: migrated.ledger, seed }).ledger, migrated.ledger)
  const removed = convert(markdown(), { ledger: migrated.ledger })
  assert.equal(removed.batch.items[0].bot_analysis, null)
  assert.equal(removed.batch.items[0].revision, 2)
  assert.throws(() => convert(raw, { seed: { ...seed, items: [{ ...item, revision: 2 }] } }), /首版/)
  const conflict = { ...seed, items: [{ ...item, title: '不一致的种子' }] }
  assert.throws(() => convert(raw, { ledger: migrated.ledger, seed: conflict }), /首版冲突/)
})

test('ledger corruption and seed identities conflicting across sources fail closed', () => {
  const first = convert(), ledger = structuredClone(first.ledger)
  Object.values(ledger.records)[0].revisions[0].item.summary = '篡改的历史'
  assert.throws(() => convert(markdown(), { ledger }), /不可变版本/)
  const item = first.batch.items[0]
  assert.throws(() => convert(markdown(), { seed: { ...first.batch, items: [item, { ...item, source_url: 'https://example.org/other' }] } }), /重复/)
})

test('file import defaults to read-only, writes privately only by request and verifies byte-identical replay', t => {
  const files = createFiles(t)
  assert.equal(importChatgptFile(files).written, false)
  assert.equal(existsSync(files.outputPath), false)
  assert.equal(existsSync(files.ledgerPath), false)
  const receipt = importChatgptFile({ ...files, write: true })
  assert.equal(receipt.mode, 'local_written_and_read_back')
  const ledger = readFileSync(files.ledgerPath, 'utf8'), candidate = readFileSync(files.outputPath, 'utf8')
  assert.equal(importChatgptFile({ ...files, write: true }).unchanged, 1)
  assert.equal(readFileSync(files.ledgerPath, 'utf8'), ledger)
  assert.equal(readFileSync(files.outputPath, 'utf8'), candidate)
  assert.equal(readdirSync(resolve(files.ledgerPath, '..')).some(name => name.includes('.tmp-') || name.endsWith('.lock')), false)
})

test('candidate failure recovers from the committed identity ledger without a new version or ID', t => {
  const files = createFiles(t), plan = convert()
  assert.throws(() => writeImportPlan(plan, files, (path, text) => {
    if (path === files.outputPath) throw new Error('simulated disk write failure')
    atomicWrite(path, text)
  }), /simulated/)
  assert.equal(existsSync(files.ledgerPath), true)
  assert.equal(existsSync(files.outputPath), false)
  const recovered = importChatgptFile({ ...files, write: true })
  assert.equal(recovered.added, 0)
  assert.equal(recovered.revised, 0)
  assert.deepEqual(JSON.parse(readFileSync(files.outputPath, 'utf8')), plan.batch)
})

test('existing lock, lost ledger and overlapping paths stop writes without destroying recovery evidence', t => {
  const files = createFiles(t)
  writeFileSync(`${files.ledgerPath}.lock`, 'other-run\n')
  assert.throws(() => importChatgptFile({ ...files, write: true }), /EEXIST/)
  assert.equal(readFileSync(`${files.ledgerPath}.lock`, 'utf8'), 'other-run\n')
  rmSync(`${files.ledgerPath}.lock`)
  writeFileSync(files.outputPath, JSON.stringify(convert().batch))
  assert.throws(() => importChatgptFile({ ...files, write: true }), /ledger缺失/)
  assert.throws(() => importChatgptFile({ ...files, ledgerPath: files.inputPath }), /不同文件/)
  assert.throws(() => importChatgptFile({ ...files, seedPath: files.outputPath }), /独立的历史候选/)
})

test('CLI checks and local writes never invoke network or the publisher and reject unsupported flags', t => {
  const files = createFiles(t), folder = resolve(files.inputPath, '..'), bin = join(folder, 'bin'), trap = join(folder, 'network-called')
  mkdirSync(bin)
  for (const name of ['gh', 'curl', 'wget']) writeFileSync(join(bin, name), `#!/bin/sh\nprintf called > '${trap}'\nexit 99\n`, { mode: 0o700 })
  const args = ['--experimental-strip-types', 'scripts/import-chatgpt-news.mjs', '--input', files.inputPath, '--ledger', files.ledgerPath, '--output', files.outputPath]
  const options = { cwd: resolve(import.meta.dirname, '..'), env: { ...process.env, PATH: `${bin}:${process.env.PATH}` }, encoding: 'utf8' }
  for (const flags of [[], ['--write']]) {
    const child = spawnSync(process.execPath, [...args, ...flags], options)
    assert.equal(child.status, 0, child.stderr)
    const result = JSON.parse(child.stdout)
    assert.equal(result.network, false)
    assert.equal(result.published, false)
  }
  for (const flags of [['--publish'], ['--write', '--write'], ['--input', files.inputPath]]) assert.notEqual(spawnSync(process.execPath, [...args, ...flags], options).status, 0)
  assert.equal(existsSync(trap), false)
})
