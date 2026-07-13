import { readFileSync } from 'node:fs'
import { parseMarkdownFrontmatter } from './frontmatter.mjs'
import { loadDailyResearchSource, validateRadarCandidate } from './radar-pipeline.mjs'

const [sourcePath, candidatePath] = process.argv.slice(2)
if (!sourcePath || !candidatePath) throw new Error('Usage: node scripts/validate-radar-candidate.mjs <obsidian-daily.md> <content/radar/date.md>')
const source = loadDailyResearchSource(sourcePath)
const { meta } = parseMarkdownFrontmatter(readFileSync(candidatePath, 'utf8'), candidatePath)
const result = validateRadarCandidate(meta, source)
console.log(`Radar candidate passed: ${result.succeeded.length} sections, ${result.candidateUrls.length} source URLs.`)
