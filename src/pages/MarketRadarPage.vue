<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { latestMarketRadars, marketRadarIndex } from '../data/generatedMarketRadars'
import { setSeoMeta } from '../utils/seo'
import '../styles/market-radar.css'

const latest = latestMarketRadars[0]
interface MarketStatus {
  status: string
  snapshotId: string | null
  asOf: string | null
  mode: string | null
  coverage: Array<{ assetId: string; status: string; marketState: string }>
}
const marketStatus = ref<MarketStatus | null>(null)
const healthyMarketCount = computed(() => marketStatus.value?.coverage.filter(item => item.status === 'healthy').length || 0)
const staleMarketCount = computed(() => marketStatus.value?.coverage.filter(item => item.status === 'stale').length || 0)
const unavailableMarketCount = computed(() => marketStatus.value?.coverage.filter(item => item.status === 'unavailable').length || 0)
const highPriorityCount = computed(() => latest?.events.filter(event => event.priority === 'P0' || event.priority === 'P1').length || 0)
const nextEvent = computed(() => {
  if (!latest) return undefined
  const generatedAt = Date.parse(latest.generatedAt)
  return [...latest.events]
    .filter(event => event.eventAt && Date.parse(event.eventAt) >= generatedAt)
    .sort((a, b) => Date.parse(a.eventAt!) - Date.parse(b.eventAt!))[0]
})
const statusLabels = { scheduled: '已排期', released: '已发布', monitoring: '观察中' }
const categoryLabels = { macro: '宏观', crypto: '加密', equity: '美股', regulation: '政策' }
const priorityLabels = { P0: '关键', P1: '重要', P2: '跟踪' }

function formatEventTime(value?: string) {
  if (!value) return '持续观察'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
}

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
}

function formatSnapshotAge(value: string | null) {
  if (!value) return '—'
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1_000))
  if (seconds < 60) return `${seconds} 秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟`
  return `${Math.floor(seconds / 3600)} 小时`
}

onMounted(() => {
  setSeoMeta({
    title: '交易研究雷达｜xiuqiu',
    description: '基于公开来源的静态交易事件观察，并公开行情覆盖与延迟状态；不公开受限报价。',
    path: '/market-radar',
  })
  void fetch('/api/market-radar/market-status').then(response => response.ok ? response.json() : null).then(value => { marketStatus.value = value as MarketStatus | null }).catch(() => {})
})
</script>

<template>
  <div
    class="trade-radar-page"
    lang="zh-CN"
    :data-event-snapshot-id="latest?.snapshotId"
    :data-event-snapshot-as-of="latest?.asOf"
  >
    <header class="trade-radar-hero">
      <div class="container trade-radar-shell trade-radar-hero-grid">
        <div class="trade-radar-hero-copy">
          <p class="trade-radar-kicker">Trade Radar / Verified events</p>
          <h1>交易雷达</h1>
          <p class="trade-radar-lead">事件、影响路径、验证边界。只做研究，不给买卖指令。</p>
        </div>
        <aside class="trade-radar-boundary" aria-label="研究与执行边界">
          <span>Research boundary</span>
          <strong>不接账户 · 不自动下单</strong>
          <p>只读来源；反应在事件后验证。</p>
        </aside>
      </div>
    </header>

    <div v-if="latest" class="trade-radar-main">
      <section class="container trade-radar-shell trade-market-status" aria-labelledby="market-snapshot-status-title" :data-snapshot-id="marketStatus?.snapshotId" :data-snapshot-as-of="marketStatus?.asOf">
        <div><p class="trade-radar-kicker">Market snapshot</p><h2 id="market-snapshot-status-title">行情覆盖</h2></div>
        <dl v-if="marketStatus?.snapshotId">
          <div><dt>快照</dt><dd>{{ marketStatus.snapshotId }}</dd></div>
          <div><dt>覆盖</dt><dd>{{ healthyMarketCount }} 健康 · {{ staleMarketCount }} 延迟 · {{ unavailableMarketCount }} 不可用</dd></div>
          <div><dt>As of</dt><dd>{{ marketStatus.asOf ? formatGeneratedAt(marketStatus.asOf) : '—' }} CST</dd></div>
          <div><dt>快照年龄</dt><dd>{{ formatSnapshotAge(marketStatus.asOf) }}</dd></div>
          <div><dt>模式</dt><dd>{{ marketStatus.mode }}</dd></div>
        </dl>
        <p v-else>当前没有可验证的行情快照；不会展示旧报价冒充当前数据。</p>
        <small>仅显示状态，不包含原始价格。</small>
        <dl class="trade-radar-mobile-metrics" aria-label="今日事件摘要">
          <div><dt>事件</dt><dd>{{ latest.events.length }}</dd></div>
          <div><dt>重点</dt><dd>{{ highPriorityCount }}</dd></div>
          <div><dt>下一项</dt><dd>{{ nextEvent ? formatEventTime(nextEvent.eventAt) : '观察中' }}</dd></div>
        </dl>
      </section>
      <section class="container trade-radar-shell trade-radar-status trade-radar-desktop-status" aria-labelledby="radar-status-title">
        <h2 id="radar-status-title" class="trade-radar-sr-only">今日雷达状态摘要</h2>
        <dl class="trade-radar-metrics">
          <div><dt>总事件</dt><dd>{{ latest.events.length }}</dd></div>
          <div class="is-urgent"><dt>P0 + P1</dt><dd>{{ highPriorityCount }}</dd></div>
          <div><dt>下一事件</dt><dd>{{ nextEvent ? formatEventTime(nextEvent.eventAt) : '持续观察' }}</dd></div>
          <div><dt>更新于</dt><dd>{{ formatGeneratedAt(latest.generatedAt) }} CST</dd></div>
        </dl>
      </section>

      <section class="container trade-radar-shell trade-radar-brief" aria-labelledby="trade-radar-title">
        <header class="trade-radar-section-heading">
          <div>
            <p class="trade-radar-kicker">Today's verification queue</p>
            <h2 id="trade-radar-title">{{ latest.title }}</h2>
          </div>
          <router-link class="trade-radar-text-link" :to="`/market-radar/${latest.slug}`">阅读完整快照 <span aria-hidden="true">↗</span></router-link>
        </header>
        <p class="trade-radar-summary">{{ latest.summary }}</p>

        <div class="trade-event-list">
          <article
            v-for="(event, index) in latest.events"
            :id="`queue-${event.id}`"
            :key="event.id"
            class="trade-event-card"
            :class="`priority-${event.priority.toLowerCase()}`"
          >
            <div class="trade-event-signal" aria-hidden="true"><span>{{ String(index + 1).padStart(2, '0') }}</span></div>
            <div class="trade-event-content">
              <header class="trade-event-header">
                <div class="trade-event-classification">
                  <strong>{{ event.priority }} · {{ priorityLabels[event.priority] }}</strong>
                  <span>{{ categoryLabels[event.category] }}</span>
                  <span>{{ statusLabels[event.status] }}</span>
                </div>
                <time v-if="event.eventAt" :datetime="event.eventAt">{{ formatEventTime(event.eventAt) }}</time>
                <span v-else class="trade-event-continuous">持续观察</span>
              </header>

              <h3><router-link :to="`/market-radar/${latest.slug}#${event.id}`">{{ event.title }}</router-link></h3>
              <p class="trade-event-fact">{{ event.fact }}</p>

              <div class="trade-event-context">
                <div class="trade-event-assets" aria-label="影响资产"><span v-for="asset in event.assets" :key="asset">{{ asset }}</span></div>
                <span class="trade-event-source-date">来源发布 {{ event.sourcePublishedAt }}</span>
              </div>

              <div v-if="event.priority !== 'P2'" class="trade-event-analysis trade-event-analysis--static">
                <dl>
                  <div><dt>为什么关注</dt><dd>{{ event.whyWatch }}</dd></div>
                  <div><dt>接下来验证</dt><dd>{{ event.watchFor }}</dd></div>
                  <div><dt>何时失效</dt><dd>{{ event.invalidation }}</dd></div>
                </dl>
              </div>
              <details v-else class="trade-event-analysis">
                <summary>展开判断边界 <span aria-hidden="true">＋</span></summary>
                <dl>
                  <div><dt>为什么关注</dt><dd>{{ event.whyWatch }}</dd></div>
                  <div><dt>接下来验证</dt><dd>{{ event.watchFor }}</dd></div>
                  <div><dt>何时失效</dt><dd>{{ event.invalidation }}</dd></div>
                </dl>
              </details>

              <footer class="trade-event-footer">
                <a :href="event.sourceUrl" target="_blank" rel="noopener">核对 {{ event.sourceName }} 原始来源 <span aria-hidden="true">↗</span></a>
                <router-link :to="`/market-radar/${latest.slug}#${event.id}`">进入事件记录 <span aria-hidden="true">→</span></router-link>
              </footer>
            </div>
          </article>
        </div>
      </section>

      <section class="container trade-radar-shell trade-radar-archive" aria-labelledby="trade-archive-title">
        <header class="trade-radar-section-heading">
          <div><p class="trade-radar-kicker">Verification archive</p><h2 id="trade-archive-title">历史快照，不覆盖改写。</h2></div>
        </header>
        <nav aria-label="交易雷达历史快照">
          <router-link v-for="entry in marketRadarIndex" :key="entry.slug" :to="`/market-radar/${entry.slug}`">
            <time :datetime="entry.date">{{ entry.date }}</time>
            <strong>{{ entry.leadTitle }}</strong>
            <span>{{ entry.eventCount }} 事件 · {{ entry.assetCount }} 资产 <i aria-hidden="true">↗</i></span>
          </router-link>
        </nav>
      </section>

      <p class="container trade-radar-shell trade-radar-disclaimer">内容仅供研究与教育，不构成投资建议。事实必须回到原始来源复核；市场反应必须在事件发生后单独记录。</p>
    </div>

    <section v-else class="trade-radar-state" aria-labelledby="radar-empty-title">
      <div class="container trade-radar-shell">
        <p class="trade-radar-kicker">No verified snapshot</p>
        <h2 id="radar-empty-title">今天还没有通过发布门禁的雷达。</h2>
        <p>新的静态快照通过来源、内容边界与重复事件检查后，会出现在这里。</p>
      </div>
    </section>
  </div>
</template>
