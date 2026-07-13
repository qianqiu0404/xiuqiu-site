<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { dailyRadars, type RadarItem } from '../data/generatedRadars'
import { getProjectByKey } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const route = useRoute()
const radar = computed(() => dailyRadars.find(item => item.slug === String(route.params.date || '')))
const sections = computed(() => {
  if (!radar.value) return []
  const groups: { label: string; items: RadarItem[] }[] = []
  if (radar.value.marketSignals.length) groups.push({ label: '市场与行业信号', items: radar.value.marketSignals })
  if (radar.value.aiTip) groups.push({ label: 'AI 技巧', items: [radar.value.aiTip] })
  if (radar.value.web3Design) groups.push({ label: 'Web3 设计', items: [radar.value.web3Design] })
  if (radar.value.vibeProject) groups.push({ label: 'Vibe 项目', items: [radar.value.vibeProject] })
  if (radar.value.readingPick) groups.push({ label: '精选阅读', items: [radar.value.readingPick] })
  return groups
})
const relatedProjects = computed(() => radar.value?.relatedProjectSlugs.map(getProjectByKey).filter(Boolean) || [])

watchEffect(() => setSeoMeta(radar.value ? { title: `${radar.value.title}｜xiuqiu`, description: radar.value.summary, path: `/radar/${radar.value.slug}` } : { title: 'Radar not found｜xiuqiu', path: route.fullPath }))
</script>

<template>
  <section class="section page-top radar-detail-page">
    <div v-if="radar" class="container radar-detail-container">
      <router-link to="/radar" class="back-link">&larr; 返回每日研究雷达</router-link>
      <header class="radar-detail-header"><div class="card-status-row"><span>AI 自动汇总</span><time>{{ radar.date }}</time></div><h1>{{ radar.title }}</h1><p>{{ radar.summary }}</p><div class="radar-card-tags"><span v-for="source in radar.sourceSections" :key="source">{{ source }} 成功</span><span v-for="source in radar.missingSections" :key="source" class="missing">{{ source }} 缺失</span></div></header>

      <section v-for="group in sections" :key="group.label" class="radar-detail-section"><p class="section-label">{{ group.label }}</p><article v-for="item in group.items" :key="item.title" class="radar-item"><h2>{{ item.title }}</h2><p>{{ item.summary }}</p><a v-if="item.sourceUrl" :href="item.sourceUrl" target="_blank" rel="noopener">查看原始来源 &rarr;</a></article></section>

      <section class="radar-followup"><p class="project-abilities-title">后续行动</p><p>{{ radar.followUp }}</p><router-link v-for="project in relatedProjects" :key="project!.slug" :to="`/projects/${project!.slug}`">关联项目：{{ project!.name }} &rarr;</router-link></section>
      <footer class="radar-source-footer"><strong>发布说明</strong><p>本期由 AI 从允许公开的 Obsidian 研究区块自动汇总。公开 URL 必须来自原始区块；少于三类来源或隐私校验失败时停止发布。内容仅供研究与教育，不构成投资建议。</p><small>生成时间：{{ radar.generatedAt }}</small></footer>
    </div>
    <div v-else class="container not-found"><p class="not-found-title">这期雷达不存在或未通过发布门禁</p><router-link to="/radar" class="btn btn-primary">返回雷达</router-link></div>
  </section>
</template>
