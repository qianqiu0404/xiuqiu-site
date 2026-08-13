import { createHash } from 'node:crypto'

export const MARKET_UNIVERSE_VERSION = 'core-2026-08-v1' as const
export const MARKET_ASSET_IDS = [
  'BTC-USDT', 'ETH-USDT', 'SOL-USDT',
  'SPY', 'QQQ', 'NVDA', 'MSFT', 'AAPL', 'TSLA', 'COIN', 'GLD',
  '000300', '000016', '399006', '000688',
  '600519', '300750', '002594', '688981', '601318',
  'XAU-USD',
] as const

export type MarketAssetId = typeof MARKET_ASSET_IDS[number]
export type MarketSnapshotMode = 'live' | 'delayed' | 'eod' | 'mixed'

export interface MarketQuoteV1 {
  assetId: MarketAssetId
  role: 'analysis' | 'display'
  price: string
  currency: string
  observedAt: string
  delaySeconds: number
  provider: string
  mode: Exclude<MarketSnapshotMode, 'mixed'>
  displayScope: 'private' | 'internal_non_display'
}

export interface MarketCoverageV1 {
  assetId: MarketAssetId
  status: 'healthy' | 'stale' | 'unavailable'
  marketState: 'open' | 'closed' | 'pre' | 'post' | 'unknown'
  reason?: string
}

export interface MarketSnapshotV1 {
  schemaVersion: 1
  universeVersion: typeof MARKET_UNIVERSE_VERSION
  snapshotId: string
  asOf: string
  generatedAt: string
  mode: MarketSnapshotMode
  quotes: MarketQuoteV1[]
  coverage: MarketCoverageV1[]
  checksum: string
}

const assetIds = new Set<string>(MARKET_ASSET_IDS)
const decimalPattern = /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/
const snapshotIdPattern = /^market-\d{4}-\d{2}-\d{2}-[0-9a-f]{16}$/
const checksumPattern = /^[0-9a-f]{64}$/

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function iso(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Non-finite JSON number.')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const record = object(value)
  if (!record) throw new Error('Unsupported canonical JSON value.')
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
}

export function computeMarketSnapshotChecksum(snapshot: MarketSnapshotV1): string {
  const payload = structuredClone(snapshot) as unknown as Record<string, unknown>
  delete payload.snapshotId
  delete payload.checksum
  return createHash('sha256').update(canonicalJson(payload)).digest('hex')
}

export function parseMarketSnapshot(value: unknown): MarketSnapshotV1 {
  const input = object(value)
  if (!input || input.schemaVersion !== 1 || input.universeVersion !== MARKET_UNIVERSE_VERSION) throw new Error('Unsupported market snapshot contract.')
  if (!snapshotIdPattern.test(String(input.snapshotId || '')) || !checksumPattern.test(String(input.checksum || ''))) throw new Error('Invalid market snapshot identity.')
  if (!iso(input.asOf) || !iso(input.generatedAt)) throw new Error('Invalid market snapshot time.')
  if (!['live', 'delayed', 'eod', 'mixed'].includes(String(input.mode))) throw new Error('Invalid market snapshot mode.')
  if (!Array.isArray(input.coverage) || input.coverage.length !== MARKET_ASSET_IDS.length || !Array.isArray(input.quotes)) throw new Error('Market snapshot must cover exactly 21 assets.')

  const coverageSeen = new Set<string>()
  const coverageByAsset = new Map<string, MarketCoverageV1>()
  const coverage = input.coverage.map((raw): MarketCoverageV1 => {
    const item = object(raw)
    const assetId = String(item?.assetId || '')
    const status = String(item?.status || '')
    const marketState = String(item?.marketState || '')
    if (!assetIds.has(assetId) || coverageSeen.has(assetId)) throw new Error('Unknown or duplicate coverage asset.')
    if (!['healthy', 'stale', 'unavailable'].includes(status) || !['open', 'closed', 'pre', 'post', 'unknown'].includes(marketState)) throw new Error('Invalid market coverage state.')
    const reason = typeof item?.reason === 'string' ? item.reason.trim() : undefined
    if (status === 'unavailable' && !reason) throw new Error('Unavailable coverage requires a reason.')
    coverageSeen.add(assetId)
    const parsed = { assetId: assetId as MarketAssetId, status: status as MarketCoverageV1['status'], marketState: marketState as MarketCoverageV1['marketState'], ...(reason ? { reason } : {}) }
    coverageByAsset.set(assetId, parsed)
    return parsed
  })

  const quoteSeen = new Set<string>()
  const quotedAssets = new Set<string>()
  const asOfMs = Date.parse(String(input.asOf))
  const generatedAtMs = Date.parse(String(input.generatedAt))
  if (generatedAtMs < asOfMs - 2_000 || generatedAtMs > asOfMs + 120_000) throw new Error('Snapshot generation time conflicts with asOf.')
  const quotes = input.quotes.map((raw): MarketQuoteV1 => {
    const item = object(raw)
    const assetId = String(item?.assetId || '')
    const role = String(item?.role || '')
    const key = `${assetId}:${role}`
    if (!assetIds.has(assetId) || quoteSeen.has(key) || !['analysis', 'display'].includes(role)) throw new Error('Unknown or duplicate market quote role.')
    const price = String(item?.price || '')
    if (!decimalPattern.test(price) || /^0(?:\.0+)?$/.test(price) || !iso(item?.observedAt)) throw new Error('Invalid market quote value or time.')
    if (!Number.isSafeInteger(item?.delaySeconds) || Number(item?.delaySeconds) < 0) throw new Error('Invalid market quote delay.')
    const mode = String(item?.mode || '')
    const displayScope = String(item?.displayScope || '')
    if (!['live', 'delayed', 'eod'].includes(mode) || !['private', 'internal_non_display'].includes(displayScope)) throw new Error('Invalid market quote policy.')
    if ((role === 'display' && displayScope !== 'private') || (role === 'analysis' && displayScope !== 'internal_non_display')) throw new Error('Market quote role conflicts with display scope.')
    const observedAtMs = Date.parse(String(item?.observedAt))
    const expectedDelay = Math.max(0, Math.floor((asOfMs - observedAtMs) / 1_000))
    if (observedAtMs > asOfMs + 120_000 || Math.abs(Number(item?.delaySeconds) - expectedDelay) > 2) throw new Error('Market quote delay conflicts with source time.')
    const state = coverageByAsset.get(assetId)
    if (!state || state.status === 'unavailable') throw new Error('Unavailable coverage cannot contain a quote.')
    if ((state.status === 'healthy' && Number(item?.delaySeconds) > 300) || (state.status === 'stale' && Number(item?.delaySeconds) <= 300)) throw new Error('Market coverage freshness conflicts with quote delay.')
    if (!String(item?.currency || '').trim() || !String(item?.provider || '').trim()) throw new Error('Incomplete market quote provenance.')
    quoteSeen.add(key)
    quotedAssets.add(assetId)
    return {
      assetId: assetId as MarketAssetId, role: role as MarketQuoteV1['role'], price, currency: String(item?.currency),
      observedAt: String(item?.observedAt), delaySeconds: Number(item?.delaySeconds), provider: String(item?.provider),
      mode: mode as MarketQuoteV1['mode'], displayScope: displayScope as MarketQuoteV1['displayScope'],
    }
  })
  for (const item of coverage) {
    if (item.status !== 'unavailable' && !quotedAssets.has(item.assetId)) throw new Error('Available coverage requires a quote.')
  }

  const quoteModes = new Set(quotes.map(quote => quote.mode))
  const expectedMode = quoteModes.size === 1 ? quotes[0].mode : 'mixed'
  if (quotes.length === MARKET_ASSET_IDS.length && input.mode !== expectedMode) throw new Error('Snapshot mode conflicts with quote modes.')
  if (quotes.length !== MARKET_ASSET_IDS.length && input.mode !== 'mixed') throw new Error('Partial market coverage requires mixed snapshot mode.')

  const snapshot = {
    schemaVersion: 1, universeVersion: MARKET_UNIVERSE_VERSION, snapshotId: String(input.snapshotId), asOf: String(input.asOf),
    generatedAt: String(input.generatedAt), mode: String(input.mode) as MarketSnapshotMode, quotes, coverage, checksum: String(input.checksum),
  } satisfies MarketSnapshotV1
  const checksum = computeMarketSnapshotChecksum(snapshot)
  const expectedId = `market-${new Date(snapshot.asOf).toISOString().slice(0, 10)}-${checksum.slice(0, 16)}`
  if (checksum !== snapshot.checksum || expectedId !== snapshot.snapshotId) throw new Error('Market snapshot checksum or identity mismatch.')
  return snapshot
}
