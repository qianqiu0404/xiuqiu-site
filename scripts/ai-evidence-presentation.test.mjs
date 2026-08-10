import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  aiAutomationRun,
  aiPublicDeliveries,
  aiReviewCases,
  aiSystemSurfaces,
  executionKernel,
} from '../src/data/aiEvidencePresentation.ts'

const pageSource = readFileSync(new URL('../src/pages/AiCollaborationPage.vue', import.meta.url), 'utf8')
const styleSource = readFileSync(new URL('../src/styles/ai-evidence-os.css', import.meta.url), 'utf8')
const researchCaseSource = readFileSync(new URL('../content/ai-cases/research-automation-workflows.md', import.meta.url), 'utf8')

test('AI public ledger is backed by published deliveries and verified public evidence', () => {
  assert.deepEqual(aiPublicDeliveries.map(item => item.delivery.slug), [
    'wallet-core-public-v1',
    'wallet-domain-engine-v1',
    'wallet-failure-playbook-pr2',
    'wallet-reliability-lab-v1',
  ])

  aiPublicDeliveries.forEach(({ delivery, evidence }) => {
    assert.equal(delivery.publish, true)
    assert.equal(delivery.status, 'delivered')
    assert.equal(evidence.status, 'verified')
    assert.equal(evidence.visibility, 'public')
    assert.ok(delivery.evidenceSlugs.includes(evidence.slug))
    assert.match(evidence.url || '', /^https:\/\//)
  })
})

test('Review Before Claim keeps concrete finding, correction and test evidence together', () => {
  assert.equal(aiReviewCases.length, 3)
  aiReviewCases.forEach(item => {
    assert.ok(item.finding.length > 10)
    assert.ok(item.correction.length > 10)
    assert.equal(item.evidence.kind, 'test')
    assert.equal(item.evidence.status, 'verified')
    assert.ok(item.delivery.reviewFindings.includes(item.finding))
    assert.ok(item.delivery.corrections.includes(item.correction))
  })
})

test('2026-08-05 automation remains partial when notification delivery is unconfirmed', () => {
  assert.equal(aiAutomationRun.date, '2026-08-05')
  assert.equal(aiAutomationRun.evidenceLevel, 'operational-partial')
  assert.equal(aiAutomationRun.failureStage, 'weixin.send')
  assert.deepEqual(aiAutomationRun.stages.map(stage => stage.value), [
    '4 / 4',
    'PR #49',
    'CI PASS',
    'HTTP 200',
    'FAILED',
  ])
  assert.match(aiAutomationRun.boundary, /发布成功不等于通知成功/)
  assert.match(researchCaseSource, /"updatedAt": "2026-08-10"/)
  assert.match(researchCaseSource, /整次运行保持 partial/)
  assert.match(researchCaseSource, /weixin\.send/)
})

test('private and experimental system surfaces state their public boundaries', () => {
  assert.deepEqual(aiSystemSurfaces.map(item => item.evidenceLevel), [
    'private-verified',
    'integration-only',
    'in-progress',
  ])

  const skillOps = aiSystemSurfaces.find(item => item.id === 'skillops')
  const tools = aiSystemSurfaces.find(item => item.id === 'tool-integration')
  const pro20x = aiSystemSurfaces.find(item => item.id === 'pro-20x')
  assert.ok(skillOps)
  assert.ok(tools)
  assert.ok(pro20x)
  assert.match(skillOps.facts.join(' '), /Agent Accord 当前默认关闭/)
  assert.match(tools.statusLabel, /INTEGRATION ONLY/)
  assert.match(tools.boundary, /不宣称已实现通用 MCP Server/)
  assert.doesNotMatch(`${pro20x.summary} ${pro20x.facts.join(' ')} ${pro20x.boundary}`, /240U|已实现收益/)
  assert.match(pro20x.boundary, /不把规划目标计作已经实现/)
})

test('AI evidence page preserves the human gate and responsive contracts', () => {
  assert.equal(executionKernel.length, 4)
  assert.match(pageSource, /Public Delivery Ledger/)
  assert.match(pageSource, /Review Before Claim/)
  assert.match(pageSource, /Operational Automation/)
  assert.match(pageSource, /Private Control Plane/)
  assert.ok(aiSystemSurfaces.some(item => item.eyebrow === 'Private SkillOps'))
  assert.match(pageSource, /:data-level="item\.evidenceLevel"/)
  assert.match(pageSource, /Human Boundary/)
  assert.match(pageSource, /target="_blank"/)
  assert.match(pageSource, /rel="noopener"/)
  assert.match(styleSource, /@media \(max-width: 768px\)/)
  assert.match(styleSource, /@media \(max-width: 480px\)/)
  assert.match(styleSource, /overflow: clip/)
  assert.match(styleSource, /min-width: 0/)
})
