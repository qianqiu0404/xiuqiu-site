<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import MarketTimelineCard from '../components/MarketTimelineCard.vue'
import { latestMarketRadars, marketRadarIndex } from '../data/generatedMarketRadars'
import type { MarketRadarSummary } from '../market-radar/contracts'
import {
  buildStaticTradeTimeline,
  formatTradeTimelineTime,
  groupHistoricalTradeTimeline,
  parseMarketTimelineList,
  parseMarketTimelineSummary,
  partitionTradeTimeline,
  toTradeTimelineCard,
  type TradeTimelineCardViewModel,
} from '../market-radar/timeline-presentation'
import { setSeoMeta } from '../utils/seo'
import '../styles/market-radar.css'

const latest = latestMarketRadars[0]
const apiCards = ref<TradeTimelineCardViewModel[]>([])
const summary = ref<MarketRadarSummary | null>(null)
const origin = ref<'api' | 'static'>('static')
const loading = ref(true)
const statusMessage = ref('')
let requestVersion = 0
let activeRequest: AbortController | null = null

const staticBaseCards = buildStaticTradeTimeline(latest)
const committedScheduleCards = (() => {
  const ids = new Set<string>()
  return latestMarketRadars.flatMap(buildStaticTradeTimeline)
    .filter(item => item.statusLabel === '已排期' && Date.parse(item.occurredAt) > Date.now())
    .filter(item => ids.has(item.id) ? false : (ids.add(item.id), true))
})()

const cards = computed(() => {
  const base = origin.value === 'api' ? apiCards.value : staticBaseCards
  const ids = new Set(base.map(item => item.id))
  return [...base, ...committedScheduleCards.filter(item => !ids.has(item.id))]
})
const partitioned = computed(() => partitionTradeTimeline(cards.value))
const futureCards = computed(() => partitioned.value.future)
const historicalGroups = computed(() => groupHistoricalTradeTimeline(partitioned.value.historical))
const hasStaticSchedule = computed(() => futureCards.value.some(item => item.origin === 'static'))
const summaryAvailable = computed(() => Boolean(summary.value && summary.value.status !== 'unconfigured'))
const totalEventCount = computed(() => origin.value === 'static' ? cards.value.length
  : summaryAvailable.value ? summary.value?.eventCount24h : '—')
const highPriorityCount = computed(() => origin.value === 'static'
  ? cards.value.filter(item => item.priority === 'P0' || item.priority === 'P1').length
  : summaryAvailable.value ? Number(summary.value?.p0Count24h || 0) + Number(summary.value?.p1Count24h || 0) : '—')
const nextEvent = computed(() => futureCards.value[0])
const updatedAt = computed(() => origin.value === 'static'
  ? latest?.generatedAt || new Date(0).toISOString()
  : (summaryAvailable.value ? summary.value?.latestEventAt : null) || apiCards.value.reduce<string | null>((latestValue, item) => (
    !latestValue || item.publishedAt > latestValue ? item.publishedAt : latestValue
  ), null) || new Date(0).toISOString())
const scheduleUpdatedAt = computed(() => committedScheduleCards.reduce<string | null>((latestValue, item) => (
  !latestValue || item.publishedAt > latestValue ? item.publishedAt : latestValue
), null))

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
}

async function requestSummary(signal: AbortSignal): Promise<MarketRadarSummary | null> {
  try {
    const response = await fetch('/api/market-radar/summary', { signal })
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return null
    return parseMarketTimelineSummary(await response.json())
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    return null
  }
}

async function loadTimeline() {
  const version = ++requestVersion
  activeRequest?.abort()
  activeRequest = new AbortController()
  loading.value = true
  statusMessage.value = ''
  apiCards.value = []
  summary.value = null
  try {
    const [itemsResponse, summaryPayload] = await Promise.all([
      fetch('/api/market-radar/events?window=168&limit=50', { signal: activeRequest.signal }),
      requestSummary(activeRequest.signal),
    ])
    if (version !== requestVersion) return
    if (!itemsResponse.ok || !itemsResponse.headers.get('content-type')?.includes('application/json')) throw new Error('events-unavailable')
    const timeline = parseMarketTimelineList(await itemsResponse.json())
    if (!timeline || timeline.status === 'unconfigured') throw new Error('events-unconfigured')
    apiCards.value = timeline.items.map(toTradeTimelineCard)
    summary.value = summaryPayload
    origin.value = 'api'
    statusMessage.value = timeline.status === 'degraded'
      ? timeline.message || '事件列表当前延迟；已显示内容仍来自数据库公开记录。'
      : summaryPayload?.status === 'degraded'
        ? summaryPayload.message || '汇总状态延迟；事件列表仍为数据库公开记录。'
        : !summaryPayload || summaryPayload.status === 'unconfigured'
          ? '汇总状态不可用；事件列表仍为数据库公开记录。' : ''
  } catch (error) {
    if (version !== requestVersion) return
    if (error instanceof DOMException && error.name === 'AbortError') return
    origin.value = 'static'
    statusMessage.value = '动态交易事件暂时不可用，当前展示已提交的静态雷达快照。'
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

onMounted(() => {
  setSeoMeta({
    title: '交易研究雷达｜xiuqiu',
    description: '基于公开来源的交易事件时间线：事实、影响资产、观察条件和失效边界分开呈现，不调用账户或自动下单。',
    path: '/market-radar',
  })
  void loadTimeline()
})

onBeforeUnmount(() => {
  requestVersion += 1
  activeRequest?.abort()
})
</script>

<template>
  <div class="trade-radar-page" lang="zh-CN">
    <header class="trade-radar-hero">
      <div class="container trade-radar-shell trade-radar-hero-grid">
        <div class="trade-radar-hero-copy">
          <p class="trade-radar-kicker">Trade Radar / Verified event intelligence</p>
          <h1>先看发生了什么。<span>再判断市场怎么走。</span></h1>
          <p class="trade-radar-lead">事实、影响资产、观察条件与失效边界分开记录；较远预定事件只来自已提交静态排期。它不告诉你买什么。</p>
        </div>
        <aside class="trade-radar-boundary" aria-label="研究与执行边界">
          <span>Research boundary</span><strong>不接账户 · 不自动下单</strong>
          <p>数据库时间线只承载已发生或临近事件；未来排期明确标注静态快照，市场反应仍需发生后验证。</p>
        </aside>
      </div>
    </header>

    <div class="trade-radar-main">
      <section class="container trade-radar-shell trade-radar-status" aria-labelledby="radar-status-title">
        <h2 id="radar-status-title" class="trade-radar-sr-only">交易雷达状态摘要</h2>
        <dl class="trade-radar-metrics">
          <div><dt>总事件</dt><dd>{{ totalEventCount }}</dd></div>
          <div class="is-urgent"><dt>P0 + P1</dt><dd>{{ highPriorityCount }}</dd></div>
          <div><dt>下一事件</dt><dd>{{ nextEvent ? formatTradeTimelineTime(nextEvent.occurredAt) : '持续观察' }}</dd></div>
          <div><dt>更新于</dt><dd>{{ formatGeneratedAt(updatedAt) }} CST</dd></div>
        </dl>
      </section>

      <div class="container trade-radar-shell trade-radar-runtime-status">
        <div v-if="origin === 'static'" class="trade-radar-static-notice" role="status">
          <strong>静态快照</strong><p>{{ statusMessage || '正在读取数据库时间线。' }} 快照更新时间 {{ formatGeneratedAt(updatedAt) }} CST，不代表实时状态。</p>
          <router-link v-if="latest" :to="`/market-radar/${latest.slug}`">查看日期快照</router-link>
        </div>
        <p v-else-if="statusMessage" class="trade-radar-api-notice" role="status">{{ statusMessage }}</p>
      </div>

      <section class="container trade-radar-shell trade-radar-brief" aria-labelledby="trade-next-title">
        <header class="trade-radar-section-heading">
          <div><p class="trade-radar-kicker">Scheduled / committed evidence</p><h2 id="trade-next-title">接下来。</h2></div>
          <router-link v-if="latest" class="trade-radar-text-link" :to="`/market-radar/${latest.slug}`">阅读完整快照 <span aria-hidden="true">↗</span></router-link>
        </header>
        <p v-if="hasStaticSchedule" class="trade-radar-schedule-note">静态排期快照 · 更新于 {{ scheduleUpdatedAt ? formatGeneratedAt(scheduleUpdatedAt) : '未知' }} CST；较远预定事件不来自数据库 live 时间线。</p>
        <div v-if="loading" class="trade-radar-timeline-state" aria-busy="true" aria-live="polite">正在读取交易事件…</div>
        <div v-else-if="futureCards.length" class="trade-event-list trade-event-list--future">
          <MarketTimelineCard v-for="(item, index) in futureCards" :key="item.id" :item="item" :index="index" />
        </div>
        <p v-else class="trade-radar-timeline-state">当前没有已确认的未来排期；持续观察不等于没有风险。</p>
      </section>

      <section class="container trade-radar-shell trade-radar-brief trade-radar-occurred" aria-labelledby="trade-occurred-title">
        <header class="trade-radar-section-heading">
          <div><p class="trade-radar-kicker">Occurred / reverse chronological</p><h2 id="trade-occurred-title">已发生。</h2></div>
          <time :datetime="updatedAt">更新 {{ formatGeneratedAt(updatedAt) }} CST</time>
        </header>
        <template v-if="!loading && historicalGroups.length">
          <section v-for="group in historicalGroups" :key="group.date" class="trade-radar-date-group" :aria-labelledby="`trade-date-${group.date}`">
            <h3 :id="`trade-date-${group.date}`"><time :datetime="group.date">{{ group.label }}</time></h3>
            <div class="trade-event-list"><MarketTimelineCard v-for="(item, index) in group.items" :key="item.id" :item="item" :index="index" /></div>
          </section>
        </template>
        <p v-else-if="!loading" class="trade-radar-timeline-state">当前没有通过公开门禁的已发生事件。</p>
      </section>

      <section class="container trade-radar-shell trade-radar-archive" aria-labelledby="trade-archive-title">
        <header class="trade-radar-section-heading"><div><p class="trade-radar-kicker">Verification archive</p><h2 id="trade-archive-title">历史快照，不覆盖改写。</h2></div></header>
        <nav aria-label="交易雷达历史快照">
          <router-link v-for="entry in marketRadarIndex" :key="entry.slug" :to="`/market-radar/${entry.slug}`">
            <time :datetime="entry.date">{{ entry.date }}</time><strong>{{ entry.leadTitle }}</strong>
            <span>{{ entry.eventCount }} 事件 · {{ entry.assetCount }} 资产 <i aria-hidden="true">↗</i></span>
          </router-link>
        </nav>
      </section>

      <p class="container trade-radar-shell trade-radar-disclaimer">内容仅供研究与教育，不构成投资建议。事实必须回到原始来源复核；市场反应必须在事件发生后单独记录。</p>
    </div>
  </div>
</template>
