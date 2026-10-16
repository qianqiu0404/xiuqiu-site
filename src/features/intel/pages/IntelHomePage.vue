<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  continuingIntelTopics,
  filterIntel,
  getIntelFreshness,
  groupIntelByDate,
  intelDayLabel,
  intelDomainLabel,
  intelFilters,
  intelHomeSeo,
  intelItemCount,
  intelLatestDate,
  intelLatestItems,
  intelKindLabel,
  intelSourceLabel,
  intelTopicLabel,
  intelTopics,
  loadIntelItems,
  radarReviews,
  shanghaiToday,
  topicsForFilter,
} from '../data'
import type { IntelFilter, IntelItem } from '../data'
import { setSeoMeta } from '../../../utils/seo'
import '../../../design/brief.css'
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
const today = shanghaiToday()
const latestDayCount = intelLatestItems.filter(item => item.date === intelLatestDate && item.kind !== 'review').length
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
  <div class="brief" lang="zh-CN">
    <header class="brief-masthead">
      <div class="brief-shell">
        <p class="brief-dateline">
          <time :datetime="today">{{ intelDayLabel(today) }}</time>
          <span>AI · Web3 · 市场</span>
        </p>
        <div class="brief-masthead-row">
          <div>
            <h1>AI 与 Web3 工程情报</h1>
            <p class="brief-lede">每天 2 条 AI、2 条 Web3 工程简报，加上市场事件。先讲机制，再给例子和边界；每条都回到一手来源。</p>
          </div>
          <dl class="brief-stats">
            <div><dt>最新一期</dt><dd>{{ latestDayCount }} 条</dd></div>
            <div><dt>累计</dt><dd>{{ intelItemCount }}</dd></div>
            <div><dt>主题</dt><dd>{{ intelTopics.length }}</dd></div>
          </dl>
        </div>
        <p :class="`brief-fresh brief-fresh--${freshness.state}`" role="status">{{ freshness.label }}</p>
      </div>
    </header>

    <div class="brief-shell brief-layout">
      <section aria-labelledby="intel-feed-title">
        <h2 id="intel-feed-title" class="brief-sr-only">情报流</h2>
        <div class="brief-toolbar">
          <div class="brief-toolbar-row">
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
        </div>

        <p class="brief-sr-only" aria-live="polite">当前显示 {{ visibleCount }} 条</p>
        <template v-if="visibleDays.length">
          <section v-for="day in visibleDays" :key="day.date" class="brief-day" :aria-labelledby="`intel-day-${day.date}`">
            <header class="brief-day-header">
              <h3 :id="`intel-day-${day.date}`">
                <time :datetime="day.date">{{ intelDayLabel(day.date) }}</time>
                <small>{{ day.items.length }} 条</small>
              </h3>
              <router-link :to="`/radar/${day.date}`">当期日报 →</router-link>
            </header>
            <ol class="brief-timeline">
              <li v-for="item in day.items" :key="item.id" :data-domain="item.domain">
                <IntelCard
                  :to="item.href"
                  :domain="item.domain"
                  :domain-label="intelDomainLabel(item.domain)"
                  :topic-label="`${intelTopicLabel(item.topic)} · ${intelKindLabel(item.kind)}`"
                  :title="item.title"
                  :summary="item.summary"
                  :source-label="intelSourceLabel(item)"
                  :continuing="continuing.has(item.topic)"
                  :deep-dive="item.flags?.deepDive"
                  :badge="item.flags?.priority === 'P0' ? 'P0' : undefined"
                />
              </li>
            </ol>
          </section>
        </template>
        <LoadState v-else-if="archiveState === 'loading'" state="loading" message="正在载入历史情报…" />
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

        <div v-if="days.length > DAY_LIMIT" class="brief-more">
          <button class="brief-button" type="button" :aria-expanded="expanded" @click="expanded = !expanded">
            {{ expanded ? '收起历史' : `展开全部 ${days.length} 天` }}
          </button>
        </div>
      </section>

      <aside class="brief-aside" aria-label="趋势、主题与订阅">
        <router-link v-if="latestReview" :to="`/radar/review/${latestReview.slug}`" class="brief-panel brief-panel-feature">
          <h2>趋势回顾</h2>
          <strong>{{ latestReview.title }}</strong>
          <p>{{ latestReview.summary }}</p>
          <span class="brief-link">看 {{ latestReview.trends.length }} 条趋势线 →</span>
        </router-link>

        <section v-if="continuingTopics.length" class="brief-panel" aria-labelledby="intel-continuing-title">
          <h2 id="intel-continuing-title">持续追踪 · 30 天</h2>
          <ul>
            <li v-for="entry in continuingTopics" :key="entry.topic">
              <router-link :to="`/topics/${entry.topic}`">{{ intelTopicLabel(entry.topic) }} <span>{{ entry.count }} 条</span></router-link>
            </li>
          </ul>
        </section>

        <section class="brief-panel" aria-labelledby="intel-topics-title">
          <h2 id="intel-topics-title">主题</h2>
          <ul>
            <li v-for="entry in intelTopics.slice(0, 10)" :key="entry.topic">
              <router-link :to="`/topics/${entry.topic}`">{{ intelTopicLabel(entry.topic) }} <span>{{ entry.count }} · {{ entry.lastSeen.slice(5) }}</span></router-link>
            </li>
          </ul>
        </section>

        <section class="brief-panel" aria-labelledby="intel-subscribe-title">
          <h2 id="intel-subscribe-title">订阅</h2>
          <SubscribeBar />
          <p class="brief-note">由公开来源自动汇总，未经人工复核；市场内容不构成投资建议。</p>
        </section>
      </aside>
    </div>
  </div>
</template>
