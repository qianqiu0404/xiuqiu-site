import { createRadarPool } from '../market-radar/worker/database-pool.mjs'
import { fileURLToPath } from 'node:url'
import { publishRadarSnapshot } from './radar-publication-store.mjs'
import { materializeRadarPublication } from './radar-publication-materializer.mjs'
import { verifyExactGitPublication } from './exact-git-publication.mjs'
import { shanghaiDate } from './radar-notification-contracts.mjs'
import { readRadarPublication } from './radar-publication-files.mjs'

const databaseUrl = process.env.MARKET_RADAR_DATABASE_URL
if (!databaseUrl) throw new Error('MARKET_RADAR_DATABASE_URL is required')
const expectedSha = process.env.GITHUB_SHA
if (!/^[0-9a-f]{40}$/.test(expectedSha || '')) throw new Error('GITHUB_SHA must be the exact lowercase publication commit')
const repo = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '')
const dates = (process.env.RADAR_PUBLICATION_DATES || process.env.RADAR_PUBLICATION_DATE || shanghaiDate()).split(',').map(value => value.trim())
if (dates.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date))) throw new Error('RADAR_PUBLICATION_DATES must contain YYYY-MM-DD values')
const kinds = new Set((process.env.RADAR_PUBLICATION_KINDS || 'learning,market').split(',').map(value => value.trim()))
if ([...kinds].some(kind => !['learning', 'market'].includes(kind))) throw new Error('RADAR_PUBLICATION_KINDS only supports learning and market')
const result = { dates, snapshots: [] }
const publications = []
for (const date of dates) {
  const datedPublications = [
    ['learning', kinds.has('learning') ? readRadarPublication(new URL(`../content/radar/${date}.md`, import.meta.url), 'learning', date) : null],
    ['market', kinds.has('market') ? readRadarPublication(new URL(`../content/market-radar/${date}.md`, import.meta.url), 'market', date) : null],
  ]
  for (const [kind, publication] of datedPublications) {
    if (!publication) continue
    publications.push({ date, kind, publication, path: `${kind === 'learning' ? 'content/radar' : 'content/market-radar'}/${date}.md` })
  }
}
const revision = await verifyExactGitPublication({ repo, expectedSha, trackedFiles: publications.map(entry => entry.path) })
const pool = createRadarPool({ connectionString: databaseUrl, max: 1, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000 })
let client
try {
  client = await pool.connect()
  await client.query('begin')
  for (const { date, kind, publication } of publications) {
    await publishRadarSnapshot(client, kind, publication, revision)
    await materializeRadarPublication(client, kind, publication)
    result.snapshots.push({ date, kind, snapshotId: publication.snapshotId, asOf: publication.asOf })
  }
  await client.query('commit')
} catch (error) {
  if (client) await client.query('rollback').catch(() => undefined)
  throw error
} finally {
  client?.release()
  await pool.end()
}
console.log(JSON.stringify(result))
