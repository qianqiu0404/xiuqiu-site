import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve, relative, sep } from 'node:path'
import { parseMarkdownFrontmatter, requireDate, requireFields, requireStringArray } from './frontmatter.mjs'

const vaultPath = process.env.OBSIDIAN_VAULT_PATH
if (!vaultPath) throw new Error('OBSIDIAN_VAULT_PATH is required.')

const vaultRoot = resolve(vaultPath)
if (!existsSync(vaultRoot) || !statSync(vaultRoot).isDirectory()) {
  throw new Error('OBSIDIAN_VAULT_PATH must point to an existing directory.')
}

const projectOutputUrl = new URL('../content/obsidian-public/projects.json', import.meta.url)
const weeklyOutputUrl = new URL('../content/obsidian-public/radar-weeklies.json', import.meta.url)
const denySegments = [
  `${sep}Notes${sep}06-生活系统${sep}`,
  `${sep}Notes${sep}06-生活系统${sep}每日记录${sep}`,
  `${sep}interview${sep}`,
  `${sep}.publish-inputs${sep}`,
  `${sep}.obsidian${sep}`,
  `${sep}.trash${sep}`,
  `${sep}.venv${sep}`,
]
const publicFields = [
  'project_id', 'site_slug', 'stage', 'portfolio_tier', 'activity_status', 'visibility',
  'updated', 'next_action', 'public_summary', 'public_evidence', 'public_next_milestone',
]
const weeklyFields = [
  'week', 'slug', 'title', 'summary', 'judgments', 'shipped', 'watch', 'stopped',
  'nextFocus', 'relatedProjectSlugs', 'sourceUrls', 'reviewedAt',
]
const weeklyArrayFields = [
  'judgments', 'shipped', 'watch', 'stopped', 'nextFocus', 'relatedProjectSlugs', 'sourceUrls',
]
const allowedStages = new Set(['planned', 'building', 'verified-local', 'showcase-ready'])
const allowedTiers = new Set(['flagship', 'verified', 'exploration', 'paused'])
const allowedActivity = new Set(['active', 'paused', 'completed'])
const allowedVisibility = new Set(['private', 'public'])
const privateText = /(?:\/Users\/|\/home\/|薪资|伴侣|身份证|助记词|私钥|private key)/i

function walk(directory) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = resolve(directory, entry.name)
    if (denySegments.some(segment => `${sep}${relative(vaultRoot, absolutePath)}${entry.isDirectory() ? sep : ''}`.includes(segment))) {
      continue
    }
    if (entry.isDirectory()) files.push(...walk(absolutePath))
    else if (entry.name.endsWith('.md')) files.push(absolutePath)
  }
  return files
}

const projects = []
const radarWeeklies = []
for (const file of walk(vaultRoot)) {
  let meta
  try {
    ;({ meta } = parseMarkdownFrontmatter(readFileSync(file, 'utf8'), relative(vaultRoot, file)))
  } catch {
    continue
  }

  if (meta.publish !== true) continue
  const relativePath = `${sep}${relative(vaultRoot, file)}`
  if (denySegments.some(segment => relativePath.includes(segment))) {
    throw new Error(`${relative(vaultRoot, file)}: denied paths cannot be published.`)
  }

  if (meta.type === 'knowledge' && meta.subtype === 'weekly-research-convergence') {
    requireFields(meta, weeklyFields, relative(vaultRoot, file))
    weeklyArrayFields.forEach(field => requireStringArray(meta, field, relative(vaultRoot, file)))
    requireDate(meta.reviewedAt, 'reviewedAt', relative(vaultRoot, file))
    if (!/^\d{4}-W\d{2}$/.test(meta.week) || meta.slug !== meta.week) {
      throw new Error(`${relative(vaultRoot, file)}: weekly slug must match YYYY-Www week.`)
    }
    if (!meta.judgments.length || !meta.nextFocus.length || meta.nextFocus.length > 2) {
      throw new Error(`${relative(vaultRoot, file)}: weekly judgments and one or two nextFocus items are required.`)
    }
    if (meta.sourceUrls.some(url => !/^https:\/\//.test(url))) {
      throw new Error(`${relative(vaultRoot, file)}: weekly sourceUrls must use HTTPS.`)
    }
    const weekly = {
      week: String(meta.week),
      slug: String(meta.slug),
      title: String(meta.title),
      summary: String(meta.summary),
      judgments: meta.judgments.map(String),
      shipped: meta.shipped.map(String),
      watch: meta.watch.map(String),
      stopped: meta.stopped.map(String),
      nextFocus: meta.nextFocus.map(String),
      relatedProjectSlugs: meta.relatedProjectSlugs.map(String),
      sourceUrls: meta.sourceUrls.map(String),
      publish: true,
      reviewedAt: String(meta.reviewedAt),
    }
    if (privateText.test(JSON.stringify(weekly))) {
      throw new Error(`${relative(vaultRoot, file)}: weekly public fields contain private or local-only text.`)
    }
    radarWeeklies.push(weekly)
    continue
  }

  if (meta.type !== 'project') continue
  requireFields(meta, publicFields, relative(vaultRoot, file))
  requireStringArray(meta, 'public_evidence', relative(vaultRoot, file))
  requireDate(meta.updated, 'updated', relative(vaultRoot, file))
  if (!allowedStages.has(meta.stage)) throw new Error(`${relative(vaultRoot, file)}: invalid stage.`)
  if (!allowedTiers.has(meta.portfolio_tier)) throw new Error(`${relative(vaultRoot, file)}: invalid portfolio_tier.`)
  if (!allowedActivity.has(meta.activity_status)) throw new Error(`${relative(vaultRoot, file)}: invalid activity_status.`)
  if (!allowedVisibility.has(meta.visibility)) throw new Error(`${relative(vaultRoot, file)}: invalid visibility.`)

  const exported = {
    projectId: String(meta.project_id),
    siteSlug: String(meta.site_slug),
    stage: String(meta.stage),
    portfolioTier: String(meta.portfolio_tier),
    activityStatus: String(meta.activity_status),
    visibility: String(meta.visibility),
    updatedAt: String(meta.updated),
    nextAction: String(meta.next_action),
    publicSummary: String(meta.public_summary),
    publicEvidence: meta.public_evidence.map(String),
    publicNextMilestone: String(meta.public_next_milestone),
  }
  if (privateText.test(JSON.stringify(exported))) {
    throw new Error(`${relative(vaultRoot, file)}: public fields contain private or local-only text.`)
  }
  projects.push(exported)
}

const ids = new Set()
const slugs = new Set()
for (const project of projects) {
  if (ids.has(project.projectId)) throw new Error(`Duplicate project_id: ${project.projectId}`)
  if (slugs.has(project.siteSlug)) throw new Error(`Duplicate site_slug: ${project.siteSlug}`)
  ids.add(project.projectId)
  slugs.add(project.siteSlug)
}

projects.sort((a, b) => a.siteSlug.localeCompare(b.siteSlug))
radarWeeklies.sort((a, b) => b.week.localeCompare(a.week))
mkdirSync(new URL('../content/obsidian-public/', import.meta.url), { recursive: true })
const generatedAt = new Date().toISOString()
writeFileSync(projectOutputUrl, `${JSON.stringify({ generatedAt, projects }, null, 2)}\n`)
writeFileSync(weeklyOutputUrl, `${JSON.stringify({ generatedAt, radarWeeklies }, null, 2)}\n`)
console.log(`Exported ${projects.length} projects and ${radarWeeklies.length} weekly radar entries without note bodies or source paths.`)
