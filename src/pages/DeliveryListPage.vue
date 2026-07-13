<script setup lang="ts">
import { onMounted } from 'vue'
import { deliveryRecords } from '../data/generatedDeliveries'
import { setSeoMeta } from '../utils/seo'

const statusLabel = { 'in-progress': '进行中', partial: '部分完成', delivered: '已交付' }
onMounted(() => setSeoMeta({ title: 'AI 协作交付记录｜xiuqiu', description: '真实工程任务中的 AI 参与、人工判断、审查纠正与公开验证记录。', path: '/ai/deliveries' }))
</script>

<template>
  <section class="section page-top delivery-list-page"><div class="container"><header class="delivery-list-hero"><p class="section-label">AI Delivery Records</p><h1>真实交付记录</h1><p>不展示抽象等级，也不公开完整聊天记录。每次交付只记录任务、AI 参与、人工判断、审查发现、纠正动作和最终证据。</p></header><div class="delivery-list"><router-link v-for="item in deliveryRecords" :key="item.slug" :to="`/ai/deliveries/${item.slug}`"><div class="card-status-row"><time>{{ item.date }}</time><strong :data-status="item.status">{{ statusLabel[item.status] }}</strong></div><h2>{{ item.title }}</h2><p>{{ item.summary }}</p><div class="delivery-list-meta"><span>{{ item.evidenceSlugs.length }} 项证据</span><span>{{ item.publicLinks.length }} 个公开链接</span><span>{{ item.projectSlugs.length }} 个关联项目</span></div></router-link></div><router-link class="back-link" to="/ai">&larr; 返回 AI 工作流</router-link></div></section>
</template>
