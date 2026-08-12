import { withRadarDatabaseLock } from './advisory-lock.mjs'
import { applyRadarMigrations } from './migrations.mjs'

const databaseUrl = process.env.MARKET_RADAR_DATABASE_URL
if (!databaseUrl) throw new Error('MARKET_RADAR_DATABASE_URL is required')
const result = await withRadarDatabaseLock({ databaseUrl, wait: true }, ({ client }) => applyRadarMigrations(
  (statement, values) => client.query(statement, values),
))
console.log(`Radar migrations: ${result.value.appliedFiles} applied, ${result.value.skippedFiles} unchanged, ${result.value.statements} statements.`)
