import { neon } from '@neondatabase/serverless'
import { applyRadarMigrations } from './migrations.mjs'

const databaseUrl = process.env.MARKET_RADAR_DATABASE_URL
if (!databaseUrl) throw new Error('MARKET_RADAR_DATABASE_URL is required')
const sql = neon(databaseUrl)
const result = await applyRadarMigrations(sql)
console.log(`Radar migrations: ${result.appliedFiles} applied, ${result.skippedFiles} unchanged, ${result.statements} statements.`)
