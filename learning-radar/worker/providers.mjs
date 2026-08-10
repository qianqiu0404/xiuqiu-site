import { isIP } from 'node:net'
import { lookup as dnsLookup } from 'node:dns/promises'
import { request as httpsRequest } from 'node:https'
import ipaddr from 'ipaddr.js'
import { AIHOT_SOURCE } from './config.mjs'
import { compactText, isAihotDiscovery, normalizeLearningItem, normalizeLearningUrl, validateLearningAiOutput } from './core.mjs'

const allowedContentTypes = /^(?:text\/(?:html|plain|xml)|application\/(?:json|[a-z0-9.+-]*\+json|xml|rss\+xml|atom\+xml))(?:;|$)/i

function responseOk(response, source) {
  if (!response?.ok) throw new Error(`${source}_http_${response?.status || 'unavailable'}`)
  return response
}

function stripCdata(value) {
  return compactText(String(value || '').replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, ''), 4_000)
}

function categoryFromAihot(value) {
  const category = String(value || '').toLowerCase()
  if (/wallet|web3|crypto|blockchain/.test(category)) return 'web3_wallet'
  if (/paper|reading|research|industry/.test(category)) return 'reading'
  if (/tool|engineering|developer|infra/.test(category)) return 'engineering_tools'
  return 'ai'
}

function githubReleasePath(repository) {
  return `/${repository.toLowerCase()}/releases/`
}

export function sourceMatchesRegistry(item, definition) {
  if (!definition?.official || item.discoveredVia !== definition.key) return false
  const url = new URL(item.sourceUrl)
  if (definition.kind === 'github_releases') {
    return url.hostname.toLowerCase() === 'github.com'
      && url.pathname.toLowerCase().startsWith(githubReleasePath(definition.repository))
      && item.category === definition.category
  }
  return definition.allowedHosts?.includes(url.hostname.toLowerCase()) === true
    && item.category === definition.category
}

export function parseLearningGitHubReleases(payload, definition) {
  if (!Array.isArray(payload)) throw new Error(`${definition.key}_invalid_payload`)
  return payload.flatMap(release => {
    if (!release?.id || release.draft || !release.html_url || !release.published_at) return []
    const title = compactText(release.name || release.tag_name, 500)
    if (!title) return []
    return [{
      provider: definition.key,
      providerId: `${definition.repository}:${release.id}`,
      category: definition.category,
      title,
      excerpt: compactText(release.body, 4_000),
      sourceUrl: release.html_url,
      publishedAt: release.published_at,
      isOfficial: true,
      discoveredVia: definition.key,
      sourceName: definition.sourceName,
      rawPayload: {
        repository: definition.repository,
        tagName: compactText(release.tag_name, 160),
        prerelease: release.prerelease === true,
      },
    }]
  })
}

export function parseLearningRss(xml, definition) {
  const records = []
  for (const match of String(xml || '').matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)) {
    const block = match[0]
    const read = name => stripCdata(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1])
    const href = block.match(/<link[^>]+href=["']([^"']+)/i)?.[1] || read('link')
    const sourceUrl = href ? normalizeLearningUrl(href) : null
    const title = read('title')
    const publishedAt = read('published') || read('updated') || read('pubDate')
    if (!sourceUrl || !title || !publishedAt) continue
    records.push({
      provider: definition.key,
      providerId: read('id') || read('guid') || sourceUrl,
      category: definition.category,
      title,
      excerpt: read('summary') || read('description'),
      sourceUrl,
      publishedAt,
      isOfficial: true,
      discoveredVia: definition.key,
      sourceName: definition.sourceName,
      rawPayload: { feed: definition.feedUrl },
    })
  }
  return records
}

export function parseAihotPayload(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.items)) throw new Error('aihot_invalid_payload')
  return payload.items.flatMap(item => {
    const sourceUrl = item?.links?.original
    const discoveredVia = item?.links?.aihot
    if (!item?.id || !sourceUrl || !discoveredVia || isAihotDiscovery(sourceUrl) || !isAihotDiscovery(discoveredVia)) return []
    return [{
      provider: AIHOT_SOURCE.key,
      providerId: String(item.id),
      category: categoryFromAihot(item.category),
      title: compactText(item.originalTitle || item.title, 500),
      excerpt: compactText(item.summary, 4_000),
      sourceUrl,
      publishedAt: item.publishedAt,
      isOfficial: false,
      discoveredVia,
      sourceName: compactText(item.source?.name, 160) || AIHOT_SOURCE.sourceName,
      rawPayload: {
        schemaVersion: payload.schemaVersion,
        attribution: item.attribution ?? null,
        discoveredAt: item.discoveredAt ?? null,
        selected: item.selected === true,
      },
    }]
  })
}

export function isBlockedAddress(address) {
  try {
    const parsed = ipaddr.parse(String(address || '').split('%')[0])
    if (parsed.kind() === 'ipv6' && parsed.isIPv4MappedAddress()) {
      return parsed.toIPv4Address().range() !== 'unicast'
    }
    return parsed.range() !== 'unicast'
  } catch {
    return true
  }
}

export function assertSafeOriginUrl(input) {
  const normalized = normalizeLearningUrl(input)
  const url = new URL(normalized)
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (url.port && url.port !== '443') throw new Error('origin_port_blocked')
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')
    || hostname === 'metadata' || hostname === 'metadata.google.internal' || hostname === 'instance-data'
    || /^(?:www\.)?example\.(?:com|org|net)$/.test(hostname)
    || hostname.endsWith('.invalid') || hostname.endsWith('.test')
    || isAihotDiscovery(normalized)) throw new Error('origin_host_blocked')
  if (isIP(hostname) && isBlockedAddress(hostname)) throw new Error('origin_address_blocked')
  return normalized
}

async function resolveSafeHost(url, resolver) {
  const hostname = new URL(url).hostname.replace(/^\[|\]$/g, '')
  if (isIP(hostname)) {
    if (isBlockedAddress(hostname)) throw new Error('origin_address_blocked')
    return [{ address: hostname, family: isIP(hostname) }]
  }
  const addresses = await resolver(hostname, { all: true, verbatim: true })
  if (!Array.isArray(addresses) || !addresses.length) throw new Error('origin_dns_empty')
  if (addresses.some(entry => isBlockedAddress(typeof entry === 'string' ? entry : entry.address))) {
    throw new Error('origin_dns_blocked')
  }
  return addresses.map(entry => typeof entry === 'string'
    ? { address: entry, family: isIP(entry) }
    : { address: entry.address, family: entry.family || isIP(entry.address) })
}

function headerAccessor(headers) {
  return { get: name => {
    const value = headers?.[String(name).toLowerCase()]
    return Array.isArray(value) ? value[0] : value == null ? null : String(value)
  } }
}

export function createPinnedLookup(address, family) {
  return (_hostname, options, callback) => {
    if (options?.all) callback(null, [{ address, family }])
    else callback(null, address, family)
  }
}

export async function requestPinnedOrigin(urlValue, {
  pinnedAddress,
  family,
  maxBytes,
  timeoutMs,
  requestFactory = httpsRequest,
} = {}) {
  const url = new URL(urlValue)
  return new Promise((resolve, reject) => {
    const request = requestFactory({
      protocol: 'https:', hostname: url.hostname, port: 443, path: `${url.pathname}${url.search}`,
      method: 'GET', servername: url.hostname, rejectUnauthorized: true,
      lookup: createPinnedLookup(pinnedAddress, family),
      headers: {
        Accept: 'text/html,application/json,text/plain,application/xml;q=0.8',
        Range: `bytes=0-${maxBytes - 1}`,
        'User-Agent': 'xiuqiu-learning-radar/1.0',
      },
    }, response => {
      const contentLength = Number(response.headers?.['content-length'] || 0)
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        response.destroy()
        reject(new Error('origin_response_too_large'))
        return
      }
      const chunks = []
      let bytes = 0
      response.on('data', chunk => {
        bytes += chunk.length
        if (bytes > maxBytes) {
          response.destroy(new Error('origin_response_too_large'))
          return
        }
        chunks.push(chunk)
      })
      response.on('end', () => resolve({
        ok: response.statusCode >= 200 && response.statusCode < 300,
        status: response.statusCode || 0,
        headers: headerAccessor(response.headers),
        bodyText: Buffer.concat(chunks).toString('utf8'),
        url: url.toString(),
      }))
      response.on('error', reject)
    })
    request.setTimeout(timeoutMs, () => request.destroy(new Error('origin_timeout')))
    request.on('error', reject)
    request.end()
  })
}

export function extractOriginMetadata(body, contentType) {
  const text = String(body || '')
  if (/application\/(?:json|[a-z0-9.+-]*\+json)/i.test(contentType)) {
    try {
      const value = JSON.parse(text)
      return {
        title: compactText(value?.title || value?.name || value?.headline, 500),
        excerpt: compactText(value?.description || value?.excerpt || value?.summary || value?.content, 4_000),
      }
    } catch {
      return { title: '', excerpt: '' }
    }
  }
  if (/html/i.test(contentType)) {
    const readMeta = key => text.match(new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']+)`, 'i'))?.[1]
      || text.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${key}["']`, 'i'))?.[1]
    return {
      title: compactText(readMeta('og:title') || text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 500),
      excerpt: compactText(readMeta('og:description') || readMeta('description')
        || text.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1], 4_000),
    }
  }
  const title = compactText(text.split(/\r?\n/).find(line => line.trim()), 500)
  return { title, excerpt: compactText(text, 4_000) }
}

export async function verifyOriginUrl(input, {
  resolver = dnsLookup,
  requestImpl = requestPinnedOrigin,
  maxRedirects = 3,
  maxBytes = 256 * 1024,
  timeoutMs = 10_000,
  now = new Date(),
} = {}) {
  let current = assertSafeOriginUrl(input)
  const seen = new Set()
  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    if (seen.has(current)) throw new Error('origin_redirect_loop')
    seen.add(current)
    const addresses = await resolveSafeHost(current, resolver)
    const pinned = addresses[0]
    const response = await requestImpl(current, {
      pinnedAddress: pinned.address, family: pinned.family, maxBytes, timeoutMs,
    })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirects === maxRedirects) throw new Error('origin_redirect_limit')
      const location = response.headers?.get?.('location')
      if (!location) throw new Error('origin_redirect_missing_location')
      current = assertSafeOriginUrl(new URL(location, current).toString())
      continue
    }
    if (!response.ok) throw new Error(`origin_http_${response.status || 'unavailable'}`)
    const finalUrl = response.url ? assertSafeOriginUrl(response.url) : current
    const contentType = response.headers?.get?.('content-type') || ''
    if (!allowedContentTypes.test(contentType)) throw new Error('origin_content_type_blocked')
    const body = response.bodyText || ''
    const metadata = extractOriginMetadata(body, contentType)
    return {
      sourceUrl: normalizeLearningUrl(finalUrl),
      originVerifiedAt: new Date(now).toISOString(),
      originTitle: metadata.title,
      originExcerpt: metadata.excerpt,
    }
  }
  throw new Error('origin_redirect_limit')
}

async function fetchDefinition(definition, fetchImpl) {
  if (definition.kind === 'github_releases') {
    const response = responseOk(await fetchImpl(`https://api.github.com/repos/${definition.repository}/releases?per_page=5`, {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'xiuqiu-learning-radar/1.0' },
    }), definition.key)
    return parseLearningGitHubReleases(await response.json(), definition)
  }
  if (definition.kind === 'rss') {
    const response = responseOk(await fetchImpl(definition.feedUrl, {
      signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/rss+xml,application/atom+xml,application/xml' },
    }), definition.key)
    return parseLearningRss(await response.text(), definition)
  }
  const response = responseOk(await fetchImpl(definition.endpoint, {
    signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json' },
  }), definition.key)
  return parseAihotPayload(await response.json())
}

export async function collectLearningSource(definition, {
  fetchImpl = fetch,
  resolver = dnsLookup,
  originRequestImpl = requestPinnedOrigin,
  now = new Date(),
} = {}) {
  const candidates = await fetchDefinition(definition, fetchImpl)
  const items = []
  for (const candidate of candidates) {
    let verification = { sourceUrl: candidate.sourceUrl, originVerifiedAt: null }
    let verificationError = null
    try {
      verification = await verifyOriginUrl(candidate.sourceUrl, { resolver, requestImpl: originRequestImpl, now })
    } catch (error) {
      verificationError = error instanceof Error ? error.message : 'origin_unavailable'
    }
    const aihotDiscovery = definition.kind === 'aihot'
    const originContentUsable = !aihotDiscovery || Boolean(verification.originTitle && verification.originExcerpt)
    if (!originContentUsable) {
      verification.originVerifiedAt = null
      verificationError = 'origin_content_missing'
    }
    const finalCandidate = { ...candidate, sourceUrl: verification.sourceUrl }
    const enriched = {
      ...candidate,
      sourceUrl: verification.sourceUrl,
      title: aihotDiscovery
        ? (verification.originTitle || `${new URL(verification.sourceUrl).hostname} origin pending`)
        : candidate.title,
      excerpt: aihotDiscovery ? (verification.originExcerpt || '') : candidate.excerpt,
      isOfficial: sourceMatchesRegistry(finalCandidate, definition),
      originVerifiedAt: verification.originVerifiedAt,
      verificationState: verification.originVerifiedAt ? 'verified' : 'unverified',
      verificationError,
    }
    try {
      items.push(normalizeLearningItem(enriched, { now }))
    } catch {
      // Malformed or stale provider records fail closed without stopping other records.
    }
  }
  return items
}

export async function analyzeLearningItem(item, {
  apiKey,
  model = 'deepseek-v4-flash',
  fetchImpl = fetch,
  timeoutMs = 15_000,
} = {}) {
  if (item?.verificationState !== 'verified' || !item?.originVerifiedAt) {
    return { analysis: null, error: 'origin_unverified' }
  }
  if (!apiKey) return { analysis: null, error: 'ai_key_missing' }
  try {
    const response = await fetchImpl('https://api.deepseek.com/chat/completions', {
      method: 'POST', signal: AbortSignal.timeout(timeoutMs),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, thinking: { type: 'disabled' }, temperature: 0.1, max_tokens: 700,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: '你是学习情报结构化器。只输出 JSON：titleZh, summaryZh, whySelectedZh, importance(key|noteworthy|watch), internalScore(0-100整数), hasConflict(boolean)。不得编造来源或事实；有明显冲突时 hasConflict=true。' },
          { role: 'user', content: JSON.stringify({
            category: item.category,
            sources: [{
              title: item.title,
              excerpt: item.excerpt,
              sourceUrl: item.sourceUrl,
              sourceName: item.sourceName,
              provider: item.provider,
              publishedAt: item.publishedAt,
              isOfficial: item.isOfficial,
            }],
          }) },
        ],
      }),
    })
    if (!response.ok) return { analysis: null, error: `ai_http_${response.status}` }
    const payload = await response.json()
    const parsed = JSON.parse(payload.choices?.[0]?.message?.content || '')
    const analysis = validateLearningAiOutput(parsed)
    return analysis ? { analysis, error: null } : { analysis: null, error: 'ai_schema_invalid' }
  } catch (error) {
    return { analysis: null, error: error instanceof SyntaxError ? 'ai_json_invalid' : 'ai_unavailable' }
  }
}
