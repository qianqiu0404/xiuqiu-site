<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import type { MarketRadarDaily } from '../data/generatedMarketRadars'
import { loadMarketRadarBySlug } from '../data/generatedMarketRadarLoader'
import { setSeoMeta } from '../utils/seo'
import '../styles/market-radar.css'

const route = useRoute()
const entry = ref<MarketRadarDaily>()
const loading = ref(true)
let requestVersion = 0
const allAssets = computed(() => entry.value ? [...new Set(entry.value.events.flatMap(event => event.assets))] : [])

watch(() => String(route.params.date || ''), async (slug) => {
  const version = ++requestVersion
  loading.value = true
  entry.value = undefined
  let loaded: MarketRadarDaily | undefined
  try { loaded = await loadMarketRadarBySlug(slug) } catch { loaded = undefined }
  if (version !== requestVersion) return
  entry.value = loaded
  loading.value = false
}, { immediate: true })

watchEffect(() => {
  if (loading.value) return
  setSeoMeta(entry.value
    ? { title: `${entry.value.title}｜xiuqiu`, description: entry.value.summary, path: `/market-radar/${entry.value.slug}`, type: 'article' }
    : { title: '交易雷达快照不存在｜xiuqiu', path: route.fullPath, indexable: false })
})
</script>

<template>
  <main v-if="loading" class="trade-radar-not-found" aria-busy="true"><div class="container"><p>正在载入静态快照…</p></div></main>
  <main v-else-if="entry" class="trade-radar-detail" lang="zh-CN">
    <header class="trade-radar-detail-hero"><div class="container trade-radar-shell">
      <router-link to="/market-radar">← Trade Radar</router-link>
      <p class="trade-radar-kicker">Dated verification snapshot</p><h1>{{ entry.title }}</h1><p>{{ entry.summary }}</p>
      <div class="trade-event-assets"><span v-for="asset in allAssets" :key="asset">{{ asset }}</span></div>
    </div></header>
    <div class="container trade-radar-shell trade-radar-detail-body">
      <article v-for="(event, index) in entry.events" :key="event.id" :id="event.id" class="trade-radar-detail-event">
        <header><span>{{ String(index + 1).padStart(2, '0') }} / {{ event.priority }}</span><small>{{ event.category }} · {{ event.status }}</small></header>
        <h2>{{ event.title }}</h2>
        <section><h3>已确认事实</h3><p>{{ event.fact }}</p></section>
        <section><h3>为什么值得观察</h3><p>{{ event.whyWatch }}</p></section>
        <section><h3>下一步验证</h3><p>{{ event.watchFor }}</p></section>
        <section><h3>不要越过的边界</h3><p>{{ event.invalidation }}</p></section>
        <div class="trade-event-assets"><span v-for="asset in event.assets" :key="asset">{{ asset }}</span></div>
        <a :href="event.sourceUrl" target="_blank" rel="noopener">打开 {{ event.sourceName }} 原始来源 ↗</a>
      </article>
      <footer><span>Generated {{ entry.generatedAt }}</span><p>静态研究记录，不接账户、不调用实时行情 API、不自动下单，不构成投资建议。</p></footer>
    </div>
  </main>
  <main v-else class="trade-radar-not-found"><div class="container"><p>这期交易雷达不存在或未通过发布门禁。</p><router-link to="/market-radar">返回交易雷达</router-link></div></main>
</template>
