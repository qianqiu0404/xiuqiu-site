<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  role: ChatRole
  content: string
}

const isOpen = ref(false)
const input = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const messageList = ref<HTMLElement | null>(null)
const messages = ref<ChatMessage[]>([
  {
    role: 'assistant',
    content: '你好，我可以帮你快速了解 xiuqiu 的项目、文章和 Web3 钱包后端方向。',
  },
])

const quickPrompts = [
  '介绍一下 xiuqiu 的 Web3 钱包项目',
  'wallet-api 和 wallet-sign 的边界是什么？',
  '哪些文章适合了解后端 API 和 gRPC？',
]

const canSend = computed(() => input.value.trim().length > 0 && !isLoading.value)

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
      }),
    })

    const responseText = await response.text()
    let payload: { answer?: unknown; error?: string } = {}

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
    })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '暂时无法连接 AI 服务，请稍后再试。'
    messages.value.push({
      role: 'assistant',
      content: '抱歉，AI 服务暂时不可用。你可以稍后再试，或直接通过 GitHub / Email 联系 xiuqiu。',
    })
  } finally {
    isLoading.value = false
    await scrollToBottom()
  }
}

async function scrollToBottom() {
  await nextTick()
  if (messageList.value) {
    messageList.value.scrollTop = messageList.value.scrollHeight
  }
}
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
        </article>
        <article v-if="isLoading" class="ai-message ai-message-assistant ai-message-loading">
          Thinking...
        </article>
      </div>

      <div class="ai-chat-prompts" aria-label="Suggested questions">
        <button
          v-for="prompt in quickPrompts"
          :key="prompt"
          class="ai-prompt"
          type="button"
          :disabled="isLoading"
          @click="sendQuickPrompt(prompt)"
        >
          {{ prompt }}
        </button>
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

.ai-chat-prompts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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
    right: 16px;
    bottom: 16px;
    left: 16px;
    display: flex;
    justify-content: flex-end;
    pointer-events: none;
  }

  .ai-chat > * {
    pointer-events: auto;
  }

  .ai-chat-panel {
    right: 0;
    bottom: 64px;
    left: 0;
    width: 100%;
    max-height: calc(100vh - 112px);
    border-radius: 18px;
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
