import { neon } from '@neondatabase/serverless'
import { publishRadarSnapshot } from './radar-publication-store.mjs'
import { shanghaiDate } from './radar-notification-contracts.mjs'
import { readRadarPublication } from './radar-publication-files.mjs'

const databaseUrl = process.env.MARKET_RADAR_DATABASE_URL
if (!databaseUrl) throw new Error('MARKET_RADAR_DATABASE_URL is required')
const dates = (process.env.RADAR_PUBLICATION_DATES || process.env.RADAR_PUBLICATION_DATE || shanghaiDate()).split(',').map(value => value.trim())
if (dates.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date))) throw new Error('RADAR_PUBLICATION_DATES must contain YYYY-MM-DD values')
const kinds = new Set((process.env.RADAR_PUBLICATION_KINDS || 'learning,market').split(',').map(value => value.trim()))
if ([...kinds].some(kind => !['learning', 'market'].includes(kind))) throw new Error('RADAR_PUBLICATION_KINDS only supports learning and market')
const sql = neon(databaseUrl)

const result = { dates, snapshots: [] }
for (const date of dates) {
  const publications = [
    ['learning', kinds.has('learning') ? readRadarPublication(new URL(`../content/radar/${date}.md`, import.meta.url), 'learning', date) : null],
    ['market', kinds.has('market') ? readRadarPublication(new URL(`../content/market-radar/${date}.md`, import.meta.url), 'market', date) : null],
  ]
  for (const [kind, publication] of publications) {
    if (!publication) continue
    await publishRadarSnapshot(sql, kind, publication)
    result.snapshots.push({ date, kind, snapshotId: publication.snapshotId, asOf: publication.asOf })
  }
}
console.log(JSON.stringify(result))
