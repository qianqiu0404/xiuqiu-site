// Scheduled health check for the two rewritten external feeds. Probes through
// the site rewrites and the upstream origins, writes the job summary, and keeps
// one tracking issue in sync. Read-only towards the site: no deploy, database,
// notification or secret.
//
//   node scripts/external-sources-issue.mjs            probe and sync the issue (CI)
//   node scripts/external-sources-issue.mjs --dry-run  probe and print the decision
//
// An issue opens only after two failing runs in a row, so one transient timeout
// does not page anyone. The previous run's conclusion is the only state needed:
// this job fails whenever a probe through the site rewrites fails.

import { appendFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { DEFAULT_EXTERNAL_SOURCES, EXTERNAL_SOURCES } from '../shared/externalSources.ts'
import { exitCode, formatReport, probeAll } from './external-sources.mjs'

export const ISSUE_LABEL = 'external-source-health'
export const ISSUE_TITLE = '外部数据源不可用'
export const WORKFLOW_FILE = 'external-source-health.yml'
export const SITE_BASE = 'https://xiuqiu-site.vercel.app'

/** Pure: what to do with the tracking issue for this run. */
export function decideIssueAction({ failing, previousFailed, openIssue }) {
  if (failing) {
    if (openIssue) return 'comment'
    return previousFailed ? 'open' : 'wait'
  }
  return openIssue ? 'close' : 'none'
}

/** Names the failing layer so the issue says where to look first. */
export function diagnose(site, upstream) {
  const sources = new Set([...DEFAULT_EXTERNAL_SOURCES, ...site.map(p => p.source), ...upstream.map(p => p.source)])
  return [...sources].map(id => {
    const s = site.find(p => p.source === id), u = upstream.find(p => p.source === id)
    const label = EXTERNAL_SOURCES[id].label
    if (s?.ok && u?.ok) return null
    if (!s?.ok && u?.ok) return `- ${label}：上游正常，经站点 rewrite 失败，先查 \`vercel.json\` 与 Vercel 部署。`
    if (s?.ok && !u?.ok) return `- ${label}：站点读取正常，直连上游失败，可能是 runner 网络波动。`
    return `- ${label}：站点与上游都失败，上游 \`${EXTERNAL_SOURCES[id].upstream}\` 不可用。`
  }).filter(Boolean)
}

export function renderReport({ site, upstream, runUrl }) {
  const lines = diagnose(site, upstream)
  return [
    '### 经站点 rewrite', '', formatReport(site), '',
    '### 直连上游', '', formatReport(upstream), '',
    ...(lines.length ? ['### 判断', '', ...lines, ''] : []),
    ...(runUrl ? [`运行记录：${runUrl}`, ''] : []),
    '页面会先改读构建期快照，快照也不可用时才显示错误；这条 issue 只用于跟踪，恢复后自动关闭。',
  ].join('\n')
}

function gh(args, input) {
  return execFileSync('gh', args, { encoding: 'utf8', input, stdio: [input == null ? 'ignore' : 'pipe', 'pipe', 'inherit'] }).trim()
}

export function createGitHub(repo, run = gh) {
  return {
    previousRunFailed(currentRunId) {
      const runs = JSON.parse(run(['api', `repos/${repo}/actions/workflows/${WORKFLOW_FILE}/runs?status=completed&per_page=5`]))
      const previous = runs.workflow_runs.find(r => String(r.id) !== String(currentRunId))
      return previous?.conclusion === 'failure'
    },
    openIssue() {
      const issues = JSON.parse(run(['issue', 'list', '--repo', repo, '--label', ISSUE_LABEL, '--state', 'open', '--json', 'number', '--limit', '1']))
      return issues[0]?.number ?? null
    },
    open(body) {
      try { run(['label', 'create', ISSUE_LABEL, '--repo', repo, '--color', 'B60205', '--description', '外部 rewrite 数据源健康检查']) } catch { /* already exists */ }
      run(['issue', 'create', '--repo', repo, '--title', ISSUE_TITLE, '--label', ISSUE_LABEL, '--body-file', '-'], body)
    },
    comment(number, body) {
      run(['issue', 'comment', String(number), '--repo', repo, '--body-file', '-'], body)
    },
    close(number, body) {
      run(['issue', 'close', String(number), '--repo', repo, '--comment', body])
    },
  }
}

export async function runHealthCheck({ github, probe = probeAll, currentRunId, runUrl, dryRun = false, log = console.log }) {
  const [site, upstream] = await Promise.all([probe({ base: SITE_BASE }), probe({})])
  // Readers go through the rewrites, so only that path decides failure. The
  // direct upstream probe only says which layer broke.
  const failing = exitCode(site) !== 0
  const report = renderReport({ site, upstream, runUrl })
  const openIssue = dryRun ? null : github.openIssue()
  const previousFailed = failing && !openIssue && !dryRun ? github.previousRunFailed(currentRunId) : false
  const action = decideIssueAction({ failing, previousFailed, openIssue })
  log(`${report}\n\n结论：${failing ? '失败' : '正常'} · 动作：${action}`)
  if (!dryRun) {
    if (action === 'open') github.open(`连续两次探测失败。\n\n${report}`)
    if (action === 'comment') github.comment(openIssue, `仍然失败。\n\n${report}`)
    if (action === 'close') github.close(openIssue, `已恢复，自动关闭。${runUrl ? `\n\n${runUrl}` : ''}`)
  }
  return { failing, action, report }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dryRun = process.argv.includes('--dry-run')
  const repo = process.env.GITHUB_REPOSITORY
  if (!dryRun && !repo) throw new Error('GITHUB_REPOSITORY is required outside --dry-run')
  const runUrl = repo && process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : undefined
  const result = await runHealthCheck({ github: repo ? createGitHub(repo) : undefined, currentRunId: process.env.GITHUB_RUN_ID, runUrl, dryRun })
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## External source health · ${result.action}\n\n${result.report}\n`)
  process.exitCode = result.failing ? 1 : 0
}
