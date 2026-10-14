<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  continuingIntelTopics,
  filterIntel,
  getIntelFreshness,
  groupIntelByDate,
  intelDomainLabel,
  intelFilters,
  intelHomeSeo,
  intelItemCount,
  intelLatestDate,
  intelLatestItems,
  intelSourceLabel,
  intelTopicLabel,
  intelTopics,
  loadIntelItems,
  radarReviews,
  topicsForFilter,
} from '../data'
import type { IntelFilter, IntelItem } from '../data'
import { setSeoMeta } from '../../../utils/seo'
import '../../../styles/radar.css'
import '../../../styles/intel-home.css'
import ChipGroup from '../../../design/components/ChipGroup.vue'
import IntelCard from '../../../design/components/IntelCard.vue'
import LoadState from '../../../design/components/LoadState.vue'
import SearchBox from '../../../design/components/SearchBox.vue'
import SubscribeBar from '../../../design/components/SubscribeBar.vue'

const DAY_LIMIT = 8
const route = useRoute()
const router = useRouter()

const queryFilter = String(route.query.domain || '')
const filter = ref<IntelFilter>(intelFilters.some(option => option.key === queryFilter) ? queryFilter as IntelFilter : 'all')
const topic = ref<string | undefined>(typeof route.query.topic === 'string' ? route.query.topic : undefined)
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const expanded = ref(false)

// The first screen renders from the bundled latest window; the full archive
// loads lazily so the home chunk does not grow with every edition.
const items = ref<IntelItem[]>(intelLatestItems)
const archiveState = ref<'loading' | 'ready' | 'error'>('loading')

async function loadArchive() {
  archiveState.value = 'loading'
  try {
    items.value = await loadIntelItems()
    archiveState.value = 'ready'
  } catch {
    archiveState.value = 'error'
  }
}

const freshness = getIntelFreshness(intelLatestDate)
const latestReview = radarReviews[0]
const continuing = computed(() => continuingIntelTopics(items.value))
const filtered = computed(() => filterIntel(items.value, { filter: filter.value, topic: topic.value, search: search.value }))
const days = computed(() => groupIntelByDate(filtered.value))
const visibleDays = computed(() => (expanded.value ? days.value : days.value.slice(0, DAY_LIMIT)))
const visibleCount = computed(() => visibleDays.value.reduce((sum, day) => sum + day.items.length, 0))
const topicOptions = computed(() =>
  topicsForFilter(intelTopics, filter.value).map(entry => ({ key: entry.topic, label: intelTopicLabel(entry.topic), count: entry.count })),
)
const filterOptions = computed(() =>
  intelFilters.map(option => ({ ...option, count: filterIntel(items.value, { filter: option.key }).filter(item => item.kind !== 'review').length })),
)
const continuingTopics = computed(() =>
  intelTopics.filter(entry => continuing.value.has(entry.topic)).slice(0, 6),
)
const hasActiveFilter = computed(() => filter.value !== 'all' || Boolean(topic.value) || Boolean(search.value.trim()))

function toggleTopic(key: string) {
  topic.value = topic.value === key ? undefined : key
}

function reset() {
  filter.value = 'all'
  topic.value = undefined
  search.value = ''
}

watch([filter, topic, search], () => {
  expanded.value = false
  if (topic.value && !topicOptions.value.some(option => option.key === topic.value)) topic.value = undefined
  const query: Record<string, string> = {}
  if (filter.value !== 'all') query.domain = filter.value
  if (topic.value) query.topic = topic.value
  if (search.value.trim()) query.q = search.value.trim()
  router.replace({ query, hash: route.hash })
})

onMounted(() => {
  setSeoMeta({ ...intelHomeSeo, path: '/' })
  loadArchive()
})
</script>

<template>
  <div class="radar-intelligence-page intel-home" lang="zh-CN">
    <header class="intel-home-hero">
      <div class="container intel-home-shell">
        <p class="radar-kicker">AI · Web3 · Market Intelligence</p>
        <h1>AI 与 Web3 的工程情报流</h1>
        <p class="intel-home-lede">每天 2 条 AI、2 条 Web3 工程简报，加上市场事件。先讲机制，再给例子和边界；每条都回到一手来源。</p>
        <p :class="`intel-freshness intel-freshness--${freshness.state}`" role="status">
          <span aria-hidden="true" class="intel-freshness-dot" />{{ freshness.label }}
        </p>
      </div>
    </header>

    <div class="container intel-home-shell intel-home-layout">
      <section class="intel-home-feed" aria-labelledby="intel-feed-title">
        <h2 id="intel-feed-title" class="sr-only">情报流</h2>
        <div class="radar-feed-toolbar">
          <ChipGroup
            variant="tabs"
            label="按领域筛选"
            :options="filterOptions"
            :active="filter"
            @select="key => (filter = key as IntelFilter)"
          />
          <SearchBox v-model="search" label="搜索标题与摘要" placeholder="搜索标题或摘要" />
        </div>
        <ChipGroup label="按主题筛选" :options="topicOptions" :active="topic" @select="toggleTopic" />

        <p class="sr-only" aria-live="polite">当前显示 {{ visibleCount }} 条</p>
        <div v-if="visibleDays.length" class="radar-archive-ledger radar-feed">
          <section v-for="day in visibleDays" :key="day.date" :aria-labelledby="`intel-day-${day.date}`">
            <header>
              <h3 :id="`intel-day-${day.date}`"><time :datetime="day.date">{{ day.date }}</time></h3>
              <router-link :to="`/radar/${day.date}`">当期简报 →</router-link>
            </header>
            <ul class="radar-feed-cards">
              <li v-for="item in day.items" :key="item.id">
                <IntelCard
                  :to="item.href"
                  :domain="item.domain"
                  :domain-label="intelDomainLabel(item.domain)"
                  :topic-label="intelTopicLabel(item.topic)"
                  :title="item.title"
                  :summary="item.summary"
                  :source-label="intelSourceLabel(item)"
                  :continuing="continuing.has(item.topic)"
                  :deep-dive="item.flags?.deepDive"
                  :badge="item.flags?.priority === 'P0' ? 'P0' : undefined"
                />
              </li>
            </ul>
          </section>
        </div>
        <LoadState
          v-else-if="archiveState === 'loading'"
          state="loading"
          message="正在载入历史情报…"
        />
        <LoadState
          v-else
          state="empty"
          message="没有符合条件的条目。"
          :action-label="hasActiveFilter ? '清除筛选' : undefined"
          hint="请稍后返回确认新的公开简报。"
          @action="reset"
        />
        <LoadState
          v-if="archiveState === 'error'"
          state="error"
          message="历史情报载入失败，当前只显示最近 7 天。"
          action-label="重试"
          @action="loadArchive"
        />

        <button
          v-if="days.length > DAY_LIMIT"
          class="radar-archive-toggle"
          type="button"
          :aria-expanded="expanded"
          @click="expanded = !expanded"
        >
          {{ expanded ? '收起历史' : `展开全部 ${days.length} 天` }}
        </button>
      </section>

      <aside class="intel-home-aside" aria-label="趋势与订阅">
        <router-link v-if="latestReview" :to="`/radar/review/${latestReview.slug}`" class="intel-aside-card intel-aside-review">
          <span class="radar-kicker">Trend Review</span>
          <strong>{{ latestReview.title }}</strong>
          <span>{{ latestReview.trends.length }} 条趋势线 →</span>
        </router-link>

        <!-- Only shown once a topic recurs inside the 30-day window. -->
        <section v-if="continuingTopics.length" class="intel-aside-card" aria-labelledby="intel-continuing-title">
          <h2 id="intel-continuing-title">持续追踪</h2>
          <ul>
            <li v-for="entry in continuingTopics" :key="entry.topic">
              <router-link :to="`/topics/${entry.topic}`">
                {{ intelTopicLabel(entry.topic) }}
                <span>{{ entry.count }} 条 · 最近 {{ entry.lastSeen }}</span>
              </router-link>
            </li>
          </ul>
        </section>

        <section class="intel-aside-card" aria-labelledby="intel-topics-title">
          <h2 id="intel-topics-title">全部主题</h2>
          <ul class="intel-aside-topics">
            <li v-for="entry in intelTopics" :key="entry.topic">
              <router-link :to="`/topics/${entry.topic}`">{{ intelTopicLabel(entry.topic) }} <span>{{ entry.count }}</span></router-link>
            </li>
          </ul>
        </section>

        <section class="intel-aside-card" aria-label="订阅">
          <SubscribeBar />
          <p class="intel-aside-meta">共 {{ intelItemCount }} 条 · 自动汇总，未经人工复核 · 不构成投资建议</p>
        </section>

        <nav class="intel-aside-card intel-aside-links" aria-label="更多">
          <router-link to="/radar">学习雷达</router-link>
          <router-link to="/market-radar">市场雷达</router-link>
          <router-link to="/about">关于 xiuqiu</router-link>
        </nav>
      </aside>
    </div>
  </div>
</template>
