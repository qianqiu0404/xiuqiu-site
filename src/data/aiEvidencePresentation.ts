import { deliveryRecords, type DeliveryRecord } from './generatedDeliveries.ts'
import { evidenceRecords, type EvidenceRecord } from './generatedEvidence.ts'

export type AiEvidenceLevel =
  | 'public-verified'
  | 'operational-partial'
  | 'private-verified'
  | 'integration-only'
  | 'in-progress'

export interface AiPublicDelivery {
  delivery: DeliveryRecord
  evidence: EvidenceRecord
}

export interface AiReviewCase {
  label: string
  delivery: DeliveryRecord
  finding: string
  correction: string
  evidence: EvidenceRecord
}

export interface AiSystemSurface {
  id: 'skillops' | 'tool-integration' | 'pro-20x'
  eyebrow: string
  title: string
  evidenceLevel: AiEvidenceLevel
  statusLabel: string
  summary: string
  facts: readonly string[]
  boundary: string
}

const deliveryBySlug = new Map(deliveryRecords.map(item => [item.slug, item]))
const evidenceBySlug = new Map(evidenceRecords.map(item => [item.slug, item]))

function requireDelivery(slug: string) {
  const delivery = deliveryBySlug.get(slug)
  if (!delivery) throw new Error(`Missing AI presentation delivery: ${slug}`)
  return delivery
}

function requireEvidence(slug: string) {
  const evidence = evidenceBySlug.get(slug)
  if (!evidence) throw new Error(`Missing AI presentation evidence: ${slug}`)
  return evidence
}

export const executionKernel = [
  { step: '01', title: 'Define', description: '冻结目标、公开范围与完成标准。' },
  { step: '02', title: 'Execute', description: '让 AI 加速检索、实现与机械性工作。' },
  { step: '03', title: 'Review', description: '检查差异、来源、风险与越界行为。' },
  { step: '04', title: 'Verify', description: '用测试和运行证据决定交付状态。' },
] as const

const publicDeliverySelection = [
  ['wallet-core-public-v1', 'wallet-core-tests'],
  ['wallet-domain-engine-v1', 'wallet-engine-invariants'],
  ['wallet-failure-playbook-pr2', 'failure-playbook-public'],
  ['wallet-reliability-lab-v1', 'wallet-lab-tests'],
] as const

export const aiPublicDeliveries: AiPublicDelivery[] = publicDeliverySelection.map(
  ([deliverySlug, evidenceSlug]) => ({
    delivery: requireDelivery(deliverySlug),
    evidence: requireEvidence(evidenceSlug),
  }),
)

const reviewSelection = [
  {
    label: 'Encoding contract',
    deliverySlug: 'wallet-core-public-v1',
    evidenceSlug: 'wallet-core-tests',
    findingIndex: 0,
    correctionIndex: 0,
  },
  {
    label: 'Runtime truth',
    deliverySlug: 'wallet-reliability-lab-v1',
    evidenceSlug: 'wallet-lab-tests',
    findingIndex: 0,
    correctionIndex: 0,
  },
  {
    label: 'Verification gate',
    deliverySlug: 'wallet-domain-engine-v1',
    evidenceSlug: 'wallet-engine-invariants',
    findingIndex: 2,
    correctionIndex: 2,
  },
] as const

export const aiReviewCases: AiReviewCase[] = reviewSelection.map(selection => {
  const delivery = requireDelivery(selection.deliverySlug)
  const finding = delivery.reviewFindings[selection.findingIndex]
  const correction = delivery.corrections[selection.correctionIndex]
  if (!finding || !correction) {
    throw new Error(`Incomplete review trace: ${selection.deliverySlug}`)
  }

  return {
    label: selection.label,
    delivery,
    finding,
    correction,
    evidence: requireEvidence(selection.evidenceSlug),
  }
})

export const aiAutomationRun = {
  date: '2026-08-05',
  evidenceLevel: 'operational-partial' as const,
  statusLabel: 'OPERATIONAL / PARTIAL',
  title: 'ResearchOps → Radar 发布闭环',
  summary: '四路公开研究采集、PR 合并、CI 与生产页验证完成；微信发送没有确认送达，因此整次运行保持 partial。',
  stages: [
    { label: 'Collect', value: '4 / 4', detail: 'Crypto 4 · AI/Web3 2 · Vibe 10 · Reading 1 个来源' },
    { label: 'Publish', value: 'PR #49', detail: '唯一同日 PR · squash merged' },
    { label: 'Verify', value: 'CI PASS', detail: 'Daily Radar Gate and Merge · Site CI' },
    { label: 'Production', value: 'HTTP 200', detail: '2026-08-05 雷达页面已验证' },
    { label: 'Notify', value: 'FAILED', detail: '微信两次尝试均无可确认送达结果' },
  ],
  failureStage: 'weixin.send',
  pullRequestUrl: 'https://github.com/qianqiu0404/xiuqiu-site/pull/49',
  productionUrl: 'https://xiuqiu-site.vercel.app/radar/2026-08-05',
  boundary: '发布成功不等于通知成功。页面 HTTP 200、PR 合并和消息送达分别验收。',
} as const

export const aiSystemSurfaces: AiSystemSurface[] = [
  {
    id: 'skillops',
    eyebrow: 'Private SkillOps',
    title: '可同步、可审查的私有协作控制面',
    evidenceLevel: 'private-verified',
    statusLabel: 'PRIVATE / VERIFIED',
    summary: '共享规则、Skill 与 agent overlay 在私有仓库中统一治理，并通过 Git 保存可回溯变更。',
    facts: [
      '共享层与 agent 专属 overlay 分离',
      '不保存凭据、认证状态或完整对话',
      'Agent Accord 当前默认关闭',
    ],
    boundary: '私有 Git 同步只证明治理结构存在，不证明每个第三方 Skill 或依赖都持续可用；外部组件保留各自归属。',
  },
  {
    id: 'tool-integration',
    eyebrow: 'Tools / MCP boundary',
    title: '受限工具连接，而不是自建 MCP 平台',
    evidenceLevel: 'integration-only',
    statusLabel: 'INTEGRATION ONLY',
    summary: '按任务连接浏览器、GitHub、Vercel 与本地工程工具，并把可写范围、授权与验收条件放在执行前。',
    facts: [
      '最小权限与明确写入范围',
      '工具结果继续接受人工复核',
      '外部连接器与平台能力不归我所有',
    ],
    boundary: '这里展示的是工具集成和边界设计，不宣称已实现通用 MCP Server、托管平台或连接器基础设施。',
  },
  {
    id: 'pro-20x',
    eyebrow: 'Pro 20X',
    title: '30 天价值负责制实验',
    evidenceLevel: 'in-progress',
    statusLabel: 'EXPERIMENT / IN PROGRESS',
    summary: '以工程交付与资产化、个人效率和商业验证组织目标，把行动、证据与复盘放在同一套节奏里。',
    facts: [
      '先定义可验证结果，再安排每日动作',
      '区分交付价值、学习价值与商业验证',
      '按证据复盘，不用计划数字替代结果',
    ],
    boundary: '当前只展示执行框架与进行中实验，不把规划目标计作已经实现的项目收益。',
  },
]

export const humanBoundaries = [
  'AI 产出是候选，不自动升级为完成状态。',
  '资金、安全、权限和公开范围由人决定。',
  '本地通过、集成验证与生产验收保持不同标签。',
  '外部模型、工具、Skill 与平台能力保留各自归属。',
] as const
