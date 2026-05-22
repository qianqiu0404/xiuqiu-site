declare const process: {
  env: Record<string, string | undefined>
}

type ChatRole = 'user' | 'assistant'

interface IncomingMessage {
  role: ChatRole
  content: string
}

interface VercelRequest {
  method?: string
  body?: unknown
}

interface VercelResponse {
  setHeader(name: string, value: string): void
  status(code: number): {
    json(body: unknown): void
    end(): void
  }
}

const DEFAULT_MODEL = 'deepseek-v4-flash'
const MAX_MESSAGE_LENGTH = 1000
const MAX_HISTORY_MESSAGES = 6

const KNOWLEDGE_CONTEXT = `
xiuqiu is a Web3 Wallet & Backend Developer.
Focus areas: multi-chain wallet backend, signer services, Go backend infrastructure, Solidity/EVM, MPC/TSS, and AI-assisted engineering workflows.

Projects:
- wallet-api: 多链钱包后端 API 服务，负责组织地址生成、余额查询、交易构建、链配置管理和签名服务调用。
  Engineering Focus: 多链钱包 API 设计, HTTP 服务入口, gRPC 内部服务调用, 链节点 RPC 接入, 钱包 API 层与签名层解耦
  Tech Stack: Go, HTTP, gRPC, PostgreSQL, Redis, Web3 RPC
- wallet-sign: 多链离线签名服务，负责 BTC、ETH、Solana、Cosmos 等链的交易签名能力，是钱包系统中安全边界更高的一层。
  Engineering Focus: 私钥管理边界, 离线签名流程, 批量签名策略, 多链签名差异, 签名服务独立部署思路
  Tech Stack: Go, TypeScript, BTC, ETH, Solana, Cosmos
- market-services: 交易所行情服务项目，负责聚合、缓存、计算和展示交易所行情数据，用于沉淀 Go 后端服务设计能力。
  Engineering Focus: HTTP 服务启动, gRPC 服务启动, Redis 行情缓存, PostgreSQL 数据持久化, Dashboard API 数据组装, 行情数据同步链路
  Tech Stack: Go, HTTP, gRPC, Redis, PostgreSQL, GORM, Vite
- prediction-market: Web3 预测市场 MVP：从 mock 原型到链上闭环，实践合约开发、链上事件监听、全栈数据流和 Polymarket API 集成。
  Engineering Focus: Solidity 合约设计, Foundry 测试与部署, Go API 代理层, 链上事件 Indexer, wagmi / viem 前端交互, Polymarket API 集成
  Tech Stack: Solidity, Foundry, Go, Next.js, wagmi, viem, GORM
- tss-mpc: 基于 GG18 协议的 Threshold Signature Scheme 多方计算签名方案实践，深入理解分布式密钥生成、门限签名和 DKG 的安全模型。
  Engineering Focus: MPC 分布式密钥生成, TSS 门限签名协议, DKG 安全模型理解, P2P 节点通信, 多方签名协作流程
  Tech Stack: Go, Ed25519, ECDSA, P2P, gRPC, Protobuf
- Scaffold-ETH: DApp 与智能合约实践项目，用于构建钱包连接、合约部署、前端读写链上数据的基础能力。
  Engineering Focus: 钱包连接, 合约部署, 前端读取链上数据, 合约交互流程, DApp 基础工程结构
  Tech Stack: Solidity, Next.js, Hardhat, Ethers, WalletConnect

Articles:
- API 到底是什么？从钱包后端项目理解系统调用
  Summary: 从前端、后端、数据库、第三方服务、链节点和签名机之间的关系，拆解 API 在现代软件系统中的连接作用。
  Tags: API, Backend, System Design, Wallet
  Difficulty: 基础
- HTTP、RPC、gRPC 的区别与项目使用场景
  Summary: 结合钱包系统和行情服务，解释 HTTP 更适合对外接口，gRPC 更适合内部服务调用，RPC 是远程过程调用思想。
  Tags: HTTP, RPC, gRPC, Backend
  Difficulty: 进阶
- wallet-api：多链钱包后端 API 的职责边界
  Summary: 梳理多链钱包 API 服务如何组织链配置、接口入口、节点调用、交易构建和签名服务协作。
  Tags: Web3, Wallet, Go, API
  Difficulty: 项目拆解
`.trim()

function parseBody(body: unknown): { messages?: unknown } {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return {}
    }
  }

  if (body && typeof body === 'object') {
    return body as { messages?: unknown }
  }

  return {}
}

function normalizeMessages(value: unknown): IncomingMessage[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((message): message is IncomingMessage => {
      if (!message || typeof message !== 'object') return false

      const candidate = message as Record<string, unknown>
      return (
        (candidate.role === 'user' || candidate.role === 'assistant') &&
        typeof candidate.content === 'string' &&
        candidate.content.trim().length > 0
      )
    })
    .map(message => ({
      role: message.role,
      content: message.content.trim().slice(0, MAX_MESSAGE_LENGTH),
    }))
    .slice(-MAX_HISTORY_MESSAGES)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests are supported.' })
  }

  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    return res.status(500).json({ error: 'DeepSeek API Key 尚未配置。' })
  }

  const { messages } = parseBody(req.body)
  const normalizedMessages = normalizeMessages(messages)

  if (normalizedMessages.length === 0) {
    return res.status(400).json({ error: '请输入一个有效问题。' })
  }

  try {
    const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content: [
              'You are the AI guide for xiuqiu personal website.',
              'Answer only questions related to xiuqiu, the listed projects, listed articles, Web3 wallets, signer services, backend engineering, and AI-assisted engineering workflows.',
              'If the answer is not supported by the provided website context, say you are not sure instead of inventing experience or facts.',
              'Prefer Chinese. Use English technical terms only where they help clarity.',
              'Keep answers concise, practical, and grounded in the website context.',
              '',
              'Website context:',
              KNOWLEDGE_CONTEXT,
            ].join('\n'),
          },
          ...normalizedMessages,
        ],
        temperature: 0.3,
        max_tokens: 700,
      }),
    })

    const payload = await deepseekResponse.json()

    if (!deepseekResponse.ok) {
      console.error('DeepSeek API error:', payload)
      return res.status(502).json({ error: '暂时无法连接 AI 服务，请稍后再试。' })
    }

    const answer = payload?.choices?.[0]?.message?.content

    if (typeof answer !== 'string' || answer.trim().length === 0) {
      return res.status(502).json({ error: 'AI 服务暂时没有返回有效回答。' })
    }

    return res.status(200).json({ answer: answer.trim() })
  } catch (error) {
    console.error('Chat API error:', error)
    return res.status(500).json({ error: '暂时无法连接 AI 服务，请稍后再试。' })
  }
}
