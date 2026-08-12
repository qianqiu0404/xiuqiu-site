import { createHash } from 'node:crypto'

export const RADAR_ORIGIN = 'research'
export const RADAR_PUBLICATION_STATE = 'published'

const QA_MARKER_RE = /(?:\[preview\s+pr|preview\s*qa|test\s*fixture|fixture\s*data|测试夹具|验收夹具)/i
const LOCAL_ENGINEERING_RE = /(?:xiuqiu(?:-site)?[^。\n]{0,48}(?:pull request|\bpr\b|ci|deploy|deployment|preview|vercel|neon)|(?:pull request|\bpr\s*#?\d+|ci run|github actions|vercel preview|neon preview)[^。\n]{0,48}xiuqiu)/i

function normalize(value) {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalize(child)]),
    )
  }
  return value
}

export function stableRadarJson(value) {
  return JSON.stringify(normalize(value))
}

export function assertResearchPublication(value, label = 'radar publication') {
  const serialized = stableRadarJson(value)
  if (QA_MARKER_RE.test(serialized)) throw new Error(`${label} contains Preview or QA fixture content.`)
  if (LOCAL_ENGINEERING_RE.test(serialized)) throw new Error(`${label} contains local PR, CI, deployment or Preview content.`)
}

export function buildRadarPublication(kind, value) {
  if (!['learning', 'market'].includes(kind)) throw new Error(`Unsupported radar kind: ${kind}`)
  assertResearchPublication(value, `${kind} radar`)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${kind} radar must be an object.`)
  if (typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) throw new Error(`${kind} radar date must use YYYY-MM-DD.`)
  const asOfDate = new Date(value.generatedAt)
  if (Number.isNaN(asOfDate.getTime())) throw new Error(`${kind} radar generatedAt must be an ISO datetime.`)
  const payload = normalize(value)
  const payloadChecksum = createHash('sha256').update(stableRadarJson(payload)).digest('hex')
  return {
    snapshotId: `${kind}-${value.date}-${payloadChecksum.slice(0, 16)}`,
    asOf: asOfDate.toISOString(),
    origin: RADAR_ORIGIN,
    publicationState: RADAR_PUBLICATION_STATE,
    payloadChecksum,
    payload,
  }
}

export function selectRadarDataset(staticDataset, apiDataset) {
  if (!apiDataset) return staticDataset
  if (!staticDataset) return apiDataset
  return apiDataset.snapshotId === staticDataset.snapshotId ? apiDataset : staticDataset
}
