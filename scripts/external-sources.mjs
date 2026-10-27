// Health probe and build-time fallback snapshots for the two external feeds
// that vercel.json rewrites (/grok-news-data, /research-data).
//
//   node scripts/external-sources.mjs                 probe the upstream origins
//   node scripts/external-sources.mjs --base <origin> probe through the site rewrites
//   node scripts/external-sources.mjs --source chatgpt probe the opt-in recommendation source
//
// Exit 1 when a source is unreachable or invalid. A stale source is a warning:
// upstream may legitimately pause, and the page already says so.

import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { EXTERNAL_SOURCES, probeAllExternalSources } from '../shared/externalSources.ts'
import { parseGrokIndex, parseNewsIndex } from '../shared/grokNews.ts'
import { parseResearchIndex } from '../src/data/sharedResearch.ts'

export const PARSERS = { grok: parseGrokIndex, research: parseResearchIndex, chatgpt: value => parseNewsIndex(value, 'chatgpt') }

export function readProbeOptions(args) {
  const options = {}, selected = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base') {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('--base 需要站点地址')
      options.base = args[++i]
    } else if (args[i] === '--source') {
      const source = args[++i]
      if (!Object.hasOwn(EXTERNAL_SOURCES, source)) throw new Error(`未知资料源：${source || '(未填写)'}`)
      if (!selected.includes(source)) selected.push(source)
    } else throw new Error(`未知参数：${args[i]}`)
  }
  return { ...options, ...(selected.length ? { sources: selected } : {}) }
}

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
  const options = readProbeOptions(process.argv.slice(2))
  const { base } = options
  const probes = await probeAll(options)
  const report = `### External sources (${base ? `via ${base}` : 'upstream'})\n\n${formatReport(probes)}\n`
  console.log(report)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report)
  for (const p of probes.filter(p => p.ok && p.freshness === 'stale')) console.warn(`warning: ${p.source} updated_at ${p.updatedAt} exceeds ${EXTERNAL_SOURCES[p.source].maxAgeHours}h`)
  process.exitCode = exitCode(probes)
}
