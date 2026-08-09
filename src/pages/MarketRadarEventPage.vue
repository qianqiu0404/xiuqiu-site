<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { MarketRadarEvent } from '../market-radar/contracts'
import { setSeoMeta } from '../utils/seo'
import '../styles/market-radar.css'

const route = useRoute()
const event = ref<MarketRadarEvent | null>(null)
const error = ref('')
const loading = ref(true)
let requestVersion = 0

const directionLabels = { bullish: '偏多', bearish: '偏空', mixed: '分歧', neutral: '中性' }
const reactionLabels = { pending: '待观察', confirmed: '已确认', priced_in: '已计价', ignored: '反应有限', contradicted: '方向相反' }
const horizonLabels = { intraday: '日内', days: '数日', weeks: '数周' }

function percent(value: number | null | undefined) {
  if (value == null) return '待观察'
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
}

watch(() => String(route.params.id || ''), async (id) => {
  const version = ++requestVersion
  event.value = null
  error.value = ''
  loading.value = true
  setSeoMeta({ title: '交易事件｜xiuqiu', description: '交易雷达事件、来源、资产映射与真实市场反应。', path: `/market-radar/events/${id}`, indexable: false })
  try {
    const response = await fetch(`/api/market-radar/events/${encodeURIComponent(id)}`)
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('invalid-response')
    const payload = await response.json() as (MarketRadarEvent & { error?: string }) | null
    if (!response.ok) throw new Error(payload?.error || '事件不存在。')
    if (!payload || typeof payload.titleZh !== 'string') throw new Error('invalid-event')
    if (version !== requestVersion) return
    event.value = payload
    setSeoMeta({ title: `${event.value?.titleZh}｜交易雷达`, description: event.value?.summaryZh, path: `/market-radar/events/${id}`, indexable: false })
  } catch {
    if (version !== requestVersion) return
    error.value = '研究服务暂时没有返回可用的事件记录。你仍可查看已通过发布门禁的静态雷达。'
  } finally {
    if (version === requestVersion) loading.value = false
  }
}, { immediate: true })
</script>

<template>
  <div class="trade-radar-page trade-radar-event-page" lang="zh-CN">
    <div class="container trade-radar-shell">
      <router-link class="trade-radar-back" to="/market-radar">← 返回 Trade Radar</router-link>

      <section v-if="loading" class="trade-radar-state trade-radar-event-state" aria-busy="true" aria-live="polite">
        <p class="trade-radar-kicker">Loading event record</p><h1>正在读取事件记录…</h1>
      </section>

      <section v-else-if="error" class="trade-radar-state trade-radar-event-state" role="alert">
        <p class="trade-radar-kicker">Event unavailable</p>
        <h1>事件记录暂时不可读取。</h1>
        <p>{{ error }}</p>
        <router-link class="trade-radar-primary-link" to="/market-radar">查看静态交易雷达</router-link>
      </section>

      <article v-else-if="event" class="trade-radar-event-detail">
        <header class="trade-radar-event-detail-header">
          <div class="trade-event-classification"><strong>{{ event.priority }}</strong><span>Score {{ event.score }}</span><span>{{ horizonLabels[event.horizon] }}</span></div>
          <time :datetime="event.publishedAt">发布 {{ formatDateTime(event.publishedAt) }} CST</time>
        </header>

        <p class="trade-radar-kicker">Database-backed event record</p>
        <h1>{{ event.titleZh }}</h1>
        <p class="trade-radar-event-lead">{{ event.summaryZh }}</p>

        <section class="trade-radar-event-fact"><h2>为什么重要</h2><p>{{ event.whyItMattersZh }}</p></section>

        <section class="trade-radar-event-reaction" aria-labelledby="event-reaction-title">
          <header><p class="trade-radar-kicker">Three-layer judgment</p><h2 id="event-reaction-title">把新闻、行情与系统判断分开。</h2></header>
          <dl>
            <div><dt>新闻倾向</dt><dd><span>{{ directionLabels[event.newsDirection] }}</span><small>{{ event.newsDirection }}</small></dd></div>
            <div><dt>真实行情反应</dt><dd><span>{{ event.reaction ? reactionLabels[event.reaction.status] : '待观察' }}</span><small>5m {{ percent(event.reaction?.excess5m) }} · 30m {{ percent(event.reaction?.excess30m) }} · 4h {{ percent(event.reaction?.excess4h) }}</small></dd></div>
            <div><dt>系统判断</dt><dd><span>{{ event.systemJudgment }}</span><small>观察周期 · {{ horizonLabels[event.horizon] }}</small></dd></div>
          </dl>
        </section>

        <section class="trade-radar-event-evidence">
          <div><p class="trade-radar-kicker">Affected assets</p><h2>相关资产</h2><div class="trade-event-assets"><span v-for="asset in event.assets" :key="`${asset.namespace}:${asset.symbol}`">{{ asset.namespace }} · {{ asset.symbol }}</span></div></div>
          <div><p class="trade-radar-kicker">Primary sources / {{ event.sourceCount }}</p><h2>原始来源</h2><ul><li v-for="source in event.sources" :key="source.url"><a :href="source.url" target="_blank" rel="noopener">{{ source.name }} <span aria-hidden="true">↗</span></a></li></ul></div>
        </section>

        <p class="trade-radar-disclaimer">这是一条事件研究记录，不构成投资建议。来源、行情和系统判断可能继续更新。</p>
      </article>
    </div>
  </div>
</template>
