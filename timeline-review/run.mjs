import { withRadarDatabaseLock } from '../market-radar/worker/advisory-lock.mjs'
import { reviewTimelineTarget } from './command.mjs'

const databaseUrl = process.env.TIMELINE_REVIEW_DATABASE_URL
if (!databaseUrl) throw new Error('TIMELINE_REVIEW_DATABASE_URL is required')

const result = await withRadarDatabaseLock({ databaseUrl, wait: true }, ({ client }) => (
  reviewTimelineTarget(client, {
    domain: process.env.REVIEW_DOMAIN,
    targetId: process.env.REVIEW_TARGET_ID,
    decision: process.env.REVIEW_DECISION,
    note: process.env.REVIEW_NOTE,
    requestedBy: process.env.GITHUB_ACTOR,
    approvedBy: process.env.REVIEW_APPROVED_BY,
    workflowRunId: process.env.GITHUB_RUN_ID,
    expectedVersion: process.env.REVIEW_EXPECTED_VERSION,
    releaseSha: process.env.RELEASE_SHA,
  })
))

if (!result.acquired) throw new Error('Timeline review database lock was not acquired')
void result.value
console.log('Protected timeline review transaction completed.')
