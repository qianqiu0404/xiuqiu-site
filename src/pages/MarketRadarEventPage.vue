<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { allMarketRadars } from '../data/generatedMarketRadarAll'
import type { MarketRadarEvent as StaticMarketRadarEvent } from '../data/generatedMarketRadars'
import { findStaticMarketRadarEvent, type StaticMarketRadarEventMatch } from '../data/marketRadarPresentation'
import type { MarketRadarEvent } from '../market-radar/contracts'
import { setSeoMeta } from '../utils/seo'
import '../styles/market-radar.css'

const route = useRoute()
interface EventPresentation {
  origin: 'api' | 'static'
  priority: MarketRadarEvent['priority']
  horizon?: MarketRadarEvent['horizon']
  status?: StaticMarketRadarEvent['status']
  category?: StaticMarketRadarEvent['category']
  title: string
  summary: string
  whyItMatters: string
  watchFor?: string | null
  invalidation?: string | null
  publishedAt: string
  eventAt?: string
  sources: Array<{ name: string; url: string }>
  assets: string[]
  sourceCount: number
  newsDirection?: MarketRadarEvent['newsDirection']
  reaction?: MarketRadarEvent['reaction']
  systemJudgment?: string
  snapshotSlug?: string
}

const event = ref<EventPresentation | null>(null)
const error = ref('')
const loading = ref(true)
let requestVersion = 0

const directionLabels = { bullish: '偏多', bearish: '偏空', mixed: '分歧', neutral: '中性' }
const reactionLabels = { pending: '待观察', confirmed: '已确认', priced_in: '已计价', ignored: '反应有限', contradicted: '方向相反' }
const horizonLabels = { intraday: '日内', days: '数日', weeks: '数周' }
const statusLabels = { scheduled: '已排期', released: '已发布', monitoring: '观察中' }
const categoryLabels = { macro: '宏观', crypto: '加密', equity: '美股', regulation: '政策' }
const legacyWatchFor = '历史记录未提供独立观察条件。'
const legacyInvalidation = '历史记录未提供独立失效条件。'

function percent(value: number | null | undefined) {
  if (value == null) return '待观察'
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
}

function fromApiEvent(value: MarketRadarEvent): EventPresentation {
  return {
    origin: 'api',
    priority: value.priority,
    horizon: value.horizon,
    title: value.titleZh,
    summary: value.summaryZh,
    whyItMatters: value.whyItMattersZh,
    watchFor: value.watchFor,
    invalidation: value.invalidation,
    publishedAt: value.publishedAt,
    sources: value.sources,
    assets: value.assets.map(asset => `${asset.namespace} · ${asset.symbol}`),
    sourceCount: value.sourceCount,
    newsDirection: value.newsDirection,
    reaction: value.reaction,
    systemJudgment: value.systemJudgment,
  }
}

function fromStaticEvent(match: StaticMarketRadarEventMatch): EventPresentation {
  return {
    origin: 'static',
    priority: match.event.priority,
    status: match.event.status,
    category: match.event.category,
    title: match.event.title,
    summary: match.event.fact,
    whyItMatters: match.event.whyWatch,
    watchFor: match.event.watchFor,
    invalidation: match.event.invalidation,
    publishedAt: match.event.sourcePublishedAt,
    eventAt: match.event.eventAt,
    sources: [{ name: match.event.sourceName, url: match.event.sourceUrl }],
    assets: [...match.event.assets],
    sourceCount: 1,
    snapshotSlug: match.snapshotSlug,
  }
}

function loadStaticFallback(id: string): EventPresentation | undefined {
  const match = findStaticMarketRadarEvent(allMarketRadars, id)
  return match ? fromStaticEvent(match) : undefined
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
    event.value = fromApiEvent(payload)
    setSeoMeta({ title: `${event.value.title}｜交易雷达`, description: event.value.summary, path: `/market-radar/events/${id}`, indexable: false })
  } catch {
    if (version !== requestVersion) return
    const fallback = loadStaticFallback(id)
    if (fallback) {
      event.value = fallback
      setSeoMeta({ title: `${fallback.title}｜交易雷达`, description: fallback.summary, path: `/market-radar/events/${id}`, indexable: false })
    } else {
      error.value = '研究服务暂时没有返回可用的事件记录，静态雷达中也没有匹配事件。'
    }
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
          <div class="trade-event-classification">
            <strong>{{ event.priority }}</strong>
            <span v-if="event.horizon">{{ horizonLabels[event.horizon] }}</span>
            <span v-if="event.status">{{ statusLabels[event.status] }}</span>
            <span v-if="event.category">{{ categoryLabels[event.category] }}</span>
          </div>
          <div class="trade-radar-event-dates">
            <time :datetime="event.publishedAt">{{ event.origin === 'api' ? `发布 ${formatDateTime(event.publishedAt)} CST` : `来源发布 ${event.publishedAt}` }}</time>
            <time v-if="event.eventAt" :datetime="event.eventAt">事件时间 {{ formatDateTime(event.eventAt) }} CST</time>
          </div>
        </header>

        <p class="trade-radar-kicker">{{ event.origin === 'api' ? 'Database-backed event record' : 'Generated static event fallback' }}</p>
        <h1>{{ event.title }}</h1>
        <p class="trade-radar-event-lead">{{ event.summary }}</p>

        <section class="trade-radar-event-fact"><h2>为什么重要</h2><p>{{ event.whyItMatters }}</p></section>

        <section class="trade-radar-event-boundaries" aria-labelledby="event-boundaries-title">
          <header>
            <p class="trade-radar-kicker">System observation boundaries</p>
            <h2 id="event-boundaries-title">来源、观察与失效边界始终分开。</h2>
            <p>下列观察条件由系统结构化生成，不是原始来源的原文。</p>
          </header>
          <dl>
            <div>
              <dt>原始来源</dt>
              <dd>
                <ul v-if="event.sources.length">
                  <li v-for="source in event.sources" :key="source.url"><a :href="source.url" target="_blank" rel="noopener"><span class="trade-radar-source-name">{{ source.name }}</span><span aria-hidden="true">↗</span></a></li>
                </ul>
                <p v-else class="is-legacy">当前记录没有可公开的原始来源。</p>
              </dd>
            </div>
            <div>
              <dt>接下来观察</dt>
              <dd><p :class="{ 'is-legacy': !event.watchFor }">{{ event.watchFor || legacyWatchFor }}</p></dd>
            </div>
            <div>
              <dt>何时失效</dt>
              <dd><p :class="{ 'is-legacy': !event.invalidation }">{{ event.invalidation || legacyInvalidation }}</p></dd>
            </div>
          </dl>
        </section>

        <section v-if="event.origin === 'api'" class="trade-radar-event-reaction" aria-labelledby="event-reaction-title">
          <header><p class="trade-radar-kicker">Three-layer judgment</p><h2 id="event-reaction-title">把新闻、行情与系统判断分开。</h2></header>
          <dl>
            <div><dt>新闻倾向</dt><dd><span>{{ event.newsDirection ? directionLabels[event.newsDirection] : '未记录' }}</span><small>{{ event.newsDirection || 'unavailable' }}</small></dd></div>
            <div><dt>真实行情反应</dt><dd><span>{{ event.reaction ? reactionLabels[event.reaction.status] : '待观察' }}</span><small>5m {{ percent(event.reaction?.excess5m) }} · 30m {{ percent(event.reaction?.excess30m) }} · 4h {{ percent(event.reaction?.excess4h) }}</small></dd></div>
            <div><dt>系统判断</dt><dd><span>{{ event.systemJudgment }}</span><small>观察周期 · {{ event.horizon ? horizonLabels[event.horizon] : '未记录' }}</small></dd></div>
          </dl>
        </section>

        <section v-else class="trade-radar-event-reaction trade-radar-event-reaction--unavailable" aria-labelledby="event-reaction-title">
          <header>
            <p class="trade-radar-kicker">Static record boundary</p>
            <h2 id="event-reaction-title">行情反应与系统判断尚未记录。</h2>
            <p>静态快照没有行情反应或系统判断字段；本页不会推测这些值。</p>
          </header>
        </section>

        <section class="trade-radar-event-evidence">
          <div><p class="trade-radar-kicker">Affected assets</p><h2>相关资产</h2><div class="trade-event-assets"><span v-for="asset in event.assets" :key="asset">{{ asset }}</span></div></div>
          <div><p class="trade-radar-kicker">Evidence count</p><h2>{{ event.sourceCount }} 个公开来源</h2><p>资产映射、来源证据和系统边界可能继续更新，但不会自动转成交易指令。</p></div>
        </section>

        <router-link v-if="event.snapshotSlug" class="trade-radar-primary-link trade-radar-event-snapshot-link" :to="`/market-radar/${event.snapshotSlug}`">
          查看所属日期快照 <span aria-hidden="true">→</span>
        </router-link>

        <p class="trade-radar-disclaimer">这是一条事件研究记录，不构成投资建议。来源、行情和系统判断可能继续更新。</p>
      </article>
    </div>
  </div>
</template>
