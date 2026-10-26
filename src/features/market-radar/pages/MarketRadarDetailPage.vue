<script setup lang="ts">
import { computed, nextTick, ref, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { loadMarketRadarBySlug, getSnapshotFreshness, getRadarCorrections, readingReturnLink, withReadingReturn } from '../data'
import type { MarketRadarDaily } from '../data'
import { setSeoMeta } from '../../../utils/seo'
import '../../../design/brief.css'
import '../../../design/reader.css'
import '../../../design/market-reader.css'

const route = useRoute()
const returnLink = computed(() => route.query.from ? readingReturnLink(route.query.from) : { href: '/market-radar', label: '← 返回市场雷达' })
const entry = ref<MarketRadarDaily>()
const loading = ref(true)
let requestVersion = 0
const allAssets = computed(() => entry.value ? [...new Set(entry.value.events.flatMap(event => event.assets))] : [])
const entryFreshness = computed(() => getSnapshotFreshness(entry.value?.date))
const corrections = computed(() => getRadarCorrections('market', entry.value?.slug))
const categoryLabels = { macro: '宏观', crypto: '加密', equity: '美股', regulation: '政策' }
const statusLabels = { scheduled: '已排期', released: '已发布', monitoring: '观察中' }
const priorityLabels = { P0: '关键', P1: '重要', P2: '跟踪' }
const sectionHeadingId = (id: string) => `${id}-title`
const researchLensLabels = { transmission: '传导链', falsification: '反证验证', scenario: '情景失效' }
const quantGroupLabels = { us_equity_etf: '美股 ETF', crypto: '币圈', gold_etf: '黄金 ETF' }
const quantGroups = ['us_equity_etf', 'crypto', 'gold_etf'] as const
const quantQualityLabels = { strong: '强', medium: '中', weak: '弱' }
const copiedQuestionId = ref<string>()

function formatEventTime(value?: string) {
  if (!value) return '持续观察'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
}

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
}

async function focusEventHash(hash: string, version: number) {
  if (!hash || hash === '#main-content') return
  await nextTick()
  await document.fonts.ready
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  if (version !== requestVersion) return

  let id = hash.slice(1)
  try { id = decodeURIComponent(id) } catch { return }
  const target = document.getElementById(id)
  const isEvent = target?.classList.contains('market-event')
  const isResearch = target?.classList.contains('market-research-card')
  if (!target || (!isEvent && !isResearch)) return
  if (isResearch) target.setAttribute('open', '')
  const heading = target.querySelector<HTMLElement>(isEvent ? ':scope > h2' : ':scope > summary')
  if (!target || !heading) return

  target.scrollIntoView({ block: 'start' })
  heading.focus({ preventScroll: true })
}

async function copyResearchPrompt(question: { id: string; prompt: string }) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(question.prompt)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = question.prompt
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      if (!document.execCommand('copy')) throw new Error('copy unavailable')
      textarea.remove()
    }
    copiedQuestionId.value = question.id
    window.setTimeout(() => {
      if (copiedQuestionId.value === question.id) copiedQuestionId.value = undefined
    }, 2400)
  } catch {
    copiedQuestionId.value = undefined
  }
}

watch(() => ({ slug: String(route.params.date || ''), hash: route.hash }), async ({ slug, hash }, previous) => {
  const version = ++requestVersion
  const shouldLoad = slug !== previous?.slug || !entry.value
  let loaded = entry.value

  if (shouldLoad) {
    loading.value = true
    entry.value = undefined
    try { loaded = await loadMarketRadarBySlug(slug) } catch { loaded = undefined }
  }

  if (version !== requestVersion) return
  entry.value = loaded
  loading.value = false

  if (loaded) await focusEventHash(hash, version)
}, { immediate: true })

watchEffect(() => {
  if (loading.value) return
  setSeoMeta(entry.value
    ? {
        title: `${entry.value.title}｜xiuqiu`, description: entry.value.summary,
        path: `/market-radar/${entry.value.slug}`, type: 'article', marketRadarSnapshotId: entry.value.snapshotId,
      }
    : { title: '交易雷达快照不存在｜xiuqiu', path: route.fullPath, indexable: false })
})
</script>

<template>
  <div v-if="loading" class="brief market-reader" aria-busy="true" aria-live="polite">
    <div class="brief-masthead"><div class="brief-shell">
      <p class="brief-dateline"><span>市场雷达</span></p>
      <h1>正在载入快照…</h1>
    </div></div>
  </div>

  <div v-else-if="entry" class="brief market-reader" lang="zh-CN" :data-snapshot-state="entryFreshness.state">
    <header class="brief-masthead">
      <div class="brief-shell">
        <router-link class="brief-back" :to="returnLink.href">{{ returnLink.label }}</router-link>
        <p class="brief-dateline">
          <time :datetime="entry.date">{{ entry.date }}</time>
          <span>市场雷达</span>
          <span>AI 自动汇总 · 未经人工复核</span>
        </p>
        <h1>{{ entry.title }}</h1>
        <aside v-for="correction in corrections" :key="correction.id" class="brief-state" role="note" :aria-labelledby="`correction-${correction.id}`">
          <strong :id="`correction-${correction.id}`"><time :datetime="correction.date">{{ correction.date }}</time> 更正</strong>
          <p>{{ correction.summary }}</p>
          <p>{{ correction.boundary }}</p>
          <a class="brief-button" :href="correction.source.url" target="_blank" rel="noopener noreferrer">{{ correction.source.label }} · {{ correction.source.publishedAt }} ↗</a>
        </aside>
        <p class="brief-lede">{{ entry.summary }}</p>
        <dl class="reader-facts">
          <div><dt>事件</dt><dd>{{ entry.events.length }}</dd></div>
          <div><dt>影响资产</dt><dd>{{ allAssets.length }}</dd></div>
          <div><dt>生成时间</dt><dd><time :datetime="entry.generatedAt">{{ formatGeneratedAt(entry.generatedAt) }}（北京时间）</time></dd></div>
        </dl>
        <p v-if="entryFreshness.isArchive" class="brief-fresh brief-fresh--stale" role="status">
          {{ entryFreshness.label }} · 这是一份冻结于 {{ entry.date }} 的历史记录；事件状态与排期只描述当时，不代表今天仍然有效。
        </p>
      </div>
    </header>

    <div class="brief-shell reader-layout">
      <nav class="reader-toc" aria-label="本期快照栏目">
        <span>本期目录</span>
        <router-link v-for="(event, index) in entry.events" :key="event.id" :to="withReadingReturn(`/market-radar/${entry.slug}#${event.id}`, route.query.from)">
          {{ String(index + 1).padStart(2, '0') }} · {{ event.title }}
        </router-link>
        <a v-if="entry.researchPack" href="#deep-research">深研问题 · {{ entry.researchPack.questions.length }}</a>
        <a v-if="entry.quantStrategy" href="#quant-strategy">量化简报</a>
      </nav>

      <div class="reader-main">
        <section class="reader-section" aria-labelledby="events-title">
          <header class="reader-section-header">
            <span>01</span>
            <h2 id="events-title">事件</h2>
            <small>{{ entry.events.length }} 条 · 事实、观察点与失效条件</small>
          </header>

          <article
            v-for="event in entry.events"
            :id="event.id"
            :key="event.id"
            class="reader-article market-event"
            :aria-labelledby="sectionHeadingId(event.id)"
          >
            <p class="brief-card-meta">
              <b :class="`brief-tag brief-tag--${event.priority.toLowerCase()}`">{{ event.priority }} · {{ priorityLabels[event.priority] }}</b>
              <b class="brief-tag brief-tag--market">{{ categoryLabels[event.category] }}</b>
              <span>{{ entryFreshness.isArchive ? `快照时：${statusLabels[event.status]}` : statusLabels[event.status] }}</span>
              <time v-if="event.eventAt" :datetime="event.eventAt">事件时间 {{ formatEventTime(event.eventAt) }}</time>
            </p>
            <h2 :id="sectionHeadingId(event.id)" tabindex="-1">{{ event.title }}</h2>
            <dl class="reader-answers">
              <div><dt>已确认事实</dt><dd>{{ event.fact }}</dd></div>
              <div><dt>为什么关注</dt><dd>{{ event.whyWatch }}</dd></div>
              <div><dt>接下来验证</dt><dd>{{ event.watchFor }}</dd></div>
              <div><dt>何时失效</dt><dd>{{ event.invalidation }}</dd></div>
              <div v-if="event.assets.length"><dt>影响资产</dt><dd><ul class="market-assets"><li v-for="asset in event.assets" :key="asset">{{ asset }}</li></ul></dd></div>
            </dl>
            <ul class="reader-sources" aria-label="原始来源">
              <li>
                <a :href="event.sourceUrl" target="_blank" rel="noopener">
                  <span class="market-source-name">{{ event.sourceName }}</span>
                  <time :datetime="event.sourcePublishedAt">{{ event.sourcePublishedAt }}</time>
                  <i aria-hidden="true">↗</i>
                </a>
              </li>
            </ul>
            <div class="market-event-links">
              <router-link :to="withReadingReturn(`/market-radar/events/${event.id}`, route.query.from)">单独查看这条事件 <span aria-hidden="true">→</span></router-link>
            </div>
          </article>
        </section>

        <section v-if="entry.researchPack" id="deep-research" class="reader-section" aria-labelledby="research-title">
          <header class="reader-section-header">
            <span>02</span>
            <h2 id="research-title">深研问题</h2>
            <small>{{ entry.researchPack.questions.length }} 个 · 可复制给任意强模型继续研究</small>
          </header>
          <p class="market-note">
            ResearchOps 已把事实、来源、反证和失效条件封装成通用问题。证据时间 {{ formatGeneratedAt(entry.researchPack.asOf) }}（北京时间），快照 <code>{{ entry.researchPack.snapshotId }}</code>，来源、日期与提示词校验和一致。
          </p>
          <div class="market-research-list">
            <details
              v-for="question in entry.researchPack.questions"
              :id="`deep-dive-${question.id}`"
              :key="question.id"
              class="reader-disclosure market-research-card"
            >
              <summary><b>Q{{ question.id }}</b><span>{{ question.shortQuestion }}</span><small>{{ researchLensLabels[question.lens] }}</small></summary>
              <div>
                <pre>{{ question.prompt }}</pre>
                <div class="market-research-actions">
                  <button type="button" class="brief-button" @click="copyResearchPrompt(question)">
                    {{ copiedQuestionId === question.id ? '已复制' : '复制研究提示词' }}
                  </button>
                  <small aria-live="polite">{{ copiedQuestionId === question.id ? '提示词已复制到剪贴板' : `SHA-256 ${question.promptChecksum.slice(0, 12)}…` }}</small>
                </div>
              </div>
            </details>
          </div>
          <p class="market-note">强模型仍需重新核验原始来源和时间。快照之后的新信息必须单列；证据不足时不得补数字、概率或交易建议。</p>
        </section>

        <section v-if="entry.quantStrategy" id="quant-strategy" class="reader-section" aria-labelledby="quant-title">
          <header class="reader-section-header">
            <span>{{ entry.researchPack ? '03' : '02' }}</span>
            <h2 id="quant-title">量化简报</h2>
            <small>未来 {{ entry.quantStrategy.horizonTradingDays }} 个交易日</small>
          </header>
          <p v-if="entry.quantStrategy.status === 'historical_samples_insufficient'" class="market-note"><strong>历史样本不足，当前只显示信号质量，不显示精确概率。</strong>{{ entry.quantStrategy.methodology }}</p>
          <p v-else class="market-note"><strong>未回测情景权重，不是统计胜率。</strong>{{ entry.quantStrategy.methodology }}</p>
          <div class="market-quant-groups">
            <section v-for="group in quantGroups" :key="group">
              <h3>{{ quantGroupLabels[group] }}</h3>
              <dl v-for="asset in entry.quantStrategy.assets.filter(item => item.group === group)" :key="asset.symbol">
                <dt>{{ asset.symbol }}</dt>
                <dd v-if="entry.quantStrategy.status === 'historical_samples_insufficient'"><span>信号质量 {{ quantQualityLabels[asset.signalQuality || 'weak'] }}</span><span>样本不足</span><span>不显示概率</span></dd>
                <dd v-else><span>上涨 {{ asset.up }}%</span><span>震荡 {{ asset.sideways }}%</span><span>下跌 {{ asset.down }}%</span></dd>
              </dl>
            </section>
          </div>
          <details class="reader-disclosure">
            <summary>判断依据、验证与失效条件</summary>
            <div>
              <dl class="reader-answers">
                <div><dt>判断依据</dt><dd>{{ entry.quantStrategy.rationale }}</dd></div>
                <div><dt>接下来验证</dt><dd>{{ entry.quantStrategy.nextValidation }}</dd></div>
                <div><dt>失效条件</dt><dd>{{ entry.quantStrategy.invalidation }}</dd></div>
              </dl>
              <ul class="reader-sources" aria-label="量化依据来源">
                <li v-for="(source, index) in entry.quantStrategy.sourceUrls" :key="source"><a :href="source" target="_blank" rel="noopener"><span class="market-source-name">核对依据 {{ index + 1 }}</span><i aria-hidden="true">↗</i></a></li>
              </ul>
            </div>
          </details>
        </section>

        <footer class="market-footer">
          <p>静态研究记录，不接账户、不调用实时行情 API、不自动下单，不构成投资建议。</p>
          <router-link to="/market-radar">返回市场雷达 →</router-link>
        </footer>
      </div>
    </div>
  </div>

  <div v-else class="brief market-reader">
    <div class="brief-masthead"><div class="brief-shell">
      <p class="brief-dateline"><span>市场雷达</span></p>
      <h1>这期交易雷达不存在。</h1>
      <p class="brief-lede">它可能尚未通过发布门禁，或日期地址无效。</p>
      <router-link class="brief-button brief-button--primary" to="/market-radar">返回市场雷达</router-link>
    </div></div>
  </div>
</template>
