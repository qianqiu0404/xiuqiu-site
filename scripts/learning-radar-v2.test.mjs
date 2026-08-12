import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parseMarkdownFrontmatter } from './frontmatter.mjs'
import { collectLearningSourceUrls, normalizeLearningEditionV2, validateLearningEditionV2 } from './learning-radar-v2.mjs'
import { buildLearningDailyNotification } from './radar-notification-contracts.mjs'

const readEdition = date => parseMarkdownFrontmatter(
  readFileSync(new URL(`../content/radar/${date}.md`, import.meta.url), 'utf8'),
  date,
).meta

for (const date of ['2026-08-10', '2026-08-11', '2026-08-12']) {
  test(`${date} is a complete, dated, source-backed v2 backfill`, () => {
    const edition = readEdition(date)
    assert.doesNotThrow(() => validateLearningEditionV2(edition))
    assert.equal(edition.editionMode, 'backfill')
    assert.equal(edition.briefs.filter(item => item.domain === 'ai').length, 2)
    assert.equal(edition.briefs.filter(item => item.domain === 'web3').length, 2)
    assert.equal(edition.deepDive.basedOnBriefId.length > 0, true)
    assert.equal('sourceUrls' in edition, false)
    assert.deepEqual(normalizeLearningEditionV2(edition).sourceUrls, collectLearningSourceUrls(edition))
  })
}

const valid = readEdition('2026-08-12')
const clone = value => structuredClone(value)

test('fails closed on Tier 2-only event evidence and discovery-only final sources', () => {
  const tier2Only = clone(valid)
  tier2Only.briefs[0].sources[0].tier = 'tier2'
  assert.throws(() => validateLearningEditionV2(tier2Only), /dated Tier 1 event source/)

  const aihot = clone(valid)
  aihot.briefs[0].sources[0].url = 'https://aihot.virxact.com/items/123'
  assert.throws(() => validateLearningEditionV2(aihot), /discovery-only/)
})

test('fails closed on local engineering content, missing fields and future evidence', () => {
  const local = clone(valid)
  local.briefs[0].whatHappened = 'xiuqiu PR #99 Preview deployment 已完成，这是一段仅供工程验收使用的本地信息。'
  assert.throws(() => validateLearningEditionV2(local), /local PR, CI, deployment or Preview/)

  const missing = clone(valid)
  delete missing.briefs[0].workedExample
  assert.throws(() => validateLearningEditionV2(missing), /workedExample/)

  const future = clone(valid)
  future.briefs[0].sources[0].publishedAt = '2026-08-13T00:00:00Z'
  assert.throws(() => validateLearningEditionV2(future), /later than the edition date/)
})

test('fails closed on duplicate sources and invalid deep-dive references', () => {
  const duplicate = clone(valid)
  duplicate.briefs[1].sources[0].url = duplicate.briefs[0].sources[0].url
  assert.throws(() => validateLearningEditionV2(duplicate), /duplicate across the edition/)

  const missingParent = clone(valid)
  missingParent.deepDive.basedOnBriefId = 'not-a-brief'
  assert.throws(() => validateLearningEditionV2(missingParent), /reference one of the four briefs/)
})

test('v2 learning notifications are explicitly disabled until M4', () => {
  assert.throws(() => buildLearningDailyNotification({ schemaVersion: 2 }), /disabled until M4/)
})
