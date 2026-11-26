import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import './radar-entry-modules.test.mjs'
import { assertPublicRadarContent, parseDailyResearchSource, validateRadarCandidate } from './radar-pipeline.mjs'
import { parseMarkdownFrontmatter } from './frontmatter.mjs'

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

function readPublishedLearningEdition() {
  const source = new URL('../content/radar/2026-11-16.md', import.meta.url)
  return parseMarkdownFrontmatter(readFileSync(source, 'utf8'), source.pathname).meta
}

test('the published November 16 learning edition passes the publication safety check unchanged', () => {
  assert.doesNotThrow(() => assertPublicRadarContent(readPublishedLearningEdition()))
})

test('quoted fields and separate path fragments do not become local paths during safety checks', () => {
  const candidate = {
    ...base,
    metadata: {
      'chainId:"1"': [
        'nonce:"0"',
        { example: 'chainId:"1", nonce:"0"' },
        ['/Us', 'ers/example'],
        ['C:', 'relative-component'],
      ],
    },
  }
  assert.doesNotThrow(() => assertPublicRadarContent(candidate))
})

test('local paths in nested arrays, values and object keys still stop publication', () => {
  const paths = [
    '/Users/example/report.md',
    '/home/example/report.md',
    String.raw`C:\Research\report.md`,
    String.raw`D:\Research\report.md`,
    'iCloud~md~obsidian',
  ]
  for (const path of paths) {
    const valueCandidate = { ...base, metadata: [{ nested: ['safe', { value: path }] }] }
    const keyCandidate = { ...base, metadata: [{ nested: { [path]: 'safe' } }] }
    assert.throws(() => assertPublicRadarContent(valueCandidate), /local absolute path/, path)
    assert.throws(() => assertPublicRadarContent(keyCandidate), /local absolute path/, path)
  }
})

test('credential, private text, source URL, schema and publication checks remain independent', () => {
  assert.throws(
    () => assertPublicRadarContent({ ...base, metadata: [{ text: 'api_key=synthetic-value' }] }),
    /credentials or secret material/,
  )
  assert.throws(
    () => assertPublicRadarContent({ ...base, metadata: [{ text: '求职计划' }] }),
    /private term/,
  )
  assert.throws(
    () => assertPublicRadarContent({ ...base, sourceUrls: ['https://'] }),
    /sourceUrls\[0\]/,
  )
  assert.throws(
    () => assertPublicRadarContent({ ...readPublishedLearningEdition(), briefs: [] }),
    /briefs/,
  )
  assert.throws(
    () => assertPublicRadarContent({ ...base, summary: '[Preview QA]' }),
    /Preview or QA fixture/,
  )
})
