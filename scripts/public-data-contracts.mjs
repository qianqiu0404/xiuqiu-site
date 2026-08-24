const FORBIDDEN_URL_PUNCTUATION_RE = /[`、，。；：！？（）【】《》“”‘’]/
const NON_ASCII_RE = /[^\x21-\x7e]/

export const PROJECT_PUBLIC_OVERLAY_SOURCE = 'explicit-publish-frontmatter/v1'
export const PROJECT_STAGES = ['exploring', 'building', 'verified-local', 'showcase-ready']
export const PROJECT_PORTFOLIO_TIERS = ['flagship', 'verified', 'exploration', 'paused']
export const PROJECT_ACTIVITY_STATUSES = ['active', 'paused', 'completed']
export const PROJECT_VISIBILITIES = ['private', 'public', 'none']
export const PROJECT_PUBLIC_ROLES = ['current-product', 'current-direction', 'historical-evidence']
export const PROJECT_CLAIM_STATES = ['locked', 'evidence-ready', 'publishable']

const PROJECT_PUBLIC_OVERLAY_FIELDS = [
  'projectId', 'siteSlug', 'publicRole', 'claimState', 'stage', 'portfolioTier',
  'activityStatus', 'visibility', 'updatedAt', 'publicSummary',
  'publicEvidence', 'publicNextMilestone',
]
const PROJECT_PUBLIC_SNAPSHOT_FIELDS = ['generatedAt', 'source', 'projects']
const PRIVATE_PUBLIC_TEXT_RE = /(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\|薪资|伴侣|身份证|助记词|私钥|private\s+key|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_ -]?key|access[_ -]?token|password|passwd|secret)\s*[:=]\s*\S+)/i

function assertExactKeys(value, allowedFields, label) {
  const allowed = new Set(allowedFields)
  const unexpected = Object.keys(value).filter(field => !allowed.has(field))
  if (unexpected.length) {
    throw new Error(`${label}: unexpected fields ${unexpected.sort().join(', ')}.`)
  }
}

function assertEnum(value, allowedValues, label) {
  if (!allowedValues.includes(value)) {
    throw new Error(`${label}: unknown value ${value}.`)
  }
}

export function assertPublicExportSafe(value, label = 'public export') {
  if (PRIVATE_PUBLIC_TEXT_RE.test(JSON.stringify(value))) {
    throw new Error(`${label}: public fields contain private, local-only or credential-shaped text.`)
  }
  return value
}

export function isPublishable(meta) {
  return meta?.publish === true
}

export function assertProjectPublicStatus(project, label = 'project') {
  if (!PROJECT_PUBLIC_ROLES.includes(project?.publicRole)) {
    throw new Error(`${label}: unknown publicRole ${project?.publicRole}.`)
  }
  if (!PROJECT_CLAIM_STATES.includes(project?.claimState)) {
    throw new Error(`${label}: unknown claimState ${project?.claimState}.`)
  }
  assertEnum(project?.activityStatus, PROJECT_ACTIVITY_STATUSES, `${label}: activityStatus`)
  if (['current-product', 'current-direction'].includes(project.publicRole) && project.activityStatus !== 'active') {
    throw new Error(`${label}: ${project.publicRole} must have activityStatus active.`)
  }
  if (project.publicRole === 'historical-evidence' && project.activityStatus === 'active') {
    throw new Error(`${label}: historical-evidence must not have activityStatus active.`)
  }
  return project
}

export function indexProjectPublicOverlays(snapshot, reviewedProjectSources, label = 'Obsidian public project snapshot') {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error(`${label}: expected an object.`)
  }
  assertExactKeys(snapshot, PROJECT_PUBLIC_SNAPSHOT_FIELDS, label)
  if (
    typeof snapshot.generatedAt !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(snapshot.generatedAt)
    || Number.isNaN(Date.parse(snapshot.generatedAt))
    || new Date(snapshot.generatedAt).toISOString() !== snapshot.generatedAt
  ) {
    throw new Error(`${label}: generatedAt must be an ISO timestamp generated in UTC.`)
  }
  if (snapshot.source !== PROJECT_PUBLIC_OVERLAY_SOURCE) {
    throw new Error(`${label}: source must be ${PROJECT_PUBLIC_OVERLAY_SOURCE}.`)
  }
  if (!Array.isArray(snapshot.projects)) {
    throw new Error(`${label}: projects must be an array.`)
  }

  if (!Array.isArray(reviewedProjectSources)) {
    throw new Error(`${label}: reviewed project sources must be an array.`)
  }
  const expectedProjectIds = new Map()
  for (const source of reviewedProjectSources) {
    const siteSlug = typeof source === 'string' ? source : source?.siteSlug
    const projectId = typeof source === 'string' ? source : source?.projectId
    if (
      typeof siteSlug !== 'string'
      || !siteSlug.trim()
      || siteSlug !== siteSlug.trim()
      || typeof projectId !== 'string'
      || !projectId.trim()
      || projectId !== projectId.trim()
    ) {
      throw new Error(`${label}: reviewed project source identities must be non-empty trimmed strings.`)
    }
    if (expectedProjectIds.has(siteSlug)) {
      throw new Error(`${label}: duplicate reviewed project source ${siteSlug}.`)
    }
    expectedProjectIds.set(siteSlug, projectId)
  }
  const overlays = new Map()
  for (const overlay of snapshot.projects) {
    if (!overlay || typeof overlay !== 'object' || Array.isArray(overlay)) {
      throw new Error(`${label}: each project must be an object.`)
    }
    assertExactKeys(overlay, PROJECT_PUBLIC_OVERLAY_FIELDS, `${label}: ${overlay.siteSlug || 'project'}`)
    for (const field of PROJECT_PUBLIC_OVERLAY_FIELDS) {
      if (overlay?.[field] === undefined || overlay[field] === null || overlay[field] === '') {
        throw new Error(`${label}: ${overlay?.siteSlug || 'project'} is missing ${field}.`)
      }
    }
    for (const field of PROJECT_PUBLIC_OVERLAY_FIELDS.filter(field => field !== 'publicEvidence')) {
      if (typeof overlay[field] !== 'string' || !overlay[field].trim() || overlay[field] !== overlay[field].trim()) {
        throw new Error(`${label}: ${overlay.siteSlug} ${field} must be a non-empty trimmed string.`)
      }
    }
    if (
      !Array.isArray(overlay.publicEvidence)
      || overlay.publicEvidence.length === 0
      || overlay.publicEvidence.some(item => typeof item !== 'string' || !item.trim() || item !== item.trim())
    ) {
      throw new Error(`${label}: ${overlay.siteSlug} publicEvidence must contain non-empty trimmed strings.`)
    }
    assertProjectPublicStatus(overlay, `${label}: ${overlay.siteSlug}`)
    assertEnum(overlay.stage, PROJECT_STAGES, `${label}: ${overlay.siteSlug} stage`)
    assertEnum(overlay.portfolioTier, PROJECT_PORTFOLIO_TIERS, `${label}: ${overlay.siteSlug} portfolioTier`)
    assertEnum(overlay.visibility, PROJECT_VISIBILITIES, `${label}: ${overlay.siteSlug} visibility`)
    if (!expectedProjectIds.has(overlay.siteSlug)) {
      throw new Error(`${label}: unknown project ${overlay.siteSlug}.`)
    }
    const expectedProjectId = expectedProjectIds.get(overlay.siteSlug)
    if (overlay.projectId !== expectedProjectId) {
      throw new Error(`${label}: ${overlay.siteSlug} projectId must be ${expectedProjectId}.`)
    }
    if (overlays.has(overlay.siteSlug)) {
      throw new Error(`${label}: duplicate project ${overlay.siteSlug}.`)
    }
    assertPublicExportSafe(overlay, `${label}: ${overlay.siteSlug}`)
    overlays.set(overlay.siteSlug, overlay)
  }
  return overlays
}

export function assertProjectPublicOverlayMatches(project, overlay, label = 'Obsidian public project overlay') {
  for (const field of ['publicRole', 'claimState', 'visibility']) {
    if (overlay[field] !== project[field]) {
      throw new Error(`${label}: ${field} must match the reviewed release artifact.`)
    }
  }
  return overlay
}

export function applyProjectPublicOverlay(project, overlay) {
  return {
    ...project,
    stage: overlay.stage,
    portfolioTier: overlay.portfolioTier,
    activityStatus: overlay.activityStatus,
    visibility: overlay.visibility,
    positioning: overlay.publicSummary,
    verifiedEvidence: overlay.publicEvidence,
    nextMilestone: overlay.publicNextMilestone,
    updatedAt: overlay.updatedAt,
  }
}

export function assertPublicHttpUrl(value, label = 'source URL') {
  if (typeof value !== 'string' || !value) {
    throw new Error(`${label} must be a complete http(s) URL.`)
  }
  if (value !== value.trim() || /\s/.test(value)) {
    throw new Error(`${label} must not contain whitespace.`)
  }
  if (FORBIDDEN_URL_PUNCTUATION_RE.test(value) || NON_ASCII_RE.test(value)) {
    throw new Error(`${label} contains forbidden punctuation or non-ASCII characters.`)
  }

  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${label} must be a complete http(s) URL.`)
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || !parsed.hostname.includes('.')) {
    throw new Error(`${label} must be a complete http(s) URL.`)
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${label} must not contain embedded credentials.`)
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '')
  const unwrappedHostname = hostname.replace(/^\[|\]$/g, '')
  if (hostname === 'example.com' || hostname.endsWith('.example.com')) {
    throw new Error(`${label} must not use example.com.`)
  }
  if (
    hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || hostname === '0.0.0.0'
    || hostname.startsWith('127.')
    || hostname === '[::1]'
    || hostname.startsWith('10.')
    || hostname.startsWith('192.168.')
    || hostname.startsWith('169.254.')
    || /^172\.(?:1[6-9]|2\d|3[01])\./.test(hostname)
    || unwrappedHostname === '::1'
    || /^(?:fc|fd)[0-9a-f]{2}:/.test(unwrappedHostname)
    || /^fe[89ab][0-9a-f]:/.test(unwrappedHostname)
  ) {
    throw new Error(`${label} must use a public hostname.`)
  }

  return value
}

export function assertProjectRepositoryVisibility(project, label = 'project') {
  const repositoryUrl = typeof project.repositoryUrl === 'string' && project.repositoryUrl
    ? project.repositoryUrl
    : undefined

  if (project.visibility === 'public') {
    if (!repositoryUrl) {
      throw new Error(`${label}: visibility public requires repositoryUrl.`)
    }
    assertPublicHttpUrl(repositoryUrl, `${label} repositoryUrl`)
    return
  }

  if (repositoryUrl) {
    throw new Error(`${label}: repositoryUrl is only allowed when visibility is public.`)
  }
}
