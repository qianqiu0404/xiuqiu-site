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
  type: 'home' | 'now' | 'engineering' | 'engineering-failures' | 'engineering-evidence' | 'ai' | 'ai-deliveries' | 'ai-delivery' | 'learning' | 'articles' | 'article' | 'project' | 'radar' | 'radar-detail'
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
const messages = ref<ChatMessage[]>([
  {
    role: 'assistant',
    content: '你好，我可以基于网站中经过整理的工程证据，帮你了解 xiuqiu 正在做什么、已经验证了什么，以及目标完成形态是什么。',
  },
])

const promptGroups = [
  {
    label: 'Projects',
    prompts: [
      '介绍一下 xiuqiu 的 Web3 钱包项目',
      'wallet-api 和 wallet-sign 的边界是什么？',
      'wallet-core 展示了哪些 TypeScript 多链能力？',
    ],
  },
  {
    label: 'AI Collaboration',
    prompts: [
      'xiuqiu 如何使用 AI 协作完成工程任务？',
      '跨设备 Skill 工具链如何区分个人与第三方能力？',
      'Obsidian 知识系统如何避免公开私人内容？',
      '研究自动化如何处理来源、去重和失败？',
    ],
  },
  {
    label: 'Writing',
    prompts: [
      '哪些文章适合了解后端 API 和 gRPC？',
      '给我一条学习多链钱包后端的阅读路径',
      '推荐几篇理解 EVM 工程的文章',
    ],
  },
  {
    label: 'Learning Path',
    prompts: [
      '如何快速了解 xiuqiu 当前在做的工程？',
      '从钱包架构到签名服务应该按什么顺序学习？',
      '请概括这个网站的工程主线',
    ],
  },
]

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
      summary: 'AI Coding、跨设备 Skill 工具链、每日研究发布与 Obsidian 知识治理四个真实 Loop。',
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
      summary: '从公开允许的 Obsidian 研究区块自动汇总，并保留来源、缺失状态、关联项目和后续行动。',
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
  isOpen.value = !isOpen.value
  errorMessage.value = ''

  if (isOpen.value) {
    void scrollToBottom()
  }
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

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messages.value.slice(-6),
        pageContext: currentPageContext.value,
      }),
    })

    const responseText = await response.text()
    let payload: { answer?: unknown; error?: string; references?: unknown } = {}

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
    errorMessage.value = error instanceof Error ? error.message : '暂时无法连接 AI 服务，请稍后再试。'
    messages.value.push({
      role: 'assistant',
      content: '抱歉，AI 服务暂时不可用。你可以稍后再试，或直接通过 Email 联系 xiuqiu。',
    })
  } finally {
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
  window.removeEventListener('ai-chat:ask', handleAskAi)
})
</script>

<template>
  <div class="ai-chat">
    <section v-if="isOpen" class="ai-chat-panel" aria-label="AI chat assistant">
      <header class="ai-chat-header">
        <div>
          <p class="ai-chat-kicker">DeepSeek AI</p>
          <h2 class="ai-chat-title">Ask about xiuqiu</h2>
        </div>
        <button class="ai-icon-button" type="button" aria-label="Close chat" @click="toggleChat">
          ×
        </button>
      </header>

      <div ref="messageList" class="ai-chat-messages" aria-live="polite">
        <article
          v-for="(message, index) in messages"
          :key="index"
          class="ai-message"
          :class="'ai-message-' + message.role"
        >
          {{ message.content }}
          <div v-if="message.references?.length" class="ai-references">
            <p class="ai-references-title">Related on this site</p>
            <a
              v-for="reference in message.references"
              :key="reference.type + reference.href + reference.title"
              class="ai-reference"
              :href="reference.href"
            >
              <span>{{ reference.title }}</span>
              <small>{{ reference.type }}</small>
            </a>
          </div>
        </article>
        <article v-if="isLoading" class="ai-message ai-message-assistant ai-message-loading">
          Thinking...
        </article>
      </div>

      <div class="ai-chat-prompts" aria-label="Suggested questions">
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

      <form class="ai-chat-form" @submit.prevent="sendMessage">
        <textarea
          v-model="input"
          class="ai-chat-input"
          rows="2"
          maxlength="1000"
          placeholder="Ask about projects, writing, wallet backend..."
          aria-label="Ask a question"
          @keydown.enter.exact.prevent="sendMessage"
        ></textarea>
        <button class="ai-send-button" type="submit" :disabled="!canSend">
          Send
        </button>
      </form>
    </section>

    <button
      class="ai-chat-toggle"
      type="button"
      :aria-expanded="isOpen"
      aria-label="Open AI chat"
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
