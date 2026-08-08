<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { MarketRadarEvent } from '../market-radar/contracts'
import { setSeoMeta } from '../utils/seo'
import '../styles/market-radar.css'

const route = useRoute()
const event = ref<MarketRadarEvent | null>(null)
const error = ref('')

function percent(value: number | null | undefined) {
  if (value == null) return '待观察'
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`
}

onMounted(async () => {
  const id = String(route.params.id || '')
  setSeoMeta({ title: '交易事件｜xiuqiu', description: '交易雷达事件、来源、资产映射与真实市场反应。', path: `/market-radar/events/${id}`, indexable: false })
  try {
    const response = await fetch(`/api/market-radar/events/${encodeURIComponent(id)}`)
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || '事件不存在。')
    event.value = payload
    setSeoMeta({ title: `${event.value?.titleZh}｜交易雷达`, description: event.value?.summaryZh, path: `/market-radar/events/${id}`, indexable: false })
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '事件暂时无法读取。'
  }
})
</script>

<template>
  <div class="market-radar-page market-event-detail-page">
    <main class="container market-radar-container">
      <router-link class="market-event-back" to="/market-radar">← 返回交易雷达</router-link>
      <p v-if="error" class="market-radar-alert" role="alert">{{ error }}</p>
      <article v-else-if="event" class="market-event-detail">
        <header><span>{{ event.priority }} · Score {{ event.score }}</span><time :datetime="event.publishedAt">{{ new Date(event.publishedAt).toLocaleString('zh-CN') }}</time></header>
        <h1>{{ event.titleZh }}</h1><p class="market-event-detail-lead">{{ event.summaryZh }}</p>
        <section><h2>为什么重要</h2><p>{{ event.whyItMattersZh }}</p></section>
        <section><h2>三层判断</h2><dl class="market-event-judgments"><div><dt>新闻倾向</dt><dd>{{ event.newsDirection }}</dd></div><div><dt>行情反应</dt><dd>5m {{ percent(event.reaction?.excess5m) }} · 30m {{ percent(event.reaction?.excess30m) }} · 4h {{ percent(event.reaction?.excess4h) }}</dd></div><div><dt>系统判断</dt><dd>{{ event.systemJudgment }}</dd></div></dl></section>
        <section><h2>相关资产</h2><div class="market-event-assets"><span v-for="asset in event.assets" :key="`${asset.namespace}:${asset.symbol}`">{{ asset.namespace }} · {{ asset.symbol }}</span></div></section>
        <section><h2>原始来源</h2><ul class="market-event-sources"><li v-for="source in event.sources" :key="source.url"><a :href="source.url" target="_blank" rel="noopener">{{ source.name }} ↗</a></li></ul></section>
        <p class="market-event-disclaimer">这是一条事件研究记录，不构成投资建议。来源、行情和系统判断可能继续更新。</p>
      </article>
      <div v-else class="market-radar-loading">正在读取事件…</div>
    </main>
  </div>
</template>
