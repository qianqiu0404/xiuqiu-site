import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { parseMarkdownFrontmatter } from './frontmatter.mjs'
import { shanghaiDate } from './radar-notification-contracts.mjs'

const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value)

export function selectRadarPublicationPlan({ env = process.env, root = new URL('../', import.meta.url), today = shanghaiDate() } = {}) {
  const kinds = new Set((env.RADAR_PUBLICATION_KINDS || 'learning,market').split(',').map(value => value.trim()))
  if (!kinds.size || [...kinds].some(kind => !['learning', 'market'].includes(kind))) {
    throw new Error('RADAR_PUBLICATION_KINDS only supports learning and market')
  }
  const explicitDates = env.RADAR_PUBLICATION_DATES || env.RADAR_PUBLICATION_DATE
  if (env.RADAR_PUBLICATION_SELECTION && env.RADAR_PUBLICATION_SELECTION !== 'latest') {
    throw new Error('RADAR_PUBLICATION_SELECTION only supports latest')
  }
  if (explicitDates && env.RADAR_PUBLICATION_SELECTION) {
    throw new Error('Choose explicit publication dates or latest selection, not both')
  }
  if (!env.RADAR_PUBLICATION_SELECTION) {
    const dates = (explicitDates || today).split(',').map(value => value.trim())
    if (dates.some(value => !validDate(value))) throw new Error('RADAR_PUBLICATION_DATES must contain YYYY-MM-DD values')
    return { dates: [...new Set(dates)], kinds, byKind: null }
  }

  const dates = new Set()
  const byKind = {}
  for (const kind of kinds) {
    const directory = new URL(kind === 'learning' ? 'content/radar/' : 'content/market-radar/', root)
    if (!existsSync(directory)) continue
    const files = readdirSync(directory).filter(file => /^\d{4}-\d{2}-\d{2}\.md$/.test(file)).sort().reverse()
    for (const file of files) {
      const source = new URL(file, directory)
      const { meta } = parseMarkdownFrontmatter(readFileSync(source, 'utf8'), source.pathname)
      if (meta.publish !== true) continue
      if (file.slice(0, 10) > today) throw new Error('Future published research must not enter a release: ' + file)
      if (meta.reviewStatus !== 'automated') continue
      if (meta.date !== file.slice(0, 10) || meta.slug !== meta.date) throw new Error('Publication filename, date and slug must agree: ' + file)
      dates.add(meta.date)
      byKind[kind] = meta.date
      break
    }
  }
  if (!dates.size) throw new Error('No publishable research snapshots in the exact release')
  return { dates: [...dates].sort(), kinds, byKind }
}
