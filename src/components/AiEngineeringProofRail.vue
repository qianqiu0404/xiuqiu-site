<script setup lang="ts">
import { computed, useId } from 'vue'
import type {
  HomeAiProofContext,
  HomeAiProofStatus,
} from '../data/homePresentation'

const props = withDefaults(defineProps<{
  context: HomeAiProofContext
  compact?: boolean
}>(), {
  compact: false,
})

const contextView = computed(() => props.context)
const titleId = `ai-proof-title-${useId()}`

const statusLabels: Record<HomeAiProofStatus, string> = {
  scoped: '范围已冻结',
  implemented: '已实现',
  reviewed: '已审查',
  verified: '已验证',
  'human-gate': '人工决定',
  pending: '待验证',
}

function readableStatus(status: HomeAiProofStatus) {
  return statusLabels[status]
}

function askAi(event: MouseEvent) {
  const context = contextView.value

  window.dispatchEvent(new CustomEvent('ai-chat:ask', {
    detail: {
      prompt: context.assistantPrompt,
      context: {
        type: 'home',
        title: context.title,
        slug: `home-${context.id}`,
        summary: context.summary,
      },
      opener: event.currentTarget,
    },
  }))
}
</script>

<template>
  <aside
    class="ai-proof-rail"
    :class="{ 'ai-proof-rail--compact': compact }"
    :aria-labelledby="titleId"
  >
    <header class="ai-proof-header">
      <p class="ai-proof-kicker">AI Engineering Proof</p>
      <p class="ai-proof-context-label">{{ contextView.label }}</p>
      <h2 :id="titleId">{{ contextView.title }}</h2>
      <p class="ai-proof-summary">{{ contextView.summary }}</p>
    </header>

    <ol class="ai-proof-steps" aria-label="AI 工程证据步骤">
      <li
        v-for="(step, index) in contextView.steps"
        :key="`${contextView.id}-${step.label}`"
        :class="{ 'is-active': index === contextView.steps.length - 1 }"
        :aria-current="index === contextView.steps.length - 1 ? 'step' : undefined"
      >
        <span class="ai-proof-index" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
        <div>
          <div class="ai-proof-step-heading">
            <h3>{{ step.label }}</h3>
            <span class="ai-proof-status">{{ readableStatus(step.status) }}</span>
          </div>
          <p>{{ step.detail }}</p>
        </div>
      </li>
    </ol>

    <div class="ai-proof-boundary">
      <span>当前边界</span>
      <p>{{ contextView.boundary }}</p>
    </div>

    <footer class="ai-proof-actions">
      <a
        v-if="contextView.evidence.destination.kind === 'external'"
        class="ai-proof-evidence"
        :href="contextView.evidence.destination.href"
        target="_blank"
        rel="noopener"
        :aria-label="`${contextView.evidence.label}（在新窗口打开）`"
      >
        {{ contextView.evidence.label }} <span aria-hidden="true">↗</span>
      </a>
      <router-link
        v-else
        class="ai-proof-evidence"
        :to="contextView.evidence.destination.to"
      >
        {{ contextView.evidence.label }} <span aria-hidden="true">→</span>
      </router-link>

      <button class="ai-proof-ask" type="button" @click="askAi">
        Ask xiuqiu AI <span aria-hidden="true">↗</span>
      </button>
    </footer>
  </aside>
</template>

<style scoped>
.ai-proof-rail {
  --proof-border: rgba(255, 255, 255, 0.14);
  --proof-muted: rgba(242, 246, 255, 0.66);
  --proof-soft: rgba(242, 246, 255, 0.82);
  position: relative;
  display: flex;
  max-height: 100%;
  flex-direction: column;
  overflow: hidden;
  width: 100%;
  border: 1px solid var(--proof-border);
  border-radius: 28px;
  background:
    radial-gradient(circle at 86% -5%, rgba(166, 207, 255, 0.2), transparent 34%),
    linear-gradient(155deg, rgba(21, 25, 34, 0.96), rgba(5, 7, 12, 0.94));
  box-shadow: 0 28px 72px rgba(0, 0, 0, 0.24), inset 0 1px rgba(255, 255, 255, 0.08);
  color: #f7f9fd;
  padding: 24px;
  isolation: isolate;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.ai-proof-rail::before {
  position: absolute;
  z-index: -1;
  top: 0;
  right: 18%;
  left: 18%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(210, 231, 255, 0.84), transparent);
  content: '';
}

.ai-proof-kicker,
.ai-proof-context-label,
.ai-proof-index,
.ai-proof-status,
.ai-proof-boundary > span {
  font-family: var(--mono);
  letter-spacing: 0.065em;
  text-transform: uppercase;
}

.ai-proof-kicker {
  color: rgba(219, 235, 255, 0.92);
  font-size: 10px;
  font-weight: 700;
}

.ai-proof-context-label {
  margin-top: 24px;
  color: var(--proof-muted);
  font-size: 9px;
  font-weight: 650;
}

.ai-proof-header h2 {
  margin-top: 7px;
  color: #fff;
  font-size: clamp(22px, 2vw, 28px);
  letter-spacing: -0.035em;
  line-height: 1.12;
}

.ai-proof-summary {
  margin-top: 11px;
  color: var(--proof-soft);
  font-size: 12px;
  line-height: 1.65;
}

.ai-proof-steps {
  display: grid;
  min-height: 0;
  flex: 1 1 auto;
  gap: 0;
  margin-top: 24px;
  overflow-y: auto;
  padding: 0 4px 0 0;
  scrollbar-color: rgba(207, 226, 250, 0.28) transparent;
  scrollbar-width: thin;
  list-style: none;
}

.ai-proof-steps::-webkit-scrollbar {
  width: 4px;
}

.ai-proof-steps::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(207, 226, 250, 0.28);
}

.ai-proof-steps li {
  position: relative;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 11px;
  border-top: 1px solid rgba(255, 255, 255, 0.09);
  padding: 14px 0;
}

.ai-proof-steps li::after {
  position: absolute;
  top: 20px;
  left: 12px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(206, 226, 250, 0.44);
  box-shadow: 0 0 0 3px rgba(206, 226, 250, 0.06);
  content: '';
}

.ai-proof-steps li.is-active::after {
  background: #fff;
  box-shadow: 0 0 0 4px rgba(181, 217, 255, 0.16), 0 0 18px rgba(181, 217, 255, 0.62);
}

.ai-proof-index {
  color: rgba(228, 239, 252, 0.46);
  font-size: 8px;
  line-height: 1.5;
}

.ai-proof-step-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.ai-proof-step-heading h3 {
  color: #fff;
  font-size: 12px;
  font-weight: 650;
  letter-spacing: -0.01em;
  line-height: 1.4;
}

.ai-proof-status {
  flex: 0 0 auto;
  color: rgba(196, 222, 252, 0.72);
  font-size: 8px;
  font-weight: 650;
}

.ai-proof-steps li > div > p {
  margin-top: 5px;
  color: var(--proof-muted);
  font-size: 10px;
  line-height: 1.55;
}

.ai-proof-boundary {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.045);
  padding: 13px 14px;
}

.ai-proof-boundary > span {
  color: rgba(204, 226, 251, 0.7);
  font-size: 8px;
  font-weight: 700;
}

.ai-proof-boundary p {
  margin-top: 5px;
  color: var(--proof-soft);
  font-size: 10px;
  line-height: 1.55;
}

.ai-proof-actions {
  display: grid;
  gap: 9px;
  margin-top: 14px;
}

.ai-proof-evidence,
.ai-proof-ask {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  border-radius: 999px;
  padding: 0 15px;
  font: 650 11px/1.3 var(--font);
  transition: border-color 180ms ease, background 180ms ease, color 180ms ease, transform 180ms ease;
}

.ai-proof-evidence {
  border: 1px solid rgba(255, 255, 255, 0.13);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(239, 246, 255, 0.84);
  text-decoration: none;
}

.ai-proof-ask {
  border: 1px solid rgba(218, 235, 255, 0.25);
  background: rgba(247, 250, 255, 0.94);
  color: #10131a;
  cursor: pointer;
}

.ai-proof-evidence:hover,
.ai-proof-ask:hover {
  transform: translateY(-1px);
}

.ai-proof-evidence:hover {
  border-color: rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.075);
  color: #fff;
}

.ai-proof-ask:hover {
  background: #fff;
}

.ai-proof-evidence:focus-visible,
.ai-proof-ask:focus-visible {
  outline: 3px solid rgba(191, 222, 255, 0.52);
  outline-offset: 3px;
}

.ai-proof-rail--compact {
  border-radius: 22px;
  padding: 20px;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.ai-proof-rail--compact .ai-proof-steps {
  margin-top: 20px;
}

.ai-proof-rail--compact .ai-proof-steps li {
  grid-template-columns: 26px minmax(0, 1fr);
  padding: 13px 0;
}

.ai-proof-rail--compact .ai-proof-step-heading {
  align-items: flex-start;
  flex-direction: column;
  gap: 3px;
}

.ai-proof-rail--compact .ai-proof-summary,
.ai-proof-rail--compact .ai-proof-steps li > div > p,
.ai-proof-rail--compact .ai-proof-boundary p {
  font-size: 12px;
}

@media (prefers-reduced-motion: reduce) {
  .ai-proof-evidence,
  .ai-proof-ask {
    transition: none;
  }

  .ai-proof-evidence:hover,
  .ai-proof-ask:hover {
    transform: none;
  }
}

@media (min-width: 1025px) and (max-height: 780px) {
  .ai-proof-rail:not(.ai-proof-rail--compact) {
    padding: 20px;
  }

  .ai-proof-rail:not(.ai-proof-rail--compact) .ai-proof-context-label {
    margin-top: 14px;
  }

  .ai-proof-rail:not(.ai-proof-rail--compact) .ai-proof-header h2 {
    font-size: 21px;
  }

  .ai-proof-rail:not(.ai-proof-rail--compact) .ai-proof-summary {
    font-size: 11px;
  }

  .ai-proof-rail:not(.ai-proof-rail--compact) .ai-proof-steps {
    margin-top: 16px;
  }

  .ai-proof-rail:not(.ai-proof-rail--compact) .ai-proof-steps li {
    padding: 10px 0;
  }

  .ai-proof-rail:not(.ai-proof-rail--compact) .ai-proof-steps li::after {
    top: 16px;
  }
}
</style>
