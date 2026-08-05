<script setup lang="ts">
import { onMounted } from 'vue'
import '../styles/ai-overview.css'
import { aiStageLabels, siteAiCases } from '../data/siteKnowledge'
import { deliveryRecords, type DeliveryStatus } from '../data/generatedDeliveries'
import { setSeoMeta } from '../utils/seo'

const executionKernel = [
  {
    step: '01',
    title: 'Define',
    description: '先冻结目标、权限边界与完成标准。',
  },
  {
    step: '02',
    title: 'Execute',
    description: '让 AI 加速检索、实现与机械性工作。',
  },
  {
    step: '03',
    title: 'Review',
    description: '检查差异、来源、风险与越界行为。',
  },
  {
    step: '04',
    title: 'Verify',
    description: '用测试和运行证据决定是否交付。',
  },
] as const

const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  delivered: '已交付',
  partial: '部分完成',
  'in-progress': '进行中',
}

const latestDeliveries = [...deliveryRecords]
  .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'zh-CN'))
  .slice(0, 2)

const aiModules = [...siteAiCases]
  .sort((a, b) => a.displayOrder - b.displayOrder)
  .slice(0, 5)

onMounted(() => setSeoMeta({
  title: 'AI Engineering OS｜xiuqiu',
  description: 'AI 参与定义、执行、审查与验证；真实交付、人工门禁和工程证据共同决定结果。',
  path: '/ai',
}))
</script>

<template>
  <div class="ai-overview-page" lang="zh-CN">
    <section class="aio-hero" aria-labelledby="ai-overview-title">
      <div class="container aio-hero-layout">
        <div class="aio-hero-copy">
          <p class="aio-kicker">AI Engineering OS / Human-Gated</p>
          <h1 id="ai-overview-title">AI 加速工程，<br /><span>但不代替验证。</span></h1>
          <p class="aio-lead">
            我把 AI 放进需求拆解、实现、审查、测试和知识治理；目标、授权边界、风险判断与最终验收始终由人负责。
          </p>
          <div class="aio-principle" aria-label="AI 工程原则">
            <span>01</span>
            <p>生成只是候选。没有来源、测试或运行证据，就不升级交付状态。</p>
          </div>
          <router-link class="aio-primary-action" to="/ai/deliveries">
            查看真实交付 <span aria-hidden="true">↗</span>
          </router-link>
        </div>

        <div class="aio-kernel" aria-labelledby="ai-kernel-title">
          <header>
            <div>
              <span>Execution Kernel</span>
              <h2 id="ai-kernel-title">Human gate active</h2>
            </div>
            <small>04 stages</small>
          </header>
          <ol>
            <li v-for="item in executionKernel" :key="item.step">
              <span>{{ item.step }}</span>
              <div>
                <h3>{{ item.title }}</h3>
                <p>{{ item.description }}</p>
              </div>
              <i aria-hidden="true"></i>
            </li>
          </ol>
          <footer>
            <span>AI assists</span>
            <b aria-hidden="true">→</b>
            <strong>Human verifies</strong>
          </footer>
        </div>
      </div>
    </section>

    <section class="aio-registry" aria-labelledby="ai-registry-title">
      <div class="container aio-registry-layout">
        <header class="aio-section-heading">
          <div>
            <p class="aio-kicker">Module Registry</p>
            <h2 id="ai-registry-title">五个可重复使用的协作模块。</h2>
          </div>
          <p>这里只保留模块身份与当前阶段；职责、流程和长复盘回到交付账本与工程笔记。</p>
        </header>

        <ol class="aio-module-list">
          <li v-for="item in aiModules" :key="item.id">
            <span>{{ String(item.displayOrder).padStart(2, '0') }}</span>
            <strong>{{ item.title }}</strong>
            <small>{{ aiStageLabels[item.stage] }}</small>
          </li>
        </ol>
      </div>
    </section>

    <section v-if="latestDeliveries.length" class="aio-deliveries" aria-labelledby="ai-deliveries-title">
      <div class="container">
        <header class="aio-section-heading aio-section-heading--dark">
          <div>
            <p class="aio-kicker">Run Ledger / Latest Proof</p>
            <h2 id="ai-deliveries-title">最近两条真实交付。</h2>
          </div>
          <p>每条记录都把 AI 参与和人工决定分开保存，让代码、纠正动作与证据可以继续追溯。</p>
        </header>

        <div class="aio-delivery-list">
          <router-link
            v-for="(item, index) in latestDeliveries"
            :key="item.slug"
            class="aio-delivery-row"
            :to="`/ai/deliveries/${item.slug}`"
          >
            <div class="aio-delivery-index">
              <span>RUN {{ String(index + 1).padStart(2, '0') }}</span>
              <time :datetime="item.date">{{ item.date }}</time>
            </div>
            <div class="aio-delivery-copy">
              <p>{{ deliveryStatusLabels[item.status] }}</p>
              <h3>{{ item.title }}</h3>
              <span>{{ item.summary }}</span>
            </div>
            <dl>
              <div>
                <dt>AI contribution</dt>
                <dd>{{ item.aiContribution[0] }}</dd>
              </div>
              <div>
                <dt>Human decision</dt>
                <dd>{{ item.humanDecisions[0] }}</dd>
              </div>
            </dl>
            <b class="aio-row-arrow" aria-hidden="true">↗</b>
          </router-link>
        </div>
      </div>
    </section>

    <section class="aio-boundary" aria-labelledby="ai-boundary-title">
      <div class="container aio-boundary-layout">
        <div>
          <p class="aio-kicker">Human Boundary</p>
          <h2 id="ai-boundary-title">AI 可以加速路径，<br />不能拥有最终决定。</h2>
        </div>
        <div class="aio-boundary-copy">
          <p>
            模型可以生成候选、执行机械步骤并提供第二视角；我决定目标、公开范围、资金与安全判断，以及一项工作是否真的完成。
          </p>
          <p>外部模型、工具与第三方 Skill 保留各自归属；本地通过、集成验证与生产验收不会混为同一状态。</p>
          <router-link class="aio-primary-action aio-primary-action--light" to="/ai/deliveries">
            进入完整交付账本 <span aria-hidden="true">↗</span>
          </router-link>
        </div>
      </div>
    </section>
  </div>
</template>
