import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { EXTERNAL_SOURCES } from '../shared/externalSources.ts'
import { ISSUE_LABEL, ISSUE_TITLE, WORKFLOW_FILE, createGitHub, decideIssueAction, diagnose, renderReport, runHealthCheck } from './external-sources-issue.mjs'

const source = readFileSync(new URL(`../.github/workflows/${WORKFLOW_FILE}`, import.meta.url), 'utf8')
const workflow = parse(source)

const probe = (source, ok, extra = {}) => ({ source, url: 'u', ok, status: ok ? 200 : 502, elapsedMs: 10, updatedAt: null, records: null, freshness: 'unknown', ageHours: null, error: ok ? null : 'HTTP 502', ...extra })
const allOk = () => [probe('grok', true), probe('research', true)]

test('health workflow is scheduled, read-only and has no secrets or environment', () => {
  assert.deepEqual(Object.keys(workflow.on).sort(), ['schedule', 'workflow_dispatch'])
  assert.equal(workflow.on.schedule.length, 1)
  assert.deepEqual(workflow.permissions, { contents: 'read', actions: 'read', issues: 'write' })
  const job = workflow.jobs.probe
  assert.equal(job.environment, undefined)
  assert.ok(job['timeout-minutes'] <= 10)
  const code = source.replace(/^\s*#.*$/gm, '')
  assert.doesNotMatch(code, /secrets\.|vars\.|vercel|deploy|DATABASE_URL|DISPATCH_TOKEN/i)
  const run = job.steps.find(step => step.run?.includes('external-sources-issue.mjs'))
  assert.deepEqual(Object.keys(run.env), ['GH_TOKEN'])
  assert.equal(run.env.GH_TOKEN, '${{ github.token }}')
})

test('issue opens only after two failing runs and closes on recovery', () => {
  assert.equal(decideIssueAction({ failing: true, previousFailed: false, openIssue: null }), 'wait')
  assert.equal(decideIssueAction({ failing: true, previousFailed: true, openIssue: null }), 'open')
  assert.equal(decideIssueAction({ failing: true, previousFailed: false, openIssue: 7 }), 'comment')
  assert.equal(decideIssueAction({ failing: false, previousFailed: true, openIssue: 7 }), 'close')
  assert.equal(decideIssueAction({ failing: false, previousFailed: false, openIssue: null }), 'none')
})

test('diagnosis names the failing layer', () => {
  const lines = diagnose([probe('grok', false), probe('research', true)], [probe('grok', true), probe('research', false)])
  assert.match(lines[0], /Grok Bot 新闻：上游正常，经站点 rewrite 失败/)
  assert.match(lines[1], /共享研究：站点读取正常，直连上游失败/)
  const both = diagnose([probe('grok', false), probe('research', true)], [probe('grok', false), probe('research', true)])
  assert.deepEqual(both, [`- Grok Bot 新闻：站点与上游都失败，上游 \`${EXTERNAL_SOURCES.grok.upstream}\` 不可用。`])
  assert.deepEqual(diagnose(allOk(), allOk()), [])
})

test('report includes both probe tables and the run link', () => {
  const report = renderReport({ site: allOk(), upstream: allOk(), runUrl: 'https://github.com/o/r/actions/runs/1' })
  assert.match(report, /### 经站点 rewrite[\s\S]*### 直连上游/)
  assert.doesNotMatch(report, /### 判断/)
  assert.match(report, /运行记录：https:\/\/github\.com\/o\/r\/actions\/runs\/1/)
})

function fakeGitHub({ openIssue = null, previousFailed = false } = {}) {
  const calls = []
  return {
    calls,
    openIssue: () => { calls.push('list'); return openIssue },
    previousRunFailed: id => { calls.push(`previous:${id}`); return previousFailed },
    open: body => calls.push(['open', body]),
    comment: (n, body) => calls.push(['comment', n, body]),
    close: (n, body) => calls.push(['close', n, body]),
  }
}
const probeWith = (site, upstream) => async ({ base }) => base ? site : upstream
const quiet = () => {}

test('runHealthCheck probes both paths and syncs the issue', async () => {
  const down = [probe('grok', false), probe('research', true)]

  const first = fakeGitHub()
  assert.equal((await runHealthCheck({ github: first, probe: probeWith(down, down), currentRunId: '9', log: quiet })).action, 'wait')
  assert.deepEqual(first.calls, ['list', 'previous:9'])

  const second = fakeGitHub({ previousFailed: true })
  const opened = await runHealthCheck({ github: second, probe: probeWith(down, down), currentRunId: '10', log: quiet })
  assert.equal(opened.failing, true)
  assert.equal(second.calls[2][0], 'open')
  assert.match(second.calls[2][1], /^连续两次探测失败。/)

  const ongoing = fakeGitHub({ openIssue: 4 })
  await runHealthCheck({ github: ongoing, probe: probeWith(down, down), log: quiet })
  assert.deepEqual(ongoing.calls.map(c => Array.isArray(c) ? c.slice(0, 2) : c), ['list', ['comment', 4]])

  const recovered = fakeGitHub({ openIssue: 4 })
  const ok = await runHealthCheck({ github: recovered, probe: probeWith(allOk(), allOk()), runUrl: 'R', log: quiet })
  assert.equal(ok.failing, false)
  assert.deepEqual(recovered.calls[1], ['close', 4, '已恢复，自动关闭。\n\nR'])
})

test('only the site path decides failure; upstream-only errors are reported, not alerted', async () => {
  const upstreamDown = [probe('grok', true), probe('research', false)]
  const result = await runHealthCheck({ github: fakeGitHub(), probe: probeWith(allOk(), upstreamDown), log: quiet })
  assert.deepEqual([result.failing, result.action], [false, 'none'])
  assert.match(result.report, /共享研究：站点读取正常，直连上游失败/)
})

test('dry run never touches GitHub', async () => {
  const result = await runHealthCheck({ github: undefined, probe: probeWith([probe('grok', false), probe('research', true)], allOk()), dryRun: true, log: quiet })
  assert.deepEqual([result.failing, result.action], [true, 'wait'])
})

test('GitHub adapter passes fixed argument arrays and bodies through stdin', () => {
  const calls = []
  const run = (args, input) => {
    calls.push([args, input])
    if (args[0] === 'api') return JSON.stringify({ workflow_runs: [{ id: 9, conclusion: 'success' }, { id: 8, conclusion: 'failure' }] })
    if (args[1] === 'list') return JSON.stringify([{ number: 12 }])
    if (args[0] === 'label') throw new Error('already exists')
    return ''
  }
  const github = createGitHub('o/r', run)
  assert.equal(github.previousRunFailed('9'), true, 'skips the current run')
  assert.equal(github.openIssue(), 12)
  github.open('body `x`; rm -rf /')
  const create = calls.find(([args]) => args[0] === 'issue' && args[1] === 'create')
  assert.deepEqual(create[0], ['issue', 'create', '--repo', 'o/r', '--title', ISSUE_TITLE, '--label', ISSUE_LABEL, '--body-file', '-'])
  assert.equal(create[1], 'body `x`; rm -rf /')
  assert.match(calls[0][0][1], /actions\/workflows\/external-source-health\.yml\/runs\?status=completed/)
})
