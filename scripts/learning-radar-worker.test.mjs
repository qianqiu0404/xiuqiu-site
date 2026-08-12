import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parse } from 'yaml'
import { AIHOT_SOURCE, LEARNING_SOURCES } from '../learning-radar/worker/config.mjs'
import {
  areLearningItemsInSameCluster,
  decideLearningPublication,
  detectLearningSourceConflicts,
  encodeLearningSourceCursor,
  learningHourSlot,
  newestLearningCursor,
  normalizeLearningItem,
  normalizeLearningUrl,
  parseLearningSourceCursor,
  registrableDomain,
  selectItemsAfterCursor,
  validateLearningAiOutput,
} from '../learning-radar/worker/core.mjs'
import {
  analyzeLearningItem,
  assertConfiguredLearningEndpoint,
  assertSafeOriginUrl,
  collectLearningSource,
  extractOriginMetadata,
  fetchConfiguredLearningEndpoint,
  isBlockedAddress,
  parseAihotPayload,
  parseLearningGitHubReleases,
  requestPinnedOrigin,
  sourceMatchesRegistry,
  verifyOriginUrl,
} from '../learning-radar/worker/providers.mjs'
import {
  buildLearningDailyDigest,
  generateLearningDailyDigest,
  runLearningDailyDigest,
} from '../learning-radar/worker/digests.mjs'
import { persistPreparedLearningItem } from '../learning-radar/worker/persistence.mjs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const publicResolver = async () => [{ address: '93.184.216.34', family: 4 }]
const now = new Date('2026-08-11T08:00:00Z')

function originResponse(body = '', {
  status = 200,
  headers = { 'content-type': 'text/html; charset=utf-8' },
  url = '',
} = {}) {
  const responseHeaders = new Headers(headers)
  return { ok: status >= 200 && status < 300, status, headers: responseHeaders, bodyText: body, url }
}

function normalized(overrides = {}) {
  return normalizeLearningItem({
    provider: 'openai_node_releases',
    providerId: 'openai/openai-node:101',
    category: 'ai',
    title: 'OpenAI Node SDK v6.0 released',
    excerpt: 'The official SDK adds a stable response interface.',
    sourceUrl: 'https://github.com/openai/openai-node/releases/tag/v6.0.0',
    publishedAt: '2026-08-11T07:00:00Z',
    isOfficial: true,
    discoveredVia: 'openai_node_releases',
    sourceName: 'OpenAI SDK Releases',
    originVerifiedAt: '2026-08-11T07:05:00Z',
    verificationState: 'verified',
    rawPayload: { retained: true },
    ...overrides,
  }, { now })
}

test('locked Learning candidate exact replay is zero-write and changed evidence uses a distinct revision provider id',async()=>{
  const item=normalized();const prepared={item,analysis:null}
  const replayStatements=[];const replayClient={query:async statement=>{replayStatements.push(statement);if(statement.includes('from learning_radar.stories s')&&statement.includes('exact_replay'))return{rows:[{id:'locked',exact_replay:true}]};return{rows:[]}}}
  const replay=await persistPreparedLearningItem(replayClient,prepared,{now});assert.equal(replay.replayed,true);assert.deepEqual(replayStatements.filter(statement=>/insert|update/i.test(statement)),[])
  let revisionProviderId=null
  const changedClient={query:async(statement,values=[])=>{
    if(statement.includes('from learning_radar.stories s')&&statement.includes('exact_replay'))return{rows:[{id:'locked',exact_replay:false}]}
    if(statement.includes('from learning_radar.stories s')&&statement.includes('join learning_radar.story_sources'))return{rows:[]}
    if(statement.includes('from learning_radar.stories s')&&statement.includes('left join learning_radar.story_sources'))return{rows:[]}
    if(statement.includes('from learning_radar.raw_items'))return{rows:[]}
    if(statement.includes('insert into learning_radar.raw_items')){revisionProviderId=values[2];throw new Error('revision_probe')}
    return{rows:[]}
  }}
  await assert.rejects(persistPreparedLearningItem(changedClient,{...prepared,item:{...item,excerpt:'Corrected official excerpt.'}},{now}),/revision_probe/)
  assert.match(revisionProviderId,/^openai\/openai-node:101:revision:[0-9a-f]{16}$/)
})

function validAnalysis(overrides = {}) {
  return validateLearningAiOutput({
    titleZh: 'OpenAI Node SDK 发布稳定接口',
    summaryZh: '官方 SDK 发布新版本，并更新了稳定接口。',
    whySelectedZh: '这会影响 AI 应用的升级与兼容边界。',
    importance: 'key', internalScore: 86, hasConflict: false,
    ...overrides,
  })
}

test('source registry binds official status to exact repo, host and category', () => {
  assert.deepEqual(new Set(LEARNING_SOURCES.map(source => source.category)),
    new Set(['ai', 'web3_wallet', 'engineering_tools', 'reading']))
  const definition = LEARNING_SOURCES.find(source => source.key === 'openai_node_releases')
  const [release] = parseLearningGitHubReleases([{
    id: 101, tag_name: 'v6.0.0', name: 'OpenAI Node SDK v6', draft: false,
    html_url: 'https://github.com/openai/openai-node/releases/tag/v6.0.0',
    published_at: '2026-08-11T07:00:00Z', body: 'Stable response interface.',
  }], definition)
  assert.equal(sourceMatchesRegistry(release, definition), true)
  assert.equal(sourceMatchesRegistry({ ...release, sourceUrl: 'https://github.com/attacker/openai-node/releases/tag/v6' }, definition), false)
  assert.equal(sourceMatchesRegistry({ ...release, category: 'reading' }, definition), false)
})

test('configured feed entrypoints pin public DNS and reject redirect, host, type and size escapes', async () => {
  const github = LEARNING_SOURCES.find(source => source.key === 'openai_node_releases')
  const rss = LEARNING_SOURCES.find(source => source.kind === 'rss')
  assert.throws(() => assertConfiguredLearningEndpoint(AIHOT_SOURCE,
    'https://sub.aihot.virxact.com/api/v1/items'), /entry_host_blocked/)
  assert.throws(() => assertConfiguredLearningEndpoint(AIHOT_SOURCE,
    'https://aihot.virxact.com.attacker.invalid/api/v1/items'), /entry_host_blocked/)
  assert.throws(() => assertConfiguredLearningEndpoint(AIHOT_SOURCE,
    'https://aihot.virxact.com/api/v1/items-evil'), /entry_path_blocked/)

  let dnsPass = 0
  await assert.rejects(fetchConfiguredLearningEndpoint(github, {
    resolver: async () => (++dnsPass === 1
      ? [{ address: '93.184.216.34', family: 4 }]
      : [{ address: '192.168.1.9', family: 4 }]),
    requestImpl: async () => originResponse('', {
      status: 302, headers: { location: 'https://api.github.com/repos/openai/openai-node/releases?page=2' },
    }),
  }), /origin_dns_blocked/)

  await assert.rejects(fetchConfiguredLearningEndpoint(AIHOT_SOURCE, {
    resolver: publicResolver,
    requestImpl: async () => originResponse('x'.repeat(1024 * 1024 + 1), {
      headers: { 'content-type': 'application/json' },
    }),
  }), /entry_response_too_large/)
  await assert.rejects(fetchConfiguredLearningEndpoint(rss, {
    resolver: publicResolver,
    requestImpl: async () => originResponse('x'.repeat(512 * 1024 + 1), {
      headers: { 'content-type': 'application/rss+xml' },
    }),
  }), /entry_response_too_large/)
  await assert.rejects(fetchConfiguredLearningEndpoint(github, {
    resolver: publicResolver,
    requestImpl: async () => originResponse('<html>not JSON</html>', {
      headers: { 'content-type': 'text/html' },
    }),
  }), /entry_content_type_blocked/)

  await assert.rejects(fetchConfiguredLearningEndpoint(AIHOT_SOURCE, {
    resolver: publicResolver,
    requestImpl: async url => originResponse('', { status: 302, headers: { location: url } }),
  }), /entry_redirect_loop/)
  let redirectStep = 0
  await assert.rejects(fetchConfiguredLearningEndpoint(AIHOT_SOURCE, {
    resolver: publicResolver,
    requestImpl: async () => originResponse('', {
      status: 302,
      headers: { location: `https://aihot.virxact.com/api/v1/items?step=${++redirectStep}` },
    }),
  }), /entry_redirect_limit/)

  let socketLookupAddress
  const requestFactory = (options, onResponse) => {
    const request = new EventEmitter()
    request.setTimeout = () => request
    request.end = () => options.lookup(options.hostname, {}, (error, address) => {
      if (error) return request.emit('error', error)
      socketLookupAddress = address
      const response = new EventEmitter()
      response.statusCode = 200
      response.headers = { 'content-type': 'application/json' }
      response.destroy = errorValue => { if (errorValue) response.emit('error', errorValue) }
      onResponse(response)
      queueMicrotask(() => {
        response.emit('data', Buffer.from('{"schemaVersion":"1","query":{},"items":[]}'))
        response.emit('end')
      })
    })
    return request
  }
  const pinned = await fetchConfiguredLearningEndpoint(AIHOT_SOURCE, {
    resolver: publicResolver,
    requestImpl: (url, options) => requestPinnedOrigin(url, { ...options, requestFactory }),
  })
  assert.equal(socketLookupAddress, '93.184.216.34')
  assert.match(pinned.bodyText, /schemaVersion/)
})

test('normalization strips trackers, uses PSL domains and clusters title rewrites across midnight', () => {
  assert.equal(normalizeLearningUrl('https://news.example.co.uk/post/?utm_source=x&gclid=y#top'), 'https://news.example.co.uk/post')
  assert.equal(registrableDomain('https://cdn.news.example.co.uk/post'), 'example.co.uk')
  const before = normalized({
    providerId: 'before', title: 'OpenAI Node SDK v6 stable response interface released',
    publishedAt: '2026-08-10T23:50:00Z',
  })
  const after = normalized({
    providerId: 'after', title: 'OpenAI Node SDK v6 released with stable response interface',
    publishedAt: '2026-08-11T00:10:00Z',
  })
  assert.equal(areLearningItemsInSameCluster(before, after), true)
  assert.equal(areLearningItemsInSameCluster(before, { ...after, publishedAt: '2026-08-13T01:00:00Z' }), false)
})

test('hybrid publication gate is official-single or two independent registrable domains only', () => {
  const analysis = validAnalysis()
  const official = normalized()
  assert.deepEqual(decideLearningPublication({ analysis, sources: [official], now }), {
    publish: true, basis: 'official_primary', reason: null,
  })
  const aihot = normalized({
    provider: 'aihot_discovery', providerId: 'hot-1', isOfficial: false,
    discoveredVia: 'https://aihot.virxact.com/items/hot-1',
  })
  assert.equal(decideLearningPublication({ analysis, sources: [aihot], now }).publish, false)
  const sameDomain = [
    normalized({ provider: 'report-a', providerId: 'a', isOfficial: false, sourceUrl: 'https://news.example.co.uk/a' }),
    normalized({ provider: 'report-b', providerId: 'b', isOfficial: false, sourceUrl: 'https://cdn.example.co.uk/b' }),
  ]
  assert.equal(decideLearningPublication({ analysis, sources: sameDomain, now }).publish, false)
  const independent = [sameDomain[0], normalized({
    provider: 'report-c', providerId: 'c', isOfficial: false, sourceUrl: 'https://research.mozilla.org/report',
  })]
  assert.equal(decideLearningPublication({ analysis, sources: independent, now }).basis, 'independent_domains')
  assert.equal(decideLearningPublication({ analysis: validAnalysis({ hasConflict: true }), sources: independent, now }).reason, 'source_conflict')
  assert.equal(decideLearningPublication({ analysis: null, sources: independent, now }).reason, 'ai_invalid')
})

test('cross-source date, key-number and negated-conclusion conflicts fail closed with audit evidence', () => {
  const verified = overrides => normalized({
    provider: overrides.provider, providerId: overrides.provider, isOfficial: false,
    sourceUrl: overrides.sourceUrl, title: overrides.title, excerpt: overrides.excerpt,
  })
  const sources = [
    verified({ provider: 'date-a', sourceUrl: 'https://research.mozilla.org/a', title: 'Release date confirmed', excerpt: 'The release date is 2026-08-15.' }),
    verified({ provider: 'date-b', sourceUrl: 'https://news.apache.org/b', title: 'Release date confirmed', excerpt: 'The release date is 2026-08-16.' }),
    verified({ provider: 'number-a', sourceUrl: 'https://blog.linuxfoundation.org/a', title: 'Protocol fee update', excerpt: 'The protocol fee will increase to 12% for validators.' }),
    verified({ provider: 'number-b', sourceUrl: 'https://updates.mozilla.org/b', title: 'Protocol fee update', excerpt: 'The protocol fee will increase to 15% for validators.' }),
    verified({ provider: 'polarity-a', sourceUrl: 'https://walletconnect.com/a', title: 'Wallet passkey support', excerpt: 'The wallet will support passkeys in its next release.' }),
    verified({ provider: 'polarity-b', sourceUrl: 'https://ethereum.org/b', title: 'Wallet passkey support', excerpt: 'The wallet will not support passkeys in its next release.' }),
  ]
  const conflict = detectLearningSourceConflicts(sources)
  assert.equal(conflict.hasConflict, true)
  assert.deepEqual(new Set(conflict.evidence.map(item => item.kind)),
    new Set(['event_date_mismatch', 'key_number_mismatch', 'negated_conclusion']))
  assert.equal(conflict.evidence.every(item => item.leftSourceUrl && item.rightSourceUrl), true)
  assert.equal(decideLearningPublication({
    analysis: { ...validAnalysis(), hasConflict: conflict.hasConflict }, sources: sources.slice(0, 2), now,
  }).reason, 'source_conflict')
})

test('AIHOT live schema uses only links.original and never carries its score into normalized evidence', () => {
  const payload = {
    schemaVersion: '1.0', query: { mode: 'selected' },
    items: [
      {
        id: 'hot-1', title: 'AIHOT translated title', originalTitle: 'Aggregator supplied title',
        summary: 'Aggregator supplied summary', source: { name: 'Source' },
        links: { aihot: 'https://aihot.virxact.com/items/hot-1', original: 'https://blog.mozilla.org/en/products/ai/update' },
        publishedAt: '2026-08-11T06:00:00Z', discoveredAt: '2026-08-11T06:10:00Z',
        category: 'ai-products', score: 99, selected: true, attribution: 'discovery',
      },
      { id: 'missing-original', links: { aihot: 'https://aihot.virxact.com/items/missing' } },
      {
        id: 'self-link', links: {
          aihot: 'https://aihot.virxact.com/items/self', original: 'https://sub.aihot.virxact.com/items/self',
        },
      },
    ],
  }
  const items = parseAihotPayload(payload)
  assert.equal(items.length, 1)
  assert.equal(items[0].providerId, 'hot-1')
  assert.equal(items[0].sourceUrl, 'https://blog.mozilla.org/en/products/ai/update')
  assert.equal(items[0].discoveredVia, 'https://aihot.virxact.com/items/hot-1')
  assert.equal(Object.hasOwn(items[0].rawPayload, 'score'), false)
})

test('AIHOT collection replaces discovery text with verified origin metadata', async () => {
  const payload = {
    schemaVersion: '1.0', query: {}, items: [{
      id: 'hot-origin', title: 'AIHOT title must disappear', originalTitle: 'AIHOT original title must disappear',
      summary: 'AIHOT summary must disappear', source: { name: 'Mozilla' },
      links: { aihot: 'https://aihot.virxact.com/items/hot-origin', original: 'https://blog.mozilla.org/en/products/ai/update?utm_source=hot' },
      publishedAt: '2026-08-11T06:00:00Z', discoveredAt: '2026-08-11T06:10:00Z',
      category: 'ai-products', score: 100, selected: true,
    }],
  }
  const [item] = await collectLearningSource(AIHOT_SOURCE, {
    entryRequestImpl: async url => originResponse(JSON.stringify(payload), {
      headers: { 'content-type': 'application/json' }, url,
    }),
    resolver: publicResolver,
    originRequestImpl: async url => originResponse(
      '<html><head><title>Mozilla Origin Update</title><meta name="description" content="Origin-owned description for the update."></head></html>',
      { url },
    ),
    now,
  })
  assert.equal(item.title, 'Mozilla Origin Update')
  assert.equal(item.excerpt, 'Origin-owned description for the update.')
  assert.equal(item.sourceUrl, 'https://blog.mozilla.org/en/products/ai/update')
  assert.equal(item.isOfficial, false)
  assert.equal(item.verificationState, 'verified')
  assert.doesNotMatch(JSON.stringify(item), /AIHOT (?:title|summary|original)/)
})

test('final canonical URL controls official status and blocked AIHOT redirects stay unverified drafts', async () => {
  const definition = LEARNING_SOURCES.find(source => source.key === 'openai_node_releases')
  const releasePayload = [{
    id: 202, tag_name: 'v6.1.0', name: 'OpenAI Node SDK v6.1', draft: false,
    html_url: 'https://github.com/openai/openai-node/releases/tag/v6.1.0',
    published_at: '2026-08-11T07:00:00Z', body: 'Release notes.',
  }]
  let redirects = 0
  const [redirected] = await collectLearningSource(definition, {
    now,
    resolver: publicResolver,
    entryRequestImpl: async url => originResponse(JSON.stringify(releasePayload), {
      headers: { 'content-type': 'application/json' }, url,
    }),
    originRequestImpl: async url => {
      if (redirects++ === 0) return originResponse('', { status: 302, headers: { location: 'https://blog.mozilla.org/redirected-release' } })
      return originResponse('<title>Third-party mirror</title><meta name="description" content="Mirrored release notes">', { url })
    },
  })
  assert.equal(redirected.sourceUrl, 'https://blog.mozilla.org/redirected-release')
  assert.equal(redirected.isOfficial, false)

  const aihotPayload = {
    schemaVersion: '1.0', query: {}, items: [{
      id: 'blocked-redirect', title: 'Discovery title', summary: 'Discovery summary', source: { name: 'Source' },
      links: { aihot: 'https://aihot.virxact.com/items/blocked-redirect', original: 'https://news.mozilla.org/post' },
      publishedAt: '2026-08-11T07:00:00Z', category: 'ai-products', selected: true,
    }],
  }
  const [blocked] = await collectLearningSource(AIHOT_SOURCE, {
    now,
    resolver: publicResolver,
    entryRequestImpl: async url => originResponse(JSON.stringify(aihotPayload), {
      headers: { 'content-type': 'application/json' }, url,
    }),
    originRequestImpl: async () => originResponse('', { status: 302, headers: { location: 'https://sub.aihot.virxact.com/items/blocked' } }),
  })
  assert.equal(blocked.verificationState, 'unverified')
  assert.equal(blocked.originVerifiedAt, null)
  assert.doesNotMatch(`${blocked.title} ${blocked.excerpt}`, /Discovery/)
  assert.equal((await analyzeLearningItem(blocked, { apiKey: 'fixture' })).error, 'origin_unverified')
  assert.equal(decideLearningPublication({ analysis: validAnalysis(), sources: [blocked], now }).publish, false)
})

test('origin verifier rejects userinfo, reserved DNS, private redirects, loops, excess redirects and unsafe content', async () => {
  for (const address of [
    '0.0.0.1', '10.1.2.3', '100.64.0.1', '127.0.0.1', '169.254.169.254', '172.20.0.1',
    '192.0.2.1', '192.88.99.1', '192.168.1.1', '198.18.0.1', '198.51.100.2', '203.0.113.5',
    '224.0.0.1', '240.0.0.1', '::1', 'fc00::1', 'fe80::1', '2001:db8::1', '2002::1', '3fff::1',
  ]) assert.equal(isBlockedAddress(address), true, address)
  assert.equal(isBlockedAddress('93.184.216.34'), false)
  assert.equal(isBlockedAddress('2606:4700:4700::1111'), false)
  assert.throws(() => assertSafeOriginUrl('https://user:pass@news.mozilla.org/post'), /not_public_https/)
  assert.throws(() => assertSafeOriginUrl('https://metadata.google.internal/latest'), /host_blocked/)
  assert.throws(() => assertSafeOriginUrl('https://sub.aihot.virxact.com/item'), /host_blocked/)

  await assert.rejects(verifyOriginUrl('https://news.mozilla.org/post', {
    resolver: async () => [{ address: '192.168.1.5', family: 4 }],
    requestImpl: async () => { throw new Error('must not fetch') },
  }), /dns_blocked/)

  await assert.rejects(verifyOriginUrl('https://news.mozilla.org/post', {
    resolver: publicResolver,
    requestImpl: async () => originResponse('', { status: 302, headers: { location: 'http://169.254.169.254/latest' } }),
  }), /not_public_https|address_blocked/)

  await assert.rejects(verifyOriginUrl('https://news.mozilla.org/post', {
    resolver: publicResolver,
    requestImpl: async url => originResponse('', { status: 302, headers: { location: String(url) } }),
  }), /redirect_loop/)

  let redirect = 0
  await assert.rejects(verifyOriginUrl('https://news.mozilla.org/start', {
    resolver: publicResolver,
    requestImpl: async () => originResponse('', { status: 302, headers: { location: `https://news.mozilla.org/${++redirect}` } }),
  }), /redirect_limit/)

  await assert.rejects(verifyOriginUrl('https://news.mozilla.org/file', {
    resolver: publicResolver,
    requestImpl: async () => originResponse('binary', { headers: { 'content-type': 'application/octet-stream' } }),
  }), /content_type_blocked/)

  let pinnedAddress
  const verified = await verifyOriginUrl('https://news.mozilla.org/pinned', {
    resolver: publicResolver,
    requestImpl: async (url, options) => {
      pinnedAddress = options.pinnedAddress
      return originResponse('<title>Pinned origin</title><meta name="description" content="Pinned response">', { url })
    },
  })
  assert.equal(pinnedAddress, '93.184.216.34')
  assert.equal(verified.originTitle, 'Pinned origin')
  let systemResolverCalls = 0
  const requestFactory = (options, onResponse) => {
    assert.equal(options.hostname, 'news.mozilla.org')
    assert.equal(options.servername, 'news.mozilla.org')
    assert.equal(typeof options.lookup, 'function')
    const request = new EventEmitter()
    request.setTimeout = () => request
    request.end = () => options.lookup(options.hostname, {}, (error, address, family) => {
      if (error) return request.emit('error', error)
      assert.equal(address, '93.184.216.34')
      assert.equal(family, 4)
      const response = new EventEmitter()
      response.statusCode = 200
      response.headers = { 'content-type': 'text/html' }
      response.destroy = errorValue => { if (errorValue) response.emit('error', errorValue) }
      onResponse(response)
      queueMicrotask(() => {
        response.emit('data', Buffer.from('<title>Pinned socket</title>'))
        response.emit('end')
      })
    })
    return request
  }
  const socketResponse = await requestPinnedOrigin('https://news.mozilla.org/socket', {
    pinnedAddress: '93.184.216.34', family: 4, maxBytes: 4_096, timeoutMs: 1_000, requestFactory,
  })
  assert.match(socketResponse.bodyText, /Pinned socket/)
  assert.equal(systemResolverCalls, 0, 'a rebound system resolver returning a private IP is never called by the socket')
})

test('origin metadata extractor and AI request use only verified public source metadata', async () => {
  assert.deepEqual(extractOriginMetadata('<title>Origin title</title><meta name="description" content="Origin excerpt">', 'text/html'), {
    title: 'Origin title', excerpt: 'Origin excerpt',
  })
  let called = false
  const unverified = normalized({ originVerifiedAt: null, verificationState: 'unverified' })
  assert.deepEqual(await analyzeLearningItem(unverified, {
    apiKey: 'fixture', fetchImpl: async () => { called = true },
  }), { analysis: null, error: 'origin_unverified' })
  assert.equal(called, false)

  let requestBody
  const output = validAnalysis()
  const analyzed = await analyzeLearningItem(normalized({
    rawPayload: { private: 'must-not-leave-process' },
  }), {
    apiKey: 'fixture',
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body)
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] }), {
        status: 200, headers: { 'content-type': 'application/json' },
      })
    },
  })
  assert.equal(analyzed.analysis?.importance, 'key')
  assert.doesNotMatch(JSON.stringify(requestBody), /private|rawPayload|AIHOT/)

  const invalid = await analyzeLearningItem(normalized(), {
    apiKey: 'fixture',
    fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: '{invalid' } }] }), { status: 200 }),
  })
  assert.equal(invalid.error, 'ai_json_invalid')
  const unavailable = await analyzeLearningItem(normalized(), {
    apiKey: 'fixture', fetchImpl: async () => { throw new Error('timeout') },
  })
  assert.equal(unavailable.error, 'ai_unavailable')
})

test('bad dates and source failures fail closed while cursor and hourly slots remain idempotent', async () => {
  assert.throws(() => normalized({ publishedAt: 'not-a-date' }), /published_at_invalid/)
  await assert.rejects(collectLearningSource(LEARNING_SOURCES[0], {
    entryRequestImpl: async () => { throw new Error('source_timeout') }, resolver: publicResolver, now,
  }), /source_timeout/)
  const first = normalized({ providerId: 'same-second-a' })
  const second = normalized({ providerId: 'same-second-b' })
  const cursor = newestLearningCursor([first, second])
  assert.equal(cursor.providerId, 'same-second-b')
  assert.deepEqual(parseLearningSourceCursor(encodeLearningSourceCursor(cursor)), cursor)
  assert.deepEqual(selectItemsAfterCursor([first], cursor).map(item => item.providerId), ['same-second-a'])
  assert.equal(learningHourSlot(new Date('2026-08-11T08:59:59Z')), '2026-08-11T08:00:00.000Z')
})

test('daily digest is bounded and truthful on quiet days', () => {
  const body = buildLearningDailyDigest([{ importance: 'key', title_zh: '事件一', why_selected_zh: '原因一' }], '2026-08-11')
  assert.match(body, /今日精选 1 条/)
  assert.match(body, /关键 1/)
  assert.match(buildLearningDailyDigest([], '2026-08-11'), /暂无满足来源验证和发布门/)
})

test('an existing learning digest can idempotently repair its missing outbox item', async () => {
  const persisted = {
    id: 'learning-daily-2026-08-11',
    title: '学习情报日报 · 2026-08-11',
    body_zh: buildLearningDailyDigest([{ importance: 'key', title_zh: 'fixture', why_selected_zh: 'verified' }],'2026-08-11'),
    origin: 'research', publication_state: 'published', snapshot_id: 'learning-snapshot-1',
  }
  let outboxExists = false
  const statements = []
  const client = {
    async query(statement, values = []) {
      statements.push(statement)
      if (statement.includes('from radar_system.publication_snapshots')) {
        assert.match(statement, /as_of at time zone 'Asia\/Shanghai'/)
        assert.equal(values[0], '2026-08-11')
        return { rows: [{ snapshot_id: 'learning-snapshot-1' }] }
      }
      if (statement.includes('from learning_radar.public_timeline_items')) {
        return { rows: [{ importance: 'key', title_zh: 'fixture', why_selected_zh: 'verified' }] }
      }
      if (statement.includes('insert into learning_radar.digests')) return { rows: [] }
      if (statement.includes('select id, title, body_zh from learning_radar.digests')) return { rows: [persisted] }
      if (statement.includes('insert into learning_radar.outbox')) {
        assert.equal(values[1], 'learning:daily:2026-08-11')
        const payload = JSON.parse(values[2])
        assert.equal(payload.digestId, persisted.id)
        assert.equal(payload.body, persisted.body_zh)
        assert.equal(payload.pageUrl, '/radar/2026-08-11')
        if (outboxExists) return { rows: [] }
        outboxExists = true
        return { rows: [{ id: 'learning-outbox-fixture' }] }
      }
      if (statement.includes('select id from learning_radar.outbox')) return { rows: outboxExists ? [{ id: 'learning-outbox-fixture' }] : [] }
      throw new Error(`Unexpected learning digest query: ${statement}`)
    },
  }

  const repaired = await generateLearningDailyDigest(client, new Date('2026-08-11T00:00:00Z'))
  assert.deepEqual(repaired, {
    created: false,
    outboxCreated: true,
    repaired: true,
    id: persisted.id,
    count: 1,
  })
  const repeated = await generateLearningDailyDigest(client, new Date('2026-08-11T00:00:00Z'))
  assert.equal(repeated.created, false)
  assert.equal(repeated.outboxCreated, false)
  assert.equal(repeated.repaired, false)
  assert.equal(statements.filter(statement => statement.includes('insert into learning_radar.outbox')).length, 2)

  const worker = read('learning-radar/worker/digests.mjs')
  const transaction = worker.slice(worker.indexOf('export async function runLearningDailyDigest'))
  assert.ok(transaction.indexOf("client.query('begin')") < transaction.indexOf('generateLearningDailyDigest'))
  assert.ok(transaction.indexOf('generateLearningDailyDigest') < transaction.indexOf("client.query('commit')"))
})

test('a successful digest job run still repairs a missing learning outbox item', async () => {
  const persisted = {
    id: 'learning-daily-2026-08-11',
    title: '学习情报日报 · 2026-08-11',
    body_zh: buildLearningDailyDigest([],'2026-08-11'),
    origin: 'research', publication_state: 'published', snapshot_id: 'learning-snapshot-1',
  }
  const statements = []
  let outboxExists = false
  const client = {
    async query(statement, values = []) {
      statements.push(statement)
      if (statement === 'begin' || statement === 'commit' || statement === 'rollback') return { rows: [] }
      if (statement.includes('insert into learning_radar.job_runs')) return { rows: [] }
      if (statement.includes('from radar_system.publication_snapshots')) return { rows: [{ snapshot_id: 'learning-snapshot-1' }] }
      if (statement.includes('from learning_radar.public_timeline_items')) return { rows: [] }
      if (statement.includes('insert into learning_radar.digests')) return { rows: [] }
      if (statement.includes('select id, title, body_zh from learning_radar.digests')) return { rows: [persisted] }
      if (statement.includes('insert into learning_radar.outbox')) {
        assert.equal(values[1], 'learning:daily:2026-08-11')
        outboxExists = true
        return { rows: [{ id: 'learning-outbox-fixture' }] }
      }
      if (statement.includes('select id from learning_radar.outbox')) return { rows: outboxExists ? [{ id: 'learning-outbox-fixture' }] : [] }
      throw new Error(`Unexpected learning digest job query: ${statement}`)
    },
  }

  const repaired = await runLearningDailyDigest(client, new Date('2026-08-11T00:00:00Z'))
  assert.equal(outboxExists, true)
  assert.deepEqual(repaired, {
    created: false,
    outboxCreated: true,
    repaired: true,
    id: persisted.id,
    count: 0,
    reason: 'repaired_missing_outbox',
  })
  assert.deepEqual(statements[0], 'begin')
  assert.equal(statements.at(-1), 'commit')
  assert.equal(statements.includes('rollback'), false)
})

test('learning digest fails closed before any write without a same-day published research snapshot',async()=>{
  const statements=[];const client={query:async(statement,values=[])=>{statements.push({statement,values});return{rows:[]}}}
  await assert.rejects(generateLearningDailyDigest(client,new Date('2026-08-11T00:00:00Z')),/learning_published_snapshot_missing/)
  assert.match(statements[0].statement,/as_of at time zone 'Asia\/Shanghai'/)
  assert.equal(statements[0].values[0],'2026-08-11')
  assert.equal(statements.some(({statement})=>/insert into learning_radar\.(?:digests|outbox)/.test(statement)),false)
})

test('Learning workflow keeps exact-SHA marker authorization and release DAG ordering', () => {
  const worker = parse(read('.github/workflows/learning-radar.yml'))
  const controller = parse(read('.github/workflows/release-controller.yml'))
  assert.deepEqual(worker.on.schedule.map(entry => entry.cron), ['0 * * * *', '0 0 * * *'])
  assert.deepEqual(worker.on.workflow_dispatch.inputs.mode.options, ['dry-run', 'ingest', 'daily'])
  assert.equal(worker.concurrency.group, 'xiuqiu-learning-radar-worker')
  assert.equal(worker.jobs.authorize.environment, undefined)
  assert.equal(worker.jobs.run.environment, undefined)
  assert.match(String(worker.jobs.authorize.if), /LEARNING_RADAR_ENABLED/)
  assert.match(JSON.stringify(worker.jobs.authorize), /learning-radar-production-authorized/)
  assert.match(JSON.stringify(worker.jobs.run), /needs\.authorize\.outputs\.release_sha/)
  assert.deepEqual(controller.jobs.promote_learning_radar_worker.needs,
    ['preflight', 'mark_deployed_sha', 'enqueue_radar_notifications'])
  assert.equal(controller.jobs.promote_learning_radar_worker.environment, 'production-release')
  assert.match(String(controller.jobs.promote_learning_radar_worker.if), /LEARNING_RADAR_ENABLED/)
})
