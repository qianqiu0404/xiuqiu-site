import { buildKnowledgeContext, findRelevantReferences } from '../src/data/siteKnowledge.ts'

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
  headers?: Record<string, string | string[] | undefined>
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
const REQUEST_TIMEOUT_MS = 16000
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 12

type ErrorCode =
  | 'method_not_allowed'
  | 'rate_limited'
  | 'missing_api_key'
  | 'invalid_messages'
  | 'upstream_auth_error'
  | 'upstream_error'
  | 'upstream_invalid_json'
  | 'upstream_invalid_answer'
  | 'upstream_timeout'
  | 'upstream_network_error'

interface PageContext {
  type: 'home' | 'now' | 'engineering' | 'engineering-failures' | 'engineering-evidence' | 'ai' | 'social-research' | 'ai-deliveries' | 'ai-delivery' | 'learning' | 'articles' | 'article' | 'project' | 'radar' | 'radar-detail'
  title?: string
  slug?: string
  summary?: string
}

interface RateLimitBucket {
  count: number
  resetAt: number
}

const rateLimitBuckets = new Map<string, RateLimitBucket>()

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function getRequestId(req: VercelRequest): string {
  return firstHeader(req.headers?.['x-vercel-id']) || `local-${Date.now().toString(36)}`
}

function errorResponse(
  res: VercelResponse,
  status: number,
  code: ErrorCode,
  error: string,
  requestId: string,
  retryable = false,
) {
  return res.status(status).json({
    error,
    code,
    retryable,
    requestId,
  })
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: text ? JSON.parse(text) : {} }
  } catch {
    return { ok: false }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function parseBody(body: unknown): { messages?: unknown; pageContext?: unknown } {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return {}
    }
  }

  if (body && typeof body === 'object') {
    return body as { messages?: unknown; pageContext?: unknown }
  }

  return {}
}

function normalizePageContext(value: unknown): PageContext | undefined {
  if (!value || typeof value !== 'object') return undefined

  const candidate = value as Record<string, unknown>
  if (
    candidate.type !== 'home' &&
    candidate.type !== 'now' &&
    candidate.type !== 'engineering' &&
    candidate.type !== 'engineering-failures' &&
    candidate.type !== 'engineering-evidence' &&
    candidate.type !== 'ai' &&
    candidate.type !== 'social-research' &&
    candidate.type !== 'ai-deliveries' &&
    candidate.type !== 'ai-delivery' &&
    candidate.type !== 'learning' &&
    candidate.type !== 'articles' &&
    candidate.type !== 'article' &&
    candidate.type !== 'project' &&
    candidate.type !== 'radar' &&
    candidate.type !== 'radar-detail'
  ) {
    return undefined
  }

  return {
    type: candidate.type,
    title: typeof candidate.title === 'string' ? candidate.title.trim().slice(0, 160) : undefined,
    slug: typeof candidate.slug === 'string' ? candidate.slug.trim().slice(0, 120) : undefined,
    summary: typeof candidate.summary === 'string' ? candidate.summary.trim().slice(0, 500) : undefined,
  }
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

function getClientKey(req: VercelRequest): string {
  const ip = firstHeader(req.headers?.['x-forwarded-for'])
  return ip?.split(',')[0]?.trim() || 'anonymous'
}

function isRateLimited(clientKey: string): boolean {
  const now = Date.now()
  const bucket = rateLimitBuckets.get(clientKey)

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(clientKey, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    })
    return false
  }

  bucket.count += 1
  return bucket.count > RATE_LIMIT_MAX_REQUESTS
}

function buildPageContextPrompt(pageContext: PageContext | undefined): string {
  if (!pageContext) return 'Current page context: unknown.'

  return [
    `Current page type: ${pageContext.type}`,
    pageContext.title ? `Current page title: ${pageContext.title}` : '',
    pageContext.slug ? `Current page slug: ${pageContext.slug}` : '',
    pageContext.summary ? `Current page summary: ${pageContext.summary}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  const requestId = getRequestId(req)

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return errorResponse(res, 405, 'method_not_allowed', 'Only POST requests are supported.', requestId)
  }

  if (isRateLimited(getClientKey(req))) {
    res.setHeader('Retry-After', String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)))
    return errorResponse(res, 429, 'rate_limited', '提问太频繁了，请稍后再试。', requestId, true)
  }

  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    return errorResponse(res, 500, 'missing_api_key', 'DeepSeek API Key 尚未配置。', requestId)
  }

  const { messages, pageContext } = parseBody(req.body)
  const normalizedMessages = normalizeMessages(messages)
  const normalizedPageContext = normalizePageContext(pageContext)
  const lastUserMessage = [...normalizedMessages].reverse().find(message => message.role === 'user')

  if (normalizedMessages.length === 0) {
    return errorResponse(res, 400, 'invalid_messages', '请输入一个有效问题。', requestId)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      signal: controller.signal,
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
              'You are the AI guide for xiuqiu public engineering learning archive.',
              'Answer only questions related to xiuqiu, the listed projects, listed articles, Web3 wallets, signer services, backend engineering, and AI-assisted engineering workflows.',
              'If the answer is not supported by the provided website context, say you are not sure instead of inventing experience or facts.',
              'Prefer Chinese. Use English technical terms only where they help clarity.',
              'Clearly distinguish implemented or verified facts, current limitations, and future learning plans.',
              'Treat evidence status literally: verified means reproducible evidence for the stated fact, partial means incomplete coverage, and design means it is not implemented.',
              'For delivery questions, distinguish AI contribution, human decisions, review findings, corrections, public evidence, and remaining limits.',
              'For wallet failure questions, always structure the answer around: chain/fund fact, stop-loss action, evidence to inspect, recovery/idempotency basis, and the current project boundary.',
              'Keep answers concise, practical, and grounded in the website context.',
              'When helpful, cite exact project names and article titles from the website context.',
              '',
              buildPageContextPrompt(normalizedPageContext),
              '',
              'Website context:',
              buildKnowledgeContext(),
            ].join('\n'),
          },
          ...normalizedMessages,
        ],
        temperature: 0.3,
        max_tokens: 700,
      }),
    })

    const responseText = await deepseekResponse.text()
    const parsedPayload = parseJson(responseText)

    if (!parsedPayload.ok) {
      console.error('DeepSeek returned non-JSON response:', {
        requestId,
        status: deepseekResponse.status,
        bodyPreview: responseText.slice(0, 200),
      })
      return errorResponse(res, 502, 'upstream_invalid_json', 'AI 服务返回格式异常，请稍后再试。', requestId, true)
    }

    const payload = parsedPayload.value

    if (!deepseekResponse.ok) {
      const upstreamError = isRecord(payload) && isRecord(payload.error) ? payload.error : undefined
      console.error('DeepSeek API error:', {
        requestId,
        status: deepseekResponse.status,
        errorType: upstreamError && typeof upstreamError.type === 'string' ? upstreamError.type : undefined,
        errorCode: upstreamError && typeof upstreamError.code === 'string' ? upstreamError.code : undefined,
      })

      const isAuthError = deepseekResponse.status === 401 || deepseekResponse.status === 403
      return errorResponse(
        res,
        502,
        isAuthError ? 'upstream_auth_error' : 'upstream_error',
        isAuthError ? 'AI 服务配置需要检查，请稍后再试。' : 'DeepSeek 返回错误，请稍后再试。',
        requestId,
        !isAuthError,
      )
    }

    const firstChoice = isRecord(payload) && Array.isArray(payload.choices) ? payload.choices[0] : undefined
    const message = isRecord(firstChoice) && isRecord(firstChoice.message) ? firstChoice.message : undefined
    const answer = typeof message?.content === 'string' ? message.content : undefined

    if (typeof answer !== 'string' || answer.trim().length === 0) {
      return errorResponse(res, 502, 'upstream_invalid_answer', 'AI 服务暂时没有返回有效回答。', requestId, true)
    }

    return res.status(200).json({
      answer: answer.trim(),
      references: findRelevantReferences(lastUserMessage?.content || '', normalizedPageContext?.title),
    })
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError'
    console.error('Chat API error:', {
      requestId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    return errorResponse(
      res,
      isTimeout ? 504 : 502,
      isTimeout ? 'upstream_timeout' : 'upstream_network_error',
      isTimeout ? 'AI 服务响应超时，请稍后再试。' : '暂时无法连接 AI 服务，请稍后再试。',
      requestId,
      true,
    )
  } finally {
    clearTimeout(timeoutId)
  }
}
