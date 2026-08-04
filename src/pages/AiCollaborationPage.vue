<script setup lang="ts">
import { onMounted } from 'vue'
import '../styles/cinematic-pages.css'
import { aiStageLabels, getArticlesBySlugs, siteAiCases } from '../data/siteKnowledge'
import { deliveryRecords } from '../data/generatedDeliveries'
import { setSeoMeta } from '../utils/seo'

const aiMethod = [
  {
    step: '01',
    title: '定义问题与边界',
    description: '先明确目标、允许使用的来源、权限边界和完成标准，避免把生成内容当作结论。',
  },
  {
    step: '02',
    title: '实现并记录假设',
    description: '让 AI 加速检索、拆解、代码和文档工作，同时保留关键假设与待验证项。',
  },
  {
    step: '03',
    title: '审查与运行验证',
    description: '人工检查差异、代码和来源，再用测试、构建、浏览器或链接检查验证实际结果。',
  },
  {
    step: '04',
    title: '沉淀证据并回流',
    description: '记录结果、限制、失败和下一步，让交付证据回到项目与知识系统。',
  },
] as const

const auditableResults = [...deliveryRecords]
  .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'zh-CN'))

function loopNumber(order: number) {
  return String(order).padStart(2, '0')
}

function askAi(event: MouseEvent) {
  window.dispatchEvent(new CustomEvent('ai-chat:ask', {
    detail: {
      prompt: '说明 xiuqiu 如何使用 AI 参与工程，并用哪些交付证据证明它没有替代人工判断。',
      context: {
        type: 'ai',
        title: 'xiuqiu · AI Engineering OS',
        slug: 'ai-engineering-os',
        summary: '从问题边界、实现、审查、验证到知识回流的 AI 工程协作系统。',
      },
      opener: event.currentTarget,
    },
  }))
}

onMounted(() => setSeoMeta({
  title: 'AI 工作流｜xiuqiu',
  description: 'AI Coding、跨设备 Skill、社交研究、每日发布与 Obsidian 知识治理五个真实 Loop。',
  path: '/ai',
}))
</script>

<template>
  <section class="ai-collaboration-page ai-os-page cinematic-page">
    <header class="ai-page-hero cinematic-page-hero">
      <div class="container ai-page-hero-layout">
        <div class="ai-page-hero-copy">
          <p class="cinematic-page-kicker">AI Engineering OS / Human-Gated</p>
          <h1>AI 加速工程，<span>但不代替验证。</span></h1>
          <p>AI 参与需求拆解、实现、审查辅助、测试准备、文档和知识治理；我负责目标、来源边界、关键判断与最终验收，外部模型、工具与第三方 Skill 保留各自归属。</p>
          <div class="ai-principle-strip"><span>目标由我定义</span><span>来源明确</span><span>证据可复核</span><span>失败可回流</span></div>
          <div class="cinematic-page-actions">
            <router-link class="cinematic-page-button cinematic-page-button--primary" to="/ai/deliveries">查看真实交付</router-link>
            <button class="cinematic-page-button cinematic-page-button--quiet" type="button" @click="askAi">Ask xiuqiu AI</button>
          </div>
        </div>

        <div class="ai-os-object" role="img" aria-label="人工门禁控制的 AI 工程执行内核">
          <span class="ai-os-orbit ai-os-orbit--outer"></span>
          <span class="ai-os-orbit ai-os-orbit--inner"></span>
          <div class="ai-os-core"><small>Human Gate</small><strong>AI OS</strong><span>Evidence First</span></div>
          <span class="ai-os-node ai-os-node--context">Context</span>
          <span class="ai-os-node ai-os-node--review">Review</span>
          <span class="ai-os-node ai-os-node--evidence">Evidence</span>
        </div>
      </div>
    </header>

    <section class="ai-method ai-os-kernel" aria-labelledby="ai-method-title">
      <div class="container">
        <header class="cinematic-page-section-heading">
          <p class="cinematic-page-kicker">Scene 01 / Execution Kernel</p>
          <h2 id="ai-method-title">从问题到证据的执行内核</h2>
          <p>AI 进入每一个关键工作环节，但决策权和验收权始终留在人工门禁。</p>
        </header>
        <ol class="ai-method-grid">
          <li v-for="item in aiMethod" :key="item.step">
            <span>{{ item.step }}</span>
            <h3>{{ item.title }}</h3>
            <p>{{ item.description }}</p>
          </li>
        </ol>
      </div>
    </section>

    <section class="ai-delivery-preview ai-run-ledger" aria-labelledby="ai-delivery-title">
      <div class="container">
        <header class="ai-run-ledger-heading">
          <div>
            <p class="ai-lab-index">PROOF LAB / RUN LEDGER</p>
            <h2 id="ai-delivery-title">真实交付，不展示抽象 AI 等级</h2>
            <p>每条记录分开呈现 AI 参与、人工判断、审查发现、纠正动作和最终证据。</p>
          </div>
          <router-link to="/ai/deliveries">查看完整交付账本 &rarr;</router-link>
        </header>
        <div class="ai-run-list">
          <router-link v-for="(item, index) in auditableResults" :key="item.slug" :to="`/ai/deliveries/${item.slug}`">
            <span class="ai-run-index">RUN {{ String(index + 1).padStart(2, '0') }}</span>
            <div>
              <div class="card-status-row"><time>{{ item.date }}</time><strong :data-status="item.status">{{ item.status === 'delivered' ? '已交付' : item.status === 'partial' ? '部分完成' : '进行中' }}</strong></div>
              <h3>{{ item.title }}</h3>
              <p>{{ item.summary }}</p>
            </div>
            <small>{{ item.evidenceSlugs.length }} 项证据<br>{{ item.publicLinks.length }} 个公开链接</small>
            <b aria-hidden="true">↗</b>
          </router-link>
        </div>
      </div>
    </section>

    <section class="ai-case-collection ai-module-registry" aria-labelledby="ai-cases-title">
      <div class="container">
        <header class="cinematic-page-section-heading">
          <p class="cinematic-page-kicker">Scene 02 / Module Registry</p>
          <h2 id="ai-cases-title">五个真实协作 Loop</h2>
          <p>默认收起长案例；展开后查看职责、流程、证据、失败处理与当前限制。</p>
        </header>

        <nav class="ai-case-nav" aria-label="AI workflow loops">
          <a v-for="item in siteAiCases" :key="item.id" :href="`#${item.slug}`"><span>{{ loopNumber(item.displayOrder) }}</span><strong>{{ item.title }}</strong></a>
        </nav>

        <div class="ai-module-list">
          <details v-for="item in siteAiCases" :id="item.slug" :key="item.id" class="ai-case-detail ai-case-compact">
            <summary>
              <span class="ai-case-number">Module {{ loopNumber(item.displayOrder) }}</span>
              <div>
                <p>{{ aiStageLabels[item.stage] }}</p>
                <h3>{{ item.title }}<small v-if="item.slug === 'cross-device-skill-toolchain'">SkillOps Loop</small></h3>
                <span>{{ item.summary }}</span>
              </div>
              <b aria-hidden="true"></b>
            </summary>
            <div class="ai-case-expanded">
              <router-link v-if="item.slug === 'social-media-research'" class="cinematic-page-button cinematic-page-button--quiet ai-case-action" to="/ai/social-research">查看交互展示</router-link>
              <div class="ai-ownership-note"><span>来源与归属</span><p>{{ item.ownershipNote }}</p></div>
              <div class="ai-case-current"><span>当前重点</span><p>{{ item.currentFocus }}</p></div>
              <div class="ai-flow" aria-label="Workflow"><template v-for="(step, index) in item.flow" :key="step"><div><span>{{ index + 1 }}</span><p>{{ step }}</p></div><b v-if="index < item.flow.length - 1">&rarr;</b></template></div>
              <div class="ai-loop-core-grid">
                <section><p class="project-abilities-title">我的职责</p><ul class="learning-list"><li v-for="value in item.responsibilities" :key="value">{{ value }}</li></ul></section>
                <section><p class="project-abilities-title">已有证据</p><ul class="learning-list"><li v-for="value in item.evidence" :key="value">{{ value }}</li></ul></section>
                <section><p class="project-abilities-title">下一里程碑</p><p>{{ item.nextMilestone }}</p></section>
              </div>
              <div class="ai-loop-details-grid">
                <section><p class="project-abilities-title">目标完成形态</p><p>{{ item.targetOutcome }}</p></section>
                <section><p class="project-abilities-title">失败处理</p><ul class="learning-list"><li v-for="value in item.failureHandling" :key="value">{{ value }}</li></ul></section>
                <section><p class="project-abilities-title">当前限制</p><ul class="learning-list"><li v-for="value in item.knownLimits" :key="value">{{ value }}</li></ul></section>
              </div>
              <div class="ai-related-links"><p class="project-abilities-title">相关公开复盘</p><router-link v-for="article in getArticlesBySlugs(item.relatedArticleSlugs)" :key="article.slug" :to="`/articles/${article.slug}`">{{ article.title }} &rarr;</router-link></div>
            </div>
          </details>
        </div>
      </div>
    </section>
  </section>
</template>
