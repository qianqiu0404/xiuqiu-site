import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import {
  parseMarkdownFrontmatter,
  requireDate,
  requireFields,
  requireStringArray,
} from './frontmatter.mjs'
import {
  applyProjectPublicOverlay,
  assertProjectRepositoryVisibility,
  isPublishable,
} from './public-data-contracts.mjs'

const CONTENT_DIR = new URL('../content/projects/', import.meta.url)
const OUTPUT_URL = new URL('../src/data/generatedProjects.ts', import.meta.url)
const OBSIDIAN_PUBLIC_URL = new URL('../content/obsidian-public/projects.json', import.meta.url)
const STAGES = ['exploring', 'building', 'verified-local', 'showcase-ready']
const SOURCE_TYPES = ['original', 'adapted', 'source-study']
const VISIBILITIES = ['private', 'public', 'none']
const PORTFOLIO_TIERS = ['flagship', 'verified', 'exploration', 'paused']
const ACTIVITY_STATUSES = ['active', 'paused', 'completed']
const REQUIRED_FIELDS = [
  'id', 'slug', 'name', 'category', 'featured', 'publish', 'portfolioTier', 'activityStatus',
  'stage', 'sourceType', 'visibility', 'positioning',
  'currentFocus', 'verifiedEvidence', 'targetOutcome', 'nextMilestone', 'knownLimits', 'updatedAt',
  'coreAbilities', 'talkingPoints', 'techStack', 'engineering', 'learning', 'conceptTags',
  'relatedArticleSlugs', 'suggestedQuestions',
]
const ARRAY_FIELDS = [
  'verifiedEvidence', 'knownLimits', 'coreAbilities', 'talkingPoints', 'techStack', 'conceptTags',
  'relatedArticleSlugs', 'suggestedQuestions',
]
const ENGINEERING_ARRAY_FIELDS = ['callFlow', 'failureScenarios', 'evidence', 'knownLimits']
const LEARNING_ARRAY_FIELDS = ['verified', 'verification', 'tradeoffs', 'nextSteps']

if (!existsSync(CONTENT_DIR)) throw new Error('content/projects does not exist.')

function assertProjectContract(project, fileName) {
  requireFields(project, REQUIRED_FIELDS, fileName)
  ARRAY_FIELDS.forEach(field => requireStringArray(project, field, fileName))
  requireDate(project.updatedAt, 'updatedAt', fileName)

  if (!STAGES.includes(project.stage)) throw new Error(`${fileName}: unknown stage ${project.stage}.`)
  if (!SOURCE_TYPES.includes(project.sourceType)) throw new Error(`${fileName}: unknown sourceType ${project.sourceType}.`)
  if (!VISIBILITIES.includes(project.visibility)) throw new Error(`${fileName}: unknown visibility ${project.visibility}.`)
  if (!PORTFOLIO_TIERS.includes(project.portfolioTier)) throw new Error(`${fileName}: unknown portfolioTier ${project.portfolioTier}.`)
  if (!ACTIVITY_STATUSES.includes(project.activityStatus)) throw new Error(`${fileName}: unknown activityStatus ${project.activityStatus}.`)
  if (project.publish !== true) throw new Error(`${fileName}: only publish: true projects may be exported.`)
  assertProjectRepositoryVisibility(project, fileName)

  if (!project.engineering || typeof project.engineering !== 'object') throw new Error(`${fileName}: engineering must be an object.`)
  if (!project.learning || typeof project.learning !== 'object') throw new Error(`${fileName}: learning must be an object.`)
  requireFields(project.engineering, ['role', 'systemBoundary', 'callFlow', 'failureScenarios', 'evidence', 'knownLimits', 'overviewSummary'], fileName)
  ENGINEERING_ARRAY_FIELDS.forEach(field => requireStringArray(project.engineering, field, fileName))
  requireFields(project.learning, ['goal', 'verified', 'verification', 'tradeoffs', 'nextSteps'], fileName)
  LEARNING_ARRAY_FIELDS.forEach(field => requireStringArray(project.learning, field, fileName))
  return project
}

function parseProject(fileName) {
  const raw = readFileSync(new URL(fileName, CONTENT_DIR), 'utf8')
  const { meta } = parseMarkdownFrontmatter(raw, fileName)
  if (!isPublishable(meta)) return undefined
  assertProjectContract(meta, fileName)

  return assertProjectContract({
    id: Number(meta.id),
    legacyIds: Array.isArray(meta.legacyIds) ? meta.legacyIds.map(Number) : [],
    slug: String(meta.slug),
    name: String(meta.name),
    category: String(meta.category),
    featured: Boolean(meta.featured),
    publish: true,
    portfolioTier: String(meta.portfolioTier),
    activityStatus: String(meta.activityStatus),
    stage: String(meta.stage),
    sourceType: String(meta.sourceType),
    visibility: String(meta.visibility),
    repositoryUrl: meta.repositoryUrl ? String(meta.repositoryUrl) : undefined,
    positioning: String(meta.positioning),
    currentFocus: String(meta.currentFocus),
    verifiedEvidence: meta.verifiedEvidence.map(String),
    targetOutcome: String(meta.targetOutcome),
    nextMilestone: String(meta.nextMilestone),
    knownLimits: meta.knownLimits.map(String),
    updatedAt: String(meta.updatedAt),
    coreAbilities: meta.coreAbilities.map(String),
    talkingPoints: meta.talkingPoints.map(String),
    techStack: meta.techStack.map(String),
    engineering: meta.engineering,
    learning: meta.learning,
    conceptTags: meta.conceptTags.map(String),
    relatedArticleSlugs: meta.relatedArticleSlugs.map(String),
    suggestedQuestions: meta.suggestedQuestions.map(String),
  }, fileName)
}

let projects = readdirSync(CONTENT_DIR)
  .filter(file => file.endsWith('.md'))
  .sort()
  .map(parseProject)
  .filter(Boolean)

if (existsSync(OBSIDIAN_PUBLIC_URL)) {
  const snapshot = JSON.parse(readFileSync(OBSIDIAN_PUBLIC_URL, 'utf8'))
  if (!snapshot || !Array.isArray(snapshot.projects)) throw new Error('Invalid Obsidian public project snapshot.')
  const overlays = new Map(snapshot.projects.map(project => [project.siteSlug, project]))
  projects = projects.map(project => {
    const overlay = overlays.get(project.slug)
    if (!overlay) throw new Error(`Missing Obsidian public project: ${project.slug}`)
    return assertProjectContract(
      applyProjectPublicOverlay(project, overlay),
      `Obsidian overlay for ${project.slug}`,
    )
  })
  for (const slug of overlays.keys()) {
    if (!projects.some(project => project.slug === slug)) throw new Error(`Obsidian snapshot references unknown project: ${slug}`)
  }
}

const ids = new Set()
const slugs = new Set()
projects.forEach(project => {
  if (ids.has(project.id)) throw new Error(`Duplicate project id: ${project.id}`)
  if (slugs.has(project.slug)) throw new Error(`Duplicate project slug: ${project.slug}`)
  ids.add(project.id)
  slugs.add(project.slug)
  project.legacyIds.forEach(id => {
    if (ids.has(id)) throw new Error(`Duplicate project or legacy id: ${id}`)
    ids.add(id)
  })
})

const output = `/* eslint-disable */\n// Generated by scripts/generate-projects.mjs. Do not edit by hand.\n\nexport type ProjectStage = 'exploring' | 'building' | 'verified-local' | 'showcase-ready'\nexport type ProjectSourceType = 'original' | 'adapted' | 'source-study'\nexport type ProjectVisibility = 'private' | 'public' | 'none'\nexport type ProjectPortfolioTier = 'flagship' | 'verified' | 'exploration' | 'paused'\nexport type ProjectActivityStatus = 'active' | 'paused' | 'completed'\n\nexport interface Project {\n  id: number\n  legacyIds: number[]\n  slug: string\n  name: string\n  category: string\n  featured: boolean\n  publish: true\n  portfolioTier: ProjectPortfolioTier\n  activityStatus: ProjectActivityStatus\n  stage: ProjectStage\n  sourceType: ProjectSourceType\n  visibility: ProjectVisibility\n  repositoryUrl?: string\n  positioning: string\n  currentFocus: string\n  verifiedEvidence: string[]\n  targetOutcome: string\n  nextMilestone: string\n  knownLimits: string[]\n  updatedAt: string\n  coreAbilities: string[]\n  talkingPoints: string[]\n  techStack: string[]\n  engineering: { role: string; systemBoundary: string; callFlow: string[]; failureScenarios: string[]; evidence: string[]; knownLimits: string[]; overviewSummary: string }\n  learning: { goal: string; verified: string[]; verification: string[]; verificationNote?: string; tradeoffs: string[]; nextSteps: string[] }\n  conceptTags: string[]\n  relatedArticleSlugs: string[]\n  suggestedQuestions: string[]\n}\n\nexport const projects: Project[] = ${JSON.stringify(projects, null, 2)}\n`

mkdirSync(new URL('../src/data/', import.meta.url), { recursive: true })
writeFileSync(OUTPUT_URL, output)
console.log(`Generated ${projects.length} projects from content/projects.`)
