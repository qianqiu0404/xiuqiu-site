<script setup lang="ts">
import { onMounted } from 'vue'
import { aboutEvidenceRows, aboutReadingLinks, githubProfileUrl, githubRepositoriesUrl, homeAiWorkflow, homeSeo, projects, evidenceRecords, deliveryRecords } from '../data'
import { setSeoMeta } from '../../../utils/seo'
import '../../../design/brief.css'
import '../../../design/collections.css'

const proofs = aboutEvidenceRows(evidenceRecords, deliveryRecords)
const currentProduct = projects.find(project => project.publicRole === 'current-product')
const currentDirection = projects.find(project => project.publicRole === 'current-direction')
function askAi() {
  window.dispatchEvent(new CustomEvent('ai-chat:ask', { detail: {
    prompt: 'AI 如何参与 Qiu Market、钱包工程实验与证据审查？',
    context: { type: 'home', title: 'xiuqiu · Qiu Market × Wallet Infrastructure × AI Engineering', slug: 'home-ai', summary: '一个 Web3 产品、钱包基础设施学习方向与一套 AI-native 工程工作流的公开证据。' },
  } }))
}
onMounted(() => setSeoMeta({ ...homeSeo, path: '/about' }))
</script>

<template>
  <div id="overview" class="brief" lang="zh-CN">
    <header class="brief-masthead">
      <div class="brief-shell">
        <p class="brief-dateline"><span>关于 xiuqiu</span><span>Web3 · AI · 工程记录</span></p>
        <h1>在实践里学习，把过程留下来。</h1>
        <p class="brief-lede">我在维护 Qiu Market，也在学习钱包基础设施与 AI 工程。这个站点用来整理读到的资料、做过的尝试，以及能回头核对的证据。</p>
      </div>
    </header>

    <div class="brief-shell brief-layout">
      <div>
        <section id="products" class="collection-section" aria-labelledby="about-current-title">
          <header class="collection-heading"><h2 id="about-current-title">目前在做什么</h2><span>产品与学习方向</span></header>
          <article v-if="currentProduct" class="collection-row">
            <div class="collection-meta"><span class="collection-tag collection-tag--market">当前产品</span><span>Qiu Market</span></div>
            <h3><router-link :to="`/projects/${currentProduct.slug}`">{{ currentProduct.name }}</router-link></h3>
            <p>{{ currentProduct.engineering.overviewSummary }}</p>
            <div class="collection-footer"><router-link class="collection-link" :to="`/projects/${currentProduct.slug}`">项目与实现记录 →</router-link><a class="collection-link" href="https://qiu-market.vercel.app" target="_blank" rel="noopener">打开 Qiu Market ↗</a></div>
          </article>
          <article v-if="currentDirection" class="collection-row">
            <div class="collection-meta"><span class="collection-tag collection-tag--notes">当前学习方向</span><span>Wallet Infrastructure</span></div>
            <h3><router-link :to="`/projects/${currentDirection.slug}`">{{ currentDirection.name }}</router-link></h3>
            <p>{{ currentDirection.engineering.overviewSummary }}</p>
            <router-link class="collection-link" :to="`/projects/${currentDirection.slug}`">学习进展与边界 →</router-link>
          </article>
        </section>

        <section id="ai-engineering" class="collection-section" aria-labelledby="about-ai-title">
          <header class="collection-heading"><h2 id="about-ai-title">怎样与 AI 协作</h2><span>从问题到验证</span></header>
          <div class="collection-copy">
            <p>AI 参与上下文整理、计划、实现与审查；涉及事实、资金和最终放行的判断，由人核对。每次尝试尽量留下来源、测试结果和失败边界。</p>
            <div class="collection-workflow" aria-label="AI 工程工作流"><span v-for="(step, index) in homeAiWorkflow" :key="step"><b>{{ String(index + 1).padStart(2, '0') }}</b>{{ step }}</span></div>
            <div class="collection-footer"><router-link class="collection-link" to="/ai">查看 AI 工作流 →</router-link><button class="brief-button" type="button" @click="askAi">向站内 AI 提问 ↗</button></div>
          </div>
        </section>

        <section id="evidence" class="collection-section" aria-labelledby="about-proof-title">
          <header class="collection-heading"><h2 id="about-proof-title">可以核对的记录</h2><router-link class="collection-link" to="/engineering/evidence">全部证据 →</router-link></header>
          <ol class="collection-list">
            <li v-for="proof in proofs" :key="proof.id" class="collection-row">
              <div class="collection-meta"><span>{{ proof.label }}</span><span>记录于 <time :datetime="proof.date">{{ proof.date }}</time></span></div>
              <h3><router-link :to="proof.to">{{ proof.title }}</router-link></h3>
              <p>{{ proof.summary }}</p>
            </li>
          </ol>
          <p class="brief-note">公开工程作品包含本地与测试网验证。历史模拟和交付记录按原日期保留，不代表生产钱包或实盘交易经验。</p>
        </section>
      </div>

      <aside class="brief-aside" aria-label="站点与联系入口">
        <section class="brief-panel">
          <h2>从这里开始</h2>
          <ul><li v-for="link in aboutReadingLinks" :key="link.to"><router-link :to="link.to">{{ link.title }} <span>→</span></router-link><p class="brief-note">{{ link.description }}</p></li></ul>
        </section>
        <section class="brief-panel">
          <h2>公开代码与记录</h2>
          <p class="collection-panel-copy">项目页面连接实现、学习笔记和工程证据。状态以各条记录标注的日期与验证范围为准。</p>
          <a class="collection-link" :href="githubProfileUrl" target="_blank" rel="noopener">GitHub · qianqiu0404 ↗</a>
          <a class="collection-link" :href="githubRepositoriesUrl" target="_blank" rel="noopener">浏览公开仓库 ↗</a>
          <router-link class="collection-link" to="/engineering/failures">失败与恢复记录 →</router-link>
        </section>
      </aside>
    </div>
  </div>
</template>
