import { Pool as NeonPool } from '@neondatabase/serverless'
import { Pool as PgPool } from 'pg'

export function localRadarDatabaseUrl(value) {
  if (!value) throw new Error('RADAR_LOCAL_DATABASE_URL is required')
  const parsed = new URL(value)
  const socket = parsed.searchParams.get('host') || ''
  if (!/^\/[^\0]+$/.test(socket) || parsed.hostname !== 'localhost' || parsed.pathname !== '/xiuqiu_radar') {
    throw new Error('Local radar database must be xiuqiu_radar over an absolute Unix socket.')
  }
  return value
}

export function createRadarPool(config) {
  const driver = process.env.RADAR_DATABASE_DRIVER || 'neon'
  if (driver === 'pg') {
    localRadarDatabaseUrl(config.connectionString)
    return new PgPool(config)
  }
  if (driver !== 'neon') throw new Error('RADAR_DATABASE_DRIVER must be neon or pg')
  return new NeonPool(config)
}
