import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseMarkdownFrontmatter, requireDate, requireFields, requireStringArray } from './frontmatter.mjs'
import { selectPublishableRadarWeeklies } from './generate-radar-weeklies.mjs'
import { listObsidianPublicSourceFiles } from './obsidian-public-source-roots.mjs'
import {
  assertPublicExportSafe,
  assertProjectPublicStatus,
  indexProjectPublicOverlays,
  PROJECT_ACTIVITY_STATUSES,
  PROJECT_PORTFOLIO_TIERS,
  PROJECT_PUBLIC_OVERLAY_SOURCE,
  PROJECT_STAGES,
  PROJECT_VISIBILITIES,
} from './public-data-contracts.mjs'

const vaultPath = process.env.OBSIDIAN_VAULT_PATH
if (!vaultPath) throw new Error('OBSIDIAN_VAULT_PATH is required.')

const vaultRoot = resolve(vaultPath)
if (!existsSync(vaultRoot) || !statSync(vaultRoot).isDirectory()) {
  throw new Error('OBSIDIAN_VAULT_PATH must point to an existing directory.')
}

const projectOutputUrl = new URL('../content/obsidian-public/projects.json', import.meta.url)
const weeklyOutputUrl = new URL('../content/obsidian-public/radar-weeklies.json', import.meta.url)
const publicFields = [
  'project_id', 'site_slug', 'stage', 'portfolio_tier', 'activity_status', 'visibility',
  'public_role', 'claim_state', 'updated', 'public_summary', 'public_evidence',
  'public_next_milestone',
]
const weeklyFields = [
  'week', 'slug', 'title', 'summary', 'judgments', 'shipped', 'watch', 'stopped',
  'nextFocus', 'relatedProjectSlugs', 'sourceUrls', 'reviewedAt',
]
const weeklyArrayFields = [
  'judgments', 'shipped', 'watch', 'stopped', 'nextFocus', 'relatedProjectSlugs', 'sourceUrls',
]
const allowedStages = new Set(PROJECT_STAGES)
const allowedTiers = new Set(PROJECT_PORTFOLIO_TIERS)
const allowedActivity = new Set(PROJECT_ACTIVITY_STATUSES)
const allowedVisibility = new Set(PROJECT_VISIBILITIES)

const reviewedPublicProjectSources = readdirSync(new URL('../content/projects/', import.meta.url))
  .filter(fileName => fileName.endsWith('.md'))
  .map(fileName => parseMarkdownFrontmatter(
    readFileSync(new URL(`../content/projects/${fileName}`, import.meta.url), 'utf8'),
    `content/projects/${fileName}`,
  ).meta)
  .filter(meta => meta.publish === true)
  .map(meta => ({
    siteSlug: String(meta.slug),
    projectId: String(meta.sourceProjectId || meta.slug),
  }))
const reviewedPublicProjectSlugs = new Set(reviewedPublicProjectSources.map(project => project.siteSlug))

const projects = []
const radarWeeklies = []
for (const { absolutePath: file, relativePath, sourceKind } of listObsidianPublicSourceFiles(vaultRoot)) {
  let meta
  try {
    ;({ meta } = parseMarkdownFrontmatter(readFileSync(file, 'utf8'), relativePath))
  } catch {
    continue
  }

  if (meta.publish !== true) continue

  const isPublishableWeekly = meta.subtype === 'weekly-research-convergence' && (
    meta.type === 'knowledge'
    || (meta.type === 'log' && meta.kind === 'learning-log')
  )
  if (sourceKind === 'weekly') {
    if (!isPublishableWeekly) {
      throw new Error(`${relativePath}: publish true notes in the weekly source root must use the reviewed weekly contract.`)
    }
    requireFields(meta, weeklyFields, relativePath)
    weeklyArrayFields.forEach(field => requireStringArray(meta, field, relativePath))
    requireDate(meta.reviewedAt, 'reviewedAt', relativePath)
    if (!/^\d{4}-W\d{2}$/.test(meta.week) || meta.slug !== meta.week) {
      throw new Error(`${relativePath}: weekly slug must match YYYY-Www week.`)
    }
    if (!meta.judgments.length || !meta.nextFocus.length || meta.nextFocus.length > 2) {
      throw new Error(`${relativePath}: weekly judgments and one or two nextFocus items are required.`)
    }
    if (meta.sourceUrls.some(url => !/^https:\/\//.test(url))) {
      throw new Error(`${relativePath}: weekly sourceUrls must use HTTPS.`)
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
    assertPublicExportSafe(weekly, relativePath)
    radarWeeklies.push(weekly)
    continue
  }

  if (sourceKind !== 'project' || meta.type !== 'project') {
    throw new Error(`${relativePath}: publish true notes in the project source root must use the reviewed project contract.`)
  }
  requireFields(meta, publicFields, relativePath)
  requireStringArray(meta, 'public_evidence', relativePath)
  requireDate(meta.updated, 'updated', relativePath)
  if (!allowedStages.has(meta.stage)) throw new Error(`${relativePath}: invalid stage.`)
  if (!allowedTiers.has(meta.portfolio_tier)) throw new Error(`${relativePath}: invalid portfolio_tier.`)
  if (!allowedActivity.has(meta.activity_status)) throw new Error(`${relativePath}: invalid activity_status.`)
  if (!allowedVisibility.has(meta.visibility)) throw new Error(`${relativePath}: invalid visibility.`)

  const exported = {
    projectId: String(meta.project_id),
    siteSlug: String(meta.site_slug),
    stage: String(meta.stage),
    portfolioTier: String(meta.portfolio_tier),
    activityStatus: String(meta.activity_status),
    publicRole: String(meta.public_role),
    claimState: String(meta.claim_state),
    visibility: String(meta.visibility),
    updatedAt: String(meta.updated),
    publicSummary: String(meta.public_summary),
    publicEvidence: meta.public_evidence.map(String),
    publicNextMilestone: String(meta.public_next_milestone),
  }
  assertProjectPublicStatus(exported, relativePath)
  assertPublicExportSafe(exported, relativePath)
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
const validatedRadarWeeklies = selectPublishableRadarWeeklies(radarWeeklies, reviewedPublicProjectSlugs)
mkdirSync(new URL('../content/obsidian-public/', import.meta.url), { recursive: true })
const generatedAt = new Date().toISOString()
const projectSnapshot = { generatedAt, source: PROJECT_PUBLIC_OVERLAY_SOURCE, projects }
indexProjectPublicOverlays(projectSnapshot, reviewedPublicProjectSources)
writeFileSync(projectOutputUrl, `${JSON.stringify(projectSnapshot, null, 2)}\n`)
writeFileSync(weeklyOutputUrl, `${JSON.stringify({ generatedAt, radarWeeklies: validatedRadarWeeklies }, null, 2)}\n`)
console.log(`Exported ${projects.length} projects and ${validatedRadarWeeklies.length} weekly radar entries without note bodies or source paths.`)
