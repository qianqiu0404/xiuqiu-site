<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { MarketRadarDigestList, MarketRadarEvent, MarketRadarEventList, MarketRadarSummary } from '../market-radar/contracts'
import { setSeoMeta } from '../utils/seo'
import '../styles/market-radar.css'

const route = useRoute()
const router = useRouter()
const summary = ref<MarketRadarSummary | null>(null)
const events = ref<MarketRadarEvent[]>([])
const digests = ref<MarketRadarDigestList['items']>([])
const nextCursor = ref<string | null>(null)
const loading = ref(true)
const loadingMore = ref(false)
const message = ref('')
const feedbackSent = ref(new Set<string>())
const filters = reactive({
  market: String(route.query.market || ''), priority: String(route.query.priority || ''),
  reaction: String(route.query.reaction || ''), asset: String(route.query.asset || ''),
  window: String(route.query.window || '24'),
})

function queryString(cursor?: string | null) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
  if (cursor) params.set('cursor', cursor)
  return params.toString()
}

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  const text = await response.text()
  let payload: unknown
  try { payload = JSON.parse(text) } catch { throw new Error('交易雷达 API 尚未连接。') }
  if (!response.ok) throw new Error((payload as { error?: string }).error || '交易雷达请求失败。')
  return payload as T
}

async function load(reset = true) {
  if (reset) loading.value = true
  else loadingMore.value = true
  message.value = ''
  try {
    const [summaryPayload, eventPayload, digestPayload] = await Promise.all([
      readJson<MarketRadarSummary>('/api/market-radar/summary'),
      readJson<MarketRadarEventList>(`/api/market-radar/events?${queryString(reset ? null : nextCursor.value)}`),
      reset ? readJson<MarketRadarDigestList>('/api/market-radar/digests?limit=3') : Promise.resolve(null),
    ])
    summary.value = summaryPayload
    events.value = reset ? eventPayload.items : [...events.value, ...eventPayload.items]
    nextCursor.value = eventPayload.nextCursor
    if (digestPayload) digests.value = digestPayload.items
    message.value = eventPayload.message || summaryPayload.message || ''
  } catch (error) {
    if (reset) events.value = []
    message.value = error instanceof Error ? error.message : '交易雷达数据暂时不可用。'
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

async function applyFilters() {
  await router.replace({ path: '/market-radar', query: Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) })
  await load(true)
}

async function sendFeedback(event: MarketRadarEvent, value: 'useful' | 'noise') {
  const key = `${event.id}:${value}`
  if (feedbackSent.value.has(key)) return
  try {
    const response = await fetch('/api/market-radar/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: event.id, value, idempotencyKey: crypto.randomUUID() }),
    })
    if (!response.ok) throw new Error()
    feedbackSent.value = new Set(feedbackSent.value).add(key)
  } catch {
    message.value = '反馈暂时没有保存成功，请稍后再试。'
  }
}

function formatTime(value: string | null) {
  if (!value) return '等待首批数据'
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function percent(value: number | null | undefined) {
  if (value === null || value === undefined) return '待观察'
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`
}

onMounted(() => {
  setSeoMeta({ title: '交易雷达｜xiuqiu', description: '将公开市场事件、关注资产、规则评分与真实行情反应分开呈现的交易研究雷达。', path: '/market-radar' })
  void load(true)
})
</script>

<template>
  <div class="market-radar-page" lang="zh-CN">
    <section class="market-radar-hero">
      <div class="container market-radar-container market-radar-hero-grid">
        <div>
          <p class="market-radar-kicker">Trade Radar / Event Intelligence</p>
          <h1>先看事实，<br /><span>再看市场有没有买单。</span></h1>
          <p class="market-radar-lead">新闻倾向、真实行情反应和系统判断分栏呈现。只做研究与提醒，不接仓位、账户或自动下单。</p>
        </div>
        <aside class="market-radar-boundary">
          <strong>V0 · 七天试运行</strong>
          <p>免费/试用数据源可能延迟或限流。任何事件都必须回到原始来源验证，不构成投资建议。</p>
        </aside>
      </div>
    </section>

    <section class="container market-radar-container market-radar-status" aria-label="交易雷达状态">
      <div class="market-radar-metric">
        <span>Freshness</span>
        <strong>{{ summary?.freshnessMinutes == null ? '—' : `${summary.freshnessMinutes}m` }}</strong>
        <small>{{ formatTime(summary?.latestEventAt || null) }}</small>
      </div>
      <div class="market-radar-metric"><span>24h Events</span><strong>{{ summary?.eventCount24h ?? '—' }}</strong><small>已公开事件</small></div>
      <div class="market-radar-metric"><span>P0 / P1</span><strong>{{ summary ? `${summary.p0Count24h} / ${summary.p1Count24h}` : '—' }}</strong><small>即时 / 聚合</small></div>
      <div class="market-radar-metric market-radar-metric--health">
        <span>System</span><strong :class="`health-${summary?.status || 'unconfigured'}`">{{ loading ? 'loading' : (summary?.status || 'unavailable') }}</strong>
        <small>{{ loading ? '正在读取状态' : !summary ? 'API 状态不可用' : summary.status === 'unconfigured' ? '尚未配置数据层' : summary.isDelayed ? '数据延迟，不等于没有事件' : '采集正常' }}</small>
      </div>
    </section>

    <section v-if="summary?.sources?.length" class="container market-radar-container market-radar-sources" aria-label="数据源状态">
      <span v-for="source in summary.sources" :key="source.source" :class="`source-${source.health}`">
        <i aria-hidden="true"></i>{{ source.source }}
      </span>
    </section>

    <section class="container market-radar-container market-radar-workspace">
      <form class="market-radar-filters" aria-label="筛选交易事件" @submit.prevent="applyFilters">
        <label>市场<select v-model="filters.market"><option value="">全部</option><option value="crypto">Crypto</option><option value="us_equity">美股</option><option value="macro">宏观</option></select></label>
        <label>等级<select v-model="filters.priority"><option value="">P0–P2</option><option>P0</option><option>P1</option><option>P2</option></select></label>
        <label>反应<select v-model="filters.reaction"><option value="">全部</option><option value="pending">待观察</option><option value="confirmed">已确认</option><option value="priced_in">已计价</option><option value="contradicted">反向</option><option value="ignored">无显著反应</option></select></label>
        <label>资产<input v-model.trim="filters.asset" maxlength="16" placeholder="BTC / NVDA" /></label>
        <label>窗口<select v-model="filters.window"><option value="24">24 小时</option><option value="72">3 天</option><option value="168">7 天</option></select></label>
        <button type="submit">应用筛选</button>
      </form>

      <p v-if="message" class="market-radar-alert" role="status">{{ message }}</p>

      <div v-if="loading" class="market-radar-loading" role="status">正在读取可验证事件…</div>
      <div v-else-if="events.length" class="market-radar-events">
        <article v-for="event in events" :key="event.id" class="market-event-card" :class="`priority-${event.priority.toLowerCase()}`">
          <header>
            <div><span>{{ event.priority }}</span><small>{{ event.market }} · Score {{ event.score }}</small></div>
            <time :datetime="event.publishedAt">{{ formatTime(event.publishedAt) }}</time>
          </header>
          <h2><router-link :to="`/market-radar/events/${event.slug}`">{{ event.titleZh }}</router-link></h2>
          <p class="market-event-summary">{{ event.summaryZh }}</p>
          <div class="market-event-assets"><span v-for="asset in event.assets" :key="`${asset.namespace}:${asset.symbol}`">{{ asset.symbol }}</span></div>
          <dl class="market-event-judgments">
            <div><dt>新闻倾向</dt><dd>{{ event.newsDirection }}</dd></div>
            <div><dt>真实反应 · 30m</dt><dd>{{ percent(event.reaction?.excess30m ?? event.reaction?.return30m) }} · {{ event.reaction?.status || 'pending' }}</dd></div>
            <div><dt>系统判断</dt><dd>{{ event.systemJudgment }}</dd></div>
          </dl>
          <footer>
            <span>{{ event.sourceCount }} 个来源 · {{ event.eventType }}</span>
            <div aria-label="反馈"><button type="button" @click="sendFeedback(event, 'useful')">有用</button><button type="button" @click="sendFeedback(event, 'noise')">噪音</button></div>
          </footer>
        </article>
        <button v-if="nextCursor" class="market-radar-more" type="button" :disabled="loadingMore" @click="load(false)">{{ loadingMore ? '读取中…' : '加载更早事件' }}</button>
      </div>
      <div v-else class="market-radar-empty">
        <strong>{{ !summary ? '交易雷达数据暂时不可用' : summary.status === 'unconfigured' ? '交易雷达尚未配置' : '当前筛选没有已验证事件' }}</strong>
        <p>这里不会用空白冒充“今日无事件”。请检查数据源状态、时间窗口或稍后重试。</p>
      </div>
    </section>

    <section v-if="digests.length" class="container market-radar-container market-radar-digests">
      <header><p class="market-radar-kicker">Briefing Archive</p><h2>聚合摘要</h2></header>
      <article v-for="digest in digests" :key="digest.id"><time :datetime="digest.publishedAt">{{ formatTime(digest.publishedAt) }}</time><h3>{{ digest.title }}</h3><p>{{ digest.bodyZh }}</p></article>
    </section>
  </div>
</template>
