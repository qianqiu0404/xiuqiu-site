<script setup lang="ts">
import { computed, nextTick, ref, watch, watchEffect } from 'vue'
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
const categoryLabels = { macro: '宏观', crypto: '加密', equity: '美股', regulation: '政策' }
const statusLabels = { scheduled: '已排期', released: '已发布', monitoring: '观察中' }
const priorityLabels = { P0: '关键', P1: '重要', P2: '跟踪' }

function formatEventTime(value?: string) {
  if (!value) return '持续观察'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
}

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
}

watch(() => String(route.params.date || ''), async (slug) => {
  const version = ++requestVersion
  loading.value = true
  entry.value = undefined
  let loaded: MarketRadarDaily | undefined
  try { loaded = await loadMarketRadarBySlug(slug) } catch { loaded = undefined }
  if (version !== requestVersion) return
  entry.value = loaded
  loading.value = false

  if (loaded && route.hash) {
    await nextTick()
    const target = document.getElementById(route.hash.slice(1))
    const heading = target?.querySelector<HTMLElement>('h2')
    if (target && heading) {
      target.scrollIntoView({ block: 'start' })
      heading.focus({ preventScroll: true })
    }
  }
}, { immediate: true })

watchEffect(() => {
  if (loading.value) return
  setSeoMeta(entry.value
    ? { title: `${entry.value.title}｜xiuqiu`, description: entry.value.summary, path: `/market-radar/${entry.value.slug}`, type: 'article' }
    : { title: '交易雷达快照不存在｜xiuqiu', path: route.fullPath, indexable: false })
})
</script>

<template>
  <div v-if="loading" class="trade-radar-page trade-radar-state" aria-busy="true" aria-live="polite">
    <div class="container trade-radar-shell"><p class="trade-radar-kicker">Loading snapshot</p><h1>正在载入静态快照…</h1></div>
  </div>

  <div v-else-if="entry" class="trade-radar-page trade-radar-detail" lang="zh-CN">
    <header class="trade-radar-detail-hero">
      <div class="container trade-radar-shell">
        <router-link class="trade-radar-back" to="/market-radar">← 返回 Trade Radar</router-link>
        <p class="trade-radar-kicker">Dated verification snapshot / {{ entry.date }}</p>
        <h1>{{ entry.title }}</h1>
        <p class="trade-radar-detail-lead">{{ entry.summary }}</p>
        <dl class="trade-radar-snapshot-meta">
          <div><dt>事件</dt><dd>{{ entry.events.length }}</dd></div>
          <div><dt>影响资产</dt><dd>{{ allAssets.length }}</dd></div>
          <div><dt>生成时间</dt><dd>{{ formatGeneratedAt(entry.generatedAt) }} CST</dd></div>
        </dl>
      </div>
    </header>

    <div class="container trade-radar-shell trade-radar-detail-layout">
      <aside class="trade-radar-detail-index">
        <p class="trade-radar-kicker">Event index</p>
        <nav aria-label="本期事件目录">
          <a v-for="(event, index) in entry.events" :key="event.id" :href="`#${event.id}`">
            <span>{{ String(index + 1).padStart(2, '0') }}</span><strong>{{ event.title }}</strong>
          </a>
        </nav>
      </aside>

      <div class="trade-radar-detail-body">
        <article v-for="(event, index) in entry.events" :id="event.id" :key="event.id" class="trade-radar-detail-event" :class="`priority-${event.priority.toLowerCase()}`">
          <header>
            <div class="trade-event-classification">
              <strong>{{ event.priority }} · {{ priorityLabels[event.priority] }}</strong>
              <span>{{ categoryLabels[event.category] }}</span>
              <span>{{ statusLabels[event.status] }}</span>
            </div>
            <time v-if="event.eventAt" :datetime="event.eventAt">{{ formatEventTime(event.eventAt) }}</time>
            <span v-else class="trade-event-continuous">持续观察</span>
          </header>

          <p class="trade-radar-event-number">Event {{ String(index + 1).padStart(2, '0') }}</p>
          <h2 tabindex="-1">{{ event.title }}</h2>
          <section class="trade-radar-fact"><h3>已确认事实</h3><p>{{ event.fact }}</p></section>

          <dl class="trade-radar-judgment-grid">
            <div><dt>为什么关注</dt><dd>{{ event.whyWatch }}</dd></div>
            <div><dt>接下来验证</dt><dd>{{ event.watchFor }}</dd></div>
            <div><dt>何时失效</dt><dd>{{ event.invalidation }}</dd></div>
          </dl>

          <footer>
            <div>
              <p>影响资产</p>
              <div class="trade-event-assets"><span v-for="asset in event.assets" :key="asset">{{ asset }}</span></div>
            </div>
            <div class="trade-radar-source-block">
              <span>来源发布 {{ event.sourcePublishedAt }}</span>
              <a :href="event.sourceUrl" target="_blank" rel="noopener">核对 {{ event.sourceName }} <i aria-hidden="true">↗</i></a>
            </div>
          </footer>
        </article>

        <footer class="trade-radar-detail-footer">
          <span>Generated {{ entry.generatedAt }}</span>
          <p>静态研究记录，不接账户、不调用实时行情 API、不自动下单，不构成投资建议。</p>
          <router-link to="/market-radar">返回今日雷达 →</router-link>
        </footer>
      </div>
    </div>
  </div>

  <div v-else class="trade-radar-page trade-radar-state">
    <div class="container trade-radar-shell">
      <p class="trade-radar-kicker">Snapshot unavailable</p>
      <h1>这期交易雷达不存在。</h1>
      <p>它可能尚未通过发布门禁，或日期地址无效。</p>
      <router-link class="trade-radar-primary-link" to="/market-radar">返回交易雷达</router-link>
    </div>
  </div>
</template>
