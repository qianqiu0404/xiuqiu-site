import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { NEWS_PRODUCERS, newsProducerConfig, parseNewsBatch, parseNewsIndex, parseNewsItem } from '../shared/grokNews.ts'

export const NEWS_REPO = 'qianqiu0404/xiuqiu-site'
export const NEWS_BRANCH = NEWS_PRODUCERS.grok.branch
const root = `repos/${NEWS_REPO}`
const hash = value => createHash('sha256').update(value).digest('hex')
const json = value => `${JSON.stringify(value, null, 2)}\n`
const MAX_INDEX_BYTES = 2 * 1024 * 1024
const revisionKey = item => `${item.origin_id}|${item.revision}`

export function mergeNews(previous, batch, history = new Map(), producer = 'grok') {
  const config = newsProducerConfig(producer)
  const existing = parseNewsIndex(previous, producer), items = parseNewsBatch(batch, producer)
  for (const record of existing.records) {
    if (record.id !== `${config.idPrefix}${hash(record.origin_id).slice(0, 24)}` || record.fingerprint !== hash(JSON.stringify(parseNewsItem(record, producer)))) throw new Error('既有新闻索引指纹不一致，未发布')
  }
  const records = new Map(existing.records.map(record => [record.origin_id, record]))
  const changed = [], ignored = []
  for (const item of items) {
    const fingerprint = hash(JSON.stringify(item)), old = records.get(item.origin_id)
    if (old && old.revision === item.revision) {
      if (old.fingerprint !== fingerprint) throw new Error('同一新闻版本内容冲突，未发布')
      continue
    }
    if (old && item.revision < old.revision) {
      const prior = history.get(revisionKey(item))
      if (prior) {
        const parsed = parseNewsItem(prior, producer)
        if (parsed.origin_id !== item.origin_id || parsed.revision !== item.revision || prior.id !== old.id
          || prior.fingerprint !== hash(JSON.stringify(parsed))) throw new Error('历史新闻版本指纹不一致，未发布')
        if (prior.fingerprint !== fingerprint) throw new Error('同一新闻版本内容冲突，未发布')
      }
      ignored.push({ origin_id: item.origin_id, revision: item.revision, current_revision: old.revision,
        status: prior ? 'verified_replay' : 'stale_ignored' })
      continue
    }
    if (item.revision !== (old?.revision || 0) + 1) throw new Error('新闻更正必须逐版追加，未发布')
    const record = { ...item, id: `${config.idPrefix}${hash(item.origin_id).slice(0, 24)}`, fingerprint }
    records.set(item.origin_id, record)
    changed.push(record)
  }
  const latest = [...records.values()].sort((a, b) => Date.parse(b.collected_at) - Date.parse(a.collected_at) || a.id.localeCompare(b.id))
  const updated = latest.reduce((max, record) => !max || Date.parse(record.collected_at) > Date.parse(max) ? record.collected_at : max, null)
  return { changed, ignored, index: parseNewsIndex({ schema_version: 1, bot_id: config.botId, updated_at: updated, records: latest }, producer) }
}

export function mergeGrokNews(previous, batch, history = new Map()) { return mergeNews(previous, batch, history, 'grok') }

async function readNewsJson(request, path) {
  const file = await request('GET', path)
  if (Number(file?.size) > MAX_INDEX_BYTES) throw new Error('新闻数据达到页面读取上限；请先制定归档方案')
  let blob = file
  if (file?.encoding !== 'base64' || typeof file.content !== 'string' || !file.content.trim()) {
    if (typeof file?.sha !== 'string' || !/^[a-f0-9]{40}$/i.test(file.sha)) throw new Error('新闻文件缺少安全的 Blob 标识；请先读回核对')
    blob = await request('GET', `${root}/git/blobs/${file.sha}`)
    if (blob?.sha !== file.sha) throw new Error('新闻 Blob 标识不一致；请先读回核对')
  }
  if (blob?.encoding !== 'base64' || typeof blob.content !== 'string' || !blob.content.trim()) {
    throw new Error('新闻 Blob 编码不受支持；投递结果待核对，请先读回分支')
  }
  const encoded = blob.content.replace(/\s/g, '')
  if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error('新闻 Blob 内容不是有效 Base64；请先读回核对')
  }
  const content = Buffer.from(encoded, 'base64')
  if (Number(blob.size) > MAX_INDEX_BYTES || content.byteLength > MAX_INDEX_BYTES) throw new Error('新闻数据达到页面读取上限；请先制定归档方案')
  try { return JSON.parse(content.toString('utf8')) }
  catch { throw new Error('新闻 JSON 无法解析；投递结果待核对，请先读回分支，不要重新生成新闻') }
}

export async function publishNews(batch, request, producer = 'grok') {
  const config = newsProducerConfig(producer), branch = config.branch
  parseNewsBatch(batch, producer) // No network until local validation succeeds.
  const repo = await request('GET', root)
  if (!repo.permissions?.push) throw new Error('当前 GitHub 身份没有本站写权限；未执行发布')
  let head, previous = { schema_version: 1, bot_id: config.botId, updated_at: null, records: [] }
  try { head = (await request('GET', `${root}/git/ref/heads/${branch}`)).object.sha }
  catch (error) { if (error.status !== 404) throw error }
  let tree
  if (head) {
    const commit = await request('GET', `${root}/git/commits/${head}`)
    tree = commit.tree.sha
    previous = await readNewsJson(request, `${root}/contents/feed/v1/index.json?ref=${head}`)
  }
  let merged = mergeNews(previous, batch, new Map(), producer)
  const history = new Map()
  for (const replay of merged.ignored) {
    const id = `${config.idPrefix}${hash(replay.origin_id).slice(0, 24)}`
    try {
      history.set(revisionKey(replay), await readNewsJson(request,
        `${root}/contents/feed/v1/records/${id}/r${replay.revision}.json?ref=${head}`))
    } catch (error) { if (error.status !== 404) throw error }
  }
  if (history.size) merged = mergeNews(previous, batch, history, producer)
  const { changed, ignored, index } = merged
  const replayReceipt = ignored.length ? { ignored } : {}
  if (!changed.length) return { status: ignored.some(item => item.status === 'stale_ignored') ? 'stale_ignored' : 'unchanged',
    branch, commit: head, changed: 0, ...replayReceipt }
  const indexText = json(index)
  if (Buffer.byteLength(indexText) > MAX_INDEX_BYTES) throw new Error('新闻索引达到页面读取上限，未发布；请先制定归档方案')
  const files = [{ path: 'feed/v1/index.json', content: indexText }, ...changed.map(record => ({ path: `feed/v1/records/${record.id}/r${record.revision}.json`, content: json(record) }))]
  const entries = []
  for (const file of files) {
    const blob = await request('POST', `${root}/git/blobs`, { content: file.content, encoding: 'utf-8' })
    entries.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha })
  }
  const nextTree = await request('POST', `${root}/git/trees`, { ...(tree ? { base_tree: tree } : {}), tree: entries })
  const commit = await request('POST', `${root}/git/commits`, { message: `news: ${config.botId} ${changed.length} public items`, tree: nextTree.sha, parents: head ? [head] : [] })
  if (head) await request('PATCH', `${root}/git/refs/heads/${branch}`, { sha: commit.sha, force: false })
  else await request('POST', `${root}/git/refs`, { ref: `refs/heads/${branch}`, sha: commit.sha })
  // Read the moving branch, not just the immutable commit we already created.
  const live = parseNewsIndex(await readNewsJson(request, `${root}/contents/feed/v1/index.json?ref=${encodeURIComponent(branch)}`), producer)
  if (!changed.every(record => live.records.some(r => r.id === record.id && r.fingerprint === record.fingerprint))) throw new Error('投递结果待核对；请先读回分支，不要重发或重新生成新闻')
  return { status: 'data_verified', branch, commit: commit.sha, changed: changed.length, website: 'not_verified', ...replayReceipt }
}

export async function publishGrokNews(batch, request) { return publishNews(batch, request, 'grok') }

async function ghRequest(method, path, body) {
  try {
    const output = execFileSync('gh', ['api', '-X', method, path,
      ...(method === 'GET' && path.includes('/contents/') ? ['-H', 'Accept: application/vnd.github.object+json'] : []),
      ...(body ? ['--input', '-'] : [])], { input: body ? JSON.stringify(body) : undefined, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024 })
    return output ? JSON.parse(output) : {}
  } catch (error) {
    const status = Number(String(error.stderr).match(/HTTP (\d{3})/)?.[1] || 0)
    const failure = new Error(status ? `GitHub 请求失败 (${status})；未确认的投递先读回，不要自动重发` : 'GitHub 请求失败；请检查现有登录和网络')
    failure.status = status
    throw failure
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2)
    const usage = '用法：node scripts/publish-grok-news.mjs --check|--publish <公开资料包.json> [--producer grok|chatgpt]'
    let mode, file, producer = 'grok', producerSelected = false
    for (let i = 0; i < args.length; i++) {
      const flag = args[i], value = args[i + 1]
      if (!value || value.startsWith('--')) throw new Error(usage)
      if (flag === '--check' || flag === '--publish') {
        if (mode) throw new Error(usage)
        mode = flag; file = value
      } else if (flag === '--producer') {
        if (producerSelected) throw new Error(usage)
        producer = value; producerSelected = true
      } else throw new Error(usage)
      i++
    }
    if (!mode) throw new Error(usage)
    newsProducerConfig(producer)
    const raw = readFileSync(file, 'utf8')
    if (Buffer.byteLength(raw) > 1024 * 1024) throw new Error('新闻批次过大')
    const batch = JSON.parse(raw), items = parseNewsBatch(batch, producer)
    console.log(JSON.stringify(mode === '--publish' ? await publishNews(batch, ghRequest, producer) : { status: 'valid', items: items.length, network: false }))
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
