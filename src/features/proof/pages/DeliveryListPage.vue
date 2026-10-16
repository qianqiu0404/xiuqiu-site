<script setup lang="ts">
import { onMounted } from 'vue'
import '../../../design/brief.css'
import '../../../design/reader.css'
import { deliveryRecords } from '../data'
import { setSeoMeta } from '../../../utils/seo'

const statusLabel = { 'in-progress': '历史进行中', partial: '历史部分完成', delivered: '历史已交付' }
onMounted(() => setSeoMeta({
  title: 'AI 历史公开交付记录｜xiuqiu',
  description: '历史工程任务中的 AI 参与、人工判断、审查纠正与公开验证；这些记录不代表当前 Wallet Infrastructure 已实现。',
  path: '/ai/deliveries',
}))
</script>

<template>
  <div class="brief delivery-list-page" lang="zh-CN">
    <header class="brief-masthead">
      <div class="brief-shell">
        <router-link class="brief-back back-link" to="/ai">← 返回 AI Engineering OS</router-link>
        <p class="brief-dateline"><span>Historical AI Delivery Records / Auditable Runs</span></p>
        <div class="brief-masthead-row">
          <div>
            <h1>历史公开交付记录，不是当前项目清单。</h1>
            <p class="brief-lede">这些记录保留过去任务中的 AI 参与、人工判断、审查发现、纠正动作和最终证据；它们不代表当前 Wallet Infrastructure 已实现。</p>
          </div>
          <dl class="brief-stats">
            <div><dt>Historical Public Runs</dt><dd>{{ String(deliveryRecords.length).padStart(2, '0') }}</dd></div>
          </dl>
        </div>
        <p class="brief-note">全部来自审核后的历史公开字段</p>
      </div>
    </header>

    <div class="brief-shell brief-reading">
      <section class="brief-day" aria-label="RUN LEDGER / SELECT A TRACE">
        <ol class="brief-timeline">
          <li v-for="item in deliveryRecords" :key="item.slug" data-domain="ai">
            <router-link class="brief-card" :to="`/ai/deliveries/${item.slug}`">
              <span class="brief-card-meta">
                <time :datetime="item.date">{{ item.date }}</time>
                <b class="brief-tag" :data-status="item.status">{{ statusLabel[item.status] }}</b>
              </span>
              <strong class="brief-card-title">{{ item.title }}</strong>
              <span class="brief-card-summary">{{ item.summary }}</span>
              <small class="brief-card-source">{{ item.evidenceSlugs.length }} 项证据 · {{ item.publicLinks.length }} 个公开链接 · {{ item.projectSlugs.length }} 个关联项目</small>
            </router-link>
          </li>
        </ol>
      </section>
    </div>
  </div>
</template>
