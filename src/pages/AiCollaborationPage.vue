<script setup lang="ts">
import { onMounted } from 'vue'
import { aiStageLabels, getArticlesBySlugs, siteAiCases, siteKnowledge } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

function askAiCase(title: string, summary: string) {
  window.dispatchEvent(new CustomEvent('ai-chat:ask', { detail: { prompt: `请解释 ${title} 的真实流程、xiuqiu 本人的职责、已有证据、当前限制和下一里程碑。`, context: { type: 'ai', title, summary } } }))
}

onMounted(() => setSeoMeta({ title: 'AI 协作｜xiuqiu 工程工作流', description: 'AI Coding 协作、Obsidian 知识系统与研究自动化三个可验证案例。', path: '/ai' }))
</script>

<template>
  <section class="section page-top ai-collaboration-page">
    <div class="container">
      <header class="ai-page-hero">
        <p class="section-label">AI Collaboration Portfolio</p>
        <h1>AI 协作，不止于生成</h1>
        <p>{{ siteKnowledge.owner.summary }}</p>
        <div class="ai-principle-strip"><span>目标由我定义</span><span>事实由代码与来源支撑</span><span>最终结果由我验收</span></div>
      </header>

      <nav class="ai-case-nav" aria-label="AI collaboration cases">
        <a v-for="item in siteAiCases" :key="item.id" :href="`#${item.slug}`"><span>0{{ item.id }}</span>{{ item.title }}</a>
      </nav>

      <article v-for="item in siteAiCases" :id="item.slug" :key="item.id" class="ai-case-detail">
        <header><div><p class="section-label">Case 0{{ item.id }} · {{ aiStageLabels[item.stage] }}</p><h2>{{ item.title }}</h2><p>{{ item.summary }}</p></div><button class="btn btn-secondary" type="button" @click="askAiCase(item.title, item.summary)">请 AI 解释这个案例</button></header>
        <div class="ai-case-current"><span>当前重点</span><p>{{ item.currentFocus }}</p></div>
        <div class="ai-flow" aria-label="Workflow"><template v-for="(step, index) in item.flow" :key="step"><div><span>{{ index + 1 }}</span><p>{{ step }}</p></div><b v-if="index < item.flow.length - 1">&rarr;</b></template></div>
        <div class="ai-case-columns">
          <section><p class="project-abilities-title">我的职责</p><ul class="learning-list"><li v-for="value in item.responsibilities" :key="value">{{ value }}</li></ul></section>
          <section><p class="project-abilities-title">已有证据</p><ul class="learning-list"><li v-for="value in item.evidence" :key="value">{{ value }}</li></ul></section>
          <section><p class="project-abilities-title">失败处理</p><ul class="learning-list"><li v-for="value in item.failureHandling" :key="value">{{ value }}</li></ul></section>
        </div>
        <div class="ai-target-grid">
          <section><p class="project-abilities-title">目标完成形态</p><p>{{ item.targetOutcome }}</p></section>
          <section><p class="project-abilities-title">下一里程碑</p><p>{{ item.nextMilestone }}</p></section>
          <section><p class="project-abilities-title">当前限制</p><ul><li v-for="value in item.knownLimits" :key="value">{{ value }}</li></ul></section>
        </div>
        <div class="ai-related-links"><p class="project-abilities-title">相关公开复盘</p><router-link v-for="article in getArticlesBySlugs(item.relatedArticleSlugs)" :key="article.slug" :to="`/articles/${article.slug}`">{{ article.title }} &rarr;</router-link></div>
      </article>
    </div>
  </section>
</template>
