export interface HomeCapability {
  id: string
  title: string
  description: string
  tags: string[]
}

export interface HomeServiceStep {
  name: string
  description: string
}

export interface HomeProductGroup {
  id: 'wallet-platform' | 'market-server'
  label: string
  title: string
  description: string
  projectSlugs: readonly string[]
}

export type HomeDestination =
  | { kind: 'internal'; to: string }
  | { kind: 'external'; href: string }

export interface HomeProofMethod {
  id: string
  title: string
  description: string
  linkLabel: string
  destination: HomeDestination
}

export interface HomeEvidenceHighlight {
  evidenceSlug: string
  label: string
  linkLabel: string
  destination: HomeDestination
}

export type HomeStoryId = 'wallet' | 'market' | 'ai'
export type HomeAiProofStatus = 'scoped' | 'implemented' | 'reviewed' | 'verified' | 'human-gate' | 'pending'

export interface HomeAiProofStep {
  label: string
  detail: string
  status: HomeAiProofStatus
}

export interface HomeAiProofContext {
  id: HomeStoryId
  label: string
  title: string
  summary: string
  steps: readonly HomeAiProofStep[]
  boundary: string
  evidence: {
    label: string
    destination: HomeDestination
  }
  assistantPrompt: string
}

export const walletLabUrl = 'https://wallet-reliability-lab.vercel.app'
export const githubProfileUrl = 'https://github.com/qianqiu0404'
export const githubRepositoriesUrl = 'https://github.com/qianqiu0404?tab=repositories'
export const homeSeo = {
  title: 'xiuqiu｜Web3 Systems × AI Engineering',
  description:
    '构建 Wallet Platform、可信 Market Server 与 AI-native Engineering 工作流，用可运行项目、代码审查、测试和工程证据展示 Web3 系统能力。',
} as const

export const flagshipProjectSlug = 'exchange-wallet-system'
export const homeProductGroups: readonly HomeProductGroup[] = [
  {
    id: 'wallet-platform',
    label: 'Product Line 01',
    title: 'Wallet Platform',
    description: '从多链资金底座、控制平面到公开可靠性实验，形成一条可以运行、验证和继续扩展的钱包产品线。',
    projectSlugs: [flagshipProjectSlug, 'wallet-launchpad', 'wallet-reliability-lab'],
  },
  {
    id: 'market-server',
    label: 'Product Line 02',
    title: 'Market Server',
    description: '把行情来源、降级状态、虚拟交易、账本与恢复收敛成一个可信市场事实服务。',
    projectSlugs: ['s78-market-services'],
  },
] as const
export const representativeProjectSlugs = homeProductGroups.flatMap(group => group.projectSlugs)

export const homeCapabilities: HomeCapability[] = [
  {
    id: 'fund-state',
    title: '资金状态与一致性',
    description:
      '梳理充值、提现、账务和通知之间的状态流转，减少重复处理、状态错乱和局部失败带来的资金风险。',
    tags: ['状态机', '幂等', '数据库事务', '确认数', '链重组', '失败补偿', '异步 Worker'],
  },
  {
    id: 'multi-chain',
    title: '多链接入与交易构建',
    description:
      '根据不同链的账户与资源模型，组织地址、余额、手续费、交易构建、签名和广播流程。',
    tags: ['EVM nonce', 'Bitcoin UTXO', 'Solana blockhash / ATA', 'Cosmos sequence', 'Chain Adaptor', 'RPC 节点'],
  },
  {
    id: 'signing-security',
    title: '签名与密钥安全',
    description:
      '将业务逻辑与私钥能力隔离，在交易进入签名边界前完成内容校验，并为 Local Signer、TSS/MPC 和 HSM 保留清晰演进路径。',
    tags: ['独立签名服务', '私钥隔离', '离线交易校验', 'TSS/MPC', 'HSM 演进', '权限边界'],
  },
  {
    id: 'recovery',
    title: '异常恢复与资金安全',
    description:
      '处理广播超时、交易结果未知、链上成功但本地失败、服务重启和重复任务等异常情况。',
    tags: ['查询优先', '广播幂等', 'request_id', 'nonce 修复', '重试', '人工介入', '对账恢复'],
  },
]

export const homeServiceFlow: HomeServiceStep[] = [
  {
    name: 'wallet-service',
    description: '维护提现请求、资金状态和业务编排，保证任务可以在失败或重启后继续推进。',
  },
  {
    name: 'risk-service',
    description: '校验提现内容、审批凭证、幂等状态和风险放行条件。',
  },
  {
    name: 'wallet-api',
    description: '读取链上资源、构建并广播交易，再查询链上最终结果。',
  },
  {
    name: 'wallet-sign',
    description: '在独立信任边界内生成地址和完成签名，避免私钥能力进入普通业务服务。',
  },
]

export const homeProofMethods: HomeProofMethod[] = [
  {
    id: 'runnable-lab',
    title: '可运行实验',
    description: '通过 Wallet Reliability Lab 展示钱包状态、失败场景和恢复过程。',
    linkLabel: '运行实验',
    destination: { kind: 'external', href: walletLabUrl },
  },
  {
    id: 'source-entry',
    title: '源码与代码入口',
    description: '使用公开仓库或明确的代码入口说明实现位置和系统边界。',
    linkLabel: '查看证据',
    destination: { kind: 'internal', to: '/engineering/evidence' },
  },
  {
    id: 'automated-tests',
    title: '自动化测试',
    description: '使用单元测试、集成测试和验证命令证明关键逻辑能够运行。',
    linkLabel: '查看测试',
    destination: { kind: 'internal', to: '/engineering/evidence' },
  },
  {
    id: 'failure-reproduction',
    title: '失败场景复现',
    description: '主动验证广播超时、重复任务和链上成功但本地失败，而不只展示正常流程。',
    linkLabel: '查看异常手册',
    destination: { kind: 'internal', to: '/engineering/failures' },
  },
  {
    id: 'known-limits',
    title: '已知限制',
    description: '明确哪些能力已经验证，哪些仍处于研究、集成或生产化设计阶段。',
    linkLabel: '查看项目边界',
    destination: { kind: 'internal', to: '/projects' },
  },
]

export const homeEvidenceHighlights: HomeEvidenceHighlight[] = [
  {
    evidenceSlug: 'wallet-launchpad-no-funds-acceptance',
    label: '多链无资金验收门',
    linkLabel: '查看最新验收证据',
    destination: { kind: 'internal', to: '/engineering/evidence' },
  },
  {
    evidenceSlug: 'failure-playbook-public',
    label: 'Failure Playbook',
    linkLabel: '查看异常手册',
    destination: { kind: 'internal', to: '/engineering/failures' },
  },
  {
    evidenceSlug: 'wallet-lab-demo',
    label: '公开可靠性实验',
    linkLabel: '运行在线实验',
    destination: { kind: 'external', href: walletLabUrl },
  },
]

export const aiEngineeringOutcomes = [
  '需求拆解',
  '实现计划',
  '代码审查',
  '测试补充',
  '文档同步',
  '知识治理',
  '失败复盘',
  '跨设备工作流',
]

export const homeAiWorkflow = [
  'Context',
  'Plan',
  'Execute',
  'Review',
  'Test',
  'Document',
  'Remember',
] as const

export const homeAiProofContexts: readonly HomeAiProofContext[] = [
  {
    id: 'wallet',
    label: 'Current frame · Wallet Platform',
    title: '让 AI 参与实现，让资金事实决定交付。',
    summary: '公开交付记录保留 AI 参与、审查发现、纠正动作与人工决定，而不是用生成代码量替代工程证据。',
    steps: [
      { label: 'Scope', detail: '冻结状态机、签名边界与公开模拟范围', status: 'scoped' },
      { label: 'Build', detail: '实现 Runner、SSE、响应式工作台与验证候选', status: 'implemented' },
      { label: 'Review', detail: '发现并修复重复启动、订阅取消和地址暴露风险', status: 'reviewed' },
      { label: 'Verify', detail: '构建、race、重连和公开安全门禁通过', status: 'verified' },
      { label: 'Human decision', detail: '公开版保持 simulation，不包装成生产钱包', status: 'human-gate' },
    ],
    boundary: '当前证据来自 Wallet Reliability Lab 公开交付；Launchpad 的多链注资 E2E 与生产签名集群仍需单独验收。',
    evidence: {
      label: '查看 Wallet AI 交付',
      destination: { kind: 'internal', to: '/ai/deliveries/wallet-reliability-lab-v1' },
    },
    assistantPrompt: 'AI 在 Wallet Platform 的工程交付中做了什么，人做了哪些决定？',
  },
  {
    id: 'market',
    label: 'Current frame · Market Server',
    title: '先把市场事实做可信，再公开 AI 交付。',
    summary: 'Market Server 已有本地构建、测试和 release artifact；当前没有单独发布的 AI delivery，因此右轨只展示可复核项目证据。',
    steps: [
      { label: 'Scope', detail: '统一来源、新鲜度、降级状态与虚拟交易边界', status: 'scoped' },
      { label: 'Build', detail: '聚合 CEX、Perp、AMM 与只读 gRPC 能力', status: 'implemented' },
      { label: 'Review', detail: '区分来源事实、缓存状态与服务降级', status: 'reviewed' },
      { label: 'Verify', detail: 'go test、构建与 release artifact 本地验证', status: 'verified' },
      { label: 'AI delivery', detail: '尚未形成独立公开交付记录', status: 'pending' },
    ],
    boundary: '使用虚拟资金与本地验证；Doris 真实联调、长期运行和生产流量尚未作为公开完成证据。',
    evidence: {
      label: '查看 Market 验证证据',
      destination: { kind: 'internal', to: '/engineering/evidence' },
    },
    assistantPrompt: 'Market Server 当前已经验证什么，AI 交付证据还缺什么？',
  },
  {
    id: 'ai',
    label: 'Current frame · AI Engineering System',
    title: 'AI 不替我判断，它让判断更快进入验证。',
    summary: 'Planner、Worker、Reviewer 与人工验收拆开计划、执行和审查；代码差异、测试结果和已知限制共同决定是否交付。',
    steps: [
      { label: 'Context', detail: '定义目标、风险、允许修改范围与不做什么', status: 'scoped' },
      { label: 'Execute', detail: '按计划实现并保留可审查的代码差异', status: 'implemented' },
      { label: 'Review', detail: '寻找错误、遗漏、越权和证据不足', status: 'reviewed' },
      { label: 'Test', detail: '构建、类型、链接、安全和场景门禁', status: 'verified' },
      { label: 'Accept', detail: '由我决定接受、修正、暂停或拒绝', status: 'human-gate' },
    ],
    boundary: '模型审查不能替代安全判断；私人内容、密钥、账户与未核验结论不进入公开知识图谱。',
    evidence: {
      label: '查看全部 AI 真实交付',
      destination: { kind: 'internal', to: '/ai/deliveries' },
    },
    assistantPrompt: '用真实交付证据解释 xiuqiu 的 AI Engineering 工作流。',
  },
] as const
