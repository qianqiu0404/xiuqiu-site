import { readdir, readFile } from 'node:fs/promises'
import { neon } from '@neondatabase/serverless'

const databaseUrl = process.env.MARKET_RADAR_DATABASE_URL
if (!databaseUrl) throw new Error('MARKET_RADAR_DATABASE_URL is required')
const sql = neon(databaseUrl)
const migrationsUrl = new URL('../migrations/', import.meta.url)
const files = (await readdir(migrationsUrl)).filter(file => /^\d+_.+\.sql$/.test(file)).sort()
let statementCount = 0
for (const file of files) {
  const migration = await readFile(new URL(file, migrationsUrl), 'utf8')
  const statements = migration.split(/;\s*(?:\n|$)/).map(statement => statement.trim()).filter(Boolean)
  for (const statement of statements) await sql.query(statement, [])
  statementCount += statements.length
}
console.log(`Applied ${statementCount} market_radar migration statements from ${files.length} files.`)
