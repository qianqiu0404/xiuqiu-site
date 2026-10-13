<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { latestRadars, radarIndex } from '../data/generatedRadars'
import { loadRadarFeed, radarFeedItemCount, type RadarFeedItem } from '../data/generatedRadarFeed'
import { radarWeeklies } from '../data/generatedRadarWeeklies'
import {
  getRadarReviewBoundary,
  getLearningBriefs,
  getSupportingRadarItems,
  isLearningEditionV2,
  radarSignalCountLabel,
  radarSourceStatus,
  radarTopicLabel,
  filterRadarFeed,
  groupRadarFeedByDate,
  countRadarFeedTopics,
  continuingRadarTopics,
  type RadarFeedDomain,
} from '../data/radarPresentation'
import { getRadarCollectionSeo, getSnapshotFreshness } from '../data/snapshotFreshness'
import { setSeoMeta } from '../utils/seo'
import '../styles/radar.css'
import ChipGroup from '../design/components/ChipGroup.vue'
import IntelCard from '../design/components/IntelCard.vue'
import LoadState from '../design/components/LoadState.vue'
import SearchBox from '../design/components/SearchBox.vue'
import SubscribeBar from '../design/components/SubscribeBar.vue'

const latestRadar = latestRadars[0]
const latestWeekly = radarWeeklies[0]
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
  latestRadar ? getSupportingRadarItems(latestRadar) : [],
)
const latestIsV2 = computed(() => Boolean(latestRadar && isLearningEditionV2(latestRadar)))
const aiBriefs = computed(() => latestRadar ? getLearningBriefs(latestRadar, 'ai') : [])
const web3Briefs = computed(() => latestRadar ? getLearningBriefs(latestRadar, 'web3') : [])
const latestSignalLabel = computed(() => radarSignalCountLabel(latestRadar?.marketSignals.length ?? 0))
const latestFreshness = computed(() => getSnapshotFreshness(latestRadar?.date))
const radarSeo = computed(() => getRadarCollectionSeo('learning', latestRadar?.date))
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
    ? getRadarReviewBoundary(latestWeekly.reviewedAt, latestRadar?.date)
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
    class="radar-intelligence-page"
    lang="zh-CN"
    :data-snapshot-id="latestRadar?.snapshotId"
    :data-snapshot-as-of="latestRadar?.asOf"
    :data-snapshot-state="latestFreshness.state"
  >
    <section class="radar-intelligence-hero" aria-labelledby="radar-title">
      <div class="container radar-intelligence-shell radar-hero-layout">
        <div class="radar-hero-copy">
          <p class="radar-kicker">Industry Intelligence / Human Convergence</p>
          <h1 id="radar-title">{{ latestFreshness.isArchive ? '从归档学懂' : '每天学懂' }}<br /><span>AI 与 Web3。</span></h1>
          <p v-if="latestFreshness.isArchive">
            历史简报保留 2 条 AI、2 条 Web3 和一个专题；先讲机制，再给例子和边界。
          </p>
          <p v-else>
            每天 2 条 AI、2 条 Web3，再选择一个问题做专题。先讲机制，再给例子和边界。
          </p>
        </div>

        <aside v-if="latestRadar" class="radar-hero-status" aria-label="最新情报状态">
          <div>
            <span>{{ latestFreshness.isArchive ? 'Latest archived brief' : 'Latest brief' }}</span>
            <time :datetime="latestRadar.date">{{ latestRadar.date }}</time>
          </div>
          <dl>
            <div>
              <dt>{{ latestIsV2 ? 'Briefs' : 'Signals' }}</dt>
              <dd>{{ latestIsV2 ? latestRadar.briefs?.length : latestRadar.marketSignals.length }}</dd>
            </div>
            <div>
              <dt>Archive</dt>
              <dd>{{ radarIndex.length }}</dd>
            </div>
          </dl>
          <p>ResearchOps 门禁通过 · {{ radarSourceStatus(latestRadar) }} · {{ latestFreshness.label }}</p>
        </aside>
        <aside v-else class="radar-hero-status" aria-label="最新情报状态">
          <div>
            <span>Latest brief</span>
            <strong>暂无已公开日报</strong>
          </div>
          <p>请查看历史档案，或稍后返回确认新的公开简报。</p>
        </aside>
      </div>
    </section>

    <section v-if="latestRadar && latestFreshness.isArchive" class="radar-snapshot-notice" role="status" aria-label="雷达归档状态">
      <div class="container radar-intelligence-shell">
        <strong>{{ latestFreshness.label }}</strong>
        <p>最新公开简报停留在 {{ latestRadar.date }}。以下内容是可追溯历史快照，不代表今天的新情报或当前状态。</p>
      </div>
    </section>

    <section v-if="latestRadar" class="radar-daily-stage" aria-labelledby="radar-daily-title">
      <div class="container radar-intelligence-shell">
        <header class="radar-stage-heading">
          <div>
            <p class="radar-kicker">01 / Daily Brief</p>
            <h2 id="radar-daily-title">{{ latestDailyTitle }}</h2>
          </div>
          <router-link :to="`/radar/${latestRadar.slug}`">阅读完整简报 <span aria-hidden="true">↗</span></router-link>
        </header>

        <div class="radar-daily-layout">
          <div class="radar-daily-primary">
            <header>
              <time :datetime="latestRadar.date">{{ latestRadar.date }}</time>
              <p>{{ latestRadar.summary }}</p>
            </header>

            <div v-if="latestIsV2" class="learning-edition-grid">
              <section class="learning-domain-column" aria-labelledby="learning-ai-title">
                <header><span>02 BRIEFS</span><h3 id="learning-ai-title">AI</h3></header>
                <router-link v-for="brief in aiBriefs" :key="brief.id" :to="`/radar/${latestRadar.slug}#${brief.id}`">
                  <small>{{ brief.topic.replaceAll('_', ' ') }}</small>
                  <strong>{{ brief.title }}</strong>
                  <p>{{ brief.mechanism }}</p>
                  <span aria-hidden="true">→</span>
                </router-link>
              </section>
              <section class="learning-domain-column" aria-labelledby="learning-web3-title">
                <header><span>02 BRIEFS</span><h3 id="learning-web3-title">Web3</h3></header>
                <router-link v-for="brief in web3Briefs" :key="brief.id" :to="`/radar/${latestRadar.slug}#${brief.id}`">
                  <small>{{ brief.topic.replaceAll('_', ' ') }}</small>
                  <strong>{{ brief.title }}</strong>
                  <p>{{ brief.mechanism }}</p>
                  <span aria-hidden="true">→</span>
                </router-link>
              </section>
              <router-link v-if="latestRadar.deepDive" class="learning-deep-dive-card" :to="`/radar/${latestRadar.slug}#deep-dive`">
                <small>DEEP DIVE · {{ latestRadar.deepDive.domain.toUpperCase() }}</small>
                <strong>{{ latestRadar.deepDive.title }}</strong>
                <p>{{ latestRadar.deepDive.whyItMatters }}</p>
                <span>进入专题 ↗</span>
              </router-link>
            </div>
            <ol v-else-if="latestRadar.marketSignals.length" class="radar-signal-ledger">
              <li v-for="(signal, index) in latestRadar.marketSignals" :key="signal.title">
                <span>{{ String(index + 1).padStart(2, '0') }}</span>
                <article>
                  <p>Public signal / verify before use</p>
                  <h3>{{ signal.title }}</h3>
                  <p>{{ signal.summary }}</p>
                </article>
                <a
                  v-if="signal.sourceUrl"
                  :href="signal.sourceUrl"
                  target="_blank"
                  rel="noopener"
                  :aria-label="`查看 ${signal.title} 的原始来源`"
                >↗</a>
              </li>
            </ol>
            <div v-else class="radar-daily-empty" role="status">
              <strong>本期没有通过公开门禁的行业信号。</strong>
              <p>完整简报仍保留工程观察与来源状态；可继续阅读，或在历史档案中查看往期信号。</p>
            </div>
          </div>

          <aside v-if="!latestIsV2 && supportingSignals.length" class="radar-research-index" aria-label="本期研究分支">
            <header>
              <p class="radar-kicker">Research Index</p>
              <span>推断与观察</span>
            </header>
            <router-link
              v-for="(signal, index) in supportingSignals"
              :key="signal.title"
              :to="`/radar/${latestRadar.slug}#${signal.key === 'web3' ? 'web3-design' : signal.key === 'ai' ? 'ai-engineering' : signal.key}`"
            >
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <div>
                <small>{{ signal.label }} · {{ signal.evidenceLabel }}</small>
                <strong>{{ signal.title }}</strong>
              </div>
              <b aria-hidden="true">→</b>
            </router-link>
          </aside>
        </div>
      </div>
    </section>

    <section v-else class="radar-daily-stage" aria-labelledby="radar-daily-empty-title">
      <div class="container radar-intelligence-shell radar-daily-empty">
        <p class="radar-kicker">01 / Daily Brief</p>
        <h2 id="radar-daily-empty-title">暂无已公开日报。</h2>
        <p>可先浏览历史档案，或稍后返回确认新的公开简报。</p>
      </div>
    </section>

    <section v-if="latestWeekly" class="radar-convergence-stage" aria-labelledby="radar-weekly-title">
      <div class="container radar-intelligence-shell">
        <header class="radar-stage-heading radar-stage-heading--dark">
          <div>
            <p class="radar-kicker">02 / Human Reviewed Weekly</p>
            <h2 id="radar-weekly-title">信号只有经过取舍，<br />才配进入工程。</h2>
          </div>
          <div v-if="latestReviewBoundary" class="radar-review-status" aria-label="周报复核状态">
            <time :datetime="latestWeekly.reviewedAt">{{ latestReviewBoundary.lastReviewedLabel }}</time>
            <span>{{ latestReviewBoundary.statusLabel }}</span>
            <span>{{ latestReviewBoundary.nextReviewLabel }}</span>
          </div>
        </header>

        <div class="radar-convergence-lead">
          <div>
            <p class="radar-kicker">{{ latestWeekly.title }}</p>
            <p>{{ latestWeekly.summary }}</p>
          </div>
          <blockquote v-if="latestWeekly.judgments[0]">{{ latestWeekly.judgments[0] }}</blockquote>
        </div>

        <div class="radar-convergence-grid">
          <article v-if="latestWeekly.shipped[0]">
            <span>01 / Entered Engineering</span>
            <p>{{ latestWeekly.shipped[0] }}</p>
          </article>
          <article v-if="latestWeekly.watch[0]">
            <span>02 / Keep Watching</span>
            <p>{{ latestWeekly.watch[0] }}</p>
          </article>
          <article v-if="latestWeekly.nextFocus[0]">
            <span>03 / Next Focus</span>
            <p>{{ latestWeekly.nextFocus[0] }}</p>
          </article>
        </div>

        <router-link class="radar-convergence-action" :to="`/radar/week/${latestWeekly.slug}`">
          查看完整周度收敛 <span aria-hidden="true">↗</span>
        </router-link>
      </div>
    </section>

    <section v-else class="radar-convergence-stage" aria-labelledby="radar-weekly-empty-title">
      <div class="container radar-intelligence-shell radar-daily-empty">
        <p class="radar-kicker">02 / Human Reviewed Weekly</p>
        <h2 id="radar-weekly-empty-title">暂无已公开的人工复核周报。</h2>
        <p>日报仍可作为待验证线索阅读；在周报公开前，不应把自动汇总视为人工结论。</p>
      </div>
    </section>

    <section class="radar-archive-stage" aria-labelledby="radar-archive-title">
      <div class="container radar-intelligence-shell">
        <header class="radar-stage-heading">
          <div>
            <p class="radar-kicker">03 / Intelligence Feed</p>
            <h2 id="radar-archive-title">每一条简报，<br />都可以按主题回看。</h2>
          </div>
          <span>{{ feedLoading ? '…' : filteredFeed.length }} / {{ radarFeedItemCount }} 条 · {{ radarIndex.length }} 期</span>
        </header>

        <div class="radar-feed-toolbar">
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

        <p class="sr-only" aria-live="polite">当前显示 {{ visibleFeedCount }} 条简报</p>
        <LoadState v-if="feedLoading" state="loading" message="正在载入简报信息流…" />
        <LoadState v-else-if="feedError" state="error" message="简报信息流载入失败。" action-label="重试" @action="loadFeed" />
        <div v-else-if="visibleFeedDays.length" class="radar-archive-ledger radar-feed">
          <section v-for="day in visibleFeedDays" :key="day.date" :aria-labelledby="`feed-day-${day.date}`">
            <header>
              <h3 :id="`feed-day-${day.date}`"><time :datetime="day.date">{{ day.date }}</time></h3>
              <router-link :to="`/radar/${day.date}`">当期简报 →</router-link>
            </header>
            <ul class="radar-feed-cards">
              <li v-for="item in day.items" :key="item.id">
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
            </ul>
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

        <button
          v-if="feedDays.length > archiveLimit"
          class="radar-archive-toggle"
          type="button"
          :aria-expanded="archiveExpanded"
          @click="archiveExpanded = !archiveExpanded"
        >
          {{ archiveExpanded ? '收起历史记录' : `展开全部 ${feedDays.length} 天` }}
        </button>

        <SubscribeBar />

        <p class="radar-editorial-disclaimer">
          内容由公开来源经 AI 自动汇总，周度判断另行人工复核。市场信息仅用于研究与教育，不构成投资建议。
        </p>
      </div>
    </section>
  </div>
</template>
