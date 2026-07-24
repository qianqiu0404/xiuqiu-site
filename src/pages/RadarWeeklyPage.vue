<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { radarWeeklies } from '../data/generatedRadarWeeklies'
import { getProjectByKey } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const route = useRoute()
const weekly = computed(() => radarWeeklies.find(item => item.slug === String(route.params.week || '')))
const relatedProjects = computed(() =>
  weekly.value?.relatedProjectSlugs.map(getProjectByKey).filter(Boolean) || [],
)
const sections = computed(() =>
  weekly.value
    ? [
        { label: '本周形成的判断', items: weekly.value.judgments },
        { label: '已进入工程', items: weekly.value.shipped },
        { label: '继续观察', items: weekly.value.watch },
        { label: '停止追踪', items: weekly.value.stopped },
        { label: '下周只保留', items: weekly.value.nextFocus },
      ].filter(section => section.items.length)
    : [],
)

watchEffect(() =>
  setSeoMeta(
    weekly.value
      ? {
          title: `${weekly.value.title}｜xiuqiu`,
          description: weekly.value.summary,
          path: `/radar/week/${weekly.value.slug}`,
        }
      : { title: 'Weekly radar not found｜xiuqiu', path: route.fullPath },
  ),
)
</script>

<template>
  <section class="section page-top radar-detail-page">
    <div v-if="weekly" class="container radar-detail-container">
      <router-link to="/radar" class="back-link">← 返回行业情报雷达</router-link>
      <header class="radar-detail-header">
        <p class="section-label">Reviewed Weekly Convergence</p>
        <h1>{{ weekly.title }}</h1>
        <p>{{ weekly.summary }}</p>
        <time :datetime="weekly.reviewedAt">复核于 {{ weekly.reviewedAt }}</time>
      </header>

      <section v-for="section in sections" :key="section.label" class="radar-weekly-section">
        <p class="section-label">{{ section.label }}</p>
        <ol>
          <li v-for="item in section.items" :key="item">{{ item }}</li>
        </ol>
      </section>

      <section v-if="relatedProjects.length" class="radar-related-projects">
        <p class="project-abilities-title">关联工程</p>
        <router-link
          v-for="project in relatedProjects"
          :key="project!.slug"
          :to="`/projects/${project!.slug}`"
        >
          {{ project!.name }} →
        </router-link>
      </section>

      <footer class="radar-source-footer">
        <strong>复核说明</strong>
        <p>周度收敛只公开人工确认的判断，不复制私人每日记录；来源用于复核，不代表采用或背书。</p>
        <a v-for="url in weekly.sourceUrls" :key="url" :href="url" target="_blank" rel="noopener">
          查看来源 ↗
        </a>
      </footer>
    </div>
    <div v-else class="container not-found">
      <p class="not-found-title">这份周度收敛不存在或尚未公开</p>
      <router-link to="/radar" class="btn btn-primary">返回雷达</router-link>
    </div>
  </section>
</template>
