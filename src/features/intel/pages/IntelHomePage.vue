<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
  loadResearchIndex,
  mergeReadingItems,
  readingTopics,
  researchUpdateLabel,
  dailyRadarHref,
  researchHref,
  RESEARCH_HOME,
  readIntelQuery,
  intelQueryParams,
  intelQueryLabel,
  intelResultLabel,
  intelItemId,
  intelReadingHref,
  intelReadingLabel,
  loadGrokNews,
  grokReadingItems,
  grokUpdateLabel,
  intelTopicHref,
} from '../data'
import type { IntelFilter, IntelItem, IntelQuery, ResearchIndex, GrokNewsIndex } from '../data'
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

const query = computed(() => readIntelQuery(route.query))
const filter = computed({ get: () => query.value.filter, set: (value: IntelFilter) => updateQuery({ filter: value }) })
const topic = computed(() => query.value.topic)
const search = computed({ get: () => query.value.search, set: (value: string) => updateQuery({ search: value }) })
const expanded = computed({ get: () => query.value.expanded, set: (value: boolean) => updateQuery({ expanded: value }) })
const topicsExpanded = ref(false)

function updateQuery(patch: Partial<IntelQuery>) {
  const next = { ...query.value, expanded: false, ...patch }
  if (patch.filter && next.topic && !topicsForFilter(combinedTopics.value, next.filter).some(option => option.topic === next.topic)) next.topic = undefined
  router.replace({ path: '/', query: intelQueryParams(next) })
}

// The first screen renders from the bundled latest window; the full archive
// loads lazily so the home chunk does not grow with every edition.
const nativeItems = ref<IntelItem[]>(intelLatestItems)
const research = ref<ResearchIndex>()
const researchState = ref<'loading' | 'ready' | 'error'>('loading')
const grok = ref<GrokNewsIndex>()
const grokState = ref<'loading' | 'ready' | 'error'>('loading')
const items = computed(() => mergeReadingItems([...nativeItems.value, ...grokReadingItems(grok.value)], research.value))
const combinedTopics = computed(() => archiveState.value === 'ready' ? readingTopics(items.value) : [...intelTopics, ...readingTopics(mergeReadingItems([], research.value))])
const archiveState = ref<'loading' | 'ready' | 'error'>('loading')

async function refreshGrok(force = false) {
  grokState.value = 'loading'
  try { grok.value = await loadGrokNews(force); grokState.value = 'ready' } catch { grokState.value = 'error' }
}

async function loadResearch(force = false) {
  researchState.value = 'loading'
  try {
    research.value = await loadResearchIndex(force)
    researchState.value = 'ready'
  } catch {
    researchState.value = 'error'
  }
}

async function loadArchive() {
  archiveState.value = 'loading'
  try {
    nativeItems.value = await loadIntelItems()
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
  topicsForFilter(combinedTopics.value, filter.value).map(entry => ({ key: entry.topic, label: intelTopicLabel(entry.topic), count: entry.count })),
)
const filterOptions = computed(() =>
  intelFilters.map(option => ({ ...option, count: filterIntel(items.value, { filter: option.key }).filter(item => item.kind !== 'review').length })),
)
const continuingTopics = computed(() =>
  combinedTopics.value.filter(entry => continuing.value.has(entry.topic)).slice(0, 6),
)
const hasActiveFilter = computed(() => filter.value !== 'all' || Boolean(topic.value) || Boolean(search.value.trim()))

function toggleTopic(key: string) {
  updateQuery({ topic: topic.value === key ? undefined : key })
}

function reset() {
  updateQuery({ filter: 'all', topic: undefined, search: '' })
}

const readingReady = computed(() => archiveState.value !== 'loading' && researchState.value !== 'loading' && grokState.value !== 'loading')
const resultLabel = computed(() => intelResultLabel(filtered.value.length, visibleCount.value,
  filter.value === 'grok' ? [grokState.value] : filter.value === 'research' ? [researchState.value] : [archiveState.value, researchState.value, grokState.value]))

onMounted(() => {
  setSeoMeta({ ...intelHomeSeo, path: '/' })
  loadArchive()
  loadResearch()
  refreshGrok()
})
</script>

<template>
  <div class="brief" lang="zh-CN" :data-reading-ready="readingReady">
    <header class="brief-masthead">
      <div class="brief-shell">
        <p class="brief-dateline">
          <time :datetime="today">{{ intelDayLabel(today) }}</time>
          <span>AI · Web3 · 市场</span>
        </p>
        <div class="brief-masthead-row">
          <div>
            <h1>AI 与 Web3 工程情报</h1>
            <p class="brief-lede">工程简报、市场事件、Grok Bot 新闻与共享研究资料，在这里一起阅读。保留来源和核实范围，按领域、主题或关键词筛选。</p>
          </div>
          <dl class="brief-stats">
            <div><dt>雷达最新一期</dt><dd>{{ latestDayCount }} 条</dd></div>
            <div><dt>累计阅读条目</dt><dd>{{ intelItemCount + (research?.cards.length || 0) + (grok?.records.length || 0) }}</dd></div>
            <div><dt>主题</dt><dd>{{ combinedTopics.length }}</dd></div>
          </dl>
        </div>
        <p :class="`brief-fresh brief-fresh--${freshness.state}`" role="status">原有雷达 · {{ freshness.label }}</p>
        <p v-if="grok" class="brief-note" role="status">{{ grokUpdateLabel(grok) }}</p>
        <p v-if="research" class="brief-note" role="status">{{ researchUpdateLabel(research) }} · 收录时间不代表事件发生时间。</p>
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
          <div id="intel-topic-options" :class="{ 'intel-topics-expanded': topicsExpanded }">
            <ChipGroup label="按主题筛选" :options="topicOptions" :active="topic" @select="toggleTopic" />
          </div>
          <button v-if="topicOptions.length" type="button" class="brief-link intel-topics-toggle" :aria-expanded="topicsExpanded" aria-controls="intel-topic-options" @click="topicsExpanded = !topicsExpanded">
            {{ topicsExpanded ? '收起主题 ↑' : `展开全部 ${topicOptions.length} 个主题 ↓` }}
          </button>
        </div>

        <div class="intel-search-feedback">
          <p role="status" aria-live="polite"><span>{{ intelQueryLabel(query) }}</span><strong>{{ resultLabel }}</strong></p>
          <button v-if="hasActiveFilter" type="button" class="brief-button" @click="reset">清除筛选</button>
          <small>分类数字为已载入条目总量（不含趋势回顾）；搜索范围为标题与摘要。</small>
        </div>
        <LoadState v-if="grokState === 'loading'" state="loading" message="正在载入 Grok Bot 新闻…" />
        <LoadState v-else-if="grokState === 'error'" state="error" :message="grok ? 'Grok Bot 刷新失败，仍保留上次资料。' : 'Grok Bot 直投资料暂不可读，其他资料仍可阅读。'" action-label="重试 Grok Bot" @action="refreshGrok(true)" />
        <LoadState v-if="researchState === 'loading'" state="loading" message="正在载入共享研究资料…" />
        <LoadState
          v-else-if="researchState === 'error'"
          state="error"
          :message="research ? '共享研究刷新失败，仍保留上次载入的资料。' : '共享研究暂时无法载入，原有雷达仍可阅读。'"
          action-label="重试共享研究"
          @action="loadResearch(true)"
        />
        <template v-if="visibleDays.length">
          <section v-for="day in visibleDays" :key="day.date" class="brief-day" :aria-labelledby="`intel-day-${day.date}`">
            <header class="brief-day-header">
              <h3 :id="`intel-day-${day.date}`">
                <time :datetime="day.date">{{ intelDayLabel(day.date) }}</time>
                <small>{{ day.items.length }} 条</small>
              </h3>
              <router-link v-if="dailyRadarHref(day.items)" :to="dailyRadarHref(day.items)!">当期日报 →</router-link>
            </header>
            <ol class="brief-timeline">
              <li v-for="item in day.items" :id="intelItemId(item.id)" :key="item.id" :data-domain="item.domain" tabindex="-1">
                <IntelCard
                  :to="intelReadingHref(item, route.fullPath)"
                  :reading-label="intelReadingLabel(item.kind)"
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
        <LoadState v-else-if="archiveState === 'loading' || researchState === 'loading' || grokState === 'loading'" state="loading" message="正在载入情报…" />
        <LoadState
          v-else-if="archiveState !== 'error' && (filter !== 'research' || researchState !== 'error') && (filter !== 'grok' || grokState !== 'error')"
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
        <section class="brief-panel" aria-labelledby="intel-grok-title">
          <h2 id="intel-grok-title">Grok Bot 新闻</h2>
          <p>由 x-ai-digest 搜索并直接投递本站，保留原始出处、整理说明与核实范围。</p>
          <button type="button" class="brief-button" :disabled="grokState === 'loading'" @click="refreshGrok(true)">刷新新闻</button>
          <p class="brief-note">Bot 整理未经人工复核。原有雷达、共享研究与 Bot 新闻各自更新。</p>
        </section>
        <section class="brief-panel" aria-labelledby="intel-research-title">
          <h2 id="intel-research-title">共享研究</h2>
          <p>合并明确关联的事件和完全重复的材料，保留不同版本与观点。</p>
          <ul v-if="research?.briefs.length">
            <li v-for="brief in research.briefs.slice(0, 3)" :key="brief.id"><router-link :to="researchHref(brief.id)">{{ brief.title }}</router-link></li>
          </ul>
          <a :href="RESEARCH_HOME" class="brief-link" rel="noopener noreferrer">资料源与完整记录 ↗</a>
          <p class="brief-note">分类沿用资料源的标签与关键词辅助归类，不代表核实结论。资料和原有雷达各自更新。</p>
        </section>
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
              <router-link :to="intelTopicHref(entry.topic)">{{ intelTopicLabel(entry.topic) }} <span>{{ entry.count }} 条</span></router-link>
            </li>
          </ul>
        </section>

        <section class="brief-panel" aria-labelledby="intel-topics-title">
          <h2 id="intel-topics-title">主题</h2>
          <ul>
            <li v-for="entry in combinedTopics.slice(0, 10)" :key="entry.topic">
              <router-link :to="intelTopicHref(entry.topic)">{{ intelTopicLabel(entry.topic) }} <span>{{ entry.count }} · {{ entry.lastSeen.slice(5) }}</span></router-link>
            </li>
          </ul>
        </section>

        <section class="brief-panel" aria-labelledby="intel-subscribe-title">
          <h2 id="intel-subscribe-title">原有雷达订阅</h2>
          <SubscribeBar />
          <p class="brief-note">订阅暂含原有雷达；共享研究在站内更新。自动汇总未经人工复核，市场内容不构成投资建议。</p>
        </section>
      </aside>
    </div>
  </div>
</template>
