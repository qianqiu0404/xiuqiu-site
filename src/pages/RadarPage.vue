<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import TimelineCard from '../components/TimelineCard.vue'
import { latestRadars } from '../data/generatedRadars'
import type { LearningRadarCategory, LearningRadarSummary } from '../learning-radar/contracts'
import {
  buildStaticTimeline,
  countOccurredToday,
  groupHistoricalTimeline,
  learningCategoryOptions,
  parseLearningSummary,
  parseLearningTimelineList,
  partitionTimelineByOccurrence,
  rankFeaturedTimeline,
  toTimelineCardViewModel,
  type TimelineCardViewModel,
} from '../learning-radar/timeline-presentation'
import { setSeoMeta } from '../utils/seo'
import '../styles/radar-timeline.css'

type CategoryFilter = 'all' | LearningRadarCategory
type TimelineOrigin = 'api' | 'static'

const category = ref<CategoryFilter>('all')
const cards = ref<TimelineCardViewModel[]>([])
const summary = ref<LearningRadarSummary | null>(null)
const origin = ref<TimelineOrigin>('static')
const loading = ref(true)
const loadingMore = ref(false)
const nextCursor = ref<string | null>(null)
const statusMessage = ref('')
let requestVersion = 0
let activeRequest: AbortController | null = null

const staticCards = buildStaticTimeline(latestRadars)
const filteredStaticCards = computed(() => category.value === 'all'
  ? staticCards : staticCards.filter(item => item.category === category.value))
const partitionedCards = computed(() => partitionTimelineByOccurrence(cards.value))
const futureCards = computed(() => partitionedCards.value.future)
const historicalCards = computed(() => partitionedCards.value.historical)
const historicalGroups = computed(() => groupHistoricalTimeline(historicalCards.value))
const featuredCards = computed(() => rankFeaturedTimeline(historicalCards.value))
const todayCount = computed(() => countOccurredToday(cards.value))
const updatedAt = computed(() => origin.value === 'api'
  ? summary.value?.latestStoryAt || cards.value[0]?.publishedAt || new Date(0).toISOString()
  : latestRadars[0]?.generatedAt || new Date(0).toISOString())

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
}

function useStaticFallback(message: string) {
  origin.value = 'static'
  cards.value = filteredStaticCards.value
  summary.value = null
  nextCursor.value = null
  statusMessage.value = message
}

async function requestTimeline(cursor?: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ window: '720', limit: '30' })
  if (category.value !== 'all') params.set('category', category.value)
  if (cursor) params.set('cursor', cursor)
  const response = await fetch(`/api/learning-radar/items?${params}`, { signal })
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('timeline-unavailable')
  const payload = parseLearningTimelineList(await response.json())
  if (!payload || payload.status === 'unconfigured') throw new Error('timeline-unconfigured')
  return payload
}

async function loadTimeline() {
  const version = ++requestVersion
  activeRequest?.abort()
  activeRequest = new AbortController()
  loading.value = true
  loadingMore.value = false
  cards.value = []
  summary.value = null
  nextCursor.value = null
  statusMessage.value = ''
  try {
    const [timeline, summaryResponse] = await Promise.all([
      requestTimeline(undefined, activeRequest.signal),
      fetch('/api/learning-radar/summary', { signal: activeRequest.signal }),
    ])
    if (version !== requestVersion) return
    const summaryPayload = summaryResponse.ok && summaryResponse.headers.get('content-type')?.includes('application/json')
      ? parseLearningSummary(await summaryResponse.json()) : null
    cards.value = timeline.items.map(toTimelineCardViewModel)
    nextCursor.value = timeline.nextCursor
    summary.value = summaryPayload
    origin.value = 'api'
    statusMessage.value = timeline.status === 'degraded'
      ? timeline.message || '学习时间线当前处于延迟状态，内容仍来自已发布数据库记录。'
      : summaryPayload?.status === 'degraded' ? summaryPayload.message || '来源健康状态延迟。' : ''
  } catch (error) {
    if (version !== requestVersion) return
    if (error instanceof DOMException && error.name === 'AbortError') return
    useStaticFallback('实时学习时间线暂时不可用，当前展示已提交的静态学习日报。')
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

async function loadMore() {
  if (!nextCursor.value || loadingMore.value || origin.value !== 'api') return
  const version = requestVersion
  const requestedCursor = nextCursor.value
  loadingMore.value = true
  try {
    const timeline = await requestTimeline(requestedCursor, activeRequest?.signal)
    if (version !== requestVersion) return
    const existingIds = new Set(cards.value.map(item => item.id))
    cards.value = [...cards.value, ...timeline.items.map(toTimelineCardViewModel)
      .filter(item => !existingIds.has(item.id))]
    nextCursor.value = timeline.nextCursor
  } catch {
    if (version !== requestVersion) return
    statusMessage.value = '更早的时间线暂时无法载入；已显示内容保持不变。'
  } finally {
    loadingMore.value = false
  }
}

watch(category, loadTimeline)
onMounted(() => {
  setSeoMeta({
    title: '学习情报时间线｜xiuqiu',
    description: '按发生时间整理的 AI、Web3 钱包、工程工具与研究阅读情报，保留来源、摘要与入选理由。',
    path: '/radar',
  })
  void loadTimeline()
})
</script>

<template>
  <div class="learn-timeline-page" lang="zh-CN">
    <header class="learn-timeline-hero">
      <div class="container learn-timeline-shell learn-timeline-hero__grid">
        <div>
          <p class="learn-timeline-kicker">Learn Radar / Source-backed intelligence</p>
          <h1>把每天发生的变化，<span>整理成可追溯的学习时间线。</span></h1>
          <p class="learn-timeline-lead">只展示已发生、可回到公开来源核对的内容。摘要与入选理由分开，先读重点，再决定是否深入原文。</p>
        </div>
        <aside class="learn-timeline-status" aria-label="学习雷达更新时间与精选数量">
          <div><span>更新时间</span><time :datetime="updatedAt">{{ formatUpdatedAt(updatedAt) }} CST</time></div>
          <div><span>今日精选</span><strong>{{ todayCount }}</strong></div>
          <p :class="{ 'is-static': origin === 'static' }">{{ origin === 'api' ? '数据库时间线' : '静态快照' }}</p>
        </aside>
      </div>
    </header>

    <section class="learn-featured" aria-labelledby="learn-featured-title">
      <div class="container learn-timeline-shell">
        <header class="learn-section-heading">
          <div><p class="learn-timeline-kicker">01 / Highest value now</p><h2 id="learn-featured-title">先看今天最值得理解的 3 条。</h2></div>
          <p>按重要性与发生时间排序，不按热度排序。</p>
        </header>
        <div v-if="loading" class="learn-timeline-state" aria-live="polite" aria-busy="true">正在读取学习情报…</div>
        <div v-else-if="featuredCards.length" class="learn-featured__grid">
          <TimelineCard v-for="item in featuredCards" :key="`featured-${item.id}`" :item="item" featured />
        </div>
        <div v-else class="learn-timeline-state">当前筛选下没有可展示的公开内容。</div>
      </div>
    </section>

    <section class="learn-ledger" aria-labelledby="learn-ledger-title">
      <div class="container learn-timeline-shell">
        <header class="learn-section-heading">
          <div><p class="learn-timeline-kicker">02 / Occurred timeline</p><h2 id="learn-ledger-title">已发生，按日期倒序。</h2></div>
          <time :datetime="updatedAt">更新 {{ formatUpdatedAt(updatedAt) }}</time>
        </header>

        <div class="learn-category-filter" role="group" aria-label="按学习分类筛选">
          <button v-for="option in learningCategoryOptions" :key="option.value" type="button"
            :class="{ active: category === option.value }" :aria-pressed="category === option.value"
            @click="category = option.value">{{ option.label }}</button>
        </div>
        <p class="sr-only" aria-live="polite">当前显示 {{ cards.length }} 条学习情报</p>
        <div v-if="origin === 'static'" class="learn-static-notice" role="status">
          <strong>静态快照</strong>
          <p>{{ statusMessage }} 快照更新时间为 {{ formatUpdatedAt(updatedAt) }} CST，不代表实时状态。</p>
          <router-link :to="`/radar/${latestRadars[0]?.slug}`">查看最新已提交日报</router-link>
        </div>
        <p v-else-if="statusMessage" class="learn-api-notice" role="status">{{ statusMessage }}</p>

        <section v-if="!loading && futureCards.length" class="learn-future" aria-labelledby="learn-future-title">
          <header><p class="learn-timeline-kicker">Scheduled / Future</p><h3 id="learn-future-title">未来事项，按时间正序。</h3></header>
          <div class="learn-timeline-list"><TimelineCard v-for="item in futureCards" :key="item.id" :item="item" /></div>
        </section>
        <div v-if="!loading && historicalGroups.length" class="learn-history-groups">
          <section v-for="group in historicalGroups" :key="group.date" class="learn-date-group" :aria-labelledby="`learn-date-${group.date}`">
            <h3 :id="`learn-date-${group.date}`"><time :datetime="group.date">{{ group.label }}</time></h3>
            <div class="learn-timeline-list"><TimelineCard v-for="item in group.items" :key="item.id" :item="item" /></div>
          </section>
        </div>
        <div v-else-if="!loading" class="learn-timeline-state">该分类暂无已发布内容，可切换分类或稍后返回。</div>

        <button v-if="nextCursor && origin === 'api'" class="learn-load-more" type="button"
          :disabled="loadingMore" @click="loadMore">{{ loadingMore ? '正在载入…' : '载入更早内容' }}</button>

        <nav class="learn-legacy-links" aria-label="学习雷达历史入口">
          <span>Legacy archive</span>
          <router-link :to="`/radar/${latestRadars[0]?.slug}`">旧版日报档案</router-link>
          <router-link to="/radar/week/2026-W29">人工复核周报</router-link>
        </nav>
      </div>
    </section>
  </div>
</template>
