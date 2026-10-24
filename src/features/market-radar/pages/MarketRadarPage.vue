<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { latestMarketRadars, marketRadarIndex, getRadarCollectionSeo, getSnapshotFreshness, filterMarketEvents, formatMarketTime, marketCategoryLabel, marketCategoryOptions, marketPriorityLabels, marketSnapshotSummary, marketStatusLabels, readMarketQuery, marketListHref, marketReadingHref } from '../data'
import type { MarketQuery } from '../data'
import { setSeoMeta } from '../../../utils/seo'
import ChipGroup from '../../../design/components/ChipGroup.vue'
import SearchBox from '../../../design/components/SearchBox.vue'
import LoadState from '../../../design/components/LoadState.vue'
import '../../../design/brief.css'
import '../../../design/collections.css'

const route = useRoute()
const router = useRouter()
const latest = latestMarketRadars[0]
const latestFreshness = computed(() => getSnapshotFreshness(latest?.date))
const summary = marketSnapshotSummary(latest)
const filters = computed(() => readMarketQuery(route.query))
const category = computed({ get: () => filters.value.category, set: (value: string) => updateQuery({ category: value }) })
const query = computed({ get: () => filters.value.query, set: (value: string) => updateQuery({ query: value }) })
const events = computed(() => filterMarketEvents(latest?.events ?? [], { category: category.value, query: query.value }))
const options = marketCategoryOptions.map(option => ({ ...option, count: filterMarketEvents(latest?.events ?? [], { category: option.key }).length }))
function updateQuery(patch: Partial<MarketQuery>) {
  router.replace(marketListHref({ ...filters.value, ...patch }))
}
function reset() { router.replace('/market-radar') }
watch(() => route.fullPath, () => {
  if (route.path !== '/market-radar') return
  const canonical = marketListHref(filters.value, route.hash)
  if (route.fullPath !== canonical) router.replace(canonical)
}, { immediate: true })
onMounted(() => setSeoMeta({ ...getRadarCollectionSeo('market', latest?.date), path: '/market-radar' }))
</script>

<template>
  <div class="brief" lang="zh-CN" :data-snapshot-id="latest?.snapshotId" :data-snapshot-as-of="latest?.asOf" :data-snapshot-state="latestFreshness.state">
    <header class="brief-masthead">
      <div class="brief-shell">
        <p class="brief-dateline"><span>市场雷达</span><span>宏观 · 加密 · 美股 · 政策</span></p>
        <div class="brief-masthead-row">
          <div><h1>市场雷达</h1><p class="brief-lede">重要事件、影响资产与后续验证。保留原始来源、观察点和失效条件，按快照日期阅读。</p></div>
          <dl class="brief-stats">
            <div><dt>快照事件</dt><dd>{{ summary.eventCount }} 条</dd></div>
            <div><dt>重点关注</dt><dd>{{ summary.highPriorityCount }} 条</dd></div>
            <div><dt>影响资产</dt><dd>{{ summary.assetCount }} 项</dd></div>
          </dl>
        </div>
        <p :class="`brief-fresh brief-fresh--${latestFreshness.state}`" role="status">{{ latestFreshness.label }}</p>
        <div v-if="latest && latestFreshness.isArchive" class="collection-notice" role="note">
          <strong>快照已归档</strong><p>最新公开快照停留在 {{ latest.date }}。事件状态、排期和观察项均按当日冻结，不代表今天仍然有效。</p>
        </div>
      </div>
    </header>

    <div class="brief-shell brief-layout">
      <section v-if="latest" aria-labelledby="market-events-title">
        <div class="brief-toolbar">
          <div class="brief-toolbar-row">
            <ChipGroup label="按市场类别筛选" variant="tabs" :options="options" :active="category" @select="key => category = key" />
            <SearchBox v-model="query" label="搜索市场事件" placeholder="搜索事件、资产或来源" />
          </div>
          <p class="brief-note" aria-live="polite">{{ events.length }} 条事件 · 快照 {{ latest.date }}</p>
          <button v-if="category !== 'all' || query" type="button" class="brief-button" @click="reset">清除筛选</button>
        </div>
        <header class="collection-heading"><h2 id="market-events-title">{{ latestFreshness.isArchive ? '归档事件' : '事件观察' }}</h2><router-link class="collection-link" :to="marketReadingHref(`/market-radar/${latest.slug}`, route.fullPath)">完整快照 →</router-link></header>
        <p class="brief-note">{{ latest.summary }}</p>
        <ol class="collection-list">
          <li v-for="event in events" :id="`queue-${event.id}`" :key="event.id" class="collection-row" tabindex="-1">
            <div class="collection-meta">
              <span class="collection-tag collection-tag--market">{{ marketCategoryLabel(event.category) }}</span>
              <span>{{ event.priority }} · {{ marketPriorityLabels[event.priority] }}</span>
              <span>{{ latestFreshness.isArchive ? '快照时：' : '' }}{{ marketStatusLabels[event.status] }}</span>
              <time v-if="event.eventAt" :datetime="event.eventAt">{{ formatMarketTime(event.eventAt) }} CST</time>
              <span v-else>持续观察</span>
            </div>
            <h3><router-link :to="marketReadingHref(`/market-radar/${latest.slug}#${event.id}`, route.fullPath, event.id)">{{ event.title }}</router-link></h3>
            <p>{{ event.fact }}</p>
            <div class="collection-meta collection-context"><span v-for="asset in event.assets" :key="asset" class="collection-tag">{{ asset }}</span><span>来源发布 <time :datetime="event.sourcePublishedAt">{{ event.sourcePublishedAt }}</time></span></div>
            <details class="collection-boundaries" :open="event.priority === 'P0'">
              <summary>观察与验证边界</summary>
              <dl><div><dt>为什么关注</dt><dd>{{ event.whyWatch }}</dd></div><div><dt>接下来验证</dt><dd>{{ event.watchFor }}</dd></div><div><dt>何时失效</dt><dd>{{ event.invalidation }}</dd></div></dl>
            </details>
            <footer class="collection-footer"><a class="collection-link" :href="event.sourceUrl" target="_blank" rel="noopener">{{ event.sourceName }} · 原始来源 ↗</a><router-link class="collection-link" :to="marketReadingHref(`/market-radar/${latest.slug}#${event.id}`, route.fullPath, event.id)" :aria-label="`查看事件：${event.title}`">事件记录 →</router-link></footer>
          </li>
        </ol>
        <LoadState v-if="!events.length" state="empty" message="没有匹配的市场事件。" hint="试试其他类别或关键词。" action-label="清除筛选" @action="reset" />
        <p class="brief-note">自动汇总未经人工复核。内容仅供研究与教育，不构成投资建议。</p>
      </section>
      <LoadState v-else state="empty" message="当前没有通过发布门禁的雷达。" hint="新快照通过来源、内容边界与重复事件检查后，会出现在这里。" />

      <aside class="brief-aside" aria-label="快照与研究说明">
        <section v-if="latest" class="brief-panel">
          <h2>本期快照</h2>
          <strong>{{ latest.title }}</strong>
          <p class="collection-panel-copy">采集于 {{ formatMarketTime(latest.generatedAt) }} CST。快照时间与事件、来源发布时间分别保留。</p>
          <router-link class="collection-link" :to="marketReadingHref(`/market-radar/${latest.slug}`, route.fullPath)">阅读完整快照 →</router-link>
        </section>
        <section class="brief-panel">
          <h2>历史快照</h2>
          <ul><li v-for="entry in marketRadarIndex" :key="entry.slug"><router-link :to="marketReadingHref(`/market-radar/${entry.slug}`, route.fullPath)"><time :datetime="entry.date">{{ entry.date }}</time><span>{{ entry.eventCount }} 事件 →</span></router-link></li></ul>
          <p class="brief-note">历史记录按当日冻结，后续快照不会覆盖原记录。</p>
        </section>
        <section class="brief-panel">
          <h2>研究边界</h2>
          <p class="collection-panel-copy">只读公开来源，不接账户、不自动下单。市场反应在事件发生后单独验证。</p>
          <router-link class="collection-link" to="/?domain=market">情报流里的市场资料 →</router-link>
        </section>
      </aside>
    </div>
  </div>
</template>
