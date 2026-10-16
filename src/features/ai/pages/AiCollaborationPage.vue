<script setup lang="ts">
import { onMounted } from 'vue'
import '../../../styles/ai-evidence-os.css'
import '../../../design/brief.css'
import '../../../design/reader.css'
import '../../../design/product.css'
import '../../../design/ai.css'
import { aiAutomationRun, aiPublicDeliveries, aiReviewCases, aiSystemSurfaces, executionKernel, humanBoundaries } from '../data'
import { setSeoMeta } from '../../../utils/seo'

const latestDeliveries = aiPublicDeliveries
const aiModules = aiSystemSurfaces

onMounted(() => setSeoMeta({
  title: 'AI Engineering OS｜xiuqiu',
  description: 'AI 参与定义、执行、审查与验证；历史公开交付、人工门禁和工程证据共同决定可声明的结果。',
  path: '/ai',
}))
</script>

<template>
  <div class="brief ai-page" lang="zh-CN">
    <header class="brief-masthead">
      <div class="brief-shell">
        <p class="brief-dateline">
          <span>AI Engineering / Evidence OS</span>
          <span>HUMAN GATE ACTIVE</span>
        </p>
        <div class="product-hero">
          <div>
            <h1 id="ai-evidence-title">AI 不是侧边工具。<span>它是一套有证据门禁的工程系统。</span></h1>
            <p class="brief-lede">
              我让 AI 进入需求拆解、实现、审查、测试、发布和知识治理，但只有公开交付、可复核纠正与运行证据能改变工作状态。
            </p>
            <div class="product-actions">
              <router-link class="brief-button brief-button--primary" to="/ai/deliveries">查看公开交付 ↗</router-link>
              <a class="brief-button" href="#review-before-claim">查看 Review Gate</a>
            </div>
          </div>
          <dl class="product-status" aria-label="AI 工程系统当前状态">
            <div><dt>Public delivery</dt><dd>{{ latestDeliveries.length }} traces</dd></div>
            <div><dt>Review mode</dt><dd>Before claim</dd></div>
            <div><dt>Latest automation</dt><dd>Partial</dd></div>
            <div><dt>Tool boundary</dt><dd>Integration only</dd></div>
            <div class="ai-status-note"><dd>生成只是候选。没有来源、测试或运行证据，就不升级交付状态。</dd></div>
          </dl>
        </div>
      </div>
    </header>

    <div class="brief-shell product-body">
      <section class="reader-section" aria-labelledby="execution-kernel-title">
        <header class="reader-section-header"><span>01</span><h2 id="execution-kernel-title">先定义门，再运行模型。</h2><small>Execution Kernel</small></header>
        <ol class="ai-kernel">
          <li v-for="item in executionKernel" :key="item.step">
            <span>{{ item.step }}</span>
            <h3>{{ item.title }}</h3>
            <p>{{ item.description }}</p>
          </li>
        </ol>
      </section>

      <section class="reader-section" aria-labelledby="public-delivery-title">
        <header class="reader-section-header"><span>02</span><h2 id="public-delivery-title">不展示 prompt 数量，展示被验证的结果。</h2><small>Public Delivery Ledger</small></header>
        <p class="brief-note">这些是历史公开交付，不代表当前 Wallet Infrastructure 已实现；每条记录把 AI 参与、人工决定、测试证据和已知限制分开保存。</p>
        <ol class="brief-timeline">
          <li v-for="(item, index) in latestDeliveries" :key="item.delivery.slug" data-domain="ai">
            <router-link class="brief-card ai-delivery" :to="`/ai/deliveries/${item.delivery.slug}`" :aria-label="`查看 ${item.delivery.title} 交付记录`">
              <span class="brief-card-meta">
                <b class="brief-tag brief-tag--ai">TRACE {{ String(index + 1).padStart(2, '0') }}</b>
                <time :datetime="item.delivery.date">{{ item.delivery.date }}</time>
                <span>HISTORICAL EVIDENCE / PUBLIC / {{ item.delivery.status.toUpperCase() }}</span>
              </span>
              <strong class="brief-card-title">{{ item.delivery.title }}</strong>
              <span class="brief-card-summary">{{ item.delivery.summary }}</span>
              <span class="ai-delivery-proof">
                <span><b>Human decision</b>{{ item.delivery.humanDecisions[0] }}</span>
                <span><b>Verified evidence</b>{{ item.evidence.summary }}</span>
              </span>
            </router-link>
          </li>
        </ol>
      </section>

      <section id="review-before-claim" class="reader-section" aria-labelledby="review-before-claim-title">
        <header class="reader-section-header"><span>03</span><h2 id="review-before-claim-title">能力不在第一次生成，而在发现它错在哪里。</h2><small>Review Before Claim</small></header>
        <p class="brief-note">以下纠正来自现有交付记录，不是为了页面补写的假想案例。</p>
        <ol class="ai-reviews">
          <li v-for="(item, index) in aiReviewCases" :key="item.delivery.slug" class="reader-article">
            <p class="brief-card-meta"><span class="review-index">{{ String(index + 1).padStart(2, '0') }}</span><span>{{ item.label }}</span></p>
            <dl class="reader-answers">
              <div><dt>Finding</dt><dd>{{ item.finding }}</dd></div>
              <div><dt>Correction</dt><dd>{{ item.correction }}</dd></div>
            </dl>
            <a v-if="item.evidence.url" class="reader-source-link" :href="item.evidence.url" target="_blank" rel="noopener">{{ item.evidence.title }} ↗</a>
          </li>
        </ol>
      </section>

      <section class="reader-section" aria-labelledby="automation-run-title">
        <header class="reader-section-header"><span>04</span><h2 id="automation-run-title">{{ aiAutomationRun.title }}</h2><small>Operational Automation / {{ aiAutomationRun.date }}</small></header>
        <div class="product-proof">
          <div class="ai-run-intro">
            <p class="brief-fresh brief-fresh--stale">{{ aiAutomationRun.statusLabel }}</p>
            <p>{{ aiAutomationRun.summary }}</p>
            <p class="brief-note">{{ aiAutomationRun.boundary }}</p>
            <div class="reader-related">
              <a :href="aiAutomationRun.pullRequestUrl" target="_blank" rel="noopener">PR #49 ↗</a>
              <a :href="aiAutomationRun.productionUrl" target="_blank" rel="noopener">生产雷达 ↗</a>
            </div>
          </div>
          <ol class="brief-panel ai-run-trace">
            <li v-for="(stage, index) in aiAutomationRun.stages" :key="stage.label" :class="{ 'is-failed': stage.value === 'FAILED' }">
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <div><p>{{ stage.label }}</p><small>{{ stage.detail }}</small></div>
              <strong>{{ stage.value }}</strong>
            </li>
          </ol>
        </div>
      </section>

      <section class="reader-section" aria-labelledby="system-surfaces-title">
        <header class="reader-section-header"><span>05</span><h2 id="system-surfaces-title">把事实状态写在能力名称旁边。</h2><small>Private Control Plane</small></header>
        <p class="brief-note">私有治理、工具集成和进行中实验使用不同证据等级，不把它们包装成同一种产品能力。</p>
        <div class="ai-surfaces">
          <article v-for="(item, index) in aiModules" :key="item.id" :id="item.id" :data-level="item.evidenceLevel" class="brief-panel ai-surface">
            <p class="brief-card-meta"><span>{{ String(index + 1).padStart(2, '0') }} / {{ item.eyebrow }}</span><b class="brief-tag">{{ item.statusLabel }}</b></p>
            <h3>{{ item.title }}</h3>
            <p>{{ item.summary }}</p>
            <ul class="product-bullets"><li v-for="fact in item.facts" :key="fact">{{ fact }}</li></ul>
            <p class="brief-note">{{ item.boundary }}</p>
          </article>
        </div>
      </section>

      <section class="reader-section product-finale" aria-labelledby="human-boundary-title">
        <header class="reader-section-header"><span>06</span><h2 id="human-boundary-title">AI 可以缩短路径，不能拥有最终决定。</h2><small>Human Boundary</small></header>
        <ul class="product-bullets"><li v-for="item in humanBoundaries" :key="item">{{ item }}</li></ul>
        <router-link class="brief-button brief-button--primary" to="/ai/deliveries">进入完整交付账本 ↗</router-link>
      </section>
    </div>
  </div>
</template>
