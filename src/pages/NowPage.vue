<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { deliveryRecords } from '../data/generatedDeliveries'
import { learningRecords } from '../data/generatedLearningRecords'
import { nowSnapshot } from '../data/generatedNow'
import { dailyRadars } from '../data/generatedRadars'
import { getArticleBySlug, getProjectByKey, projectStageLabels, siteArticlesByNewest } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const currentProjects = nowSnapshot.developmentProjectSlugs.map(getProjectByKey).filter(Boolean)
const featuredDeliveries = nowSnapshot.featuredDeliverySlugs.map(slug => deliveryRecords.find(item => item.slug === slug)).filter(Boolean)
const latestRadar = dailyRadars[0]
const researchItems = [
  latestRadar
    ? { type: '每日雷达', title: latestRadar.title, summary: latestRadar.summary, date: latestRadar.date, to: `/radar/${latestRadar.slug}` }
    : undefined,
  ...nowSnapshot.researchRefs
    .filter(ref => ref.type === 'article')
    .map(ref => {
      const item = getArticleBySlug(ref.slug)
      return item ? { type: '工程文章', title: item.title, summary: item.summary, date: item.date, to: `/articles/${item.slug}` } : undefined
    }),
].filter(Boolean)

const recentOutputs = computed(() => [
  ...deliveryRecords.map(item => ({ date: item.date, type: '工程交付', title: item.title, summary: item.summary, to: `/ai/deliveries/${item.slug}` })),
  ...siteArticlesByNewest.map(item => ({ date: item.date, type: '工程文章', title: item.title, summary: item.summary, to: `/articles/${item.slug}` })),
  ...learningRecords.map(item => ({ date: item.date, type: '学习复盘', title: item.title, summary: item.summary, to: '/learning' })),
  ...dailyRadars.map(item => ({ date: item.date, type: '每日雷达', title: item.title, summary: item.summary, to: `/radar/${item.slug}` })),
].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10))

const stale = computed(() => (Date.now() - new Date(`${nowSnapshot.updatedAt}T00:00:00+08:00`).getTime()) / 86_400_000 > 14)

onMounted(() => setSeoMeta({ title: '当前动态｜xiuqiu', description: nowSnapshot.summary, path: '/now' }))
</script>

<template>
  <section class="section page-top now-page">
    <div class="container">
      <header class="now-hero">
        <div><p class="section-label">Now · {{ nowSnapshot.updatedAt }}</p><h1>{{ nowSnapshot.headline }}</h1><p>{{ nowSnapshot.summary }}</p></div>
        <aside :class="{ stale }"><span>{{ stale ? '近期未更新' : '当前快照' }}</span><strong>开发 · 研究 · 公开交付</strong><p>项目事实来自结构化内容，最近产出由网站自动聚合。</p></aside>
      </header>

      <section class="now-section"><div class="section-heading section-heading-left"><p class="section-label">01 · 开发中</p><h2 class="section-title">当前工程主线</h2></div><div class="now-project-grid"><router-link v-for="project in currentProjects" :key="project!.slug" :to="`/projects/${project!.slug}`"><div class="card-status-row"><span>{{ project!.category }}</span><strong>{{ projectStageLabels[project!.stage] }}</strong></div><h3>{{ project!.name }}</h3><p>{{ project!.currentFocus }}</p><small>下一里程碑：{{ project!.nextMilestone }}</small></router-link></div></section>

      <section class="now-section"><div class="section-heading section-heading-left"><p class="section-label">02 · 研究中</p><h2 class="section-title">正在形成判断的主题</h2></div><div class="now-research-list"><router-link v-for="item in researchItems" :key="item!.to" :to="item!.to"><time>{{ item!.date }}</time><div><span>{{ item!.type }}</span><h3>{{ item!.title }}</h3><p>{{ item!.summary }}</p></div></router-link></div></section>

      <section class="now-section"><div class="section-heading section-heading-left"><p class="section-label">03 · 最近交付</p><h2 class="section-title">结果、判断与验证放在一起</h2></div><div class="now-delivery-grid"><router-link v-for="item in featuredDeliveries" :key="item!.slug" :to="`/ai/deliveries/${item!.slug}`"><div class="card-status-row"><time>{{ item!.date }}</time><strong>{{ item!.status === 'delivered' ? '已交付' : item!.status === 'partial' ? '部分完成' : '进行中' }}</strong></div><h3>{{ item!.title }}</h3><p>{{ item!.summary }}</p><small>{{ item!.evidenceSlugs.length }} 项证据 · {{ item!.publicLinks.length }} 个公开链接</small></router-link></div></section>

      <section class="now-section now-next"><div><p class="section-label">04 · 下一步</p><h2>接下来准备验证什么</h2></div><ol><li v-for="item in nowSnapshot.nextFocus" :key="item">{{ item }}</li></ol></section>

      <section class="now-section"><div class="section-heading section-heading-left"><p class="section-label">Recent Activity</p><h2 class="section-title">最近 10 条公开产出</h2></div><div class="now-timeline"><router-link v-for="item in recentOutputs" :key="`${item.type}-${item.to}-${item.title}`" :to="item.to"><time>{{ item.date }}</time><span>{{ item.type }}</span><div><h3>{{ item.title }}</h3><p>{{ item.summary }}</p></div></router-link></div></section>
    </div>
  </section>
</template>
