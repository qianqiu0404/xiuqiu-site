BEGIN;

DO $database_guard$
BEGIN
  IF current_database() <> 'xiuqiu_content' THEN
    RAISE EXCEPTION 'Article Catalog Shadow migration requires database xiuqiu_content; connected to %.', current_database();
  END IF;
END
$database_guard$;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'article_catalog_owner') THEN
    CREATE ROLE article_catalog_owner NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'article_catalog_importer') THEN
    CREATE ROLE article_catalog_importer NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'article_catalog_reader') THEN
    CREATE ROLE article_catalog_reader NOLOGIN NOINHERIT;
  END IF;
END
$roles$;

DO $membership$
BEGIN
  EXECUTE format('GRANT article_catalog_owner TO %I', current_user);
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'article_catalog_import_login') THEN
    GRANT article_catalog_importer TO article_catalog_import_login;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'article_catalog_api') THEN
    GRANT article_catalog_reader TO article_catalog_api;
  END IF;
END
$membership$;

REVOKE CONNECT ON DATABASE xiuqiu_content FROM PUBLIC;
REVOKE TEMPORARY ON DATABASE xiuqiu_content FROM PUBLIC;
GRANT CONNECT ON DATABASE xiuqiu_content TO article_catalog_owner;
GRANT CONNECT ON DATABASE xiuqiu_content TO article_catalog_importer;
GRANT CONNECT ON DATABASE xiuqiu_content TO article_catalog_reader;
GRANT CONNECT ON DATABASE xiuqiu_content TO article_catalog_migrator;
GRANT CONNECT ON DATABASE xiuqiu_content TO article_catalog_import_login;
GRANT CONNECT ON DATABASE xiuqiu_content TO article_catalog_api;

CREATE SCHEMA IF NOT EXISTS article_catalog AUTHORIZATION article_catalog_owner;

SET LOCAL ROLE article_catalog_owner;

CREATE TABLE IF NOT EXISTS article_catalog.publication_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_commit text NOT NULL CHECK (source_commit ~ '^[0-9a-f]{40}$'),
  catalog_hash char(64) NOT NULL UNIQUE CHECK (catalog_hash ~ '^[0-9a-f]{64}$'),
  schema_version integer NOT NULL CHECK (schema_version = 1),
  article_count integer NOT NULL CHECK (article_count >= 0),
  published_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS article_catalog.articles (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  summary text NOT NULL CHECK (length(btrim(summary)) > 0),
  published_on date NOT NULL,
  updated_on date CHECK (updated_on IS NULL OR updated_on >= published_on),
  source_commit text NOT NULL CHECK (source_commit ~ '^[0-9a-f]{40}$'),
  source_hash char(64) NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  schema_version integer NOT NULL CHECK (schema_version = 1),
  publication_id bigint NOT NULL REFERENCES article_catalog.publication_runs(id)
);

CREATE OR REPLACE VIEW article_catalog.public_articles
WITH (security_barrier = true)
AS
SELECT
  slug,
  title,
  summary,
  published_on,
  updated_on,
  source_commit,
  source_hash,
  schema_version
FROM article_catalog.articles;

CREATE OR REPLACE VIEW article_catalog.public_catalog_audit
WITH (security_barrier = true)
AS
SELECT source_commit, catalog_hash, schema_version, article_count, published_at
FROM article_catalog.publication_runs
WHERE id = (
  SELECT min(publication_id)
  FROM article_catalog.articles
  HAVING min(publication_id) = max(publication_id)
)
LIMIT 1;

RESET ROLE;

REVOKE ALL ON SCHEMA article_catalog FROM PUBLIC;
REVOKE ALL ON article_catalog.articles FROM PUBLIC, article_catalog_importer, article_catalog_reader;
REVOKE ALL ON article_catalog.publication_runs FROM PUBLIC, article_catalog_importer, article_catalog_reader;
REVOKE ALL ON article_catalog.public_articles FROM PUBLIC;
REVOKE ALL ON article_catalog.public_catalog_audit FROM PUBLIC;
GRANT USAGE ON SCHEMA article_catalog TO article_catalog_importer;
GRANT SELECT, INSERT, UPDATE ON article_catalog.articles TO article_catalog_importer;
GRANT SELECT, INSERT ON article_catalog.publication_runs TO article_catalog_importer;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA article_catalog TO article_catalog_importer;
GRANT USAGE ON SCHEMA article_catalog TO article_catalog_reader;
GRANT SELECT ON article_catalog.public_articles TO article_catalog_reader;
GRANT SELECT ON article_catalog.public_catalog_audit TO article_catalog_reader;

COMMIT;
