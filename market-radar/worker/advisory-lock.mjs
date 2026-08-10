import { Pool } from '@neondatabase/serverless'

export const RADAR_DATABASE_LOCK_KEY = 'xiuqiu-site:radar:database-write:v1'

export class RadarDatabaseLockTimeoutError extends Error {
  constructor(timeoutMs) {
    super(`Timed out after ${timeoutMs}ms waiting for the radar database lock`)
    this.name = 'RadarDatabaseLockTimeoutError'
  }
}

export async function withRadarDatabaseLock(options, work) {
  const {
    databaseUrl,
    wait = false,
    timeoutMs = 120_000,
    pollIntervalMs = 500,
    sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
    createPool = config => new Pool(config),
  } = options
  if (!databaseUrl) throw new Error('A radar database URL is required for the advisory lock')

  const pool = createPool({ connectionString: databaseUrl, max: 1 })
  let client
  let acquired = false
  let releaseError
  try {
    client = await pool.connect()
    const deadline = Date.now() + timeoutMs
    do {
      const result = await client.query(
        'select pg_try_advisory_lock(hashtextextended($1, 0)) as acquired',
        [RADAR_DATABASE_LOCK_KEY],
      )
      acquired = result.rows[0]?.acquired === true
      if (acquired || !wait) break
      if (Date.now() >= deadline) throw new RadarDatabaseLockTimeoutError(timeoutMs)
      await sleep(Math.min(pollIntervalMs, Math.max(1, deadline - Date.now())))
    } while (!acquired)

    if (!acquired) return { acquired: false, value: undefined }
    return { acquired: true, value: await work({ client }) }
  } finally {
    try {
      if (client) {
        if (acquired) {
          try {
            await client.query('select pg_advisory_unlock(hashtextextended($1, 0))', [RADAR_DATABASE_LOCK_KEY])
          } catch (error) {
            releaseError = error
          }
        }
        client.release(releaseError)
      }
    } finally {
      await pool.end()
    }
  }
}
