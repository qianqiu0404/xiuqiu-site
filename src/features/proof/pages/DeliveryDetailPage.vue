<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import '../../../design/brief.css'
import '../../../design/reader.css'
import '../../../design/product.css'
import { useRoute } from 'vue-router'
import { evidenceBySlug, evidenceStatusLabels, deliveryRecords, getProjectByKey } from '../data'
import { setSeoMeta } from '../../../utils/seo'

const route = useRoute()
const delivery = computed(() => deliveryRecords.find(item => item.slug === String(route.params.slug || '')))
const evidence = computed(() => delivery.value?.evidenceSlugs.map(evidenceBySlug).filter(Boolean) || [])
const projects = computed(() => delivery.value?.projectSlugs.map(getProjectByKey).filter(Boolean) || [])
const statusLabel = { 'in-progress': '历史进行中', partial: '历史部分完成', delivered: '历史已交付' }

watchEffect(() => setSeoMeta(delivery.value ? {
  title: `${delivery.value.title}｜AI 历史公开交付`,
  description: `历史公开交付证据：${delivery.value.summary}`,
  path: `/ai/deliveries/${delivery.value.slug}`,
  type: 'article',
} : { title: '交付记录不存在｜xiuqiu', path: route.fullPath, indexable: false }))
</script>

<template>
  <div class="brief delivery-detail-page" lang="zh-CN">
    <template v-if="delivery">
      <header class="brief-masthead">
        <div class="brief-shell brief-reading">
          <router-link class="brief-back back-link" to="/ai/deliveries">← 返回历史公开交付记录</router-link>
          <p class="brief-dateline">
            <time :datetime="delivery.date">{{ delivery.date }}</time>
            <span>AI 历史公开交付 / {{ delivery.kind }}</span>
            <b class="brief-tag" :data-status="delivery.status">{{ statusLabel[delivery.status] }}</b>
          </p>
          <h1>{{ delivery.title }}</h1>
          <p class="brief-lede">{{ delivery.summary }}</p>
          <div class="reader-related">
            <router-link v-for="project in projects" :key="project!.slug" :to="`/projects/${project!.slug}`">{{ project!.name }} →</router-link>
          </div>
        </div>
      </header>

      <div class="brief-shell brief-reading product-body">
        <section class="reader-section">
          <header class="reader-section-header"><span>01</span><h2>{{ delivery.goal }}</h2><small>GOAL &amp; SCOPE</small></header>
          <ul class="product-bullets"><li v-for="item in delivery.scope" :key="item">{{ item }}</li></ul>
        </section>

        <div class="product-pair">
          <section class="brief-panel"><h2>02 / AI CONTRIBUTION · AI 参与</h2><ul class="product-bullets"><li v-for="item in delivery.aiContribution" :key="item">{{ item }}</li></ul></section>
          <section class="brief-panel"><h2>03 / HUMAN GATE · 人工判断</h2><ul class="product-bullets"><li v-for="item in delivery.humanDecisions" :key="item">{{ item }}</li></ul></section>
          <section class="brief-panel"><h2>04 / REVIEW FINDINGS · 审查发现</h2><ul class="product-bullets"><li v-for="item in delivery.reviewFindings" :key="item">{{ item }}</li></ul></section>
          <section class="brief-panel"><h2>05 / CORRECTIONS · 纠正动作</h2><ul class="product-bullets"><li v-for="item in delivery.corrections" :key="item">{{ item }}</li></ul></section>
        </div>

        <section class="reader-section">
          <header class="reader-section-header"><span>06</span><h2>交付结果如何被复核</h2><small>VERIFIED EVIDENCE</small></header>
          <div class="radar-reader-articles">
            <article v-for="record in evidence" :key="record!.slug" class="reader-article reader-article--compact">
              <p class="brief-card-meta"><span>{{ record!.kind }}</span><b class="brief-tag" :data-status="record!.status">{{ evidenceStatusLabels[record!.status] }}</b></p>
              <h3>{{ record!.title }}</h3>
              <p>{{ record!.summary }}</p>
              <div v-if="record!.command" class="product-commands"><code>{{ record!.command }}</code></div>
              <a v-if="record!.url" class="reader-source-link" :href="record!.url" target="_blank" rel="noopener">查看证据 →</a>
            </article>
          </div>
          <div class="reader-related">
            <a v-for="link in delivery.publicLinks" :key="link.url" :href="link.url" target="_blank" rel="noopener">{{ link.label }} →</a>
          </div>
        </section>

        <div class="product-pair">
          <section class="brief-panel"><h2>07 / LAST RECORDED LIMITS · 最后记录的限制</h2><ul class="product-bullets"><li v-for="item in delivery.knownLimits" :key="item">{{ item }}</li></ul></section>
          <section class="brief-panel"><h2>08 / LAST RECORDED NEXT STEP / PAUSED · 最后记录的下一步（已暂停）</h2><p>{{ delivery.nextStep }}</p></section>
        </div>
      </div>
    </template>
    <div v-else class="brief-masthead"><div class="brief-shell">
      <p class="brief-dateline"><span>Delivery</span></p>
      <h1>这条交付记录不存在</h1>
      <div class="reader-actions"><router-link class="brief-button" to="/ai/deliveries">返回交付记录</router-link></div>
    </div></div>
  </div>
</template>
