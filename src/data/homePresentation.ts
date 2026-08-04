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

export const walletLabUrl = 'https://wallet-reliability-lab.vercel.app'
export const githubProfileUrl = 'https://github.com/qianqiu0404'
export const githubRepositoriesUrl = 'https://github.com/qianqiu0404?tab=repositories'
export const homeSeo = {
  title: 'xiuqiu｜Web3 钱包后端与多链基础设施工程',
  description:
    '专注交易所钱包充值、提现、资金状态、多链交易、签名安全与异常恢复，通过可运行项目、源码、测试和工程证据展示 Web3 钱包后端能力。',
} as const

export const flagshipProjectSlug = 'exchange-wallet-system'
export const representativeProjectSlugs = [
  flagshipProjectSlug,
  'wallet-launchpad',
  's78-market-services',
  'wallet-reliability-lab',
] as const

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
