<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getArticleBySlug, getProjectByKey, siteKnowledge, type SiteReference } from '../data/siteKnowledge'

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  role: ChatRole
  content: string
  references?: SiteReference[]
}

interface PageContext {
  type: 'home' | 'now' | 'engineering' | 'engineering-failures' | 'engineering-evidence' | 'ai' | 'social-research' | 'ai-deliveries' | 'ai-delivery' | 'learning' | 'articles' | 'article' | 'project' | 'radar' | 'radar-detail'
  title?: string
  slug?: string
  summary?: string
}

interface AskAiEventDetail {
  prompt: string
  context?: PageContext
}

const route = useRoute()
const isOpen = ref(false)
const input = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const messageList = ref<HTMLElement | null>(null)
const explicitPageContext = ref<PageContext | null>(null)
const CLIENT_REQUEST_TIMEOUT_MS = 20_000
let activeRequestController: AbortController | null = null
const messages = ref<ChatMessage[]>([
  {
    role: 'assistant',
    content: '你好，我是 xiuqiu AI。我只基于本站公开资料，帮你理解 Wallet Launchpad、Qiu Market Server、钱包工程证据，以及它们的目标完成形态与当前验证边界。',
  },
])

const promptGroups = [
  {
    label: '产品完成形态',
    prompts: [
      '完成后的 Wallet Launchpad 是什么？',
      'Qiu Market Server 解决什么问题？',
      '用三分钟介绍 xiuqiu 的代表项目',
    ],
  },
  {
    label: '工程证据',
    prompts: [
      '哪些能力已经验证，哪些仍待验收？',
      'wallet-api、risk-service 和 wallet-sign 的边界是什么？',
      '遇到广播结果未知时，系统如何止损与恢复？',
    ],
  },
  {
    label: 'AI 协作',
    prompts: [
      'xiuqiu 如何让 AI 加速工程但不代替验证？',
      '公开站点如何避免泄露 Obsidian 私人内容？',
    ],
  },
]

const referenceTypeLabels: Record<SiteReference['type'], string> = {
  article: '工程笔记',
  project: '项目',
  capability: '能力',
  ai: 'AI 协作',
  radar: '研究雷达',
  failure: '异常手册',
  evidence: '工程证据',
  delivery: '交付记录',
}

const canSend = computed(() => input.value.trim().length > 0 && !isLoading.value)
const currentPageContext = computed<PageContext>(() => {
  if (explicitPageContext.value) return explicitPageContext.value

  if (route.name === 'article-detail') {
    const slug = String(route.params.slug || '')
    const article = getArticleBySlug(slug)
    return {
      type: 'article',
      title: article?.title || 'Article detail',
      slug,
      summary: article?.summary,
    }
  }

  if (route.name === 'articles') {
    return {
      type: 'articles',
      title: 'Writing',
      summary: `${siteKnowledge.articles.length} technical articles about wallet architecture, backend services, signer boundaries, EVM, and MPC/TSS.`,
    }
  }

  if (route.name === 'engineering') {
    return {
      type: 'engineering',
      title: '工程档案',
      summary: 'Exchange Wallet Infrastructure 的资金编排、风险控制、链交互、签名边界、失败场景和验证证据。',
    }
  }

  if (route.name === 'engineering-failures') {
    return {
      type: 'engineering-failures',
      title: '钱包异常恢复手册',
      summary: '30 个钱包后端核心异常；回答必须包含资金事实、先止损动作、排查与恢复依据，以及当前项目证据边界。',
    }
  }

  if (route.name === 'engineering-evidence') {
    return {
      type: 'engineering-evidence',
      title: '工程证据覆盖',
      summary: '八个钱包工程能力维度分别关联工程实现、自动化测试、可运行演示和公开说明，并明确已验证、部分验证与工程设计。',
    }
  }

  if (route.name === 'now') {
    return {
      type: 'now',
      title: siteKnowledge.now.headline,
      summary: `${siteKnowledge.now.summary} 下一步：${siteKnowledge.now.nextFocus.join('；')}`,
    }
  }

  if (route.name === 'learning') {
    return {
      type: 'learning',
      title: '学习复盘',
      summary: '精选公开的阶段目标、验证结果、复盘结论和下一步。',
    }
  }

  if (route.name === 'ai') {
    return {
      type: 'ai',
      title: 'AI 工作流',
      summary: 'AI Coding、跨设备 Skill、社交研究、每日发布与 Obsidian 知识治理五个真实 Loop。',
    }
  }

  if (route.name === 'social-research') {
    return {
      type: 'social-research',
      title: 'Social Media Research Skill',
      summary: 'MediaCrawler 本地优先、TikHub 付费确认回退、统一 JSONL 与 Codex 分析组成的双后端公开研究工作流。',
    }
  }

  if (route.name === 'ai-deliveries' || route.name === 'ai-delivery-detail') {
    const slug = route.name === 'ai-delivery-detail' ? String(route.params.slug || '') : undefined
    const delivery = slug ? siteKnowledge.deliveryRecords.find(item => item.slug === slug) : undefined
    return {
      type: route.name === 'ai-delivery-detail' ? 'ai-delivery' : 'ai-deliveries',
      title: delivery?.title || 'AI 协作真实交付记录',
      slug,
      summary: delivery?.summary || '真实工程任务中的 AI 参与、人工判断、审查发现、纠正动作与公开验证。',
    }
  }

  if (route.name === 'radar' || route.name === 'radar-detail') {
    return {
      type: route.name === 'radar-detail' ? 'radar-detail' : 'radar',
      title: route.name === 'radar-detail' ? `每日研究雷达 ${String(route.params.date || '')}` : '每日研究雷达',
      slug: route.name === 'radar-detail' ? String(route.params.date || '') : undefined,
      summary: '从公开允许的 Obsidian 研究区块自动汇总，并保留来源、缺失状态和关联工程。',
    }
  }

  if (route.name === 'project-detail') {
    const project = getProjectByKey(String(route.params.project || ''))
    return {
      type: 'project',
      title: project?.name || '工程项目',
      slug: project?.slug,
      summary: project?.positioning,
    }
  }

  return {
    type: 'home',
    title: siteKnowledge.owner.title,
    summary: siteKnowledge.owner.summary,
  }
})

function toggleChat() {
  if (isOpen.value) cancelActiveRequest()
  isOpen.value = !isOpen.value
  errorMessage.value = ''

  if (isOpen.value) {
    void scrollToBottom()
  }
}

function cancelActiveRequest() {
  activeRequestController?.abort()
  activeRequestController = null
}

async function sendQuickPrompt(prompt: string) {
  input.value = prompt
  await sendMessage()
}

async function askWithContext(detail: AskAiEventDetail) {
  explicitPageContext.value = detail.context || null
  isOpen.value = true
  input.value = detail.prompt
  await sendMessage()
}

async function sendMessage() {
  const content = input.value.trim().slice(0, 1000)

  if (!content || isLoading.value) return

  const userMessage: ChatMessage = { role: 'user', content }
  messages.value.push(userMessage)
  input.value = ''
  errorMessage.value = ''
  isLoading.value = true

  await scrollToBottom()

  const controller = new AbortController()
  activeRequestController = controller
  let didTimeout = false
  const timeoutId = window.setTimeout(() => {
    didTimeout = true
    controller.abort()
  }, CLIENT_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messages.value.slice(-6),
        pageContext: currentPageContext.value,
      }),
    })

    const responseText = await response.text()
    let payload: { answer?: unknown; error?: string; references?: unknown; requestId?: unknown } = {}

    try {
      payload = responseText ? JSON.parse(responseText) : {}
    } catch {
      payload = {}
    }

    if (!response.ok) {
      throw new Error(payload?.error || '暂时无法连接 AI 服务，请稍后再试。')
    }

    if (typeof payload?.answer !== 'string') {
      throw new Error('AI 服务暂时没有返回有效回答。')
    }

    messages.value.push({
      role: 'assistant',
      content: payload.answer,
      references: normalizeReferences(payload.references),
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (didTimeout) {
        errorMessage.value = 'xiuqiu AI 响应超过 20 秒，请稍后重试。'
      }
      return
    }

    errorMessage.value = error instanceof Error ? error.message : '暂时无法连接 AI 服务，请稍后再试。'
    messages.value.push({
      role: 'assistant',
      content: '抱歉，AI 服务暂时不可用。你可以稍后再试，或通过 GitHub 继续了解 xiuqiu 的项目。',
    })
  } finally {
    window.clearTimeout(timeoutId)
    if (activeRequestController === controller) activeRequestController = null
    explicitPageContext.value = null
    isLoading.value = false
    await scrollToBottom()
  }
}

function normalizeReferences(value: unknown): SiteReference[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is SiteReference => {
      if (!item || typeof item !== 'object') return false
      const candidate = item as Record<string, unknown>
      return (
        (candidate.type === 'article' || candidate.type === 'project' || candidate.type === 'capability' || candidate.type === 'ai' || candidate.type === 'radar' || candidate.type === 'failure' || candidate.type === 'evidence' || candidate.type === 'delivery') &&
        typeof candidate.title === 'string' &&
        typeof candidate.href === 'string' &&
        typeof candidate.summary === 'string'
      )
    })
    .slice(0, 4)
}

async function scrollToBottom() {
  await nextTick()
  if (messageList.value) {
    messageList.value.scrollTop = messageList.value.scrollHeight
  }
}

function handleAskAi(event: Event) {
  const detail = (event as CustomEvent<AskAiEventDetail>).detail
  if (!detail?.prompt) return
  void askWithContext(detail)
}

onMounted(() => {
  window.addEventListener('ai-chat:ask', handleAskAi)
})

onUnmounted(() => {
  cancelActiveRequest()
  window.removeEventListener('ai-chat:ask', handleAskAi)
})
</script>

<template>
  <div class="ai-chat">
    <section v-if="isOpen" class="ai-chat-panel" aria-label="xiuqiu AI 客服">
      <header class="ai-chat-header">
        <div>
          <p class="ai-chat-kicker">xiuqiu AI</p>
          <h2 class="ai-chat-title">产品与工程证据助手</h2>
          <p class="ai-chat-scope">公开知识 · 不读取私有仓库</p>
        </div>
        <button class="ai-icon-button" type="button" aria-label="关闭 AI 客服" @click="toggleChat">
          ×
        </button>
      </header>

      <div ref="messageList" class="ai-chat-messages" aria-live="polite" :aria-busy="isLoading">
        <article
          v-for="(message, index) in messages"
          :key="index"
          class="ai-message"
          :class="'ai-message-' + message.role"
        >
          {{ message.content }}
          <div v-if="message.references?.length" class="ai-references">
            <p class="ai-references-title">本站相关资料</p>
            <a
              v-for="reference in message.references"
              :key="reference.type + reference.href + reference.title"
              class="ai-reference"
              :href="reference.href"
            >
              <span>{{ reference.title }}</span>
              <small>{{ referenceTypeLabels[reference.type] }}</small>
            </a>
          </div>
        </article>
        <article v-if="isLoading" class="ai-message ai-message-assistant ai-message-loading">
          正在核对公开资料...
        </article>
      </div>

      <div class="ai-chat-prompts" aria-label="推荐问题">
        <div v-for="group in promptGroups" :key="group.label" class="ai-prompt-group">
          <p class="ai-prompt-label">{{ group.label }}</p>
          <button
            v-for="prompt in group.prompts"
            :key="prompt"
            class="ai-prompt"
            type="button"
            :disabled="isLoading"
            @click="sendQuickPrompt(prompt)"
          >
            {{ prompt }}
          </button>
        </div>
      </div>

      <p v-if="errorMessage" class="ai-chat-error">{{ errorMessage }}</p>

      <p class="ai-chat-privacy">只使用本站公开内容，不读取 Obsidian 原文、私有仓库或账户数据。请勿输入密钥、地址、交易或其他隐私信息。</p>

      <form class="ai-chat-form" @submit.prevent="sendMessage">
        <textarea
          v-model="input"
          class="ai-chat-input"
          rows="2"
          maxlength="1000"
          placeholder="询问项目、工程证据或钱包后端..."
          aria-label="向 xiuqiu AI 客服提问"
          @keydown.enter.exact.prevent="sendMessage"
        ></textarea>
        <button class="ai-send-button" type="submit" :disabled="!canSend">
          发送
        </button>
      </form>
    </section>

    <button
      class="ai-chat-toggle"
      type="button"
      :aria-expanded="isOpen"
      aria-label="打开 xiuqiu AI 客服"
      @click="toggleChat"
    >
      AI
    </button>
  </div>
</template>

<style scoped>
.ai-chat {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 140;
  font-family: var(--font);
}

.ai-chat-toggle {
  width: 52px;
  height: 52px;
  border: 1px solid rgba(0, 113, 227, 0.18);
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  box-shadow: 0 12px 32px rgba(0, 113, 227, 0.24);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.ai-chat-toggle:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 36px rgba(0, 113, 227, 0.28);
}

.ai-chat-panel {
  position: absolute;
  right: 0;
  bottom: 68px;
  width: min(380px, calc(100vw - 48px));
  max-height: min(680px, calc(100vh - 120px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid var(--border-light);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.ai-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 18px 14px;
  border-bottom: 1px solid var(--border-light);
}

.ai-chat-kicker {
  margin-bottom: 2px;
  color: var(--text-muted);
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1.3;
}

.ai-chat-title {
  color: var(--text);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.25;
}

.ai-chat-scope {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.35;
}

.ai-icon-button {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  border: 1px solid var(--border-light);
  border-radius: 50%;
  background: var(--bg);
  color: var(--text-muted);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
}

.ai-icon-button:hover {
  border-color: #c0c0c5;
  color: var(--text);
}

.ai-chat-messages {
  flex: 1;
  min-height: 220px;
  overflow-y: auto;
  padding: 18px;
  background: var(--bg-warm);
}

.ai-message {
  width: fit-content;
  max-width: 86%;
  margin-bottom: 10px;
  padding: 10px 12px;
  border-radius: 16px;
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-message-assistant {
  background: #fff;
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
}

.ai-message-user {
  margin-left: auto;
  background: var(--accent);
  color: #fff;
}

.ai-message-loading {
  color: var(--text-muted);
  font-family: var(--mono);
}

.ai-references {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}

.ai-references-title {
  color: var(--text-muted);
  font-family: var(--mono);
  font-size: 10px;
  line-height: 1.2;
  text-transform: uppercase;
}

.ai-reference {
  display: grid;
  gap: 2px;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  background: var(--bg-warm);
  color: var(--text);
  padding: 8px 9px;
}

.ai-reference span {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
}

.ai-reference small {
  color: var(--text-muted);
  font-family: var(--mono);
  font-size: 10px;
}

.ai-chat-prompts {
  display: grid;
  gap: 10px;
  padding: 12px 18px 0;
}

.ai-prompt-group {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.ai-prompt-label {
  width: 100%;
  color: var(--text-muted);
  font-family: var(--mono);
  font-size: 10px;
  line-height: 1.2;
  text-transform: uppercase;
}

.ai-prompt {
  border: 1px solid var(--border-light);
  border-radius: 999px;
  background: var(--bg);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
  line-height: 1.4;
  padding: 7px 10px;
  text-align: left;
  transition: border-color 0.2s, color 0.2s;
}

.ai-prompt:hover:not(:disabled) {
  border-color: #c0c0c5;
  color: var(--text);
}

.ai-prompt:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.ai-chat-error {
  margin: 10px 18px 0;
  color: #b42318;
  font-size: 12px;
  line-height: 1.5;
}

.ai-chat-privacy {
  margin: 0;
  padding: 0 18px 10px;
  color: var(--text-light);
  font-size: 11px;
  line-height: 1.5;
}

.ai-chat-form {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 12px 18px 18px;
}

.ai-chat-input {
  min-height: 42px;
  max-height: 110px;
  flex: 1;
  resize: vertical;
  border: 1px solid var(--border-light);
  border-radius: 14px;
  background: var(--bg);
  color: var(--text);
  font: 400 13px/1.5 var(--font);
  outline: none;
  padding: 10px 12px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.ai-chat-input:focus {
  border-color: rgba(0, 113, 227, 0.5);
  box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.08);
}

.ai-send-button {
  height: 42px;
  flex: 0 0 auto;
  border: none;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  padding: 0 16px;
  transition: background 0.2s, opacity 0.2s;
}

.ai-send-button:hover:not(:disabled) {
  background: #147ce5;
}

.ai-send-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@media (max-width: 768px) {
  .ai-chat {
    right: 18px;
    bottom: 18px;
    left: 18px;
    display: flex;
    justify-content: flex-end;
    pointer-events: none;
  }

  .ai-chat > * {
    pointer-events: auto;
  }

  .ai-chat-panel {
    right: 0;
    bottom: 62px;
    left: 0;
    width: 100%;
    height: min(680px, calc(100dvh - 124px));
    max-height: none;
    border-radius: 18px;
  }

  .ai-chat-messages {
    min-height: 0;
  }

  .ai-chat-prompts {
    max-height: 180px;
    overflow-y: auto;
    padding-bottom: 4px;
  }

  .ai-chat-toggle {
    width: 46px;
    height: 46px;
    font-size: 13px;
  }

  .ai-chat-form {
    align-items: stretch;
    flex-direction: column;
  }

  .ai-send-button {
    width: 100%;
  }
}
</style>
