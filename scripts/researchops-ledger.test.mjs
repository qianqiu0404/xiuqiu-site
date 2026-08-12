import assert from 'node:assert/strict'
import test from 'node:test'
import { renderResearchSource, validateResearchOpsLedger } from './prepare-researchops-source.mjs'

const source = (url, publishedAt = '2026-08-09T01:00:00Z') => ({
  tier: 'tier1', role: 'event', kind: 'official_release', name: `Official ${url}`, url, publishedAt,
})
const brief = (id, domain, topic, url) => ({
  id, domain, topic, title: `${id} 机制研究主题`,
  whatHappened: '官方公开了一项可以核验的变化，并说明了它影响的系统边界。',
  mechanism: '系统通过显式接口、状态检查和失败关闭机制，把输入转成可验证结果。',
  workedExample: '示例先构造一个具体输入，再观察状态变化、失败路径和最终输出是否一致。',
  whyItMatters: '这个机制能连接学习目标、工程实践和风险判断，不只是复述一个版本名称。',
  risksAndLimits: ['该结果来自特定环境，不能直接外推到所有系统。'],
  sources: [source(url)],
  nextQuestions: ['下一步应如何建立可重复验证与长期跟踪？'],
})
const deepDive = (parent) => ({
  ...brief('deep-topic', parent.domain, parent.topic, 'https://example.org/deep-event'),
  basedOnBriefId: parent.id,
  sources: [
    source('https://example.org/deep-event'),
    { tier: 'tier1', role: 'mechanism', kind: 'official_docs', name: 'Official mechanism docs', url: 'https://example.org/deep-docs' },
  ],
})

const briefs = [
  brief('ai-agent', 'ai', 'agent', 'https://example.org/ai-agent'),
  brief('ai-eval', 'ai', 'evaluation', 'https://example.org/ai-eval'),
  brief('web3-wallet', 'web3', 'wallet_cex', 'https://example.org/web3-wallet'),
  brief('web3-protocol', 'web3', 'protocol', 'https://example.org/web3-protocol'),
]
const base = {
  version: 2, date: '2026-08-10', timezone: 'Asia/Shanghai', runKey: 'learning-radar/2026-08-10',
  editionMode: 'daily', researchedAt: '2026-08-10T07:20:00+08:00', briefs, deepDive: deepDive(briefs[0]),
}

test('accepts one idempotent v2 ledger with 2 AI, 2 Web3 and one deep dive', () => {
  const result = validateResearchOpsLedger(base, [])
  assert.deepEqual(result.counts, { ai: 2, web3: 2, deepDive: 1 })
  assert.match(renderResearchSource(base), /<!-- ai:start -->[\s\S]*<!-- web3:start -->[\s\S]*<!-- deepDive:start -->/)
})

test('stops duplicate history, wrong domain mix and repeated topics', () => {
  assert.throws(() => validateResearchOpsLedger(base, [{ date: '2026-08-01', urls: ['https://example.org/ai-agent'], titles: [] }]), /previous 30 days/)
  assert.throws(() => validateResearchOpsLedger({ ...base, briefs: briefs.map((item, index) => index === 2 ? { ...item, domain: 'ai', topic: 'safety' } : item) }, []), /exactly 2/)
  assert.throws(() => validateResearchOpsLedger({ ...base, briefs: briefs.map((item, index) => index === 1 ? { ...item, topic: 'agent' } : item) }, []), /different topics/)
})

test('ResearchOps v2 schedule is fixed in policy', async () => {
  const policy = (await import('../config/researchops-learning-radar.json', { with: { type: 'json' } })).default
  assert.deepEqual(policy.schedule, { start: '05:30', editorialCutoff: '07:20', gateCutoff: '07:35', immutableSnapshot: '07:45' })
  assert.equal(policy.timezone, 'Asia/Shanghai')
})
