<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { allMarketRadars, findStaticMarketRadarEvent, getSnapshotFreshness, readingReturnLink, withReadingReturn } from '../data'
import type { StaticMarketRadarEvent, StaticMarketRadarEventMatch } from '../data'
import type { MarketRadarEvent } from '../../../market-radar/contracts'
import { setSeoMeta } from '../../../utils/seo'
import '../../../design/brief.css'
import '../../../design/reader.css'
import '../../../design/market-reader.css'

const route = useRoute()
const returnLink = computed(() => route.query.from ? readingReturnLink(route.query.from) : { href: '/market-radar', label: '← 返回市场雷达' })
interface EventPresentation {
  origin: 'api' | 'static'
  priority: MarketRadarEvent['priority']
  score?: number
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
const eventFreshness = computed(() => getSnapshotFreshness(event.value?.snapshotSlug || event.value?.publishedAt))
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
    score: value.score,
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
  <div class="brief market-reader" lang="zh-CN" :data-snapshot-state="eventFreshness.state">
    <header class="brief-masthead">
      <div class="brief-shell">
        <router-link class="brief-back" :to="returnLink.href">{{ returnLink.label }}</router-link>

        <template v-if="loading">
          <p class="brief-dateline"><span>市场雷达</span><span>事件记录</span></p>
          <h1 aria-busy="true" aria-live="polite">正在读取事件记录…</h1>
        </template>

        <template v-else-if="error">
          <p class="brief-dateline"><span>市场雷达</span><span>事件记录</span></p>
          <h1>事件记录暂时不可读取。</h1>
          <p class="brief-state" role="alert">{{ error }}</p>
          <router-link class="brief-button brief-button--primary" :to="returnLink.href">{{ returnLink.label }}</router-link>
        </template>

        <template v-else-if="event">
          <p class="brief-dateline">
            <span>市场雷达</span>
            <span>{{ eventFreshness.isArchive ? '历史事件记录' : event.origin === 'api' ? '数据库事件记录' : '静态快照事件' }}</span>
            <time :datetime="event.publishedAt">{{ event.origin === 'api' ? `发布 ${formatDateTime(event.publishedAt)}（北京时间）` : `来源发布 ${event.publishedAt}` }}</time>
          </p>
          <p class="brief-card-meta">
            <b :class="`brief-tag brief-tag--${event.priority.toLowerCase()}`">{{ event.priority }}</b>
            <b v-if="event.category" class="brief-tag brief-tag--market">{{ categoryLabels[event.category] }}</b>
            <span v-if="event.status">{{ eventFreshness.isArchive ? `快照时：${statusLabels[event.status]}` : statusLabels[event.status] }}</span>
            <span v-if="event.score !== undefined">评分 {{ event.score }}</span>
            <span v-if="event.horizon">观察周期 {{ horizonLabels[event.horizon] }}</span>
            <time v-if="event.eventAt" :datetime="event.eventAt">事件时间 {{ formatDateTime(event.eventAt) }}（北京时间）</time>
          </p>
          <h1>{{ event.title }}</h1>
          <p class="brief-lede">{{ event.summary }}</p>
          <p v-if="eventFreshness.isArchive" class="brief-fresh brief-fresh--stale" role="status">
            {{ eventFreshness.label }} · 这条记录来自历史快照；事件状态和观察条件只描述当时，不代表今天仍然有效。
          </p>
        </template>
      </div>
    </header>

    <div v-if="event && !loading && !error" class="brief-shell market-event-body">
      <article class="reader-article">
        <p class="reader-why">{{ event.whyItMatters }}</p>

        <dl class="reader-answers trade-radar-event-boundaries">
          <div>
            <dt>原始来源</dt>
            <dd>
              <ul v-if="event.sources.length" class="reader-sources">
                <li v-for="source in event.sources" :key="source.url"><a :href="source.url" target="_blank" rel="noopener"><span class="market-source-name">{{ source.name }}</span><i aria-hidden="true">↗</i></a></li>
              </ul>
              <p v-else class="market-legacy">当前记录没有可公开的原始来源。</p>
            </dd>
          </div>
          <div>
            <dt>接下来观察</dt>
            <dd><p :class="{ 'market-legacy': !event.watchFor }">{{ event.watchFor || legacyWatchFor }}</p></dd>
          </div>
          <div>
            <dt>何时失效</dt>
            <dd><p :class="{ 'market-legacy': !event.invalidation }">{{ event.invalidation || legacyInvalidation }}</p></dd>
          </div>
          <div v-if="event.assets.length">
            <dt>相关资产</dt>
            <dd><ul class="market-assets"><li v-for="asset in event.assets" :key="asset">{{ asset }}</li></ul></dd>
          </div>
        </dl>
        <p class="market-note">观察与失效条件由系统结构化生成，不是原始来源的原文。共 {{ event.sourceCount }} 个公开来源。</p>
      </article>

      <section v-if="event.origin === 'api'" class="reader-section" aria-labelledby="event-reaction-title">
        <header class="reader-section-header">
          <h2 id="event-reaction-title">新闻、行情与系统判断</h2>
          <small>三层分开记录</small>
        </header>
        <dl class="reader-answers">
          <div><dt>新闻倾向</dt><dd>{{ event.newsDirection ? directionLabels[event.newsDirection] : '未记录' }}</dd></div>
          <div><dt>行情反应</dt><dd>{{ event.reaction ? reactionLabels[event.reaction.status] : '待观察' }} · 5 分钟 {{ percent(event.reaction?.excess5m) }} · 30 分钟 {{ percent(event.reaction?.excess30m) }} · 4 小时 {{ percent(event.reaction?.excess4h) }}</dd></div>
          <div><dt>系统判断</dt><dd>{{ event.systemJudgment }}</dd></div>
        </dl>
      </section>

      <p v-else class="market-note">静态快照没有 score、行情反应或系统判断字段；本页不会推测这些值。</p>

      <div class="market-event-links">
        <router-link v-if="event.snapshotSlug" :to="withReadingReturn(`/market-radar/${event.snapshotSlug}`, route.query.from)">查看所属日期快照 <span aria-hidden="true">→</span></router-link>
      </div>

      <footer class="market-footer">
        <p>这是一条事件研究记录，不构成投资建议。来源、行情和系统判断可能继续更新。</p>
      </footer>
    </div>
  </div>
</template>
