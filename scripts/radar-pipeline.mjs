import { readFileSync } from 'node:fs'

export const PUBLIC_RADAR_SECTIONS = ['crypto', 'radar', 'vibe', 'reading']
export const MIN_RADAR_SECTIONS = 3

const PRIVATE_MARKERS = ['briefing', 'practice']
const PRIVATE_TERMS = ['晚间复盘', '求职计划', '个人日记', '助记词', '私钥', 'briefing', 'practice']
const ABSOLUTE_PATH_RE = /(?:\/Users\/|\/home\/|[A-Za-z]:\\|iCloud~md~obsidian)/
const SECRET_RE = /(?:api[_-]?key|access[_-]?token|secret|mnemonic|seed phrase)\s*[:=]\s*[^\s]+/i
const URL_RE = /https?:\/\/[^\s)\]>"']+/g

export function extractMarkerBlock(source, name) {
  const pattern = new RegExp(`<!--\\s*${name}:start\\s*-->([\\s\\S]*?)<!--\\s*${name}:end\\s*-->`, 'i')
  return source.match(pattern)?.[1]?.trim() || ''
}

export function parseDailyResearchSource(source) {
  const sections = Object.fromEntries(PUBLIC_RADAR_SECTIONS.map(name => [name, extractMarkerBlock(source, name)]))
  const succeeded = PUBLIC_RADAR_SECTIONS.filter(name => sections[name].length > 0)
  return {
    sections,
    succeeded,
    missing: PUBLIC_RADAR_SECTIONS.filter(name => !succeeded.includes(name)),
    sourceUrls: extractUrls(succeeded.map(name => sections[name]).join('\n')),
  }
}

export function extractUrls(value) {
  return [...new Set((value.match(URL_RE) || []).map(url => url.replace(/[.,;，。；]+$/, '')))]
}

export function assertSafeSource(source) {
  PRIVATE_MARKERS.forEach(marker => extractMarkerBlock(source, marker))
}

export function validateRadarCandidate(candidate, source) {
  const errors = []
  const parsed = parseDailyResearchSource(source)
  const serialized = JSON.stringify(candidate)
  const candidateUrls = extractUrls(serialized)
  const sourceUrlSet = new Set(parsed.sourceUrls)

  if (parsed.succeeded.length < MIN_RADAR_SECTIONS) errors.push(`Only ${parsed.succeeded.length} public source sections succeeded.`)
  if (candidate.publish !== true) errors.push('publish must be true.')
  if (candidate.reviewStatus !== 'automated') errors.push('reviewStatus must be automated.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate.date || '')) errors.push('date must use YYYY-MM-DD.')
  if (candidate.slug !== candidate.date) errors.push('slug must equal date for idempotent daily updates.')
  if (!Array.isArray(candidate.sourceSections) || candidate.sourceSections.some(name => !PUBLIC_RADAR_SECTIONS.includes(name))) errors.push('sourceSections contains an unknown section.')
  if ((candidate.marketSignals || []).length > 3) errors.push('marketSignals must contain at most 3 items.')
  try { assertPublicRadarContent(candidate) } catch (error) { errors.push(error instanceof Error ? error.message : String(error)) }
  candidateUrls.forEach(url => { if (!sourceUrlSet.has(url)) errors.push(`Output URL does not exist in the source: ${url}`) })

  if (errors.length) throw new Error(errors.join('\n'))
  return { ...parsed, candidateUrls }
}

export function assertPublicRadarContent(candidate) {
  const serialized = JSON.stringify(candidate)
  const errors = []
  if (ABSOLUTE_PATH_RE.test(serialized)) errors.push('Output contains a local absolute path.')
  if (SECRET_RE.test(serialized)) errors.push('Output may contain credentials or secret material.')
  PRIVATE_TERMS.forEach(term => { if (serialized.toLowerCase().includes(term.toLowerCase())) errors.push(`Output contains private term: ${term}`) })
  if (errors.length) throw new Error(errors.join('\n'))
}

export function loadDailyResearchSource(path) {
  const source = readFileSync(path, 'utf8')
  assertSafeSource(source)
  return source
}
