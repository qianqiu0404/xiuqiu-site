import { readFile } from 'node:fs/promises'
import { neon } from '@neondatabase/serverless'

const databaseUrl = process.env.MARKET_RADAR_DATABASE_URL
if (!databaseUrl) throw new Error('MARKET_RADAR_DATABASE_URL is required')
const sql = neon(databaseUrl)
const migration = await readFile(new URL('../migrations/001_initial.sql', import.meta.url), 'utf8')
const statements = migration.split(/;\s*(?:\n|$)/).map(statement => statement.trim()).filter(Boolean)
for (const statement of statements) await sql.query(statement, [])
console.log(`Applied ${statements.length} market_radar migration statements.`)
