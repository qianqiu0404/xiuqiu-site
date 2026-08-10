import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import {
  deterministicCatalogHash,
  deterministicMetadataHash,
  parseArticleSource,
  publicArticleDto,
  readArticleCatalog,
} from '../article-catalog-shadow/article-source.mjs'
import { importArticleCatalog } from '../article-catalog-shadow/import-articles.mjs'
import { migrateArticleCatalog } from '../article-catalog-shadow/migrate.mjs'
import { queryJson, runPsql } from '../article-catalog-shadow/postgres.mjs'
import { createArticleCatalogServer } from '../article-catalog-shadow/server.mjs'
import { parseMarkdownFrontmatter } from './frontmatter.mjs'

const CONTENT_DIR = new URL('../content/articles/', import.meta.url)
const TEST_COMMIT = 'a'.repeat(40)

function resolvePostgresBinary(name) {
  const direct = spawnSync(name, ['--version'], { encoding: 'utf8' })
  if (!direct.error && direct.status === 0) return name
  const pgConfig = spawnSync('pg_config', ['--bindir'], { encoding: 'utf8' })
  if (!pgConfig.error && pgConfig.status === 0) return join(pgConfig.stdout.trim(), name)
  throw new Error(`PostgreSQL fixture requires ${name}.`)
}

function urlForRole(adminUrl, role, database) {
  const parsed = new URL(adminUrl)
  parsed.pathname = `/${database}`
  parsed.username = role
  parsed.password = ''
  return parsed.href
}

function createFixture() {
  const externalAdminUrl = process.env.ARTICLE_SHADOW_TEST_ADMIN_URL
  let adminUrl = externalAdminUrl
  let fixtureDir
  let pgCtl
  let dataDir
  let localClosed = false
  const closeLocalFixture = () => {
    if (!pgCtl || localClosed) return
    localClosed = true
    spawnSync(pgCtl, ['-D', dataDir, '-m', 'fast', '-w', 'stop'], { stdio: 'ignore' })
    rmSync(fixtureDir, { recursive: true, force: true })
  }

  if (!adminUrl) {
    fixtureDir = mkdtempSync(join(tmpdir(), 'article-catalog-pg-'))
    dataDir = join(fixtureDir, 'data')
    const socketDir = join(fixtureDir, 'socket')
    const initdb = resolvePostgresBinary('initdb')
    pgCtl = resolvePostgresBinary('pg_ctl')
    mkdirSync(socketDir)
    execFileSync(initdb, ['--auth=trust', '--username=article_shadow_admin', '--no-locale', '-D', dataDir], {
      stdio: 'pipe',
    })
    execFileSync(pgCtl, [
      '-D', dataDir,
      '-l', join(fixtureDir, 'postgres.log'),
      '-o', `-k ${socketDir} -h '' -p 5432`,
      '-w', 'start',
    ], {
      stdio: 'ignore',
    })
    process.once('exit', closeLocalFixture)
    const socket = encodeURIComponent(socketDir)
    adminUrl = `postgresql://article_shadow_admin@localhost/postgres?host=${socket}&port=5432`
  }

  const roleNames = [
    'article_catalog_owner',
    'article_catalog_importer',
    'article_catalog_reader',
    'article_catalog_migrator',
    'article_catalog_import_login',
    'article_catalog_api',
    'article_catalog_bystander',
  ]
  const occupied = queryJson(adminUrl, `
    SELECT COALESCE(jsonb_agg(rolname), '[]'::jsonb)::text
    FROM pg_roles WHERE rolname = ANY (ARRAY[${roleNames.map(role => `'${role}'`).join(',')}]);
  `)
  if (occupied.length) throw new Error(`Disposable fixture roles already exist: ${occupied.join(', ')}`)
  const databaseExists = queryJson(adminUrl, `
    SELECT to_jsonb(EXISTS (SELECT 1 FROM pg_database WHERE datname = 'xiuqiu_content'))::text;
  `)
  if (databaseExists) throw new Error('Disposable fixture database xiuqiu_content already exists.')

  runPsql(adminUrl, `
    CREATE ROLE article_catalog_migrator LOGIN CREATEROLE;
    CREATE ROLE article_catalog_import_login LOGIN;
    CREATE ROLE article_catalog_api LOGIN;
    CREATE ROLE article_catalog_bystander LOGIN;
    CREATE DATABASE xiuqiu_content OWNER article_catalog_migrator;
  `)

  let contentAdminUrl
  let migratorUrl
  let importerUrl
  let apiUrl
  let bystanderUrl
  if (externalAdminUrl) {
    const admin = new URL(adminUrl)
    admin.pathname = '/xiuqiu_content'
    contentAdminUrl = admin.href
    migratorUrl = urlForRole(adminUrl, 'article_catalog_migrator', 'xiuqiu_content')
    importerUrl = urlForRole(adminUrl, 'article_catalog_import_login', 'xiuqiu_content')
    apiUrl = urlForRole(adminUrl, 'article_catalog_api', 'xiuqiu_content')
    bystanderUrl = urlForRole(adminUrl, 'article_catalog_bystander', 'xiuqiu_content')
  } else {
    const socketQuery = new URL(adminUrl).search
    contentAdminUrl = `postgresql://article_shadow_admin@localhost/xiuqiu_content${socketQuery}`
    migratorUrl = `postgresql://article_catalog_migrator@localhost/xiuqiu_content${socketQuery}`
    importerUrl = `postgresql://article_catalog_import_login@localhost/xiuqiu_content${socketQuery}`
    apiUrl = `postgresql://article_catalog_api@localhost/xiuqiu_content${socketQuery}`
    bystanderUrl = `postgresql://article_catalog_bystander@localhost/xiuqiu_content${socketQuery}`
  }

  return {
    adminUrl,
    contentAdminUrl,
    migratorUrl,
    importerUrl,
    apiUrl,
    bystanderUrl,
    close() {
      if (pgCtl) {
        closeLocalFixture()
        process.removeListener('exit', closeLocalFixture)
        return
      }
      runPsql(adminUrl, `
        SELECT pg_terminate_backend(pid) FROM pg_stat_activity
        WHERE datname = 'xiuqiu_content' AND pid <> pg_backend_pid();
        DROP DATABASE xiuqiu_content;
        DROP ROLE article_catalog_api;
        DROP ROLE article_catalog_bystander;
        DROP ROLE article_catalog_import_login;
        DROP ROLE article_catalog_migrator;
        DROP ROLE article_catalog_reader;
        DROP ROLE article_catalog_importer;
        DROP ROLE article_catalog_owner;
      `)
    },
  }
}

function cloneContent() {
  const directory = mkdtempSync(join(tmpdir(), 'article-catalog-source-'))
  cpSync(new URL('.', CONTENT_DIR), directory, { recursive: true })
  return directory
}

function sourceUrl(directory) {
  return pathToFileURL(`${directory}/`)
}

function rewriteArticle(directory, file, mutateMeta, bodySuffix = '') {
  const path = join(directory, file)
  const { meta, body } = parseMarkdownFrontmatter(readFileSync(path, 'utf8'), file)
  mutateMeta(meta)
  writeFileSync(path, `---\n${JSON.stringify(meta, null, 2)}\n---\n\n${body}${bodySuffix}\n`)
}

async function request(server, path = '/v1/public/articles', init) {
  if (!server.listening) {
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
  }
  const address = server.address()
  return fetch(`http://127.0.0.1:${address.port}${path}`, init)
}

async function closeServer(server) {
  server.closeIdleConnections?.()
  server.closeAllConnections?.()
  if (!server.listening) return
  await new Promise(resolve => server.close(resolve))
}

test('Article Catalog Shadow uses a real disposable PostgreSQL database', async t => {
  const fixture = createFixture()
  t.after(() => fixture.close())
  const expectedSource = readArticleCatalog(CONTENT_DIR)
  const expectedCount = expectedSource.length
  const expectedPublicArticles = expectedSource
    .map(article => ({
      slug: article.slug,
      title: article.title,
      summary: article.summary,
      publishedAt: article.publishedAt,
      updatedAt: article.updatedAt ?? null,
      sourceCommit: TEST_COMMIT,
      sourceHash: article.sourceHash,
      schemaVersion: 1,
    }))
    .sort((left, right) => (
      right.publishedAt.localeCompare(left.publishedAt) || left.slug.localeCompare(right.slug)
    ))

  await t.test('migration rejects every database except xiuqiu_content and is idempotent', () => {
    assert.throws(() => migrateArticleCatalog(fixture.adminUrl), /requires database xiuqiu_content/)
    migrateArticleCatalog(fixture.migratorUrl)
    migrateArticleCatalog(fixture.migratorUrl)
    assert.equal(
      queryJson(fixture.contentAdminUrl, `SELECT to_jsonb(current_database())::text;`),
      'xiuqiu_content',
    )
  })

  await t.test('current Git catalog imports every source row with deterministic audit hashes', () => {
    assert.equal(
      deterministicMetadataHash(publicArticleDto(expectedSource[0])),
      expectedSource[0].sourceHash,
    )
    assert.throws(
      () => importArticleCatalog({ databaseUrl: fixture.importerUrl, sourceCommit: 'abc1234' }),
      /complete 40-character lowercase Git SHA/,
    )

    const first = importArticleCatalog({
      databaseUrl: fixture.importerUrl,
      sourceCommit: TEST_COMMIT,
    })
    assert.deepEqual(first, {
      total: expectedCount,
      inserted: expectedCount,
      updated: 0,
      unchanged: 0,
    })
    const beforeRepeat = queryJson(fixture.importerUrl, `
      SELECT jsonb_build_object(
        'auditCount', (SELECT count(*) FROM article_catalog.publication_runs),
        'rows', (SELECT jsonb_agg(to_jsonb(article) ORDER BY slug) FROM article_catalog.articles AS article)
      )::text;
    `)
    const second = importArticleCatalog({
      databaseUrl: fixture.importerUrl,
      sourceCommit: TEST_COMMIT,
    })
    assert.deepEqual(second, {
      total: expectedCount,
      inserted: 0,
      updated: 0,
      unchanged: expectedCount,
    })
    const afterRepeat = queryJson(fixture.importerUrl, `
      SELECT jsonb_build_object(
        'auditCount', (SELECT count(*) FROM article_catalog.publication_runs),
        'rows', (SELECT jsonb_agg(to_jsonb(article) ORDER BY slug) FROM article_catalog.articles AS article)
      )::text;
    `)
    assert.deepEqual(afterRepeat, beforeRepeat)
  })

  await t.test('storage and public view expose only the exact catalog allowlists', () => {
    const columns = queryJson(fixture.contentAdminUrl, `
      SELECT jsonb_agg(column_name ORDER BY ordinal_position)::text
      FROM information_schema.columns
      WHERE table_schema = 'article_catalog' AND table_name = 'articles';
    `)
    assert.deepEqual(columns, [
      'slug', 'title', 'summary', 'published_on', 'updated_on', 'source_commit',
      'source_hash', 'schema_version', 'publication_id',
    ])
    const viewColumns = queryJson(fixture.contentAdminUrl, `
      SELECT jsonb_agg(column_name ORDER BY ordinal_position)::text
      FROM information_schema.columns
      WHERE table_schema = 'article_catalog' AND table_name = 'public_articles';
    `)
    assert.deepEqual(viewColumns, [
      'slug', 'title', 'summary', 'published_on', 'updated_on',
      'source_commit', 'source_hash', 'schema_version',
    ])
  })

  await t.test('importer has DML without DELETE or DDL; reader and PUBLIC are view-only', () => {
    assert.equal(runPsql(fixture.importerUrl, 'SELECT count(*) FROM article_catalog.articles;').ok, true)
    assert.equal(runPsql(fixture.importerUrl, 'DELETE FROM article_catalog.articles;', { allowFailure: true }).ok, false)
    assert.equal(runPsql(fixture.importerUrl, 'CREATE TABLE article_catalog.forbidden(id int);', { allowFailure: true }).ok, false)
    assert.equal(runPsql(fixture.importerUrl, 'CREATE SCHEMA forbidden;', { allowFailure: true }).ok, false)
    assert.equal(runPsql(fixture.importerUrl, 'CREATE TEMP TABLE forbidden(id int);', { allowFailure: true }).ok, false)
    assert.equal(runPsql(fixture.apiUrl, 'SELECT count(*) FROM article_catalog.public_articles;').ok, true)
    assert.equal(runPsql(fixture.apiUrl, 'SELECT count(*) FROM article_catalog.public_catalog_audit;').ok, true)
    assert.equal(runPsql(fixture.apiUrl, 'SELECT count(*) FROM article_catalog.articles;', { allowFailure: true }).ok, false)
    assert.equal(runPsql(fixture.apiUrl, 'UPDATE article_catalog.public_articles SET title = title;', { allowFailure: true }).ok, false)
    assert.equal(runPsql(fixture.bystanderUrl, 'SELECT count(*) FROM article_catalog.public_articles;', { allowFailure: true }).ok, false)
  })

  await t.test('public GET matches every Git slug and exposes only the catalog allowlist', async subtest => {
    const server = createArticleCatalogServer({ databaseUrl: fixture.apiUrl })
    subtest.after(() => closeServer(server))
    const response = await request(server)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    const payload = await response.json()
    assert.equal(payload.articles.length, expectedCount)
    assert.deepEqual(payload.articles, expectedPublicArticles)
    assert.deepEqual(
      Object.keys(payload.articles[0]).sort(),
      [
        'publishedAt', 'schemaVersion', 'slug', 'sourceCommit', 'sourceHash',
        'summary', 'title', 'updatedAt',
      ].sort(),
    )
    assert.deepEqual(
      Object.keys(payload.audit).sort(),
      ['articleCount', 'catalogHash', 'publishedAt', 'schemaVersion', 'sourceCommit'].sort(),
    )
    assert.equal(payload.audit.articleCount, expectedCount)
    assert.equal(payload.audit.sourceCommit, TEST_COMMIT)
    const serialized = JSON.stringify(payload)
    for (const forbidden of [
      'content', 'conceptTags', 'relatedProjectIds', 'recommendedSlugs', 'suggestedQuestions',
      'sourcePath', 'difficulty', 'evidenceLevel', 'seriesOrder',
    ]) assert.doesNotMatch(serialized, new RegExp(`"${forbidden}"`))

    const method = await request(server, '/v1/public/articles', { method: 'POST' })
    assert.equal(method.status, 405)
    assert.equal(method.headers.get('allow'), 'GET')
    assert.equal(method.headers.get('cache-control'), 'no-store')
    await method.text()
    const missing = await request(server, '/missing')
    assert.equal(missing.status, 404)
    assert.equal(missing.headers.get('cache-control'), 'no-store')
    await missing.text()
  })

  await t.test('no database and database errors fail closed with no-store', async () => {
    assert.throws(
      () => runPsql('postgresql://article_catalog_api@db.example.com/xiuqiu_content', 'SELECT 1;'),
      /only permits local PostgreSQL connections/,
    )
    const noDatabase = createArticleCatalogServer()
    const missingResponse = await request(noDatabase)
    assert.equal(missingResponse.status, 503)
    assert.equal(missingResponse.headers.get('cache-control'), 'no-store')
    assert.equal(missingResponse.headers.get('x-content-type-options'), 'nosniff')
    await missingResponse.text()
    await closeServer(noDatabase)

    runPsql(fixture.migratorUrl, 'REVOKE SELECT ON article_catalog.public_articles FROM article_catalog_reader;')
    const brokenDatabase = createArticleCatalogServer({ databaseUrl: fixture.apiUrl })
    const errorResponse = await request(brokenDatabase)
    assert.equal(errorResponse.status, 503)
    assert.equal(errorResponse.headers.get('cache-control'), 'no-store')
    await errorResponse.text()
    await closeServer(brokenDatabase)
    runPsql(fixture.migratorUrl, 'GRANT SELECT ON article_catalog.public_articles TO article_catalog_reader;')

    const remoteDatabase = createArticleCatalogServer({
      databaseUrl: 'postgresql://article_catalog_api@db.example.com/xiuqiu_content',
    })
    const remoteResponse = await request(remoteDatabase)
    assert.equal(remoteResponse.status, 503)
    assert.equal(remoteResponse.headers.get('cache-control'), 'no-store')
    await remoteResponse.text()
    await closeServer(remoteDatabase)
  })

  await t.test('private frontmatter and body changes never enter storage or API', async () => {
    const directory = cloneContent()
    t.after(() => rmSync(directory, { recursive: true, force: true }))
    const file = readdirSync(directory).filter(name => name.endsWith('.md')).sort()[0]
    rewriteArticle(directory, file, meta => {
      meta.suggestedQuestions.push('ARTICLE_SHADOW_PRIVATE_SENTINEL')
    }, '\n\nARTICLE_SHADOW_PRIVATE_SENTINEL')
    const result = importArticleCatalog({
      databaseUrl: fixture.importerUrl,
      contentDir: sourceUrl(directory),
      sourceCommit: TEST_COMMIT,
    })
    assert.equal(result.updated, 0)
    const server = createArticleCatalogServer({ databaseUrl: fixture.apiUrl })
    const response = await request(server)
    assert.doesNotMatch(await response.text(), /ARTICLE_SHADOW_PRIVATE_SENTINEL/)
    await closeServer(server)
  })

  await t.test('a valid Git metadata change updates hash and can return to the committed snapshot', () => {
    const directory = cloneContent()
    t.after(() => rmSync(directory, { recursive: true, force: true }))
    const file = readdirSync(directory).filter(name => name.endsWith('.md')).sort()[0]
    rewriteArticle(directory, file, meta => { meta.title = `${meta.title}（影子测试）` })
    const changed = importArticleCatalog({
      databaseUrl: fixture.importerUrl,
      contentDir: sourceUrl(directory),
      sourceCommit: TEST_COMMIT,
    })
    assert.equal(changed.updated, 1)
    const restored = importArticleCatalog({ databaseUrl: fixture.importerUrl, sourceCommit: TEST_COMMIT })
    assert.equal(restored.updated, 1)
    const activeAudit = queryJson(fixture.apiUrl, `
      SELECT to_jsonb(audit)::text
      FROM article_catalog.public_catalog_audit AS audit;
    `)
    const expectedCatalogHash = deterministicCatalogHash({
      sourceCommit: TEST_COMMIT,
      schemaVersion: 1,
      articles: expectedSource,
    })
    assert.equal(activeAudit.catalog_hash, expectedCatalogHash)
    assert.equal(activeAudit.article_count, expectedCount)
  })

  await t.test('deletion and file/slug rename are rejected without changing the Git-sized snapshot', () => {
    const source = readArticleCatalog(CONTENT_DIR)
    const referenced = new Set(source.flatMap(article => article.privateMetadata.recommendedSlugs))
    const removable = source.find(article => !referenced.has(article.slug))
    assert.ok(removable)

    const deletedDirectory = cloneContent()
    t.after(() => rmSync(deletedDirectory, { recursive: true, force: true }))
    rmSync(join(deletedDirectory, removable.sourcePath))
    assert.throws(
      () => importArticleCatalog({
        databaseUrl: fixture.importerUrl,
        contentDir: sourceUrl(deletedDirectory),
        sourceCommit: TEST_COMMIT,
      }),
      /deletion or slug rename/,
    )

    const renamedDirectory = cloneContent()
    t.after(() => rmSync(renamedDirectory, { recursive: true, force: true }))
    renameSync(
      join(renamedDirectory, removable.sourcePath),
      join(renamedDirectory, `renamed-${removable.sourcePath}`),
    )
    assert.throws(
      () => importArticleCatalog({
        databaseUrl: fixture.importerUrl,
        contentDir: sourceUrl(renamedDirectory),
        sourceCommit: TEST_COMMIT,
      }),
      /filename must match article slug/,
    )
    assert.equal(
      queryJson(fixture.importerUrl, `SELECT to_jsonb(count(*))::text FROM article_catalog.articles;`),
      expectedCount,
    )
  })

  await t.test('duplicate slug and invalid calendar date fail before database writes', () => {
    const duplicateDirectory = cloneContent()
    t.after(() => rmSync(duplicateDirectory, { recursive: true, force: true }))
    const files = readdirSync(duplicateDirectory).filter(name => name.endsWith('.md')).sort()
    const first = parseArticleSource(readFileSync(join(duplicateDirectory, files[0]), 'utf8'), files[0])
    rewriteArticle(duplicateDirectory, files[1], meta => { meta.slug = first.slug })
    assert.throws(() => readArticleCatalog(sourceUrl(duplicateDirectory)), /Duplicate article slug/)

    const invalidDateDirectory = cloneContent()
    t.after(() => rmSync(invalidDateDirectory, { recursive: true, force: true }))
    rewriteArticle(invalidDateDirectory, files[0], meta => { meta.date = '2026-02-30' })
    assert.throws(() => readArticleCatalog(sourceUrl(invalidDateDirectory)), /not a valid calendar date/)
    assert.equal(
      queryJson(fixture.importerUrl, `SELECT to_jsonb(count(*))::text FROM article_catalog.articles;`),
      expectedCount,
    )
  })

  await t.test('out-of-band database hash drift fails closed', () => {
    runPsql(fixture.importerUrl, `
      UPDATE article_catalog.articles
      SET title = title || ' tampered'
      WHERE slug = (SELECT slug FROM article_catalog.articles ORDER BY slug LIMIT 1);
    `)
    assert.throws(
      () => importArticleCatalog({ databaseUrl: fixture.importerUrl, sourceCommit: TEST_COMMIT }),
      /metadata hash drift/,
    )
    assert.equal(
      queryJson(fixture.importerUrl, `SELECT to_jsonb(count(*))::text FROM article_catalog.articles;`),
      expectedCount,
    )
  })
})
