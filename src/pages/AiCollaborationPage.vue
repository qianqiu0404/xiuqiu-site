<script setup lang="ts">
import { onMounted } from 'vue'
import { aiStageLabels, getArticlesBySlugs, siteAiCases } from '../data/siteKnowledge'
import { deliveryRecords } from '../data/generatedDeliveries'
import { setSeoMeta } from '../utils/seo'

function loopNumber(order: number) {
  return String(order).padStart(2, '0')
}

function toggleDetailsFromKeyboard(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ') return

  event.preventDefault()
  const details = (event.currentTarget as HTMLElement).closest('details')
  if (details instanceof HTMLDetailsElement) details.open = !details.open
}

onMounted(() => setSeoMeta({ title: 'AI 工作流｜xiuqiu', description: 'AI Coding、跨设备 Skill、社交研究、每日发布与 Obsidian 知识治理五个真实 Loop。', path: '/ai' }))
</script>

<template>
  <section class="section page-top ai-collaboration-page">
    <div class="container">
      <header class="ai-page-hero">
        <p class="section-label">AI Workflows</p>
        <h1>AI 如何进入我的工作流</h1>
        <p>五个真实 Loop 连接工程协作、Skill 复用、社交研究、研究发布与知识治理。我负责目标、来源边界和最终验收，外部模型、工具与第三方 Skill 保留各自归属。</p>
        <div class="ai-principle-strip"><span>目标由我定义</span><span>来源明确</span><span>证据可复核</span><span>失败可回流</span></div>
      </header>

      <nav class="ai-case-nav" aria-label="AI workflow loops">
        <a v-for="item in siteAiCases" :key="item.id" :href="`#${item.slug}`"><span>{{ loopNumber(item.displayOrder) }}</span><strong>{{ item.title }}</strong></a>
      </nav>

      <section class="ai-delivery-preview">
        <header><div><p class="section-label">Real Deliveries</p><h2>协作方法最终要回到真实交付</h2><p>记录 AI 参与、人工判断、审查发现、纠正动作和公开证据，不展示抽象等级。</p></div><router-link to="/ai/deliveries">查看全部交付 &rarr;</router-link></header>
        <div><router-link v-for="item in deliveryRecords.slice(0, 3)" :key="item.slug" :to="`/ai/deliveries/${item.slug}`"><div class="card-status-row"><time>{{ item.date }}</time><strong>{{ item.status === 'delivered' ? '已交付' : item.status === 'partial' ? '部分完成' : '进行中' }}</strong></div><h3>{{ item.title }}</h3><p>{{ item.summary }}</p><small>{{ item.evidenceSlugs.length }} 项证据 · {{ item.publicLinks.length }} 个公开链接</small></router-link></div>
      </section>

      <article v-for="item in siteAiCases" :id="item.slug" :key="item.id" class="ai-case-detail">
        <header><div><p class="section-label">Loop {{ loopNumber(item.displayOrder) }} · {{ aiStageLabels[item.stage] }}</p><h2>{{ item.title }}<small v-if="item.slug === 'cross-device-skill-toolchain'">SkillOps Loop</small></h2><p>{{ item.summary }}</p></div><router-link v-if="item.slug === 'social-media-research'" class="btn btn-secondary" to="/ai/social-research">查看交互展示</router-link></header>
        <div class="ai-ownership-note"><span>来源与归属</span><p>{{ item.ownershipNote }}</p></div>
        <div class="ai-case-current"><span>当前重点</span><p>{{ item.currentFocus }}</p></div>
        <div class="ai-flow" aria-label="Workflow"><template v-for="(step, index) in item.flow" :key="step"><div><span>{{ index + 1 }}</span><p>{{ step }}</p></div><b v-if="index < item.flow.length - 1">&rarr;</b></template></div>
        <div class="ai-loop-core-grid">
          <section><p class="project-abilities-title">我的职责</p><ul class="learning-list"><li v-for="value in item.responsibilities" :key="value">{{ value }}</li></ul></section>
          <section><p class="project-abilities-title">已有证据</p><ul class="learning-list"><li v-for="value in item.evidence" :key="value">{{ value }}</li></ul></section>
          <section><p class="project-abilities-title">下一里程碑</p><p>{{ item.nextMilestone }}</p></section>
        </div>
        <details class="ai-loop-details">
          <summary @keydown="toggleDetailsFromKeyboard">查看目标态、失败处理与当前限制 <span>&darr;</span></summary>
          <div class="ai-loop-details-grid">
            <section><p class="project-abilities-title">目标完成形态</p><p>{{ item.targetOutcome }}</p></section>
            <section><p class="project-abilities-title">失败处理</p><ul class="learning-list"><li v-for="value in item.failureHandling" :key="value">{{ value }}</li></ul></section>
            <section><p class="project-abilities-title">当前限制</p><ul class="learning-list"><li v-for="value in item.knownLimits" :key="value">{{ value }}</li></ul></section>
          </div>
          <div class="ai-related-links"><p class="project-abilities-title">相关公开复盘</p><router-link v-for="article in getArticlesBySlugs(item.relatedArticleSlugs)" :key="article.slug" :to="`/articles/${article.slug}`">{{ article.title }} &rarr;</router-link></div>
        </details>
      </article>
    </div>
  </section>
</template>
