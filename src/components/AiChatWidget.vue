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
  opener?: HTMLElement
}

const props = withDefaults(defineProps<{
  cinematic?: boolean
  hideDesktopToggle?: boolean
}>(), {
  cinematic: false,
  hideDesktopToggle: false,
})

const route = useRoute()
const isOpen = ref(false)
const input = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const messageList = ref<HTMLElement | null>(null)
const chatInput = ref<HTMLTextAreaElement | null>(null)
const chatToggle = ref<HTMLButtonElement | null>(null)
const lastOpener = ref<HTMLElement | null>(null)
const explicitPageContext = ref<PageContext | null>(null)
const CLIENT_REQUEST_TIMEOUT_MS = 20_000
let activeRequestController: AbortController | null = null
const messages = ref<ChatMessage[]>([
  {
    role: 'assistant',
    content: '你好，我是 xiuqiu AI。我只基于本站公开资料，帮你理解 Wallet Launchpad、Qiu Market Server、钱包工程证据，以及它们的目标完成形态与当前验证边界。',
  },
])

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

  if (route.name === 'home') {
    return {
      type: 'home',
      title: 'Wallet Platform × Market Server × AI Engineering',
      summary: 'Wallet 与 Market 是构建的系统，AI 是贯穿计划、实现、审查、测试、文档和知识治理的工程工作流。',
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

const contextualPrompts = computed(() => {
  switch (currentPageContext.value.type) {
    case 'project':
      return [
        '这个项目解决什么问题，当前证据和限制是什么？',
        '这个项目完成后的产品形态是什么？',
        '推荐相关工程证据和文章',
      ]
    case 'engineering-failures':
      return [
        '广播结果未知时为什么不能直接重发？',
        '链上成功但本地失败应该如何恢复？',
        '先止损、查事实和幂等恢复分别做什么？',
      ]
    case 'engineering-evidence':
    case 'engineering':
      return [
        '哪些钱包能力已经有可复现证据？',
        '本地验证、测试网验证和生产经验有什么区别？',
        'wallet-api、wallet-sign 和 risk-service 的边界是什么？',
      ]
    case 'article':
    case 'articles':
      return [
        '概括这篇内容的核心工程判断',
        '推荐一条多链钱包后端阅读路径',
        '哪些文章适合理解签名与异常恢复？',
      ]
    case 'ai':
    case 'ai-deliveries':
    case 'ai-delivery':
      return [
        'AI 在工程任务中负责什么，人负责什么？',
        '哪些 AI 协作结果有公开验证？',
        '知识治理如何避免公开私人内容？',
      ]
    case 'radar':
    case 'radar-detail':
      return [
        '这条研究信号与哪些工程项目相关？',
        '哪些是事实，哪些仍是推断？',
        '最近研究正在收敛到什么主题？',
      ]
    default:
      return [
        'xiuqiu 的 Wallet Platform 包含哪些项目？',
        'Market Server 完成后是什么产品？',
        '哪些能力已经有可复现证据？',
      ]
  }
})

async function toggleChat() {
  if (isOpen.value) {
    closeChat()
    return
  }

  lastOpener.value = chatToggle.value
  isOpen.value = true
  errorMessage.value = ''
  await nextTick()
  chatInput.value?.focus()
  await scrollToBottom()
}

function closeChat() {
  cancelActiveRequest()
  isOpen.value = false
  errorMessage.value = ''
  void nextTick(() => (lastOpener.value || chatToggle.value)?.focus())
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
  lastOpener.value = detail.opener || chatToggle.value
  explicitPageContext.value = detail.context || null
  isOpen.value = true
  input.value = detail.prompt
  await sendMessage()
}

function handleInputKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  void sendMessage()
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

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) closeChat()
}

onMounted(() => {
  window.addEventListener('ai-chat:ask', handleAskAi)
  window.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  cancelActiveRequest()
  window.removeEventListener('ai-chat:ask', handleAskAi)
  window.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <div
    class="ai-chat"
    :class="{
      'ai-chat--cinematic': props.cinematic,
      'ai-chat--desktop-rail': props.hideDesktopToggle,
    }"
  >
    <section
      v-if="isOpen"
      id="ai-chat-panel"
      class="ai-chat-panel"
      role="dialog"
      aria-label="xiuqiu AI 工程内容助手"
    >
      <header class="ai-chat-header">
        <div>
          <p class="ai-chat-kicker">xiuqiu AI · DeepSeek</p>
          <h2 class="ai-chat-title">产品与工程证据助手</h2>
          <p class="ai-chat-scope">公开知识 · 不读取私有仓库</p>
        </div>
        <button class="ai-icon-button" type="button" aria-label="关闭 AI 助手" @click="closeChat">
          ×
        </button>
      </header>

      <p class="ai-chat-context">当前页面 · {{ currentPageContext.title }}</p>

      <div ref="messageList" class="ai-chat-messages" aria-live="polite" :aria-busy="isLoading">
        <article
          v-for="(message, index) in messages"
          :key="index"
          class="ai-message"
          :class="'ai-message-' + message.role"
        >
          {{ message.content }}
          <div v-if="message.references?.length" class="ai-references">
            <p class="ai-references-title">站内相关证据</p>
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
        <article v-if="isLoading" class="ai-message ai-message-assistant ai-message-loading" role="status">
          正在整理公开证据…
        </article>
      </div>

      <div class="ai-chat-prompts" aria-label="当前页面建议问题">
        <button
          v-for="prompt in contextualPrompts"
          :key="prompt"
          class="ai-prompt"
          type="button"
          :disabled="isLoading"
          @click="sendQuickPrompt(prompt)"
        >
          {{ prompt }}
        </button>
      </div>

      <p v-if="errorMessage" class="ai-chat-error" role="alert">{{ errorMessage }}</p>

      <p class="ai-chat-privacy">
        回答只使用本站公开内容，不读取 Obsidian 原文、私有仓库或账户数据；你的问题会发送至 DeepSeek API。请勿输入密钥、账户、地址、交易或其他隐私信息。
      </p>

      <form class="ai-chat-form" @submit.prevent="sendMessage">
        <textarea
          ref="chatInput"
          v-model="input"
          class="ai-chat-input"
          rows="2"
          maxlength="1000"
          placeholder="询问项目、工程证据或钱包后端..."
          aria-label="向 xiuqiu AI 助手提问"
          @keydown="handleInputKeydown"
        ></textarea>
        <button class="ai-send-button" type="submit" :disabled="!canSend">
          发送
        </button>
      </form>
    </section>

    <button
      ref="chatToggle"
      class="ai-chat-toggle"
      type="button"
      :aria-expanded="isOpen"
      aria-controls="ai-chat-panel"
      :aria-label="isOpen ? '关闭 xiuqiu AI 工程内容助手' : '打开 xiuqiu AI 工程内容助手'"
      @click="toggleChat"
    >
      <span v-if="props.cinematic">Ask xiuqiu AI</span>
      <span v-else>AI</span>
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

.ai-chat :where(button, textarea, a):focus-visible {
  outline: 3px solid rgba(0, 113, 227, 0.28);
  outline-offset: 2px;
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

.ai-chat--cinematic .ai-chat-toggle {
  width: auto;
  min-width: 132px;
  height: 48px;
  border-color: rgba(222, 237, 255, 0.24);
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(35, 43, 56, 0.92), rgba(9, 12, 18, 0.94));
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.34), inset 0 1px rgba(255, 255, 255, 0.13);
  font-size: 12px;
  letter-spacing: 0.02em;
  padding: 0 19px;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.ai-chat--cinematic .ai-chat-toggle:hover {
  border-color: rgba(222, 237, 255, 0.42);
  box-shadow:
    0 20px 54px rgba(0, 0, 0, 0.4),
    0 0 30px rgba(97, 164, 255, 0.12),
    inset 0 1px rgba(255, 255, 255, 0.18);
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

.ai-chat--cinematic .ai-chat-panel {
  border-color: rgba(255, 255, 255, 0.14);
  background:
    radial-gradient(circle at 84% -10%, rgba(82, 147, 239, 0.2), transparent 32%),
    rgba(7, 10, 15, 0.96);
  box-shadow: 0 34px 90px rgba(0, 0, 0, 0.48), inset 0 1px rgba(255, 255, 255, 0.08);
  color: #f7f9fd;
}

.ai-chat--cinematic .ai-chat-header,
.ai-chat--cinematic .ai-chat-context {
  border-color: rgba(255, 255, 255, 0.09);
}

.ai-chat--cinematic .ai-chat-kicker,
.ai-chat--cinematic .ai-chat-context,
.ai-chat--cinematic .ai-chat-privacy,
.ai-chat--cinematic .ai-message-loading,
.ai-chat--cinematic .ai-references-title,
.ai-chat--cinematic .ai-reference small {
  color: rgba(225, 235, 249, 0.58);
}

.ai-chat--cinematic .ai-chat-title,
.ai-chat--cinematic .ai-reference,
.ai-chat--cinematic .ai-prompt,
.ai-chat--cinematic .ai-chat-input {
  color: #f7f9fd;
}

.ai-chat--cinematic .ai-icon-button,
.ai-chat--cinematic .ai-prompt,
.ai-chat--cinematic .ai-chat-input,
.ai-chat--cinematic .ai-reference {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.045);
}

.ai-chat--cinematic .ai-icon-button {
  color: rgba(241, 247, 255, 0.7);
}

.ai-chat--cinematic .ai-chat-messages {
  background: rgba(255, 255, 255, 0.018);
}

.ai-chat--cinematic .ai-message-assistant {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.065);
  color: rgba(244, 248, 255, 0.84);
}

.ai-chat--cinematic .ai-message-user,
.ai-chat--cinematic .ai-send-button {
  background: #e9f3ff;
  color: #10141c;
}

.ai-chat--cinematic .ai-prompt:hover:not(:disabled),
.ai-chat--cinematic .ai-icon-button:hover {
  border-color: rgba(255, 255, 255, 0.28);
  color: #fff;
}

.ai-chat--cinematic .ai-chat-input:focus {
  border-color: rgba(171, 211, 255, 0.52);
  box-shadow: 0 0 0 3px rgba(121, 184, 255, 0.1);
}

@media (min-width: 1025px) {
  .ai-chat--desktop-rail .ai-chat-toggle {
    display: none;
  }

  .ai-chat--desktop-rail .ai-chat-panel {
    bottom: 0;
  }
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

.ai-chat-context {
  overflow: hidden;
  border-bottom: 1px solid var(--border-light);
  padding: 9px 18px;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  padding: 10px 18px 0;
  color: var(--text-muted);
  font-size: 10px;
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

  .ai-chat--cinematic .ai-chat-toggle {
    width: auto;
    min-width: 118px;
    height: 44px;
    padding: 0 16px;
  }

  .ai-chat-form {
    align-items: stretch;
    flex-direction: column;
  }

  .ai-send-button {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ai-chat-toggle,
  .ai-icon-button,
  .ai-prompt,
  .ai-chat-input,
  .ai-send-button {
    transition: none;
  }

  .ai-chat-toggle:hover {
    transform: none;
  }
}
</style>
