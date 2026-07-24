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
  const groups: { label: string; evidenceLabel: string; items: RadarItem[] }[] = []
  if (radar.value.marketSignals.length) groups.push({ label: '市场与行业信号', evidenceLabel: '公开事实与待验证边界', items: radar.value.marketSignals })
  if (radar.value.aiTip) groups.push({ label: 'AI Engineering', evidenceLabel: '工程推断', items: [radar.value.aiTip] })
  if (radar.value.web3Design) groups.push({ label: 'Web3 Design', evidenceLabel: '设计推断', items: [radar.value.web3Design] })
  if (radar.value.vibeProject) groups.push({ label: 'Tools', evidenceLabel: '工具观察', items: [radar.value.vibeProject] })
  if (radar.value.readingPick) groups.push({ label: 'Reading', evidenceLabel: '阅读问题', items: [radar.value.readingPick] })
  return groups
})
const relatedProjects = computed(() => radar.value?.relatedProjectSlugs.map(getProjectByKey).filter(Boolean) || [])

watchEffect(() => setSeoMeta(radar.value ? { title: `${radar.value.title}｜xiuqiu`, description: radar.value.summary, path: `/radar/${radar.value.slug}` } : { title: 'Radar not found｜xiuqiu', path: route.fullPath }))
</script>

<template>
  <section class="section page-top radar-detail-page">
    <div v-if="radar" class="container radar-detail-container">
      <router-link to="/radar" class="back-link">&larr; 返回行业情报雷达</router-link>
      <header class="radar-detail-header"><p class="section-label">Daily Industry Brief</p><time>{{ radar.date }}</time><h1>{{ radar.title }}</h1><p>{{ radar.summary }}</p></header>

      <section v-for="group in sections" :key="group.label" class="radar-detail-section"><div class="radar-detail-section-label"><p class="section-label">{{ group.label }}</p><span>{{ group.evidenceLabel }}</span></div><article v-for="item in group.items" :key="item.title" class="radar-item"><h2>{{ item.title }}</h2><p>{{ item.summary }}</p><a v-if="item.sourceUrl" :href="item.sourceUrl" target="_blank" rel="noopener">{{ item.sourceUrl.includes('coinmarketcap.com') ? '查看实时币价' : '查看原始来源' }} &rarr;</a></article></section>

      <section v-if="relatedProjects.length" class="radar-related-projects"><p class="project-abilities-title">关联工程</p><router-link v-for="project in relatedProjects" :key="project!.slug" :to="`/projects/${project!.slug}`">{{ project!.name }} &rarr;</router-link></section>
      <footer class="radar-source-footer"><strong>来源与发布说明</strong><p>本期由 AI 从允许公开的研究输入整理；少于三类来源、隐私校验失败或构建门禁不通过时停止发布。摘要中的推断和待验证边界不等同于来源方结论，市场内容仅供研究与教育，不构成投资建议。</p><div class="radar-card-tags"><span v-for="source in radar.sourceSections" :key="source">{{ source }} 成功</span><span v-for="source in radar.missingSections" :key="source" class="missing">{{ source }} 缺失</span></div><small>生成时间：{{ radar.generatedAt }}</small></footer>
    </div>
    <div v-else class="container not-found"><p class="not-found-title">这期雷达不存在或未通过发布门禁</p><router-link to="/radar" class="btn btn-primary">返回雷达</router-link></div>
  </section>
</template>
