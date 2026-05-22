import { articles } from '../src/data/articles'
import { projects } from '../src/data/projects'

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

const knowledgeContext = [
  'xiuqiu is a Web3 Wallet & Backend Developer. Focus areas: multi-chain wallet backend, signer services, Go backend infrastructure, Solidity/EVM, MPC/TSS, and AI-assisted engineering workflows.',
  '',
  'Projects:',
  ...projects.map(project => {
    return [
      `- ${project.name}: ${project.positioning}`,
      `  Engineering Focus: ${project.coreAbilities.join(', ')}`,
      `  Tech Stack: ${project.techStack.join(', ')}`,
    ].join('\n')
  }),
  '',
  'Articles:',
  ...articles.map(article => {
    return [
      `- ${article.title}`,
      `  Summary: ${article.summary}`,
      `  Tags: ${article.tags.join(', ')}`,
      `  Difficulty: ${article.difficulty}`,
    ].join('\n')
  }),
].join('\n')

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
              knowledgeContext,
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
