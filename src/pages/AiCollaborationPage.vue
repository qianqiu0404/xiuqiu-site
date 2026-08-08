<script setup lang="ts">
import { onMounted } from 'vue'
import '../styles/ai-evidence-os.css'
import {
  aiAutomationRun,
  aiPublicDeliveries,
  aiReviewCases,
  aiSystemSurfaces,
  executionKernel,
  humanBoundaries,
} from '../data/aiEvidencePresentation'
import { setSeoMeta } from '../utils/seo'

const latestDeliveries = aiPublicDeliveries
const aiModules = aiSystemSurfaces

onMounted(() => setSeoMeta({
  title: 'AI Engineering OS｜xiuqiu',
  description: 'AI 参与定义、执行、审查与验证；真实交付、人工门禁和工程证据共同决定结果。',
  path: '/ai',
}))
</script>

<template>
  <div class="ai-evidence-os" lang="zh-CN">
    <section class="aeo-hero" aria-labelledby="ai-evidence-title">
      <div class="container aeo-hero-grid">
        <div class="aeo-hero-copy">
          <p class="aeo-kicker">AI Engineering / Evidence OS</p>
          <h1 id="ai-evidence-title">
            <span class="aeo-title-primary">AI 不是侧边工具。</span>
            <span class="aeo-title-secondary">它是一套有证据门禁的工程系统。</span>
          </h1>
          <p class="aeo-lead">
            我让 AI 进入需求拆解、实现、审查、测试、发布和知识治理，但只有公开交付、可复核纠正与运行证据能改变工作状态。
          </p>
          <div class="aeo-actions">
            <router-link class="aeo-action aeo-action--primary" to="/ai/deliveries">
              查看公开交付 <span aria-hidden="true">↗</span>
            </router-link>
            <a class="aeo-action" href="#review-before-claim">查看 Review Gate</a>
          </div>
        </div>

        <aside class="aeo-hero-console" aria-label="AI 工程系统当前状态">
          <header>
            <span>CONTROL SURFACE</span>
            <i aria-hidden="true"></i>
            <strong>HUMAN GATE ACTIVE</strong>
          </header>
          <dl>
            <div>
              <dt>Public delivery</dt>
              <dd>{{ latestDeliveries.length }} traces</dd>
            </div>
            <div>
              <dt>Review mode</dt>
              <dd>Before claim</dd>
            </div>
            <div>
              <dt>Latest automation</dt>
              <dd>Partial</dd>
            </div>
            <div>
              <dt>Tool boundary</dt>
              <dd>Integration only</dd>
            </div>
          </dl>
          <p>生成只是候选。没有来源、测试或运行证据，就不升级交付状态。</p>
        </aside>
      </div>
    </section>

    <section class="aeo-protocol" aria-labelledby="execution-kernel-title">
      <div class="container">
        <header class="aeo-section-heading aeo-section-heading--compact">
          <p class="aeo-kicker">Execution Kernel</p>
          <h2 id="execution-kernel-title">先定义门，再运行模型。</h2>
        </header>
        <ol class="aeo-kernel-list">
          <li v-for="item in executionKernel" :key="item.step">
            <span>{{ item.step }}</span>
            <h3>{{ item.title }}</h3>
            <p>{{ item.description }}</p>
          </li>
        </ol>
      </div>
    </section>

    <section class="aeo-ledger" aria-labelledby="public-delivery-title">
      <div class="container">
        <header class="aeo-section-heading aeo-section-heading--dark">
          <div>
            <p class="aeo-kicker">Public Delivery Ledger</p>
            <h2 id="public-delivery-title">不展示 prompt 数量，展示被验证的结果。</h2>
          </div>
          <p>每条公开记录把 AI 参与、人工决定、测试证据和已知限制分开保存。</p>
        </header>

        <div class="aeo-delivery-list">
          <article v-for="(item, index) in latestDeliveries" :key="item.delivery.slug" class="aeo-delivery-row">
            <div class="aeo-delivery-id">
              <span>TRACE {{ String(index + 1).padStart(2, '0') }}</span>
              <time :datetime="item.delivery.date">{{ item.delivery.date }}</time>
            </div>
            <div class="aeo-delivery-main">
              <p>PUBLIC / {{ item.delivery.status.toUpperCase() }}</p>
              <h3>{{ item.delivery.title }}</h3>
              <span>{{ item.delivery.summary }}</span>
            </div>
            <dl class="aeo-delivery-proof">
              <div>
                <dt>Human decision</dt>
                <dd>{{ item.delivery.humanDecisions[0] }}</dd>
              </div>
              <div>
                <dt>Verified evidence</dt>
                <dd>{{ item.evidence.summary }}</dd>
              </div>
            </dl>
            <router-link :to="`/ai/deliveries/${item.delivery.slug}`" :aria-label="`查看 ${item.delivery.title} 交付记录`">↗</router-link>
          </article>
        </div>
      </div>
    </section>

    <section id="review-before-claim" class="aeo-review" aria-labelledby="review-before-claim-title">
      <div class="container">
        <header class="aeo-section-heading">
          <div>
            <p class="aeo-kicker">Review Before Claim</p>
            <h2 id="review-before-claim-title">能力不在第一次生成，而在发现它错在哪里。</h2>
          </div>
          <p>以下纠正来自现有交付记录，不是为了页面补写的假想案例。</p>
        </header>

        <ol class="aeo-review-list">
          <li v-for="(item, index) in aiReviewCases" :key="item.delivery.slug">
            <div class="aeo-review-index">
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <small>{{ item.label }}</small>
            </div>
            <div class="aeo-review-before">
              <p>Finding</p>
              <h3>{{ item.finding }}</h3>
            </div>
            <div class="aeo-review-after">
              <p>Correction</p>
              <h3>{{ item.correction }}</h3>
              <a v-if="item.evidence.url" :href="item.evidence.url" target="_blank" rel="noopener">
                {{ item.evidence.title }} ↗
              </a>
            </div>
          </li>
        </ol>
      </div>
    </section>

    <section class="aeo-automation" aria-labelledby="automation-run-title">
      <div class="container aeo-automation-grid">
        <header class="aeo-automation-intro">
          <p class="aeo-kicker">Operational Automation / {{ aiAutomationRun.date }}</p>
          <span class="aeo-status aeo-status--partial">{{ aiAutomationRun.statusLabel }}</span>
          <h2 id="automation-run-title">{{ aiAutomationRun.title }}</h2>
          <p>{{ aiAutomationRun.summary }}</p>
          <small>{{ aiAutomationRun.boundary }}</small>
          <div class="aeo-inline-links">
            <a :href="aiAutomationRun.pullRequestUrl" target="_blank" rel="noopener">PR #49 ↗</a>
            <a :href="aiAutomationRun.productionUrl" target="_blank" rel="noopener">生产雷达 ↗</a>
          </div>
        </header>

        <ol class="aeo-run-trace">
          <li v-for="(stage, index) in aiAutomationRun.stages" :key="stage.label" :class="{ 'is-failed': stage.value === 'FAILED' }">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <div>
              <p>{{ stage.label }}</p>
              <small>{{ stage.detail }}</small>
            </div>
            <strong>{{ stage.value }}</strong>
          </li>
        </ol>
      </div>
    </section>

    <section class="aeo-surfaces" aria-labelledby="system-surfaces-title">
      <div class="container">
        <header class="aeo-section-heading">
          <div>
            <p class="aeo-kicker">Private Control Plane</p>
            <h2 id="system-surfaces-title">把事实状态写在能力名称旁边。</h2>
          </div>
          <p>私有治理、工具集成和进行中实验使用不同证据等级，不把它们包装成同一种产品能力。</p>
        </header>

        <div class="aeo-surface-list">
          <article v-for="(item, index) in aiModules" :key="item.id" :id="item.id" :data-level="item.evidenceLevel">
            <div class="aeo-surface-title">
              <span>{{ String(index + 1).padStart(2, '0') }} / {{ item.eyebrow }}</span>
              <strong>{{ item.statusLabel }}</strong>
            </div>
            <div class="aeo-surface-copy">
              <h3>{{ item.title }}</h3>
              <p>{{ item.summary }}</p>
            </div>
            <ul>
              <li v-for="fact in item.facts" :key="fact">{{ fact }}</li>
            </ul>
            <p class="aeo-surface-boundary">{{ item.boundary }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="aeo-boundary" aria-labelledby="human-boundary-title">
      <div class="container aeo-boundary-grid">
        <div>
          <p class="aeo-kicker">Human Boundary</p>
          <h2 id="human-boundary-title">AI 可以缩短路径，<br />不能拥有最终决定。</h2>
        </div>
        <div>
          <ul>
            <li v-for="item in humanBoundaries" :key="item">{{ item }}</li>
          </ul>
          <router-link class="aeo-action aeo-action--light" to="/ai/deliveries">
            进入完整交付账本 <span aria-hidden="true">↗</span>
          </router-link>
        </div>
      </div>
    </section>
  </div>
</template>
