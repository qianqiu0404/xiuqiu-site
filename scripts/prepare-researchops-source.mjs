import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMarkdownFrontmatter } from './frontmatter.mjs'
import { collectLearningSourceUrls, validateLearningEditionV2 } from './learning-radar-v2.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SCRIPT_DIR, '..')
const POLICY = JSON.parse(readFileSync(resolve(REPO_ROOT, 'config/researchops-learning-radar.json'), 'utf8'))
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function normalizedUrl(value) {
  const url = new URL(value)
  url.hash = ''
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/$/, '')
  return url.toString()
}

function normalizedTitle(value) {
  return String(value).toLocaleLowerCase('zh-CN').replace(/[\s·:：,，。.!！?？\-_—]/g, '')
}

export function loadRadarHistory(contentDir = resolve(REPO_ROOT, 'content/radar')) {
  if (!existsSync(contentDir)) return []
  return readdirSync(contentDir)
    .filter(name => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
    .map(name => {
      const { meta } = parseMarkdownFrontmatter(readFileSync(resolve(contentDir, name), 'utf8'), name)
      if (meta.schemaVersion === 2) {
        return {
          date: String(meta.date || name.slice(0, 10)),
          urls: collectLearningSourceUrls(meta),
          titles: [...(meta.briefs || []), meta.deepDive].filter(Boolean).map(item => String(item.title || '')).filter(Boolean),
        }
      }
      const items = [...(Array.isArray(meta.marketSignals) ? meta.marketSignals : []), meta.aiTip, meta.web3Design, meta.vibeProject, meta.readingPick].filter(Boolean)
      return {
        date: String(meta.date || name.slice(0, 10)),
        urls: items.map(item => item.sourceUrl).filter(Boolean).map(String),
        titles: items.map(item => item.title).filter(Boolean).map(String),
      }
    })
}

function ledgerAsEdition(ledger) {
  return {
    ...ledger,
    schemaVersion: 2,
    slug: ledger.date,
    publish: true,
    reviewStatus: 'automated',
    editionMode: ledger.editionMode || 'daily',
    title: ledger.title || `学习雷达 · ${ledger.date}`,
    summary: ledger.summary || 'AI 与 Web3 每日研究简报及专题。',
    relatedProjectSlugs: ledger.relatedProjectSlugs || [],
  }
}

export function validateResearchOpsLedger(ledger, history = loadRadarHistory()) {
  const errors = []
  if (ledger?.version !== POLICY.version) errors.push(`version must be ${POLICY.version}.`)
  if (!DATE_RE.test(ledger?.date || '')) errors.push('date must use YYYY-MM-DD.')
  if (ledger?.timezone !== POLICY.timezone) errors.push(`timezone must be ${POLICY.timezone}.`)
  if (ledger?.runKey !== `learning-radar/${ledger?.date || ''}`) errors.push('runKey must be the unique learning-radar/YYYY-MM-DD key.')
  if (errors.length) throw new Error(errors.join('\n'))

  const edition = ledgerAsEdition(ledger)
  validateLearningEditionV2(edition, 'ResearchOps ledger')
  const editionDate = new Date(`${ledger.date}T23:59:59+08:00`)
  const historyStart = new Date(editionDate)
  historyStart.setUTCDate(historyStart.getUTCDate() - POLICY.dedupDays)
  const recent = history.filter(entry => {
    const date = new Date(`${entry.date}T00:00:00+08:00`)
    return date >= historyStart && date < new Date(`${ledger.date}T00:00:00+08:00`)
  })
  const recentUrls = new Set(recent.flatMap(entry => entry.urls).map(normalizedUrl))
  const recentTitles = new Set(recent.flatMap(entry => entry.titles).map(normalizedTitle))
  for (const brief of edition.briefs) {
    if (recentTitles.has(normalizedTitle(brief.title))) errors.push(`${brief.id}.title appeared in the previous ${POLICY.dedupDays} days.`)
    for (const source of brief.sources) {
      if (recentUrls.has(normalizedUrl(source.url))) errors.push(`${brief.id}.source appeared in the previous ${POLICY.dedupDays} days.`)
    }
  }
  if (errors.length) throw new Error(errors.join('\n'))
  return { counts: { ai: 2, web3: 2, deepDive: 1 }, itemCount: 5, edition }
}

function renderItem(item) {
  return [
    `### ${item.title}`,
    `- id: ${item.id}`,
    `- topic: ${item.topic}`,
    ...item.sources.map(source => `- source: ${source.url}`),
  ].join('\n')
}

export function renderResearchSource(ledger) {
  const { edition } = validateResearchOpsLedger(ledger)
  const blocks = [
    ['ai', edition.briefs.filter(item => item.domain === 'ai')],
    ['web3', edition.briefs.filter(item => item.domain === 'web3')],
    ['deepDive', [edition.deepDive]],
  ]
  return blocks.map(([section, items]) => `<!-- ${section}:start -->\n${items.map(renderItem).join('\n\n')}\n<!-- ${section}:end -->`).join('\n\n') + '\n'
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [ledgerPath, sourcePath] = process.argv.slice(2)
  if (!ledgerPath || !sourcePath) throw new Error('Usage: npm run prepare:researchops -- <ledger.json> <public-source.md>')
  const ledger = JSON.parse(readFileSync(resolve(ledgerPath), 'utf8'))
  const result = validateResearchOpsLedger(ledger)
  const output = renderResearchSource(ledger)
  if (!existsSync(resolve(sourcePath)) || readFileSync(resolve(sourcePath), 'utf8') !== output) writeFileSync(resolve(sourcePath), output)
  console.log(`ResearchOps v2 ledger passed: ${result.itemCount} published items (2 AI, 2 Web3, 1 deep dive).`)
}
