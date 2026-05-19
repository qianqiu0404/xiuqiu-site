export interface Project {
  id: number
  name: string
  positioning: string
  coreAbilities: string[]
  talkingPoints: string[]
  techStack: string[]
  github: string
}

export const projects: Project[] = [
  {
    id: 1,
    name: 'wallet-api',
    positioning:
      '多链钱包后端 API 服务，负责组织地址生成、余额查询、交易构建、链配置管理和签名服务调用。',
    coreAbilities: [
      '多链钱包 API 设计',
      'HTTP 服务入口',
      'gRPC 内部服务调用',
      '链节点 RPC 接入',
      '钱包 API 层与签名层解耦',
    ],
    talkingPoints: [
      '为什么 wallet-api 不直接处理私钥',
      'API 层和签名机如何划分边界',
      '多链配置如何抽象',
      'HTTP、gRPC 和链 RPC 在钱包系统中的不同角色',
    ],
    techStack: ['Go', 'HTTP', 'gRPC', 'PostgreSQL', 'Redis', 'Web3 RPC'],
    github: 'https://github.com/qianqiu0404/exchange-wallet-api',
  },
  {
    id: 2,
    name: 'wallet-sign',
    positioning:
      '多链离线签名服务，负责 BTC、ETH、Solana、Cosmos 等链的交易签名能力，是钱包系统中安全边界更高的一层。',
    coreAbilities: [
      '私钥管理边界',
      '离线签名流程',
      '批量签名策略',
      '多链签名差异',
      '签名服务独立部署思路',
    ],
    talkingPoints: [
      '为什么签名机要独立',
      'BTC UTXO 和 ETH 账户模型的签名差异',
      '如何设计批量签名',
      '如何降低私钥暴露风险',
      '签名服务如何与 wallet-api 协作',
    ],
    techStack: ['Go', 'TypeScript', 'BTC', 'ETH', 'Solana', 'Cosmos'],
    github: 'https://github.com/qianqiu0404/exchange-wallet-sign',
  },
  {
    id: 3,
    name: 'market-services',
    positioning:
      '交易所行情服务项目，负责聚合、缓存、计算和展示交易所行情数据，用于沉淀 Go 后端服务设计能力。',
    coreAbilities: [
      'HTTP 服务启动',
      'gRPC 服务启动',
      'Redis 行情缓存',
      'PostgreSQL 数据持久化',
      'Dashboard API 数据组装',
      '行情数据同步链路',
    ],
    talkingPoints: [
      '为什么行情服务需要 Redis 缓存',
      'Redis 和 PostgreSQL 如何分工',
      'HTTP 服务和 gRPC 服务如何共存',
      'Dashboard API 如何组装数据',
      '行情同步服务如何拆分职责',
    ],
    techStack: ['Go', 'HTTP', 'gRPC', 'Redis', 'PostgreSQL', 'GORM', 'Vite'],
    github: 'https://github.com/qianqiu0404/s78-market-services',
  },
  {
    id: 4,
    name: 'prediction-market',
    positioning:
      'Web3 预测市场 MVP：从 mock 原型到链上闭环，实践合约开发、链上事件监听、全栈数据流和 Polymarket API 集成。',
    coreAbilities: [
      'Solidity 合约设计',
      'Foundry 测试与部署',
      'Go API 代理层',
      '链上事件 Indexer',
      'wagmi / viem 前端交互',
      'Polymarket API 集成',
    ],
    talkingPoints: [
      '从 Web2 mock 到链上闭环的渐进式开发策略',
      '合约事件驱动架构 vs 轮询模式的取舍',
      '为什么 Gamma API 只需要代理层而不是直接暴露',
      '链上 Indexer 如何避免双花和重复事件',
      '前端双路径设计：mock 预览 + 真实链上交易',
    ],
    techStack: ['Solidity', 'Foundry', 'Go', 'Next.js', 'wagmi', 'viem', 'GORM'],
    github: 'https://github.com/qianqiu0404/prediction-market',
  },
  {
    id: 5,
    name: 'tss-mpc',
    positioning:
      '基于 GG18 协议的 Threshold Signature Scheme 多方计算签名方案实践，深入理解分布式密钥生成、门限签名和 DKG 的安全模型。',
    coreAbilities: [
      'MPC 分布式密钥生成',
      'TSS 门限签名协议',
      'DKG 安全模型理解',
      'P2P 节点通信',
      '多方签名协作流程',
    ],
    talkingPoints: [
      'TSS 和 Multisig 的本质区别：链上验证 vs 链下计算',
      '为什么 GG18 需要多轮交互',
      'DKG 中的拜占庭容错如何工作',
      'TSS 在钱包基础设施中的实际角色',
      '从单签名到门限签名的安全等级跃迁',
    ],
    techStack: ['Go', 'Ed25519', 'ECDSA', 'P2P', 'gRPC', 'Protobuf'],
    github: 'https://github.com/dapplink-baas/tss',
  },
  {
    id: 6,
    name: 'Scaffold-ETH',
    positioning:
      'DApp 与智能合约实践项目，用于构建钱包连接、合约部署、前端读写链上数据的基础能力。',
    coreAbilities: [
      '钱包连接',
      '合约部署',
      '前端读取链上数据',
      '合约交互流程',
      'DApp 基础工程结构',
    ],
    talkingPoints: [
      'DApp 前端如何连接钱包',
      '前端如何读取合约数据',
      '合约部署和前端调用的关系',
      'Web3 前端和传统前端的区别',
    ],
    techStack: ['Solidity', 'Next.js', 'Hardhat', 'Ethers', 'WalletConnect'],
    github: '#',
  },
]
