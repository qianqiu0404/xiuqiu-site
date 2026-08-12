const DOMAINS = new Set(['learning', 'market'])
const DECISIONS = new Set(['approve', 'reject'])
const TARGET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/
const WORKFLOW_RUN_PATTERN = /^[0-9]{1,20}$/
const RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/

export class TimelineReviewError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'TimelineReviewError'
    this.code = code
  }
}

function fail(code, message) {
  throw new TimelineReviewError(code, message)
}

function isSafeNoteCodePoint(codePoint) {
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return false
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) return false
  if (codePoint >= 0xfdd0 && codePoint <= 0xfdef) return false
  if ((codePoint & 0xffff) === 0xfffe || (codePoint & 0xffff) === 0xffff) return false
  if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) return false
  return true
}

export function sanitizeTimelineReviewNote(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const sanitized = [...String(value).normalize('NFC')]
    .map(character => isSafeNoteCodePoint(character.codePointAt(0)) ? character : ' ')
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
  return [...sanitized].slice(0, 1000).join('') || null
}

export function validateTimelineReviewInput(input) {
  const domain = String(input?.domain || '')
  const targetId = String(input?.targetId || '')
  const decision = String(input?.decision || '')
  const requestedBy = String(input?.requestedBy || '').toLowerCase()
  const approvedBy = String(input?.approvedBy || '').toLowerCase()
  const workflowRunId = String(input?.workflowRunId || '')
  const expectedVersion = String(input?.expectedVersion || '')
  const releaseSha = String(input?.releaseSha || '')
  if (!DOMAINS.has(domain)) fail('invalid_domain', 'Review domain must be learning or market')
  if (!TARGET_ID_PATTERN.test(targetId)) fail('invalid_target_id', 'Review target ID has an invalid format')
  if (!DECISIONS.has(decision)) fail('invalid_decision', 'Review decision must be approve or reject')
  if (!GITHUB_LOGIN_PATTERN.test(requestedBy)) fail('invalid_requested_by', 'Requesting GitHub actor has an invalid format')
  if (!GITHUB_LOGIN_PATTERN.test(approvedBy)) fail('invalid_approved_by', 'Approving GitHub reviewer has an invalid format')
  if (requestedBy === approvedBy) fail('requester_cannot_approve', 'The requester and Environment approver must be different users')
  if (!WORKFLOW_RUN_PATTERN.test(workflowRunId)) fail('invalid_workflow_run', 'GitHub workflow run ID has an invalid format')
  if (!RELEASE_SHA_PATTERN.test(releaseSha)) fail('invalid_release_sha', 'Release SHA must be a full lowercase commit SHA')
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(expectedVersion)
    || !Number.isFinite(Date.parse(expectedVersion))) {
    fail('invalid_expected_version', 'Expected version must be an exact UTC timestamp')
  }
  return {
    domain,
    targetId,
    decision,
    requestedBy,
    approvedBy,
    workflowRunId,
    expectedVersion,
    releaseSha,
    note: sanitizeTimelineReviewNote(input.note),
  }
}

export async function reviewTimelineTarget(client, rawInput) {
  const input = validateTimelineReviewInput(rawInput)
  await client.query('begin')
  try {
    const result = await client.query(`select new_status, replayed, decided_at
      from radar_system.review_timeline($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9)`, [
      input.domain,
      input.targetId,
      input.decision,
      input.note,
      input.requestedBy,
      input.approvedBy,
      input.workflowRunId,
      input.expectedVersion,
      input.releaseSha,
    ])
    if (result.rowCount !== 1) fail('review_failed', 'Timeline review did not return an audit result')
    await client.query('commit')
    return {
      domain: input.domain,
      targetId: input.targetId,
      decision: input.decision,
      newStatus: result.rows[0].new_status,
      decidedAt: result.rows[0].decided_at,
      replayed: result.rows[0].replayed,
    }
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    throw error
  }
}
