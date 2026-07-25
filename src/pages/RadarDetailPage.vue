<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { dailyRadars } from '../data/generatedRadars'
import { getRadarDetailSections, radarSourceStatus } from '../data/radarPresentation'
import { getProjectByKey } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const route = useRoute()
const radar = computed(() => dailyRadars.find(item => item.slug === String(route.params.date || '')))
const sections = computed(() => radar.value ? getRadarDetailSections(radar.value) : [])
const relatedProjects = computed(() => radar.value?.relatedProjectSlugs.map(getProjectByKey).filter(Boolean) || [])

watchEffect(() => setSeoMeta(radar.value ? { title: `${radar.value.title}｜xiuqiu`, description: radar.value.summary, path: `/radar/${radar.value.slug}` } : { title: 'Radar not found｜xiuqiu', path: route.fullPath }))
</script>

<template>
  <section class="page-top radar-reader-page">
    <div v-if="radar" class="container radar-reader">
      <router-link to="/radar" class="radar-reader-back">← 返回行业情报雷达</router-link>
      <header class="radar-reader-header">
        <p class="radar-kicker">Daily Industry Brief</p>
        <div class="radar-reader-meta">
          <time :datetime="radar.date">{{ radar.date }}</time>
          <span>AI 自动汇总</span>
          <span>{{ radarSourceStatus(radar) }}</span>
        </div>
        <h1>{{ radar.title }}</h1>
        <p>{{ radar.summary }}</p>
      </header>

      <nav class="radar-reader-index" aria-label="本期简报栏目">
        <a v-for="section in sections" :key="section.id" :href="`#${section.id}`">{{ section.label }}</a>
      </nav>

      <section
        v-for="(group, groupIndex) in sections"
        :id="group.id"
        :key="group.id"
        class="radar-reader-section"
      >
        <header>
          <span>{{ String(groupIndex + 1).padStart(2, '0') }}</span>
          <div><p class="radar-kicker">{{ group.label }}</p><strong>{{ group.evidenceLabel }}</strong></div>
        </header>
        <article v-for="item in group.items" :key="item.title">
          <h2>{{ item.title }}</h2>
          <p>{{ item.summary }}</p>
          <a v-if="item.sourceUrl" :href="item.sourceUrl" target="_blank" rel="noopener">
            {{ item.sourceUrl.includes('coinmarketcap.com') ? '查看实时币价' : '查看原始来源' }}
            <span aria-hidden="true">↗</span>
          </a>
        </article>
      </section>

      <section v-if="relatedProjects.length" class="radar-reader-projects">
        <p class="radar-kicker">Related Engineering</p>
        <h2>关联工程</h2>
        <div>
          <router-link v-for="project in relatedProjects" :key="project!.slug" :to="`/projects/${project!.slug}`">
            {{ project!.name }} <span aria-hidden="true">→</span>
          </router-link>
        </div>
      </section>

      <details class="radar-reader-disclosure">
        <summary>来源与发布说明 <span aria-hidden="true">＋</span></summary>
        <div>
          <p>本期由 AI 从允许公开的研究输入整理；少于三类来源、隐私校验失败或构建门禁不通过时停止发布。摘要中的推断和待验证边界不等同于来源方结论，市场内容仅供研究与教育，不构成投资建议。</p>
          <div class="radar-source-status">
            <span v-for="source in radar.sourceSections" :key="source">{{ source }} 成功</span>
            <span v-for="source in radar.missingSections" :key="source" class="missing">{{ source }} 缺失</span>
          </div>
          <small>生成时间：{{ radar.generatedAt }}</small>
        </div>
      </details>
    </div>
    <div v-else class="container not-found"><p class="not-found-title">这期雷达不存在或未通过发布门禁</p><router-link to="/radar" class="btn btn-primary">返回雷达</router-link></div>
  </section>
</template>
