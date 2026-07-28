const FORBIDDEN_URL_PUNCTUATION_RE = /[`、，。；：！？（）【】《》“”‘’]/
const NON_ASCII_RE = /[^\x21-\x7e]/

export function isPublishable(meta) {
  return meta?.publish === true
}

export function applyProjectPublicOverlay(project, overlay) {
  return {
    ...project,
    stage: overlay.stage,
    portfolioTier: overlay.portfolioTier,
    activityStatus: overlay.activityStatus,
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
