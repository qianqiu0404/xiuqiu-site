// Health probe and build-time fallback snapshots for the two external feeds
// that vercel.json rewrites (/grok-news-data, /research-data).
//
//   node scripts/external-sources.mjs                 probe the upstream origins
//   node scripts/external-sources.mjs --base <origin> probe through the site rewrites
//
// Exit 1 when a source is unreachable or invalid. A stale source is a warning:
// upstream may legitimately pause, and the page already says so.

import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { EXTERNAL_SOURCES, probeAllExternalSources } from '../shared/externalSources.ts'
import { parseGrokIndex } from '../shared/grokNews.ts'
import { parseResearchIndex } from '../src/data/sharedResearch.ts'

export const PARSERS = { grok: parseGrokIndex, research: parseResearchIndex }

export function probeAll(options = {}) {
  return probeAllExternalSources(PARSERS, options)
}

export function formatReport(probes) {
  const rows = probes.map(p => {
    const state = !p.ok ? 'FAIL' : p.freshness === 'stale' ? 'STALE' : p.freshness === 'unknown' ? 'UNKNOWN' : 'OK'
    const age = p.ageHours == null ? '-' : `${p.ageHours.toFixed(1)}h`
    return `| ${EXTERNAL_SOURCES[p.source].label} | ${state} | ${p.status ?? '-'} | ${p.elapsedMs}ms | ${p.updatedAt ?? '-'} | ${age} | ${p.records ?? '-'} | ${p.error ?? ''} |`
  })
  return ['| 来源 | 状态 | HTTP | 耗时 | updated_at | 距今 | 条数 | 错误 |', '| --- | --- | --- | --- | --- | --- | --- | --- |', ...rows].join('\n')
}

export function exitCode(probes) {
  return probes.every(p => p.ok) ? 0 : 1
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const baseIndex = process.argv.indexOf('--base')
  const base = baseIndex > -1 ? process.argv[baseIndex + 1] : undefined
  const probes = await probeAll({ base })
  const report = `### External sources (${base ? `via ${base}` : 'upstream'})\n\n${formatReport(probes)}\n`
  console.log(report)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report)
  for (const p of probes.filter(p => p.ok && p.freshness === 'stale')) console.warn(`warning: ${p.source} updated_at ${p.updatedAt} exceeds ${EXTERNAL_SOURCES[p.source].maxAgeHours}h`)
  process.exitCode = exitCode(probes)
}
