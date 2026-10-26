<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { radarIndex, createLatestRadarLoader, loadRadarBySlug, loadRadarFeed, radarFeedItemCount, radarWeeklies, radarReviews, getRadarReviewBoundary, getLearningBriefs, getSupportingRadarItems, isLearningEditionV2, radarSignalCountLabel, radarSourceStatus, radarTopicLabel, filterRadarFeed, groupRadarFeedByDate, countRadarFeedTopics, continuingRadarTopics, getRadarCollectionSeo, getSnapshotFreshness } from '../data'
import type { RadarFeedItem, RadarFeedDomain, LatestRadarState } from '../data'
import { setSeoMeta } from '../../../utils/seo'
import '../../../design/brief.css'
import '../../../design/reader.css'
import ChipGroup from '../../../design/components/ChipGroup.vue'
import IntelCard from '../../../design/components/IntelCard.vue'
import LoadState from '../../../design/components/LoadState.vue'
import SearchBox from '../../../design/components/SearchBox.vue'
import SubscribeBar from '../../../design/components/SubscribeBar.vue'

const latestRadarIndex = radarIndex[0]
const latestLoad = shallowRef<LatestRadarState>({ status: latestRadarIndex ? 'loading' : 'empty' })
const latestRadar = computed(() => latestLoad.value.radar)
const latestRequest = createLatestRadarLoader(state => { latestLoad.value = state }, loadRadarBySlug)
const loadLatestRadar = () => latestRequest.load(latestRadarIndex)
onBeforeUnmount(() => latestRequest.dispose())
void loadLatestRadar()
const latestWeekly = radarWeeklies[0]
const latestReview = radarReviews[0]
const archiveLimit = 10
const archiveFilter = ref<RadarFeedDomain>('all')
const archiveExpanded = ref(false)
const archiveFilters: { key: RadarFeedDomain; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'ai', label: 'AI' },
  { key: 'web3', label: 'Web3' },
]
const route = useRoute()
const router = useRouter()
const topicFilter = ref<string | undefined>(typeof route.query.topic === 'string' ? route.query.topic : undefined)
const searchQuery = ref(typeof route.query.q === 'string' ? route.query.q : '')
const radarFeedItems = ref<RadarFeedItem[]>([])
const feedLoading = ref(true)
const feedError = ref(false)
const continuingTopics = computed(() => continuingRadarTopics(radarFeedItems.value))

async function loadFeed() {
  feedLoading.value = true
  feedError.value = false
  try {
    radarFeedItems.value = await loadRadarFeed()
  } catch {
    feedError.value = true
  }
  feedLoading.value = false
}

loadFeed()
const supportingSignals = computed(() =>
  latestRadar.value ? getSupportingRadarItems(latestRadar.value) : [],
)
const latestIsV2 = computed(() => Boolean(latestRadar.value && isLearningEditionV2(latestRadar.value)))
const aiBriefs = computed(() => latestRadar.value ? getLearningBriefs(latestRadar.value, 'ai') : [])
const web3Briefs = computed(() => latestRadar.value ? getLearningBriefs(latestRadar.value, 'web3') : [])
const latestSignalLabel = computed(() => radarSignalCountLabel(latestRadar.value?.marketSignals.length ?? 0))
const latestFreshness = computed(() => getSnapshotFreshness(latestRadarIndex?.date))
const radarSeo = computed(() => getRadarCollectionSeo('learning', latestRadarIndex?.date))
const latestDailyTitle = computed(() => {
  if (latestIsV2.value) {
    if (latestFreshness.value.isToday) return '今天：4 条快报 + 1 篇专题。'
    if (latestFreshness.value.isArchive) return '归档快照：4 条快报 + 1 篇专题。'
    return '最近一期：4 条快报 + 1 篇专题。'
  }
  if (latestFreshness.value.isToday) return latestSignalLabel.value
  return latestSignalLabel.value.replace(
    /^今天/,
    latestFreshness.value.isArchive ? '归档快照' : '最近一期',
  )
})
const latestReviewBoundary = computed(() =>
  latestWeekly
    ? getRadarReviewBoundary(latestWeekly.reviewedAt, latestRadarIndex?.date)
    : undefined,
)

const domainItems = computed(() => filterRadarFeed(radarFeedItems.value, { domain: archiveFilter.value }))
const topicOptions = computed(() => countRadarFeedTopics(domainItems.value))
const archiveFilterCounts = computed(() =>
  Object.fromEntries(
    archiveFilters.map(option => [option.key, filterRadarFeed(radarFeedItems.value, { domain: option.key }).length]),
  ) as Record<RadarFeedDomain, number>,
)
const filteredFeed = computed(() =>
  filterRadarFeed(radarFeedItems.value, { domain: archiveFilter.value, topic: topicFilter.value, search: searchQuery.value }),
)
const feedDays = computed(() => groupRadarFeedByDate(filteredFeed.value))
const visibleFeedDays = computed(() =>
  archiveExpanded.value ? feedDays.value : feedDays.value.slice(0, archiveLimit),
)
const visibleFeedCount = computed(() => visibleFeedDays.value.reduce((sum, day) => sum + day.items.length, 0))
const hasActiveFilter = computed(() => archiveFilter.value !== 'all' || Boolean(topicFilter.value) || Boolean(searchQuery.value.trim()))

function toggleTopic(topic: string) {
  topicFilter.value = topicFilter.value === topic ? undefined : topic
}

function resetFeed() {
  archiveFilter.value = 'all'
  topicFilter.value = undefined
  searchQuery.value = ''
}

watch([archiveFilter, topicFilter, searchQuery], () => {
  archiveExpanded.value = false
  if (!feedLoading.value && topicFilter.value && !topicOptions.value.some(option => option.topic === topicFilter.value)) topicFilter.value = undefined
  const query: Record<string, string> = {}
  if (topicFilter.value) query.topic = topicFilter.value
  if (searchQuery.value.trim()) query.q = searchQuery.value.trim()
  router.replace({ query, hash: route.hash })
})

onMounted(() =>
  setSeoMeta({
    ...radarSeo.value,
    path: '/radar',
  }),
)
</script>

<template>
  <div
    class="brief radar-intelligence-page"
    lang="zh-CN"
    :data-snapshot-id="latestRadarIndex?.snapshotId"
    :data-snapshot-as-of="latestRadarIndex?.asOf"
    :data-snapshot-state="latestFreshness.state"
  >
    <header class="brief-masthead radar-intelligence-hero">
      <div class="brief-shell">
        <p class="brief-dateline">
          <span>学习雷达</span>
          <span>每天 2 条 AI · 2 条 Web3 · 1 个专题</span>
        </p>
        <div class="brief-masthead-row">
          <div>
            <h1 id="radar-title">{{ latestFreshness.isArchive ? '从归档学懂 AI 与 Web3' : '每天学懂 AI 与 Web3' }}</h1>
            <p class="brief-lede">先讲机制，再给例子和边界；每条都回到带发布时间的一手来源。</p>
          </div>
          <dl v-if="latestRadar" class="brief-stats">
            <div><dt>最新一期</dt><dd><time :datetime="latestRadar.date">{{ latestRadar.date.slice(5) }}</time></dd></div>
            <div><dt>{{ latestIsV2 ? '本期条目' : '本期信号' }}</dt><dd>{{ latestIsV2 ? latestRadar.briefs?.length : latestRadar.marketSignals.length }}</dd></div>
            <div><dt>档案</dt><dd>{{ radarIndex.length }} 期</dd></div>
          </dl>
        </div>
        <p v-if="latestRadar" :class="`brief-fresh brief-fresh--${latestFreshness.isArchive ? 'stale' : latestFreshness.state}`" role="status">
          ResearchOps 门禁通过 · {{ radarSourceStatus(latestRadar) }} · {{ latestFreshness.label }}
        </p>
        <p v-if="latestRadar && latestFreshness.isArchive" class="brief-note radar-snapshot-notice">
          最新公开简报停留在 {{ latestRadar.date }}。以下内容是可追溯历史快照，不代表今天的新情报或当前状态。
        </p>
      </div>
    </header>

    <div class="brief-shell">
      <section v-if="latestLoad.status === 'loading'" class="radar-section" aria-label="最近一期简报载入状态">
        <LoadState state="loading" message="正在载入最近一期简报…" />
      </section>
      <section v-else-if="latestLoad.status === 'error'" class="radar-section" aria-label="最近一期简报载入状态">
        <LoadState state="error" message="最近一期简报暂时无法载入。" action-label="重试" @action="loadLatestRadar" />
      </section>
      <section v-else-if="latestRadar" class="radar-section" aria-labelledby="radar-daily-title">
        <header class="reader-section-header radar-section-header">
          <span>01</span>
          <h2 id="radar-daily-title">{{ latestDailyTitle }}</h2>
          <router-link class="reader-source-link" :to="`/radar/${latestRadar.slug}`">阅读完整简报 →</router-link>
        </header>
        <p class="radar-summary">{{ latestRadar.summary }}</p>

        <div v-if="latestIsV2" class="radar-edition">
          <section v-for="group in [{ id: 'ai', label: 'AI', items: aiBriefs }, { id: 'web3', label: 'Web3', items: web3Briefs }]" :key="group.id" :aria-labelledby="`learning-${group.id}-title`">
            <h3 :id="`learning-${group.id}-title`" class="radar-edition-label"><b :class="`brief-tag brief-tag--${group.id}`">{{ group.label.toUpperCase() }}</b> 2 条</h3>
            <router-link v-for="brief in group.items" :key="brief.id" class="brief-card" :to="`/radar/${latestRadar.slug}#${brief.id}`">
              <span class="brief-card-meta"><span>{{ brief.topic.replaceAll('_', ' ') }}</span></span>
              <strong class="brief-card-title">{{ brief.title }}</strong>
              <span class="brief-card-summary">{{ brief.mechanism }}</span>
            </router-link>
          </section>
          <router-link v-if="latestRadar.deepDive" class="brief-panel brief-panel-feature radar-deep" :to="`/radar/${latestRadar.slug}#deep-dive`">
            <h2>专题</h2>
            <strong>{{ latestRadar.deepDive.title }}</strong>
            <p>{{ latestRadar.deepDive.whyItMatters }}</p>
            <span class="brief-link">进入专题 →</span>
          </router-link>
        </div>

        <ol v-else-if="latestRadar.marketSignals.length" class="radar-signal-ledger reader-list">
          <li v-for="signal in latestRadar.marketSignals" :key="signal.title">
            <strong>{{ signal.title }}</strong>
            <p>{{ signal.summary }}</p>
            <a v-if="signal.sourceUrl" class="reader-source-link" :href="signal.sourceUrl" target="_blank" rel="noopener" :aria-label="`查看 ${signal.title} 的原始来源`">原始来源 ↗</a>
          </li>
        </ol>
        <LoadState v-else state="empty" message="本期没有通过公开门禁的行业信号。" hint="完整简报仍保留工程观察与来源状态；可继续阅读，或在历史档案中查看往期信号。" />

        <nav v-if="!latestIsV2 && supportingSignals.length" class="radar-research-index reader-related" aria-label="本期研究分支">
          <router-link
            v-for="signal in supportingSignals"
            :key="signal.title"
            :to="`/radar/${latestRadar.slug}#${signal.key === 'web3' ? 'web3-design' : signal.key === 'ai' ? 'ai-engineering' : signal.key}`"
          >{{ signal.label }} · {{ signal.title }} →</router-link>
        </nav>
      </section>
      <section v-else class="radar-section" aria-labelledby="radar-daily-empty-title">
        <header class="reader-section-header"><span>01</span><h2 id="radar-daily-empty-title">暂无已公开日报。</h2></header>
        <p class="brief-note">可先浏览历史档案，或稍后返回确认新的公开简报。</p>
      </section>

      <div class="radar-pair">
        <router-link v-if="latestReview" class="brief-panel brief-panel-feature" :to="`/radar/review/${latestReview.slug}`" aria-labelledby="radar-review-banner-title">
          <h2>趋势回顾 · {{ latestReview.periodStart }} – {{ latestReview.periodEnd }}</h2>
          <strong id="radar-review-banner-title">{{ latestReview.title }}</strong>
          <p>{{ latestReview.summary }}</p>
          <span class="brief-link">看 {{ latestReview.trends.length }} 条趋势线 →</span>
        </router-link>

        <section v-if="latestWeekly" class="brief-panel radar-convergence-stage" aria-labelledby="radar-weekly-title">
          <h2 id="radar-weekly-title">人工复核周报 · {{ latestWeekly.title }}</h2>
          <p>{{ latestWeekly.summary }}</p>
          <blockquote v-if="latestWeekly.judgments[0]" class="radar-quote">{{ latestWeekly.judgments[0] }}</blockquote>
          <p v-if="latestReviewBoundary" class="brief-note">
            <time :datetime="latestWeekly.reviewedAt">{{ latestReviewBoundary.lastReviewedLabel }}</time> ·
            {{ latestReviewBoundary.statusLabel }} {{ latestReviewBoundary.nextReviewLabel }}
          </p>
          <router-link class="brief-link" :to="`/radar/week/${latestWeekly.slug}`">查看完整周度收敛 →</router-link>
        </section>
        <section v-else class="brief-panel radar-convergence-stage" aria-labelledby="radar-weekly-empty-title">
          <h2 id="radar-weekly-empty-title">暂无已公开的人工复核周报。</h2>
          <p class="brief-note">日报仍可作为待验证线索阅读；在周报公开前，不应把自动汇总视为人工结论。</p>
        </section>
      </div>

      <section class="radar-section radar-archive-stage" aria-labelledby="radar-archive-title">
        <header class="reader-section-header radar-section-header">
          <span>02</span>
          <h2 id="radar-archive-title">按主题回看全部简报</h2>
          <small>{{ feedLoading ? '…' : filteredFeed.length }} / {{ radarFeedItemCount }} 条 · {{ radarIndex.length }} 期</small>
        </header>

        <div class="brief-toolbar">
          <div class="brief-toolbar-row">
            <ChipGroup
              variant="tabs"
              label="按领域筛选简报"
              :options="archiveFilters.map(option => ({ ...option, count: archiveFilterCounts[option.key] }))"
              :active="archiveFilter"
              @select="key => (archiveFilter = key as RadarFeedDomain)"
            />
            <SearchBox v-model="searchQuery" label="搜索简报标题与摘要" placeholder="搜索标题或摘要" />
          </div>
          <ChipGroup
            label="按主题筛选简报"
            :options="topicOptions.map(option => ({ key: option.topic, label: radarTopicLabel(option.topic), count: option.count }))"
            :active="topicFilter"
            @select="toggleTopic"
          />
        </div>

        <p class="brief-sr-only" aria-live="polite">当前显示 {{ visibleFeedCount }} 条简报</p>
        <LoadState v-if="feedLoading" state="loading" message="正在载入简报信息流…" />
        <LoadState v-else-if="feedError" state="error" message="简报信息流载入失败。" action-label="重试" @action="loadFeed" />
        <div v-else-if="visibleFeedDays.length" class="radar-archive-ledger">
          <section v-for="day in visibleFeedDays" :key="day.date" class="brief-day" :aria-labelledby="`feed-day-${day.date}`">
            <header class="brief-day-header">
              <h3 :id="`feed-day-${day.date}`"><time :datetime="day.date">{{ day.date }}</time><small>{{ day.items.length }} 条</small></h3>
              <router-link :to="`/radar/${day.date}`">当期简报 →</router-link>
            </header>
            <ol class="brief-timeline radar-feed-cards">
              <li v-for="item in day.items" :key="item.id" :data-domain="item.domain">
                <IntelCard
                  :to="`/radar/${item.date}#${item.anchor}`"
                  :domain="item.domain"
                  :topic-label="radarTopicLabel(item.topic)"
                  :title="item.title"
                  :summary="item.summary"
                  :source-label="item.sourceName ? `${item.sourceTier === 'tier1' ? '一手来源' : '研究解读'} · ${item.sourceName}` : undefined"
                  :continuing="continuingTopics.has(item.topic)"
                  :deep-dive="item.isDeepDive"
                />
              </li>
            </ol>
          </section>
        </div>
        <LoadState
          v-else
          state="empty"
          message="没有符合条件的简报。"
          :action-label="hasActiveFilter ? '清除筛选' : undefined"
          hint="请稍后返回确认新的公开简报。"
          @action="resetFeed"
        />

        <div v-if="feedDays.length > archiveLimit" class="brief-more">
          <button class="brief-button" type="button" :aria-expanded="archiveExpanded" @click="archiveExpanded = !archiveExpanded">
            {{ archiveExpanded ? '收起历史记录' : `展开全部 ${feedDays.length} 天` }}
          </button>
        </div>

        <SubscribeBar class="radar-subscribe" />
        <p class="brief-note radar-editorial-disclaimer">内容由公开来源经 AI 自动汇总，周度判断另行人工复核。市场信息仅用于研究与教育，不构成投资建议。</p>
      </section>
    </div>
  </div>
</template>
