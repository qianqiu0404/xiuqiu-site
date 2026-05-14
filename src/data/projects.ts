export interface Project {
  id: number
  name: string
  description: string
  techStack: string[]
  learnings: string[]
  github: string
}

export const projects: Project[] = [
  {
    id: 1,
    name: 'wallet-api',
    description:
      '多链钱包后端 API 服务，负责对外提供地址生成、余额查询、交易构建等接口。',
    techStack: ['Go', 'gRPC', 'HTTP', 'PostgreSQL', 'Redis', 'Web3 RPC'],
    learnings: [
      '多链配置管理',
      'HTTP API 设计',
      'gRPC 服务调用',
      '链节点 RPC 接入',
      '钱包 API 和签名机之间的协作关系',
    ],
    github: 'https://github.com/qianqiu0404/exchange-wallet-api',
  },
  {
    id: 2,
    name: 'wallet-sign',
    description:
      '钱包离线签名服务/签名机，负责多链交易签名，保障私钥安全隔离。',
    techStack: ['Go', 'TypeScript', 'BTC', 'ETH', 'Solana', 'Cosmos'],
    learnings: [
      '私钥管理',
      '离线签名',
      '批量签名',
      'BTC / ETH / Solana 不同链的签名差异',
      '签名服务和 API 服务的边界设计',
    ],
    github: 'https://github.com/qianqiu0404/exchange-wallet-sign',
  },
  {
    id: 3,
    name: 'market-services',
    description:
      '交易所行情服务项目，负责聚合、缓存和展示交易所行情数据。',
    techStack: ['Go', 'HTTP', 'gRPC', 'Redis', 'PostgreSQL', 'GORM', 'Vite'],
    learnings: [
      'HTTP 服务启动',
      'gRPC 服务启动',
      'Redis 行情缓存',
      'PostgreSQL 数据持久化',
      'Dashboard API',
      '行情数据同步流程',
    ],
    github: 'https://github.com/qianqiu0404/s78-market-services',
  },
  {
    id: 4,
    name: 'Scaffold-ETH demo',
    description:
      '智能合约和 DApp 学习 Demo，用于理解前端、合约、钱包连接和链上交互流程。',
    techStack: ['Solidity', 'Next.js', 'Hardhat', 'Ethers', 'WalletConnect'],
    learnings: [
      '钱包连接',
      '合约部署',
      '前端读取链上数据',
      'DApp 基础交互流程',
    ],
    github: '#',
  },
]
