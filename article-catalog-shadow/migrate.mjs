import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { runPsql } from './postgres.mjs'

const MIGRATION_URL = new URL('./migrations/001_article_catalog.sql', import.meta.url)

export function migrateArticleCatalog(databaseUrl) {
  runPsql(databaseUrl, readFileSync(MIGRATION_URL, 'utf8'))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const databaseUrl = process.env.ARTICLE_CATALOG_ADMIN_DATABASE_URL
  if (!databaseUrl) {
    console.error('ARTICLE_CATALOG_ADMIN_DATABASE_URL is required for migration.')
    process.exitCode = 1
  } else {
    migrateArticleCatalog(databaseUrl)
    console.log('Article Catalog Shadow migration is current.')
  }
}
