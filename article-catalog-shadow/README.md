# Article Catalog Shadow

This is a local, server-only shadow of the Git-owned article catalog. Git remains the source of truth.

- `migrate.mjs` applies the idempotent PostgreSQL schema migration using `ARTICLE_CATALOG_ADMIN_DATABASE_URL`.
- `import-articles.mjs` imports Git metadata in one direction using `ARTICLE_CATALOG_DATABASE_URL`.
- `server.mjs` serves only `GET /v1/public/articles` on localhost. It is not a Vercel Function and is not imported by the Vite application.
- `npm run test:article-shadow` creates a disposable PostgreSQL fixture locally. CI uses an isolated PostgreSQL service.

The importer stores only slug, title, summary, publication/update dates, deterministic public-metadata hash, Git commit, schema version, and a publication-run reference. It never stores article bodies, tags, difficulty, evidence, series, concept tags, project relationships, recommended slugs, or suggested questions. It refuses deletions, slug/file renames, and out-of-band database metadata drift. A failure leaves the existing catalog unchanged.

The migration is guarded to run only in the dedicated `xiuqiu_content` database. The database is owned by a separate `article_catalog_migrator` login and needs application logins named `article_catalog_import_login` and `article_catalog_api`. The migration revokes public database access, grants the importer only table DML (without DELETE or DDL), and lets the API select only the public catalog/audit views.

This change does not wire host persistence or a Q-SSD storage manifest. The operational migrate/import/serve scripts do not run `initdb`, create a PostgreSQL data directory, or fall back to a system-disk database. Migration and import require explicit database URLs and stop when they are absent; only Unix-socket, `localhost`, `127.0.0.1`, and `::1` PostgreSQL connections are accepted. The HTTP server uses `Cache-Control: no-store` for success and failure, and fails closed with `503` when no local database is available. Only the test suite creates and removes a disposable PostgreSQL cluster.

Production-like imports attribute a clean `content/articles` snapshot to the complete 40-character lowercase `HEAD` SHA. Tracked or untracked article changes make the default importer stop; fixture/custom-source callers must provide an explicit full SHA.
