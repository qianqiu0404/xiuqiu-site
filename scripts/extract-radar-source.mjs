import { loadDailyResearchSource, parseDailyResearchSource } from './radar-pipeline.mjs'

const [sourcePath] = process.argv.slice(2)
if (!sourcePath) throw new Error('Usage: node scripts/extract-radar-source.mjs <obsidian-daily.md>')

const parsed = parseDailyResearchSource(loadDailyResearchSource(sourcePath))
if (parsed.succeeded.length < 3) {
  console.error(`Radar publishing stopped: only ${parsed.succeeded.length}/4 public sections succeeded.`)
  process.exit(2)
}

process.stdout.write(JSON.stringify(parsed, null, 2))
