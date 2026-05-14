export interface Article {
  id: number
  title: string
  date: string
  summary: string
  tags: string[]
}

export const articles: Article[] = [
  {
    id: 1,
    title: '什么是 API？我如何理解系统之间的调用',
    date: '2026-05-14',
    summary:
      '用前端、后端、数据库和第三方服务之间的调用关系，解释 API 的本质。',
    tags: ['API', '后端', '系统设计'],
  },
  {
    id: 2,
    title: 'HTTP、RPC、gRPC 的区别',
    date: '2026-05-14',
    summary:
      '从通信方式、调用模型、使用场景和项目实践角度理解 HTTP、RPC 和 gRPC。',
    tags: ['HTTP', 'RPC', 'gRPC'],
  },
  {
    id: 3,
    title: 'wallet-api 项目架构初步理解',
    date: '2026-05-14',
    summary:
      '整理多链钱包 API 服务的职责边界、接口设计和与签名服务之间的关系。',
    tags: ['Web3', 'Wallet', 'Go'],
  },
  {
    id: 4,
    title: 'wallet-sign 签名机项目介绍',
    date: '2026-05-14',
    summary:
      '理解离线签名服务如何管理多链签名流程，以及为什么签名服务需要独立设计。',
    tags: ['Wallet', 'Signer', 'Security'],
  },
  {
    id: 5,
    title: '交易所行情服务 market-services 项目介绍',
    date: '2026-05-14',
    summary:
      '从 HTTP、gRPC、Redis、PostgreSQL 和行情同步流程理解交易所行情服务。',
    tags: ['Go', 'Market', 'Backend'],
  },
  {
    id: 6,
    title: 'BTC、ETH、Solana 钱包地址生成的区别',
    date: '2026-05-14',
    summary:
      '对比 UTXO 模型、账户模型、HD 钱包路径、地址格式和签名逻辑差异。',
    tags: ['BTC', 'ETH', 'Solana'],
  },
]
