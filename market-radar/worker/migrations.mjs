import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'

export const migrationsUrl = new URL('../migrations/', import.meta.url)

export function splitRadarMigrationStatements(migration) {
  const statements = []
  let start = 0
  let index = 0
  let quote = null
  let dollarTag = null
  let lineComment = false
  let blockComment = false
  while (index < migration.length) {
    const character = migration[index]
    const next = migration[index + 1]
    if (lineComment) {
      if (character === '\n') lineComment = false
      index += 1
      continue
    }
    if (blockComment) {
      if (character === '*' && next === '/') {
        blockComment = false
        index += 2
      } else index += 1
      continue
    }
    if (dollarTag) {
      if (migration.startsWith(dollarTag, index)) {
        index += dollarTag.length
        dollarTag = null
      } else index += 1
      continue
    }
    if (quote) {
      if (character === quote) {
        if (next === quote) index += 2
        else {
          quote = null
          index += 1
        }
      } else index += 1
      continue
    }
    if (character === '-' && next === '-') {
      lineComment = true
      index += 2
      continue
    }
    if (character === '/' && next === '*') {
      blockComment = true
      index += 2
      continue
    }
    if (character === "'" || character === '"') {
      quote = character
      index += 1
      continue
    }
    if (character === '$') {
      const match = migration.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)
      if (match) {
        dollarTag = match[0]
        index += dollarTag.length
        continue
      }
    }
    if (character === ';') {
      const statement = migration.slice(start, index).trim()
      if (statement) statements.push(statement)
      start = index + 1
    }
    index += 1
  }
  const trailing = migration.slice(start).trim()
  if (trailing) statements.push(trailing)
  return statements
}

export async function loadRadarMigrations() {
  const files = (await readdir(migrationsUrl)).filter(file => /^\d+_.+\.sql$/.test(file)).sort()
  return Promise.all(files.map(async (file) => {
    const migration = await readFile(new URL(file, migrationsUrl), 'utf8')
    return {
      file,
      checksum: createHash('sha256').update(migration).digest('hex'),
      statements: splitRadarMigrationStatements(migration),
    }
  }))
}

export async function applyRadarMigrations(sql, migrations) {
  const selectedMigrations = migrations ?? await loadRadarMigrations()
  await sql.transaction([
    sql.query('create schema if not exists radar_system', []),
    sql.query(`create table if not exists radar_system.schema_migrations (
      file text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )`, []),
  ])

  let statementCount = 0
  let appliedFiles = 0
  let skippedFiles = 0
  for (const migration of selectedMigrations) {
    const existing = await sql.query('select checksum from radar_system.schema_migrations where file = $1', [migration.file])
    if (existing[0]) {
      if (existing[0].checksum !== migration.checksum) throw new Error(`Migration checksum mismatch for ${migration.file}`)
      skippedFiles += 1
      continue
    }
    await sql.transaction([
      ...migration.statements.map(statement => sql.query(statement, [])),
      sql.query('insert into radar_system.schema_migrations (file, checksum) values ($1, $2)', [migration.file, migration.checksum]),
    ])
    statementCount += migration.statements.length
    appliedFiles += 1
  }
  return { files: selectedMigrations.length, appliedFiles, skippedFiles, statements: statementCount }
}
