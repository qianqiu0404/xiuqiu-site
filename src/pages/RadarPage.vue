<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { dailyRadars } from '../data/generatedRadars'
import { radarWeeklies } from '../data/generatedRadarWeeklies'
import { setSeoMeta } from '../utils/seo'

const latestRadar = dailyRadars[0]
const latestWeekly = radarWeeklies[0]
const activeTopic = ref('all')
const topics = [
  { key: 'all', label: '全部' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'ai', label: 'AI Engineering' },
  { key: 'web3', label: 'Web3 Design' },
  { key: 'tools', label: 'Tools' },
  { key: 'reading', label: 'Reading' },
]
const supportingSignals = computed(() =>
  latestRadar
    ? [
        latestRadar.aiTip ? { label: 'AI Engineering', ...latestRadar.aiTip } : null,
        latestRadar.web3Design ? { label: 'Web3 Design', ...latestRadar.web3Design } : null,
        latestRadar.vibeProject ? { label: 'Tools', ...latestRadar.vibeProject } : null,
        latestRadar.readingPick ? { label: 'Reading', ...latestRadar.readingPick } : null,
      ].filter(Boolean)
    : [],
)

function supportsTopic(radar: typeof dailyRadars[number], topic: string) {
  if (topic === 'all') return true
  if (topic === 'crypto') return radar.marketSignals.length > 0
  if (topic === 'ai') return Boolean(radar.aiTip)
  if (topic === 'web3') return Boolean(radar.web3Design)
  if (topic === 'tools') return Boolean(radar.vibeProject)
  return Boolean(radar.readingPick)
}

function isoWeek(date: string) {
  const value = new Date(`${date}T00:00:00Z`)
  const day = value.getUTCDay() || 7
  value.setUTCDate(value.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((value.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

const archiveGroups = computed(() => {
  const groups = new Map<string, typeof dailyRadars>()
  dailyRadars
    .filter(radar => supportsTopic(radar, activeTopic.value))
    .forEach(radar => {
      const week = isoWeek(radar.date)
      groups.set(week, [...(groups.get(week) || []), radar])
    })
  return [...groups.entries()].map(([week, entries]) => ({ week, entries }))
})

onMounted(() =>
  setSeoMeta({
    title: '行业情报雷达｜xiuqiu',
    description: '面向 Web3 钱包与 AI 工程的每日行业简报、人工复核周度收敛和可追溯历史档案。',
    path: '/radar',
  }),
)
</script>

<template>
  <section class="section page-top radar-page">
    <div class="container">
      <header class="radar-hero">
        <div>
          <p class="section-label">Industry Intelligence Radar</p>
          <h1>行业情报雷达</h1>
          <p>每日快速扫描公开信号，每周收敛成判断。资讯、工程推断和待验证边界分别表达，来源始终可以回溯。</p>
        </div>
        <div class="radar-disclaimer">
          <strong>公开来源 · AI 辅助整理</strong>
          <span>人工复核内容单独标记 · 市场内容非投资建议</span>
        </div>
      </header>

      <section v-if="latestRadar" class="radar-latest" aria-labelledby="radar-latest-title">
        <div class="radar-latest-heading">
          <div>
            <p class="section-label">Latest Daily Brief</p>
            <h2 id="radar-latest-title">今日三条行业信号</h2>
          </div>
          <router-link :to="`/radar/${latestRadar.slug}`">{{ latestRadar.date }} · 查看完整简报 →</router-link>
        </div>
        <div class="radar-lead-signals">
          <article v-for="(signal, index) in latestRadar.marketSignals" :key="signal.title">
            <span>0{{ index + 1 }} · 事实与边界</span>
            <h3>{{ signal.title }}</h3>
            <p>{{ signal.summary }}</p>
            <a v-if="signal.sourceUrl" :href="signal.sourceUrl" target="_blank" rel="noopener">原始来源 ↗</a>
          </article>
        </div>
        <div class="radar-supporting-signals">
          <article v-for="signal in supportingSignals" :key="signal!.title">
            <span>{{ signal!.label }}</span>
            <h3>{{ signal!.title }}</h3>
            <p>{{ signal!.summary }}</p>
          </article>
        </div>
      </section>

      <section v-if="latestWeekly" class="radar-weekly-preview" aria-labelledby="weekly-title">
        <div>
          <p class="section-label">Reviewed Weekly Convergence</p>
          <h2 id="weekly-title">{{ latestWeekly.title }}</h2>
          <p>{{ latestWeekly.summary }}</p>
        </div>
        <div class="radar-weekly-preview-points">
          <div><span>形成判断</span><strong>{{ latestWeekly.judgments.length }}</strong></div>
          <div><span>进入工程</span><strong>{{ latestWeekly.shipped.length }}</strong></div>
          <div><span>下周重点</span><strong>{{ latestWeekly.nextFocus.length }}</strong></div>
          <router-link :to="`/radar/week/${latestWeekly.slug}`">查看本周收敛 →</router-link>
        </div>
      </section>

      <section class="radar-archive" aria-labelledby="archive-title">
        <div class="radar-archive-heading">
          <div><p class="section-label">Archive</p><h2 id="archive-title">历史简报</h2></div>
          <div class="radar-topic-filters" role="group" aria-label="按主题筛选历史简报">
            <button
              v-for="topic in topics"
              :key="topic.key"
              type="button"
              :class="{ active: activeTopic === topic.key }"
              :aria-pressed="activeTopic === topic.key"
              @click="activeTopic = topic.key"
            >
              {{ topic.label }}
            </button>
          </div>
        </div>

        <div v-if="archiveGroups.length" class="radar-archive-groups">
          <section v-for="group in archiveGroups" :key="group.week">
            <h3>{{ group.week }}</h3>
            <router-link
              v-for="radar in group.entries"
              :key="radar.slug"
              :to="`/radar/${radar.slug}`"
              class="radar-archive-row"
            >
              <time :datetime="radar.date">{{ radar.date }}</time>
              <span>{{ radar.summary }}</span>
              <strong>→</strong>
            </router-link>
          </section>
        </div>
        <p v-else class="verification-note">这个主题暂时没有通过发布门禁的简报。</p>
      </section>
    </div>
  </section>
</template>
