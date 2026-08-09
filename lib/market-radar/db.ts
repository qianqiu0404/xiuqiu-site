import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

declare const process: { env: Record<string, string | undefined> }

let client: NeonQueryFunction<false, false> | null = null

export class MarketRadarNotConfiguredError extends Error {
  constructor() {
    super('MARKET_RADAR_DATABASE_URL is not configured')
    this.name = 'MarketRadarNotConfiguredError'
  }
}

export function getMarketRadarDb(): NeonQueryFunction<false, false> {
  const databaseUrl = process.env.MARKET_RADAR_DATABASE_URL
  if (!databaseUrl) throw new MarketRadarNotConfiguredError()
  if (!client) client = neon(databaseUrl)
  return client
}

export function isMarketRadarConfigured(): boolean {
  return Boolean(process.env.MARKET_RADAR_DATABASE_URL)
}
