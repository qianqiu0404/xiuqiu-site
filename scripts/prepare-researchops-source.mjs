import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMarkdownFrontmatter } from './frontmatter.mjs'
import { assertPublicHttpUrl } from './public-data-contracts.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SCRIPT_DIR, '..')
const POLICY = JSON.parse(readFileSync(resolve(REPO_ROOT, 'config/researchops-learning-radar.json'), 'utf8'))
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const SECRET_RE = /(?:api[_-]?key|access[_-]?token|secret|mnemonic|seed phrase)\s*[:=]\s*[^\s]+/i
const ABSOLUTE_PATH_RE = /(?:\/Users\/|\/home\/|[A-Za-z]:\\|iCloud~md~obsidian)/

function normalizedUrl(value) {
  const url = new URL(value)
  url.hash = ''
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/$/, '')
  return url.toString()
}

function normalizedTitle(value) {
  return value.toLocaleLowerCase('zh-CN').replace(/[\s·:：,，。.!！?？\-_—]/g, '')
}

function requiredString(value, label, minimum = 1) {
  if (typeof value !== 'string' || value.trim().length < minimum) throw new Error(`${label} must be a string with at least ${minimum} characters.`)
  return value.trim()
}

function assertTimestamp(value, label) {
  requiredString(value, label)
  if (Number.isNaN(Date.parse(value))) throw new Error(`${label} must be an ISO timestamp.`)
}

function assertPublicText(value, label) {
  if (ABSOLUTE_PATH_RE.test(value)) throw new Error(`${label} contains a local absolute path.`)
  if (SECRET_RE.test(value)) throw new Error(`${label} may contain credentials or secret material.`)
}

export function loadRadarHistory(contentDir = resolve(REPO_ROOT, 'content/radar')) {
  if (!existsSync(contentDir)) return []
  return readdirSync(contentDir)
    .filter(name => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
    .map(name => {
      const { meta } = parseMarkdownFrontmatter(readFileSync(resolve(contentDir, name), 'utf8'), name)
      const items = [
        ...(Array.isArray(meta.marketSignals) ? meta.marketSignals : []),
        meta.aiTip,
        meta.web3Design,
        meta.vibeProject,
        meta.readingPick,
      ].filter(Boolean)
      return {
        date: String(meta.date || name.slice(0, 10)),
        urls: items.map(item => item.sourceUrl).filter(Boolean).map(String),
        titles: items.map(item => item.title).filter(Boolean).map(String),
      }
    })
}

export function validateResearchOpsLedger(ledger, history = loadRadarHistory()) {
  const errors = []
  if (ledger?.version !== POLICY.version) errors.push(`version must be ${POLICY.version}.`)
  if (!DATE_RE.test(ledger?.date || '')) errors.push('date must use YYYY-MM-DD.')
  if (ledger?.timezone !== POLICY.timezone) errors.push(`timezone must be ${POLICY.timezone}.`)
  if (ledger?.runKey !== `learning-radar/${ledger?.date || ''}`) errors.push('runKey must be the unique learning-radar/YYYY-MM-DD key.')
  if (!Array.isArray(ledger?.items)) errors.push('items must be an array.')
  if (errors.length) throw new Error(errors.join('\n'))

  const counts = Object.fromEntries(Object.keys(POLICY.lanes).map(name => [name, 0]))
  const seenUrls = new Set()
  const seenTitles = new Set()
  const sections = new Set()
  const ledgerDate = new Date(`${ledger.date}T23:59:59+08:00`)
  const historyStart = new Date(ledgerDate)
  historyStart.setUTCDate(historyStart.getUTCDate() - POLICY.dedupDays)
  const recentHistory = history.filter(entry => {
    const date = new Date(`${entry.date}T00:00:00+08:00`)
    return date >= historyStart && date <= ledgerDate
  })
  const recentUrls = new Set(recentHistory.flatMap(entry => entry.urls).map(normalizedUrl))
  const recentTitles = new Set(recentHistory.flatMap(entry => entry.titles).map(normalizedTitle))

  ledger.items.forEach((item, index) => {
    const label = `items[${index}]`
    const lane = POLICY.lanes[item?.lane]
    if (!lane) {
      errors.push(`${label}.lane is not allowed.`)
      return
    }
    counts[item.lane] += 1
    sections.add(lane.publicSection)
    let title = ''
    let sourceUrl = ''
    try {
      title = requiredString(item.title, `${label}.title`, 8)
      sourceUrl = requiredString(item.sourceUrl, `${label}.sourceUrl`)
      requiredString(item.verificationNotes, `${label}.verificationNotes`, 20)
      assertTimestamp(item.publishedAt, `${label}.publishedAt`)
      assertTimestamp(item.checkedAt, `${label}.checkedAt`)
      if (new Date(item.publishedAt) > new Date(item.checkedAt)) errors.push(`${label}.publishedAt cannot be later than checkedAt.`)
      const checkedDate = new Intl.DateTimeFormat('en-CA', { timeZone: POLICY.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(item.checkedAt))
      if (checkedDate !== ledger.date) errors.push(`${label}.checkedAt must fall on the ledger date in ${POLICY.timezone}.`)
      assertPublicHttpUrl(sourceUrl, `${label}.sourceUrl`)
      assertPublicText(JSON.stringify(item), label)
      const sourceHost = new URL(sourceUrl).hostname.toLowerCase()
      if (POLICY.blockedFinalSourceHosts.includes(sourceHost)) errors.push(`${label}.sourceUrl is discovery-only and cannot be the final citation.`)
      if (item.primarySource !== true) errors.push(`${label}.primarySource must be true.`)
      if (item.discoveredVia != null) {
        assertPublicHttpUrl(item.discoveredVia, `${label}.discoveredVia`)
        const discovery = POLICY.discoverySources.aiHot
        if (item.lane !== 'aiEngineering' || !String(item.discoveredVia).startsWith(new URL(discovery.endpoint).origin)) {
          errors.push(`${label}.discoveredVia is not allowed for this lane.`)
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
    if (!title || !sourceUrl) return
    const urlKey = normalizedUrl(sourceUrl)
    const titleKey = normalizedTitle(title)
    if (seenUrls.has(urlKey)) errors.push(`${label}.sourceUrl duplicates another ledger item.`)
    if (seenTitles.has(titleKey)) errors.push(`${label}.title duplicates another ledger item.`)
    if (recentUrls.has(urlKey)) errors.push(`${label}.sourceUrl appeared in the previous ${POLICY.dedupDays} days.`)
    if (recentTitles.has(titleKey)) errors.push(`${label}.title appeared in the previous ${POLICY.dedupDays} days.`)
    seenUrls.add(urlKey)
    seenTitles.add(titleKey)
  })

  Object.entries(counts).forEach(([lane, count]) => {
    if (count > POLICY.lanes[lane].maximumItems) errors.push(`${lane} exceeds its ${POLICY.lanes[lane].maximumItems}-item limit.`)
  })
  if (ledger.items.length > POLICY.maximumItems) errors.push(`items exceeds the ${POLICY.maximumItems}-item daily limit.`)
  if (sections.size < POLICY.minimumPublicSections) errors.push(`Only ${sections.size} public source sections succeeded.`)
  if (errors.length) throw new Error(errors.join('\n'))
  return { counts, sections: [...sections], itemCount: ledger.items.length }
}

export function renderResearchSource(ledger) {
  validateResearchOpsLedger(ledger)
  const blocks = new Map()
  for (const section of ['crypto', 'radar', 'vibe', 'reading']) blocks.set(section, [])
  for (const item of ledger.items) {
    const section = POLICY.lanes[item.lane].publicSection
    blocks.get(section).push([
      `### ${item.title}`,
      `- lane: ${item.lane}`,
      `- publishedAt: ${item.publishedAt}`,
      `- checkedAt: ${item.checkedAt}`,
      `- primarySource: ${item.primarySource}`,
      `- source: ${item.sourceUrl}`,
      `- verification: ${item.verificationNotes}`,
    ].join('\n'))
  }
  return [...blocks.entries()]
    .filter(([, entries]) => entries.length)
    .map(([section, entries]) => `<!-- ${section}:start -->\n${entries.join('\n\n')}\n<!-- ${section}:end -->`)
    .join('\n\n') + '\n'
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [ledgerPath, sourcePath] = process.argv.slice(2)
  if (!ledgerPath || !sourcePath) throw new Error('Usage: npm run prepare:researchops -- <ledger.json> <public-source.md>')
  const ledger = JSON.parse(readFileSync(resolve(ledgerPath), 'utf8'))
  const result = validateResearchOpsLedger(ledger)
  const output = renderResearchSource(ledger)
  if (!existsSync(resolve(sourcePath)) || readFileSync(resolve(sourcePath), 'utf8') !== output) writeFileSync(resolve(sourcePath), output)
  console.log(`ResearchOps ledger passed: ${result.itemCount} items across ${result.sections.length} public sections.`)
}
