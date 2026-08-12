<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { allMarketRadars } from '../data/generatedMarketRadarAll'
import type { MarketRadarEvent as StaticMarketRadarEvent } from '../data/generatedMarketRadars'
import { findStaticMarketRadarEvent, type StaticMarketRadarEventMatch } from '../data/marketRadarPresentation'
import type { MarketRadarEventDetail, MarketRadarReport } from '../market-radar/contracts'
import { isSafePublicMarketUrl, parseMarketEventDetail } from '../market-radar/timeline-presentation'
import { setSeoMeta } from '../utils/seo'
import '../styles/market-radar.css'

const route = useRoute()
interface EventPresentation {
  origin: 'api' | 'static'
  id: string
  priority: MarketRadarEventDetail['priority']
  horizon?: MarketRadarEventDetail['horizon']
  status?: StaticMarketRadarEvent['status']
  category?: StaticMarketRadarEvent['category']
  title: string
  summary: string
  whyItMatters: string
  watchFor?: string | null
  invalidation?: string | null
  publishedAt: string
  eventAt: string
  sources: Array<{ name: string; url: string }>
  reports: MarketRadarReport[]
  assets: string[]
  sourceCount: number
  newsDirection?: MarketRadarEventDetail['newsDirection']
  reaction?: MarketRadarEventDetail['reaction']
  systemJudgment?: string
  snapshotSlug?: string
}

const event = ref<EventPresentation | null>(null)
const unavailable = ref<'404' | '503' | ''>('')
const fallbackNotice = ref('')
const loading = ref(true)
let requestVersion = 0
let activeRequest: AbortController | null = null

const directionLabels = { bullish: '偏多', bearish: '偏空', mixed: '分歧', neutral: '中性' }
const reactionLabels = { pending: '待观察', confirmed: '已确认', priced_in: '已计价', ignored: '反应有限', contradicted: '方向相反' }
const horizonLabels = { intraday: '日内', days: '数日', weeks: '数周' }
const statusLabels = { scheduled: '已排期', released: '已发布', monitoring: '观察中' }
const categoryLabels = { macro: '宏观', crypto: '加密', equity: '美股', regulation: '政策' }
const legacyWatchFor = '历史记录未提供独立观察条件。'
const legacyInvalidation = '历史记录未提供独立失效条件。'
const primaryReport = computed(() => event.value?.reports.find(report => report.isPrimary) || null)

function percent(value: number | null | undefined) {
  if (value == null) return '待观察'
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
}

function fromApiEvent(value: MarketRadarEventDetail): EventPresentation {
  return {
    origin: 'api', id: value.id, priority: value.priority, horizon: value.horizon,
    title: value.titleZh, summary: value.summaryZh, whyItMatters: value.whyItMattersZh,
    watchFor: value.watchFor, invalidation: value.invalidation, publishedAt: value.publishedAt,
    eventAt: value.occurredAt, sources: value.sources, reports: value.reports,
    assets: value.assets.map(asset => `${asset.namespace} · ${asset.symbol}`), sourceCount: value.sourceCount,
    newsDirection: value.newsDirection, reaction: value.reaction, systemJudgment: value.systemJudgment,
  }
}

function fromStaticEvent(match: StaticMarketRadarEventMatch): EventPresentation {
  const safeSource = isSafePublicMarketUrl(match.event.sourceUrl)
  return {
    origin: 'static', id: match.event.id, priority: match.event.priority, status: match.event.status,
    category: match.event.category, title: match.event.title, summary: match.event.fact,
    whyItMatters: match.event.whyWatch, watchFor: match.event.watchFor, invalidation: match.event.invalidation,
    publishedAt: match.generatedAt,
    eventAt: match.event.eventAt || `${match.event.sourcePublishedAt}T12:00:00+08:00`,
    sources: safeSource ? [{ name: match.event.sourceName, url: match.event.sourceUrl }] : [],
    reports: [], assets: [...match.event.assets], sourceCount: safeSource ? 1 : 0, snapshotSlug: match.snapshotSlug,
  }
}

function loadStaticFallback(id: string): EventPresentation | undefined {
  const match = findStaticMarketRadarEvent(allMarketRadars, id)
  return match ? fromStaticEvent(match) : undefined
}

watch(() => String(route.params.id || ''), async (id) => {
  const version = ++requestVersion
  activeRequest?.abort()
  activeRequest = new AbortController()
  event.value = null
  unavailable.value = ''
  fallbackNotice.value = ''
  loading.value = true
  setSeoMeta({ title: '交易事件｜xiuqiu', description: '交易雷达事件、来源、资产映射与真实市场反应。', path: `/market-radar/events/${encodeURIComponent(id)}`, indexable: false })
  let responseStatus = 503
  try {
    const response = await fetch(`/api/market-radar/events/${encodeURIComponent(id)}`, { signal: activeRequest.signal })
    responseStatus = response.status
    if (version !== requestVersion) return
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('event-unavailable')
    const payload = parseMarketEventDetail(await response.json())
    if (!payload || (payload.id !== id && payload.slug !== id)) throw new Error('invalid-event')
    if (version !== requestVersion) return
    event.value = fromApiEvent(payload)
    setSeoMeta({ title: `${event.value.title}｜交易雷达`, description: event.value.summary, path: `/market-radar/events/${encodeURIComponent(id)}`, indexable: false })
  } catch (error) {
    if (version !== requestVersion) return
    if (error instanceof DOMException && error.name === 'AbortError') return
    const fallback = loadStaticFallback(id)
    if (fallback) {
      event.value = fallback
      fallbackNotice.value = `${responseStatus === 404 ? '数据库没有这条事件' : '动态事件服务暂时不可用'}；当前展示已提交静态快照，更新时间 ${formatDateTime(fallback.publishedAt)} CST。`
      setSeoMeta({ title: `${fallback.title}｜交易雷达`, description: fallback.summary, path: `/market-radar/events/${encodeURIComponent(id)}`, indexable: false })
    } else {
      unavailable.value = responseStatus === 404 ? '404' : '503'
    }
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
  <div class="trade-radar-page trade-radar-event-page" lang="zh-CN">
    <div class="container trade-radar-shell">
      <router-link class="trade-radar-back" to="/market-radar">← 返回 Trade Radar</router-link>

      <section v-if="loading" class="trade-radar-state trade-radar-event-state" aria-busy="true" aria-live="polite">
        <p class="trade-radar-kicker">Loading event record</p><h1>正在读取事件记录…</h1>
      </section>

      <section v-else-if="unavailable" class="trade-radar-state trade-radar-event-state" role="alert">
        <p class="trade-radar-kicker">{{ unavailable === '404' ? 'Event not found' : 'Event service delayed' }}</p>
        <h1>{{ unavailable === '404' ? '没有找到这条事件记录。' : '事件记录暂时不可读取。' }}</h1>
        <p>{{ unavailable === '404' ? '数据库与已提交静态雷达都没有匹配事件。' : '动态服务返回 503 或无有效数据，且没有可用静态快照。' }}</p>
        <router-link class="trade-radar-primary-link" to="/market-radar">返回交易雷达</router-link>
      </section>

      <article v-else-if="event" class="trade-radar-event-detail">
        <p v-if="fallbackNotice" class="trade-radar-event-fallback" role="status"><strong>静态快照</strong>{{ fallbackNotice }}</p>
        <header class="trade-radar-event-detail-header">
          <div class="trade-event-classification">
            <strong>{{ event.priority }}</strong><span v-if="event.horizon">{{ horizonLabels[event.horizon] }}</span>
            <span v-if="event.status">{{ statusLabels[event.status] }}</span><span v-if="event.category">{{ categoryLabels[event.category] }}</span>
          </div>
          <div class="trade-radar-event-dates">
            <time :datetime="event.publishedAt">记录发布 {{ formatDateTime(event.publishedAt) }} CST</time>
            <time :datetime="event.eventAt">事件时间 {{ formatDateTime(event.eventAt) }} CST</time>
          </div>
        </header>

        <p class="trade-radar-kicker">{{ event.origin === 'api' ? 'Database-backed event record' : 'Generated static event fallback' }}</p>
        <h1>{{ event.title }}</h1><p class="trade-radar-event-lead">{{ event.summary }}</p>

        <section class="trade-radar-event-fact"><h2>事件概览</h2><div><p>{{ event.summary }}</p><p><strong>为什么重要：</strong>{{ event.whyItMatters }}</p></div></section>

        <section class="trade-radar-event-boundaries" aria-labelledby="event-boundaries-title">
          <header><p class="trade-radar-kicker">System observation boundaries</p><h2 id="event-boundaries-title">来源、观察与失效边界始终分开。</h2><p>观察条件由系统结构化生成，不是原始来源原文，也不会自动转成交易指令。</p></header>
          <dl>
            <div><dt>原始来源</dt><dd><ul v-if="event.sources.length"><li v-for="source in event.sources" :key="source.url"><a :href="source.url" target="_blank" rel="noopener noreferrer"><span class="trade-radar-source-name">{{ source.name }}</span><span aria-hidden="true">↗</span></a></li></ul><p v-else class="is-legacy">当前记录没有安全公开的原始来源。</p></dd></div>
            <div><dt>接下来观察</dt><dd><p :class="{ 'is-legacy': !event.watchFor }">{{ event.watchFor || legacyWatchFor }}</p></dd></div>
            <div><dt>何时失效</dt><dd><p :class="{ 'is-legacy': !event.invalidation }">{{ event.invalidation || legacyInvalidation }}</p></dd></div>
          </dl>
        </section>

        <section v-if="event.origin === 'api'" class="trade-radar-event-reaction" aria-labelledby="event-reaction-title">
          <header><p class="trade-radar-kicker">Latest progress / three-layer judgment</p><h2 id="event-reaction-title">最新进展。</h2></header>
          <dl>
            <div><dt>新闻倾向</dt><dd><span>{{ event.newsDirection ? directionLabels[event.newsDirection] : '未记录' }}</span><small>{{ event.newsDirection || 'unavailable' }}</small></dd></div>
            <div><dt>真实行情反应</dt><dd><span>{{ event.reaction ? reactionLabels[event.reaction.status] : '待观察' }}</span><small>5m {{ percent(event.reaction?.excess5m) }} · 30m {{ percent(event.reaction?.excess30m) }} · 4h {{ percent(event.reaction?.excess4h) }}</small></dd></div>
            <div><dt>系统判断</dt><dd><span>{{ event.systemJudgment }}</span><small>观察周期 · {{ event.horizon ? horizonLabels[event.horizon] : '未记录' }}</small></dd></div>
          </dl>
        </section>
        <section v-else class="trade-radar-event-reaction trade-radar-event-reaction--unavailable" aria-labelledby="event-reaction-title">
          <header><p class="trade-radar-kicker">Static record boundary</p><h2 id="event-reaction-title">暂无数据库最新进展。</h2><p>静态快照没有行情反应或系统判断字段；本页不会推测这些值。</p></header>
        </section>

        <section class="trade-radar-event-reports" aria-labelledby="event-reports-title">
          <header><p class="trade-radar-kicker">Source reporting timeline</p><h2 id="event-reports-title">来源报道时间线。</h2>
            <p v-if="primaryReport">主来源：{{ primaryReport.sourceName }}<template v-if="primaryReport.publishedAt"> · 发布 {{ formatDateTime(primaryReport.publishedAt) }} CST</template></p>
            <p v-else>当前详情没有可展示的来源报道。</p>
          </header>
          <ol v-if="event.reports.length">
            <li v-for="report in event.reports" :key="report.id">
              <time v-if="report.publishedAt" :datetime="report.publishedAt">{{ formatDateTime(report.publishedAt) }} CST</time><span v-else>时间未记录</span>
              <div><span v-if="report.isPrimary" class="trade-radar-report-primary">主来源</span><strong>{{ report.title || report.sourceName }}</strong><p v-if="report.excerpt">{{ report.excerpt }}</p><a :href="report.sourceUrl" target="_blank" rel="noopener noreferrer">{{ report.sourceName }} · 核对原文 ↗</a></div>
            </li>
          </ol>
          <p v-else class="trade-radar-reports-empty">暂无可展示的来源报道。</p>
        </section>

        <section class="trade-radar-event-evidence">
          <div><p class="trade-radar-kicker">Affected assets</p><h2>相关资产</h2><div class="trade-event-assets"><span v-for="asset in event.assets" :key="asset">{{ asset }}</span></div></div>
          <div><p class="trade-radar-kicker">Evidence count</p><h2>{{ event.sourceCount }} 个公开来源</h2><p>资产映射、来源证据和系统边界可能继续更新，但不会自动转成交易指令。</p></div>
        </section>

        <router-link v-if="event.snapshotSlug" class="trade-radar-primary-link trade-radar-event-snapshot-link" :to="`/market-radar/${event.snapshotSlug}`">查看所属日期快照 <span aria-hidden="true">→</span></router-link>
        <p class="trade-radar-disclaimer">这是一条事件研究记录，不构成投资建议。来源、行情和系统判断可能继续更新。</p>
      </article>
    </div>
  </div>
</template>
