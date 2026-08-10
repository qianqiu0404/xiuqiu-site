import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

declare const process: { env: Record<string, string | undefined> }

let client: NeonQueryFunction<false, false> | null = null

export function isLearningRadarConfigured(): boolean {
  return Boolean(process.env.LEARNING_RADAR_DATABASE_URL || process.env.MARKET_RADAR_DATABASE_URL)
}

export function getLearningRadarDb(): NeonQueryFunction<false, false> {
  const databaseUrl = process.env.LEARNING_RADAR_DATABASE_URL || process.env.MARKET_RADAR_DATABASE_URL
  if (!databaseUrl) throw new Error('Learning Radar database is not configured')
  if (!client) client = neon(databaseUrl)
  return client
}
