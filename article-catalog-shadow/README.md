# Article Catalog Shadow

This is a local, server-only shadow of the Git-owned article catalog. Git remains the source of truth.

- `migrate.mjs` applies the idempotent PostgreSQL schema migration using `ARTICLE_CATALOG_ADMIN_DATABASE_URL`.
- `import-articles.mjs` imports Git metadata in one direction using `ARTICLE_CATALOG_DATABASE_URL`.
- `server.mjs` serves only authenticated `GET /health` and `GET /v1/public/articles` on localhost. It is not a Vercel Function and is not imported by the Vite application.
- `npm run test:article-shadow` creates a disposable PostgreSQL fixture locally. CI uses an isolated PostgreSQL service.

The importer stores only slug, title, summary, publication/update dates, deterministic public-metadata hash, Git commit, schema version, and a publication-run reference. It never stores article bodies, tags, difficulty, evidence, series, concept tags, project relationships, recommended slugs, or suggested questions. It refuses deletions, slug/file renames, and out-of-band database metadata drift. A failure leaves the existing catalog unchanged.

The migration is guarded to run only in the dedicated `xiuqiu_content` database. The database is owned by a separate `article_catalog_migrator` login and needs application logins named `article_catalog_import_login` and `article_catalog_api`. The migration revokes public database access, grants the importer only table DML (without DELETE or DDL), and lets the API select only the public catalog/audit views.

This change does not wire host persistence or a Q-SSD storage manifest. The operational migrate/import/serve scripts do not run `initdb`, create a PostgreSQL data directory, or fall back to a system-disk database. Migration and import require explicit database URLs and stop when they are absent; only Unix-socket, `localhost`, `127.0.0.1`, and `::1` PostgreSQL connections are accepted. The HTTP server uses `Cache-Control: no-store` for success and failure, and fails closed with `503` when no local database is available. Only the test suite creates and removes a disposable PostgreSQL cluster.

Production-like imports attribute a clean `content/articles` snapshot to the complete 40-character lowercase `HEAD` SHA. Tracked or untracked article changes make the default importer stop; fixture/custom-source callers must provide an explicit full SHA.

## Preview authentication and proxy

The localhost server requires `ARTICLE_CATALOG_HMAC_KEYS_JSON`, a JSON object mapping rotatable key IDs to secrets of at least 32 characters. Every request is signed over the key ID, method, exact path, body SHA-256, 13-digit timestamp, and one-time nonce. Signatures expire after 60 seconds and valid nonces cannot be replayed. Encoded or query-string variants of the two allowed paths are rejected.

The Vercel proxy is available only when both `VERCEL_ENV=preview` and `CONTENT_CATALOG_PREVIEW_ENABLED=true`. It requires an HTTPS `ARTICLE_CATALOG_PREVIEW_UPSTREAM_URL` plus `ARTICLE_CATALOG_PREVIEW_KEY_ID` and `ARTICLE_CATALOG_PREVIEW_SECRET` for one active key from the host key map. Rotation is performed by adding the new key to the host map, switching the Preview key ID/secret, and then removing the old host key after in-flight requests expire. Values belong in host/Vercel secret stores and must never be committed.

The Vue inspection page is included only when the Vite build has `VITE_CONTENT_CATALOG_PREVIEW=true`. It is not linked from production navigation, SEO, or sitemap sources. The page and proxy are always `no-store`/`noindex`; if the localhost catalog is unavailable, the page continues with the public metadata snapshot generated from Git at build time. Production and every build without both Preview gates return or route to the normal `404` surface.
