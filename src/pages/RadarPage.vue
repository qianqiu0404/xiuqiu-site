<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { dailyRadars } from '../data/generatedRadars'
import { radarWeeklies } from '../data/generatedRadarWeeklies'
import {
  getFeaturedRadarItem,
  getIndustryRadarItems,
  getSupportingRadarItems,
  getVisibleRadarArchive,
  radarSourceStatus,
} from '../data/radarPresentation'
import { setSeoMeta } from '../utils/seo'

const latestRadar = dailyRadars[0]
const latestWeekly = radarWeeklies[0]
const archiveExpanded = ref(false)
const featuredSignal = computed(() => latestRadar ? getFeaturedRadarItem(latestRadar) : undefined)
const industrySignals = computed(() =>
  latestRadar ? getIndustryRadarItems(latestRadar, featuredSignal.value?.key) : [],
)
const supportingSignals = computed(() =>
  latestRadar ? getSupportingRadarItems(latestRadar, featuredSignal.value?.key) : [],
)
const visibleArchive = computed(() => getVisibleRadarArchive(dailyRadars, archiveExpanded.value))

onMounted(() =>
  setSeoMeta({
    title: '行业情报雷达｜xiuqiu',
    description: '面向 Web3 钱包与 AI 工程的每日行业简报、人工复核周度收敛和可追溯历史档案。',
    path: '/radar',
  }),
)
</script>

<template>
  <section class="page-top radar-editorial-page">
    <div class="container radar-editorial-container">
      <header class="radar-editorial-hero">
        <p class="radar-kicker">Industry Intelligence Radar</p>
        <div class="radar-editorial-hero-copy">
          <div>
            <h1>行业情报雷达</h1>
            <p>从公开信号中提炼钱包与 AI 工程判断，每周再由人工复核哪些值得进入项目。</p>
          </div>
          <div v-if="latestRadar" class="radar-freshness" aria-label="最新雷达状态">
            <time :datetime="latestRadar.date">{{ latestRadar.date }}</time>
            <span>AI 自动汇总</span>
            <span>{{ radarSourceStatus(latestRadar) }}</span>
          </div>
        </div>
      </header>

      <section
        v-if="latestRadar && featuredSignal"
        class="radar-today"
        aria-labelledby="radar-today-title"
      >
        <div class="radar-section-heading">
          <div>
            <p class="radar-kicker">Today</p>
            <h2 id="radar-today-title">今日工程判断</h2>
          </div>
          <router-link :to="`/radar/${latestRadar.slug}`">阅读完整简报 <span aria-hidden="true">→</span></router-link>
        </div>

        <div class="radar-today-grid">
          <article class="radar-feature-story">
            <div class="radar-story-meta">
              <span>{{ featuredSignal.label }}</span>
              <strong>{{ featuredSignal.evidenceLabel }}</strong>
            </div>
            <h3>{{ featuredSignal.title }}</h3>
            <p>{{ featuredSignal.summary }}</p>
            <div class="radar-story-actions">
              <router-link :to="`/radar/${latestRadar.slug}#${featuredSignal.key === 'web3' ? 'web3-design' : featuredSignal.key === 'ai' ? 'ai-engineering' : 'industry-signals'}`">
                查看判断与边界 <span aria-hidden="true">→</span>
              </router-link>
              <a v-if="featuredSignal.sourceUrl" :href="featuredSignal.sourceUrl" target="_blank" rel="noopener">
                原始来源 <span aria-hidden="true">↗</span>
              </a>
            </div>
          </article>

          <div v-if="industrySignals.length" class="radar-industry-list">
            <div class="radar-list-heading">
              <span>Industry Signals</span>
              <strong>{{ industrySignals.length }} 条</strong>
            </div>
            <article v-for="(signal, index) in industrySignals" :key="signal.title">
              <span class="radar-list-index">0{{ index + 1 }}</span>
              <div>
                <h3>{{ signal.title }}</h3>
                <p>{{ signal.summary }}</p>
              </div>
              <a v-if="signal.sourceUrl" :href="signal.sourceUrl" target="_blank" rel="noopener" :aria-label="`查看 ${signal.title} 的原始来源`">↗</a>
            </article>
          </div>
        </div>
      </section>

      <section v-if="supportingSignals.length" class="radar-followups" aria-labelledby="radar-followups-title">
        <div class="radar-section-heading">
          <div>
            <p class="radar-kicker">Keep Exploring</p>
            <h2 id="radar-followups-title">继续研究</h2>
          </div>
        </div>
        <div class="radar-followup-list">
          <article v-for="signal in supportingSignals" :key="signal.title">
            <div>
              <span>{{ signal.label }}</span>
              <strong>{{ signal.evidenceLabel }}</strong>
            </div>
            <h3>{{ signal.title }}</h3>
            <p>{{ signal.summary }}</p>
            <a v-if="signal.sourceUrl" :href="signal.sourceUrl" target="_blank" rel="noopener" :aria-label="`查看 ${signal.title} 的原始来源`">↗</a>
          </article>
        </div>
      </section>

      <section v-if="latestWeekly" class="radar-weekly-card" aria-labelledby="weekly-title">
        <div class="radar-weekly-copy">
          <p class="radar-kicker">Human Reviewed Weekly</p>
          <h2 id="weekly-title">{{ latestWeekly.title }}</h2>
          <p>{{ latestWeekly.summary }}</p>
          <router-link :to="`/radar/week/${latestWeekly.slug}`">查看人工收敛 <span aria-hidden="true">→</span></router-link>
        </div>
        <div class="radar-weekly-stats" aria-label="本周研究收敛统计">
          <div><strong>{{ latestWeekly.judgments.length }}</strong><span>形成判断</span></div>
          <div><strong>{{ latestWeekly.shipped.length }}</strong><span>进入工程</span></div>
          <div><strong>{{ latestWeekly.nextFocus.length }}</strong><span>下周重点</span></div>
        </div>
      </section>

      <section class="radar-editorial-archive" aria-labelledby="archive-title">
        <div class="radar-section-heading">
          <div>
            <p class="radar-kicker">Archive</p>
            <h2 id="archive-title">历史简报</h2>
          </div>
          <span>{{ dailyRadars.length }} 期公开记录</span>
        </div>

        <div v-if="visibleArchive.length" class="radar-editorial-archive-list">
          <router-link
            v-for="radar in visibleArchive"
            :key="radar.slug"
            :to="`/radar/${radar.slug}`"
          >
            <time :datetime="radar.date">{{ radar.date }}</time>
            <span>{{ radar.summary }}</span>
            <strong aria-hidden="true">→</strong>
          </router-link>
        </div>
        <button
          v-if="dailyRadars.length > 7"
          class="radar-archive-toggle"
          type="button"
          :aria-expanded="archiveExpanded"
          @click="archiveExpanded = !archiveExpanded"
        >
          {{ archiveExpanded ? '收起历史记录' : `查看全部 ${dailyRadars.length} 期` }}
          <span aria-hidden="true">{{ archiveExpanded ? '↑' : '↓' }}</span>
        </button>
      </section>

      <p class="radar-editorial-disclaimer">
        内容由公开来源经 AI 自动汇总，周度判断另行人工复核。市场信息仅用于研究与教育，不构成投资建议。
      </p>
    </div>
  </section>
</template>
