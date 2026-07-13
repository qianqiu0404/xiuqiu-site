<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { evidenceBySlug, evidenceStatusLabels } from '../data/evidence'
import { deliveryRecords } from '../data/generatedDeliveries'
import { getProjectByKey } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const route = useRoute()
const delivery = computed(() => deliveryRecords.find(item => item.slug === String(route.params.slug || '')))
const evidence = computed(() => delivery.value?.evidenceSlugs.map(evidenceBySlug).filter(Boolean) || [])
const projects = computed(() => delivery.value?.projectSlugs.map(getProjectByKey).filter(Boolean) || [])
const statusLabel = { 'in-progress': '进行中', partial: '部分完成', delivered: '已交付' }

watchEffect(() => setSeoMeta(delivery.value ? { title: `${delivery.value.title}｜AI 交付记录`, description: delivery.value.summary, path: `/ai/deliveries/${delivery.value.slug}` } : { title: '交付记录不存在｜xiuqiu', path: route.fullPath }))
</script>

<template>
  <section class="section page-top delivery-detail-page"><div v-if="delivery" class="container delivery-detail-container"><router-link class="back-link" to="/ai/deliveries">&larr; 返回全部交付记录</router-link><header class="delivery-detail-hero"><div class="card-status-row"><time>{{ delivery.date }}</time><strong :data-status="delivery.status">{{ statusLabel[delivery.status] }}</strong></div><h1>{{ delivery.title }}</h1><p>{{ delivery.summary }}</p><div class="delivery-project-links"><router-link v-for="project in projects" :key="project!.slug" :to="`/projects/${project!.slug}`">{{ project!.name }}</router-link></div></header><section class="delivery-goal"><p class="section-label">任务目标</p><h2>{{ delivery.goal }}</h2><ul><li v-for="item in delivery.scope" :key="item">{{ item }}</li></ul></section><div class="delivery-role-grid"><section><p class="section-label">AI 参与</p><ul><li v-for="item in delivery.aiContribution" :key="item">{{ item }}</li></ul></section><section><p class="section-label">人工判断</p><ul><li v-for="item in delivery.humanDecisions" :key="item">{{ item }}</li></ul></section></div><div class="delivery-review-grid"><section><p class="section-label">审查发现</p><ul><li v-for="item in delivery.reviewFindings" :key="item">{{ item }}</li></ul></section><section><p class="section-label">纠正动作</p><ul><li v-for="item in delivery.corrections" :key="item">{{ item }}</li></ul></section></div><section class="delivery-evidence-section"><div class="section-heading section-heading-left"><p class="section-label">验证证据</p><h2 class="section-title">交付结果如何被复核</h2></div><div class="delivery-evidence-grid"><article v-for="record in evidence" :key="record!.slug"><div class="card-status-row"><span>{{ record!.kind }}</span><strong :data-status="record!.status">{{ evidenceStatusLabels[record!.status] }}</strong></div><h3>{{ record!.title }}</h3><p>{{ record!.summary }}</p><code v-if="record!.command">{{ record!.command }}</code><a v-if="record!.url" :href="record!.url" target="_blank" rel="noopener">查看证据 &rarr;</a></article></div><div class="delivery-public-links"><a v-for="link in delivery.publicLinks" :key="link.url" :href="link.url" target="_blank" rel="noopener">{{ link.label }} &rarr;</a></div></section><section class="delivery-limits"><div><p class="section-label">当前限制</p><ul><li v-for="item in delivery.knownLimits" :key="item">{{ item }}</li></ul></div><div><p class="section-label">下一步</p><p>{{ delivery.nextStep }}</p></div></section></div><div v-else class="container not-found"><p class="not-found-title">这条交付记录不存在</p><router-link class="btn btn-primary" to="/ai/deliveries">返回交付记录</router-link></div></section>
</template>
