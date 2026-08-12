<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { LearningRadarStory } from '../learning-radar/contracts'
import { parseLearningStory, toTimelineCardViewModel } from '../learning-radar/timeline-presentation'
import { setSeoMeta } from '../utils/seo'
import '../styles/radar-timeline.css'

const route = useRoute()
const story = ref<LearningRadarStory | null>(null)
const loading = ref(true)
const unavailable = ref<'404' | '503' | ''>('')
let requestVersion = 0
let activeRequest: AbortController | null = null

const card = computed(() => story.value ? toTimelineCardViewModel(story.value) : null)
const followUpUpdates = computed(() => {
  if (!story.value) return []
  return story.value.updates
})

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
}

watch(() => String(route.params.slug || ''), async (slug) => {
  const version = ++requestVersion
  activeRequest?.abort()
  activeRequest = new AbortController()
  story.value = null
  unavailable.value = ''
  loading.value = true
  setSeoMeta({
    title: '学习情报详情｜xiuqiu',
    description: '正在读取可追溯的学习情报详情。',
    path: `/radar/stories/${encodeURIComponent(slug)}`,
    indexable: false,
  })
  try {
    const response = await fetch(`/api/learning-radar/stories/${encodeURIComponent(slug)}`, { signal: activeRequest.signal })
    if (version !== requestVersion) return
    if (response.status === 404) {
      unavailable.value = '404'
      return
    }
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('story-unavailable')
    const payload = parseLearningStory(await response.json())
    if (!payload || payload.slug !== slug) throw new Error('invalid-story')
    if (version !== requestVersion) return
    story.value = payload
    setSeoMeta({
      title: `${payload.titleZh}｜学习雷达`,
      description: payload.summaryZh,
      path: `/radar/stories/${encodeURIComponent(payload.slug)}`,
      type: 'article',
      indexable: false,
    })
  } catch {
    if (version === requestVersion) unavailable.value = '503'
  } finally {
    if (version === requestVersion) loading.value = false
  }
}, { immediate: true })

onBeforeUnmount(() => {
  requestVersion += 1
  activeRequest?.abort()
})
</script>

<template>
  <div class="learn-story-page" lang="zh-CN">
    <div class="container learn-timeline-shell">
      <router-link class="learn-story-back" to="/radar">← 返回学习情报时间线</router-link>
      <section v-if="loading" class="learn-story-state" aria-busy="true" aria-live="polite"><h1>正在读取情报详情…</h1></section>
      <section v-else-if="unavailable" class="learn-story-state" role="alert">
        <p class="learn-timeline-kicker">{{ unavailable === '404' ? 'Story not found' : 'Learning service delayed' }}</p>
        <h1>{{ unavailable === '404' ? '没有找到这条学习情报。' : '学习情报详情暂时不可用。' }}</h1>
        <p>{{ unavailable === '404' ? '链接可能已失效；旧日报与周报入口仍然保留。' : '服务返回 503 或无有效数据；这里不会用其他内容伪装实时详情。' }}</p>
        <router-link class="learn-story-action" to="/radar">返回时间线</router-link>
      </section>
      <article v-else-if="story && card" class="learn-story">
        <header class="learn-story__hero">
          <div class="learn-story__meta"><span>{{ card.categoryLabel }}</span><strong>{{ card.importanceLabel }}</strong><time :datetime="story.occurredAt">{{ formatDate(story.occurredAt) }} CST</time></div>
          <p class="learn-timeline-kicker">Database-backed learning story</p>
          <h1>{{ story.titleZh }}</h1>
          <p>{{ story.summaryZh }}</p>
          <a v-if="card.sourceUrl" :href="card.sourceUrl" target="_blank" rel="noopener noreferrer">阅读原文 <span aria-hidden="true">↗</span></a>
        </header>
        <div class="learn-story__body">
          <section><p class="learn-timeline-kicker">Overview</p><h2>概览</h2><p>{{ story.summaryZh }}</p></section>
          <section><p class="learn-timeline-kicker">Follow-up updates</p><h2>后续更新</h2>
            <ul v-if="followUpUpdates.length"><li v-for="update in followUpUpdates" :key="update.id"><strong>{{ update.titleZh }}</strong><br />{{ update.bodyZh }}</li></ul>
            <p v-else>暂无后续更新；完整摘要保留在概览中。</p>
          </section>
          <section><p class="learn-timeline-kicker">Why selected</p><h2>为什么入选</h2><p>{{ story.whySelectedZh }}</p></section>
          <section class="learn-story__reports"><p class="learn-timeline-kicker">Source reporting timeline</p><h2>来源报道时间线</h2>
            <ol v-if="story.reports.length"><li v-for="report in story.reports" :key="report.id"><time :datetime="report.publishedAt">{{ formatDate(report.publishedAt) }} CST</time><div><strong>{{ report.title }}</strong><p v-if="report.excerpt">{{ report.excerpt }}</p><a :href="report.sourceUrl" target="_blank" rel="noopener noreferrer">{{ report.sourceName }} · 阅读原文 ↗</a></div></li></ol>
            <p v-else>暂无可展示的来源报道。</p>
          </section>
        </div>
      </article>
    </div>
  </div>
</template>
