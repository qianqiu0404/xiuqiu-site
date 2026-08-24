<script setup lang="ts">
import { onMounted } from 'vue'
import '../styles/cinematic-pages.css'
import { deliveryRecords } from '../data/generatedDeliveries'
import { setSeoMeta } from '../utils/seo'

const statusLabel = { 'in-progress': '历史进行中', partial: '历史部分完成', delivered: '历史已交付' }
onMounted(() => setSeoMeta({
  title: 'AI 历史公开交付记录｜xiuqiu',
  description: '历史工程任务中的 AI 参与、人工判断、审查纠正与公开验证；这些记录不代表当前 Wallet Infrastructure 已实现。',
  path: '/ai/deliveries',
}))
</script>

<template>
  <section class="delivery-list-page delivery-ledger-page cinematic-page">
    <header class="delivery-list-hero cinematic-page-hero">
      <div class="container delivery-list-hero-layout">
        <div>
          <p class="cinematic-page-kicker">Historical AI Delivery Records / Auditable Runs</p>
          <h1>历史公开交付记录，<span>不是当前项目清单。</span></h1>
          <p>这些记录保留过去任务中的 AI 参与、人工判断、审查发现、纠正动作和最终证据；它们不代表当前 Wallet Infrastructure 已实现。</p>
        </div>
        <div class="delivery-ledger-count"><small>Historical Public Runs</small><strong>{{ String(deliveryRecords.length).padStart(2, '0') }}</strong><span>全部来自审核后的历史公开字段</span></div>
      </div>
    </header>

    <div class="delivery-ledger-surface">
      <div class="container">
        <div class="delivery-ledger-heading"><p>RUN LEDGER / SELECT A TRACE</p><router-link class="back-link" to="/ai">&larr; 返回 AI Engineering OS</router-link></div>
        <div class="delivery-list">
          <router-link v-for="(item, index) in deliveryRecords" :key="item.slug" :to="`/ai/deliveries/${item.slug}`">
            <span class="delivery-list-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <div>
              <div class="card-status-row"><time>{{ item.date }}</time><strong :data-status="item.status">{{ statusLabel[item.status] }}</strong></div>
              <h2>{{ item.title }}</h2>
              <p>{{ item.summary }}</p>
            </div>
            <div class="delivery-list-meta"><span>{{ item.evidenceSlugs.length }} 项证据</span><span>{{ item.publicLinks.length }} 个公开链接</span><span>{{ item.projectSlugs.length }} 个关联项目</span></div>
            <b aria-hidden="true">↗</b>
          </router-link>
        </div>
      </div>
    </div>
  </section>
</template>
