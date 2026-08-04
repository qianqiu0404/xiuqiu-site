import assert from 'node:assert/strict'
import test from 'node:test'
import { parseDailyResearchSource, validateRadarCandidate } from './radar-pipeline.mjs'

const sourceUrls = {
  crypto: 'https://github.com/ethereum/go-ethereum',
  radar: 'https://eips.ethereum.org/',
  vibe: 'https://github.com/vercel-labs/agent-browser',
  reading: 'https://github.blog/ai-and-ml/',
  briefing: 'https://github.com/openai/openai-node',
}
const block = name => `<!-- ${name}:start -->\n${name} [source](${sourceUrls[name]})\n<!-- ${name}:end -->`
const source = ['crypto', 'radar', 'vibe', 'reading', 'briefing'].map(block).join('\n')
const base = { date: '2026-07-13', slug: '2026-07-13', publish: true, reviewStatus: 'automated', sourceSections: ['crypto', 'radar', 'vibe', 'reading'], marketSignals: [], sourceUrls: [sourceUrls.crypto] }

test('only allowlisted blocks are parsed', () => {
  const parsed = parseDailyResearchSource(source)
  assert.deepEqual(parsed.succeeded, ['crypto', 'radar', 'vibe', 'reading'])
  assert.equal(JSON.stringify(parsed.sections).includes('briefing'), false)
})

test('three public blocks are sufficient and missing blocks are explicit', () => {
  const partial = ['crypto', 'radar', 'reading'].map(block).join('\n')
  assert.doesNotThrow(() => validateRadarCandidate({ ...base, sourceSections: ['crypto', 'radar', 'reading'] }, partial))
  assert.deepEqual(parseDailyResearchSource(partial).missing, ['vibe'])
})

test('fewer than three blocks stop publishing', () => {
  assert.throws(() => validateRadarCandidate(base, ['crypto', 'radar'].map(block).join('\n')), /Only 2/)
})

test('invented URLs and private data stop publishing', () => {
  assert.throws(() => validateRadarCandidate({ ...base, sourceUrls: ['https://invented.example/x'] }, source), /does not exist/)
  assert.throws(() => validateRadarCandidate({ ...base, unsafeText: '/Users/name/private' }, source), /absolute path/)
  assert.throws(() => validateRadarCandidate({ ...base, unsafeText: '求职计划' }, source), /private term/)
})

test('malformed and placeholder source URLs stop publishing', () => {
  const invalidUrls = [
    'https://example.com/source',
    'https://github.com/vercel-labs/agent-browser`',
    'https://github.com/vercel-labs/agent-browser、extra',
    'https://github.com/vercel-labs/agent browser',
    'github.com/vercel-labs/agent-browser',
    'ftp://github.com/vercel-labs/agent-browser',
  ]

  invalidUrls.forEach(url => {
    assert.throws(
      () => validateRadarCandidate({ ...base, sourceUrls: [url] }, source),
      /sourceUrls\[0\]|source URL/,
      url,
    )
  })
  assert.throws(
    () => validateRadarCandidate({ ...base, aiTip: { title: 'AI', summary: 'Summary', sourceUrl: 'https://' } }, source),
    /aiTip\[0\]\.sourceUrl/,
  )
})

test('date slug makes same-day publishing idempotent', () => {
  assert.throws(() => validateRadarCandidate({ ...base, slug: 'another-copy' }, source), /slug must equal date/)
})
