<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import MarketTimelineCard from '../components/MarketTimelineCard.vue'
import { latestMarketRadars, marketRadarIndex } from '../data/generatedMarketRadars'
import type { MarketRadarSummary } from '../market-radar/contracts'
import {
  buildStaticTradeTimeline,
  formatTradeTimelineTime,
  groupHistoricalTradeTimeline,
  mergeTradeTimelinePage,
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
const loadingMore = ref(false)
const statusMessage = ref('')
const paginationMessage = ref('')
const nextCursor = ref<string | null>(null)
const requestedCursors = ref<string[]>([])
let requestVersion = 0
let activeRequest: AbortController | null = null
let paginationRequest: AbortController | null = null

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
const futureGroups = computed(() => groupHistoricalTradeTimeline(futureCards.value)
  .reverse()
  .map(group => ({ ...group, items: [...group.items].reverse() })))
const historicalGroups = computed(() => groupHistoricalTradeTimeline(partitioned.value.historical))
const hasStaticSchedule = computed(() => futureCards.value.some(item => item.origin === 'static'))
const summaryAvailable = computed(() => Boolean(summary.value && summary.value.status !== 'unconfigured'))
const totalEventCount = computed(() => origin.value === 'static' ? cards.value.length
  : summaryAvailable.value ? summary.value?.eventCount24h : '—')
const highPriorityCount = computed(() => origin.value === 'static'
  ? cards.value.filter(item => item.priority === 'P0' || item.priority === 'P1').length
  : summaryAvailable.value ? Number(summary.value?.p0Count24h || 0) + Number(summary.value?.p1Count24h || 0) : '—')
const nextEvent = computed(() => futureCards.value[0])
const snapshotUpdatedAt = computed(() => latest?.generatedAt || new Date(0).toISOString())
const latestEventAt = computed(() => summaryAvailable.value && summary.value?.latestEventAt
  ? summary.value.latestEventAt : partitioned.value.historical[0]?.occurredAt || null)
const freshnessLabel = computed(() => {
  if (origin.value !== 'api' || !summaryAvailable.value) return '不可用'
  if (summary.value?.isDelayed) return summary.value.freshnessMinutes === null ? '延迟' : `延迟 · ${summary.value.freshnessMinutes} 分钟`
  if (summary.value?.freshnessMinutes === null) return '不可用'
  return `${summary.value?.freshnessMinutes} 分钟`
})
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
  paginationRequest?.abort()
  activeRequest = new AbortController()
  loading.value = true
  loadingMore.value = false
  statusMessage.value = ''
  paginationMessage.value = ''
  apiCards.value = []
  summary.value = null
  nextCursor.value = null
  requestedCursors.value = []
  try {
    const [itemsResponse, summaryPayload] = await Promise.all([
      fetch('/api/market-radar/events?window=24&limit=30', { signal: activeRequest.signal }),
      requestSummary(activeRequest.signal),
    ])
    if (version !== requestVersion) return
    if (!itemsResponse.ok || !itemsResponse.headers.get('content-type')?.includes('application/json')) throw new Error('events-unavailable')
    const timeline = parseMarketTimelineList(await itemsResponse.json())
    if (!timeline || timeline.status === 'unconfigured') throw new Error('events-unconfigured')
    if (!latest || timeline.snapshotId !== latest.snapshotId
      || !summaryPayload || summaryPayload.snapshotId !== latest.snapshotId) throw new Error('snapshot-mismatch')
    apiCards.value = timeline.items.map(toTradeTimelineCard)
    nextCursor.value = timeline.nextCursor
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

async function loadMore() {
  const requestedCursor = nextCursor.value
  if (origin.value !== 'api' || !requestedCursor || loadingMore.value) return
  const version = requestVersion
  paginationRequest?.abort()
  paginationRequest = new AbortController()
  loadingMore.value = true
  paginationMessage.value = ''
  try {
    const response = await fetch(`/api/market-radar/events?window=24&limit=30&cursor=${encodeURIComponent(requestedCursor)}`, {
      signal: paginationRequest.signal,
    })
    if (version !== requestVersion) return
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('page-unavailable')
    const page = parseMarketTimelineList(await response.json())
    if (!page || page.status === 'unconfigured') throw new Error('invalid-page')
    if (!latest || page.snapshotId !== latest.snapshotId) throw new Error('snapshot-mismatch')
    const merged = mergeTradeTimelinePage(apiCards.value, page, requestedCursor, requestedCursors.value)
    apiCards.value = merged.cards
    nextCursor.value = merged.nextCursor
    requestedCursors.value = merged.requestedCursors
    if (merged.stopped) paginationMessage.value = '分页游标没有继续前进；已安全停止加载。'
  } catch (error) {
    if (version !== requestVersion) return
    if (error instanceof DOMException && error.name === 'AbortError') return
    paginationMessage.value = '更多历史暂时无法读取；已显示事件保持不变，可稍后重试。'
  } finally {
    if (version === requestVersion) loadingMore.value = false
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
  paginationRequest?.abort()
})
</script>

<template>
  <div
    class="trade-radar-page"
    lang="zh-CN"
    :data-snapshot-id="latest?.snapshotId"
    :data-snapshot-as-of="latest?.asOf"
  >
    <header class="trade-radar-hero">
      <div class="container trade-radar-shell trade-radar-hero-grid">
        <div class="trade-radar-hero-copy">
          <p class="trade-radar-kicker">Trade Radar / Verified events</p>
          <h1>市场雷达</h1>
          <p class="trade-radar-lead">重要事件 → 影响资产 → 验证与失效。只做研究，不给买卖指令。</p>
        </div>
        <aside class="trade-radar-boundary" aria-label="研究与执行边界">
          <span>Research boundary</span>
          <strong>不接账户 · 不自动下单</strong>
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
          <div :class="{ 'is-delayed': summary?.isDelayed }"><dt>数据新鲜度</dt><dd>{{ freshnessLabel }}</dd></div>
        </dl>
      </section>

      <div class="container trade-radar-shell trade-radar-runtime-status">
        <div v-if="origin === 'static'" class="trade-radar-static-notice" role="status">
          <strong>静态快照</strong><p>{{ statusMessage || '正在读取数据库时间线。' }} 快照更新时间 {{ formatGeneratedAt(snapshotUpdatedAt) }} CST，不代表实时状态。</p>
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
        <div v-else-if="futureGroups.length" class="trade-radar-future-groups">
          <section v-for="group in futureGroups" :key="group.date" class="trade-radar-date-group trade-radar-date-group--future"
            :aria-labelledby="`trade-future-date-${group.date}`">
            <h3 :id="`trade-future-date-${group.date}`">
              <time :datetime="group.date">{{ group.label }}</time><span>{{ group.items.length }} 条</span>
            </h3>
            <div class="trade-event-list trade-event-list--future">
              <MarketTimelineCard v-for="item in group.items" :key="item.id" :item="item" />
            </div>
          </section>
        </div>
        <p v-else class="trade-radar-timeline-state">当前没有已确认的未来排期；持续观察不等于没有风险。</p>
      </section>

      <section class="container trade-radar-shell trade-radar-brief trade-radar-occurred" aria-labelledby="trade-occurred-title">
        <header class="trade-radar-section-heading">
          <div><p class="trade-radar-kicker">Occurred / reverse chronological</p><h2 id="trade-occurred-title">已发生。</h2></div>
          <time v-if="latestEventAt" :datetime="latestEventAt">最新事件 {{ formatGeneratedAt(latestEventAt) }} CST</time>
        </header>
        <template v-if="!loading && historicalGroups.length">
          <section v-for="group in historicalGroups" :key="group.date" class="trade-radar-date-group" :aria-labelledby="`trade-date-${group.date}`">
            <h3 :id="`trade-date-${group.date}`">
              <time :datetime="group.date">{{ group.label }}</time><span>{{ group.items.length }} 条</span>
            </h3>
            <div class="trade-event-list"><MarketTimelineCard v-for="item in group.items" :key="item.id" :item="item" /></div>
          </section>
        </template>
        <p v-else-if="!loading" class="trade-radar-timeline-state">当前没有通过公开门禁的已发生事件。</p>
        <div v-if="origin === 'api' && (nextCursor || paginationMessage)" class="trade-radar-pagination" aria-live="polite">
          <button v-if="nextCursor" type="button" :disabled="loadingMore" @click="loadMore">{{ loadingMore ? '正在加载…' : '加载更多历史' }}</button>
          <p v-if="paginationMessage">{{ paginationMessage }}</p>
        </div>
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
