import { spawnSync } from 'node:child_process'

function redactPostgresError(value) {
  return value.replace(/(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s/]+@/gi, '$1[redacted]@').trim()
}

export function runPsql(databaseUrl, sql, { allowFailure = false } = {}) {
  if (typeof databaseUrl !== 'string' || !databaseUrl.trim()) {
    throw new Error('A PostgreSQL connection string is required.')
  }
  let connection
  try {
    connection = new URL(databaseUrl)
  } catch {
    throw new Error('PostgreSQL connection must be a postgres:// or postgresql:// URL.')
  }
  if (!['postgres:', 'postgresql:'].includes(connection.protocol)) {
    throw new Error('PostgreSQL connection must use the postgres protocol.')
  }
  const socketHost = connection.searchParams.get('host')
  const networkHost = connection.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  const localNetworkHosts = new Set(['localhost', '127.0.0.1', '::1'])
  if (!(socketHost?.startsWith('/') || localNetworkHosts.has(networkHost))) {
    throw new Error('Article Catalog Shadow only permits local PostgreSQL connections.')
  }
  const connectionEnvironment = {
    PGHOST: socketHost || connection.hostname,
    PGPORT: connection.searchParams.get('port') || connection.port || '5432',
    PGDATABASE: decodeURIComponent(connection.pathname.replace(/^\//, '')),
    PGUSER: decodeURIComponent(connection.username),
  }
  if (connection.password) connectionEnvironment.PGPASSWORD = decodeURIComponent(connection.password)
  if (connection.searchParams.get('sslmode')) {
    connectionEnvironment.PGSSLMODE = connection.searchParams.get('sslmode')
  }
  if (connection.searchParams.get('connect_timeout')) {
    connectionEnvironment.PGCONNECT_TIMEOUT = connection.searchParams.get('connect_timeout')
  }
  const psqlBin = process.env.ARTICLE_CATALOG_PSQL_BIN || 'psql'
  const result = spawnSync(
    psqlBin,
    ['-X', '--set', 'ON_ERROR_STOP=1', '--quiet', '--tuples-only', '--no-align', '--echo-errors'],
    {
      encoding: 'utf8',
      env: { ...process.env, ...connectionEnvironment },
      input: sql,
      maxBuffer: 16 * 1024 * 1024,
      timeout: 10_000,
    },
  )

  if (result.error) {
    if (allowFailure) return { ok: false, stdout: '', stderr: result.error.message }
    throw new Error(`PostgreSQL client failed: ${result.error.message}`)
  }
  if (result.status !== 0) {
    const stderr = redactPostgresError(result.stderr || 'PostgreSQL command failed.')
    if (allowFailure) return { ok: false, stdout: result.stdout, stderr }
    throw new Error(stderr)
  }
  return { ok: true, stdout: result.stdout.trim(), stderr: '' }
}

export function queryJson(databaseUrl, sql) {
  const { stdout } = runPsql(databaseUrl, sql)
  if (!stdout) throw new Error('PostgreSQL query returned no JSON payload.')
  try {
    return JSON.parse(stdout)
  } catch {
    throw new Error('PostgreSQL query returned malformed JSON.')
  }
}
