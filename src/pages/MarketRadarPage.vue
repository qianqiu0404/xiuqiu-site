<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { latestMarketRadars, marketRadarIndex } from '../data/generatedMarketRadars'
import { setSeoMeta } from '../utils/seo'
import '../styles/market-radar.css'

const latest = latestMarketRadars[0]
const assets = computed(() => latest ? [...new Set(latest.events.flatMap(event => event.assets))] : [])
const statusLabels = { scheduled: '已排期', released: '已发布', monitoring: '观察中' }
const categoryLabels = { macro: 'Macro', crypto: 'Crypto', equity: 'Equity', regulation: 'Policy' }

function formatEventTime(value?: string) {
  if (!value) return '持续观察'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
}

onMounted(() => setSeoMeta({
  title: '交易研究雷达｜xiuqiu',
  description: '基于公开来源的静态交易事件观察：事实、影响资产、观察条件和失效边界分开呈现，不调用实时行情 API。',
  path: '/market-radar',
}))
</script>

<template>
  <div class="trade-radar-page" lang="zh-CN">
    <header class="trade-radar-hero">
      <div class="container trade-radar-shell trade-radar-hero-grid">
        <div>
          <p class="trade-radar-kicker">Static Event Intelligence / No Trading API</p>
          <h1>先验证，<br /><span>再判断。</span></h1>
          <p class="trade-radar-lead">它不告诉你买什么。每天从公开网页、官方日程和项目发布中提取少量事件，把事实、市场含义、观察条件与失效边界拆开。</p>
        </div>
        <aside class="trade-radar-boundary">
          <span>Execution boundary</span>
          <strong>不接账户 · 不自动下单</strong>
          <p>页面完全读取构建时生成的静态快照。没有运行时新闻、行情或数据库 API。</p>
        </aside>
      </div>
    </header>

    <main v-if="latest" class="trade-radar-main">
      <section class="container trade-radar-shell trade-radar-tape" aria-label="本期状态">
        <div><span>Snapshot</span><strong>{{ latest.date }}</strong></div>
        <div><span>Events</span><strong>{{ latest.events.length }}</strong></div>
        <div><span>Assets</span><strong>{{ assets.length }}</strong></div>
        <div><span>Archive</span><strong>{{ marketRadarIndex.length }}</strong></div>
      </section>

      <section class="container trade-radar-shell trade-radar-brief" aria-labelledby="trade-radar-title">
        <header>
          <div><p class="trade-radar-kicker">Today's verification queue</p><h2 id="trade-radar-title">{{ latest.title }}</h2></div>
          <router-link :to="`/market-radar/${latest.slug}`">阅读完整快照 <span aria-hidden="true">↗</span></router-link>
        </header>
        <p class="trade-radar-summary">{{ latest.summary }}</p>

        <div class="trade-event-list">
          <article v-for="(event, index) in latest.events" :key="event.id" class="trade-event-card" :class="`priority-${event.priority.toLowerCase()}`">
            <header>
              <span class="trade-event-number">{{ String(index + 1).padStart(2, '0') }}</span>
              <div><small>{{ event.priority }} · {{ categoryLabels[event.category] }} · {{ statusLabels[event.status] }}</small><time :datetime="event.eventAt">{{ formatEventTime(event.eventAt) }}</time></div>
            </header>
            <h3>{{ event.title }}</h3>
            <p>{{ event.fact }}</p>
            <div class="trade-event-assets"><span v-for="asset in event.assets" :key="asset">{{ asset }}</span></div>
            <dl>
              <div><dt>为什么关注</dt><dd>{{ event.whyWatch }}</dd></div>
              <div><dt>接下来验证</dt><dd>{{ event.watchFor }}</dd></div>
              <div><dt>失效边界</dt><dd>{{ event.invalidation }}</dd></div>
            </dl>
            <a :href="event.sourceUrl" target="_blank" rel="noopener">{{ event.sourceName }} <span aria-hidden="true">↗</span></a>
          </article>
        </div>
      </section>

      <section class="container trade-radar-shell trade-radar-archive" aria-labelledby="trade-archive-title">
        <header><p class="trade-radar-kicker">Verification archive</p><h2 id="trade-archive-title">历史观察，不覆盖改写。</h2></header>
        <router-link v-for="entry in marketRadarIndex" :key="entry.slug" :to="`/market-radar/${entry.slug}`">
          <time :datetime="entry.date">{{ entry.date }}</time><strong>{{ entry.leadTitle }}</strong><span>{{ entry.eventCount }} events · {{ entry.assetCount }} assets →</span>
        </router-link>
      </section>

      <p class="container trade-radar-shell trade-radar-disclaimer">内容仅供研究与教育，不构成投资建议。任何事实必须回到原始来源复核；任何市场反应必须在事件发生后单独记录。</p>
    </main>
  </div>
</template>
