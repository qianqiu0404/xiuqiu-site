<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { dailyRadars, type DailyRadar } from '../data/generatedRadars'
import { radarWeeklies } from '../data/generatedRadarWeeklies'
import { getSupportingRadarItems, radarSourceStatus } from '../data/radarPresentation'
import { setSeoMeta } from '../utils/seo'
import '../styles/radar.css'

const latestRadar = dailyRadars[0]
const latestWeekly = radarWeeklies[0]
type ArchiveFilter = 'all' | 'crypto' | 'ai' | 'web3' | 'tools' | 'reading'

interface ArchiveFilterOption {
  key: ArchiveFilter
  label: string
}

interface RadarArchiveGroup {
  week: string
  label: string
  radars: DailyRadar[]
}

const archiveFilter = ref<ArchiveFilter>('all')
const archiveFilters: ArchiveFilterOption[] = [
  { key: 'all', label: '全部' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'ai', label: 'AI Engineering' },
  { key: 'web3', label: 'Web3 Design' },
  { key: 'tools', label: 'Tools' },
  { key: 'reading', label: 'Reading' },
]
const supportingSignals = computed(() =>
  latestRadar ? getSupportingRadarItems(latestRadar) : [],
)

function radarMatchesFilter(radar: DailyRadar, filter: ArchiveFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'crypto') return radar.marketSignals.length > 0
  if (filter === 'ai') return Boolean(radar.aiTip)
  if (filter === 'web3') return Boolean(radar.web3Design)
  if (filter === 'tools') return Boolean(radar.vibeProject)
  return Boolean(radar.readingPick)
}

function radarCategoryLabels(radar: DailyRadar): string[] {
  return [
    radar.marketSignals.length ? 'Crypto' : undefined,
    radar.aiTip ? 'AI' : undefined,
    radar.web3Design ? 'Web3' : undefined,
    radar.vibeProject ? 'Tools' : undefined,
    radar.readingPick ? 'Reading' : undefined,
  ].filter((label): label is string => Boolean(label))
}

function radarArchiveTitle(radar: DailyRadar): string {
  if (archiveFilter.value === 'ai') return radar.aiTip?.title || radar.summary
  if (archiveFilter.value === 'web3') return radar.web3Design?.title || radar.summary
  if (archiveFilter.value === 'tools') return radar.vibeProject?.title || radar.summary
  if (archiveFilter.value === 'reading') return radar.readingPick?.title || radar.summary
  return radar.marketSignals[0]?.title || radar.summary
}

function getIsoWeek(dateValue: string): { key: string; label: string } {
  const date = new Date(`${dateValue}T00:00:00Z`)
  const dayIndex = (date.getUTCDay() + 6) % 7
  const thursday = new Date(date)
  thursday.setUTCDate(date.getUTCDate() - dayIndex + 3)
  const weekYear = thursday.getUTCFullYear()
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4))
  const firstDayIndex = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayIndex + 3)
  const weekNumber = 1 + Math.round(
    (thursday.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000),
  )
  const week = String(weekNumber).padStart(2, '0')
  return { key: `${weekYear}-W${week}`, label: `${weekYear} · 第 ${weekNumber} 周` }
}

const archiveFilterCounts = computed(() =>
  Object.fromEntries(
    archiveFilters.map(option => [
      option.key,
      dailyRadars.filter(radar => radarMatchesFilter(radar, option.key)).length,
    ]),
  ) as Record<ArchiveFilter, number>,
)

const archiveGroups = computed<RadarArchiveGroup[]>(() => {
  const groups = new Map<string, RadarArchiveGroup>()
  dailyRadars
    .filter(radar => radarMatchesFilter(radar, archiveFilter.value))
    .forEach((radar) => {
      const week = getIsoWeek(radar.date)
      const current = groups.get(week.key)
      if (current) {
        current.radars.push(radar)
      } else {
        groups.set(week.key, { week: week.key, label: week.label, radars: [radar] })
      }
    })
  return [...groups.values()]
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

      <section v-if="latestRadar" class="radar-today" aria-labelledby="radar-today-title">
        <div class="radar-section-heading">
          <div>
            <p class="radar-kicker">01 · Latest Daily Brief</p>
            <h2 id="radar-today-title">最新日报核心信号</h2>
          </div>
          <router-link :to="`/radar/${latestRadar.slug}`">阅读完整简报 <span aria-hidden="true">→</span></router-link>
        </div>

        <div class="radar-latest-brief">
          <div class="radar-latest-primary">
            <div class="radar-latest-intro">
              <div>
                <time :datetime="latestRadar.date">{{ latestRadar.date }}</time>
                <span>AI 自动汇总 · 公开来源</span>
              </div>
              <p>{{ latestRadar.summary }}</p>
            </div>

            <ol class="radar-core-signals">
              <li v-for="(signal, index) in latestRadar.marketSignals" :key="signal.title">
                <span>{{ String(index + 1).padStart(2, '0') }}</span>
                <div>
                  <p>公开事实与待验证边界</p>
                  <h3>{{ signal.title }}</h3>
                  <p>{{ signal.summary }}</p>
                </div>
                <a
                  v-if="signal.sourceUrl"
                  :href="signal.sourceUrl"
                  target="_blank"
                  rel="noopener"
                  :aria-label="`查看 ${signal.title} 的原始来源`"
                >↗</a>
              </li>
            </ol>
          </div>

          <aside v-if="supportingSignals.length" class="radar-research-lanes" aria-label="本期次级研究栏目">
            <header>
              <p class="radar-kicker">Research Lanes</p>
              <span>推断与观察</span>
            </header>
            <article v-for="signal in supportingSignals" :key="signal.title">
              <div>
                <span>{{ signal.label }}</span>
                <strong>{{ signal.evidenceLabel }}</strong>
              </div>
              <h3>{{ signal.title }}</h3>
              <router-link
                :to="`/radar/${latestRadar.slug}#${signal.key === 'web3' ? 'web3-design' : signal.key === 'ai' ? 'ai-engineering' : signal.key}`"
                :aria-label="`阅读 ${signal.title}`"
              >→</router-link>
            </article>
          </aside>
        </div>
      </section>

      <section v-if="latestWeekly" class="radar-weekly-section" aria-labelledby="weekly-title">
        <div class="radar-section-heading">
          <div>
            <p class="radar-kicker">02 · Human Reviewed Weekly</p>
            <h2 id="weekly-title">最新人工周度收敛</h2>
          </div>
          <time :datetime="latestWeekly.reviewedAt">复核于 {{ latestWeekly.reviewedAt }}</time>
        </div>

        <div class="radar-weekly-card">
          <div class="radar-weekly-copy">
            <p class="radar-kicker">{{ latestWeekly.title }}</p>
            <p>{{ latestWeekly.summary }}</p>
            <router-link :to="`/radar/week/${latestWeekly.slug}`">查看五类收敛结论 <span aria-hidden="true">→</span></router-link>
          </div>
          <div class="radar-weekly-digest">
            <div v-if="latestWeekly.judgments[0]">
              <span>人工判断</span>
              <p>{{ latestWeekly.judgments[0] }}</p>
            </div>
            <div v-if="latestWeekly.shipped[0]">
              <span>已进入工程</span>
              <p>{{ latestWeekly.shipped[0] }}</p>
            </div>
            <div v-if="latestWeekly.nextFocus[0]">
              <span>下周重点</span>
              <p>{{ latestWeekly.nextFocus[0] }}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="radar-editorial-archive" aria-labelledby="archive-title">
        <div class="radar-section-heading">
          <div>
            <p class="radar-kicker">03 · Archive</p>
            <h2 id="archive-title">按周历史档案</h2>
          </div>
          <span>{{ dailyRadars.length }} 期公开记录</span>
        </div>

        <div class="radar-archive-filters" role="group" aria-label="按栏目筛选历史简报">
          <button
            v-for="option in archiveFilters"
            :key="option.key"
            type="button"
            :class="{ active: archiveFilter === option.key }"
            :aria-pressed="archiveFilter === option.key"
            @click="archiveFilter = option.key"
          >
            {{ option.label }}
            <span>{{ archiveFilterCounts[option.key] }}</span>
          </button>
        </div>

        <p class="sr-only" aria-live="polite">
          当前显示 {{ archiveFilterCounts[archiveFilter] }} 期简报
        </p>
        <div v-if="archiveGroups.length" class="radar-archive-groups">
          <div v-for="group in archiveGroups" :key="group.week" class="radar-archive-group">
            <header>
              <h3>{{ group.label }}</h3>
              <span>{{ group.radars.length }} 期</span>
            </header>
            <div>
              <router-link
                v-for="radar in group.radars"
                :key="radar.slug"
                :to="`/radar/${radar.slug}`"
              >
                <time :datetime="radar.date">{{ radar.date.slice(5).replace('-', '.') }}</time>
                <strong>{{ radarArchiveTitle(radar) }}</strong>
                <span class="radar-archive-tags" aria-label="包含栏目">
                  <small v-for="label in radarCategoryLabels(radar)" :key="label">{{ label }}</small>
                </span>
                <span aria-hidden="true">→</span>
              </router-link>
            </div>
          </div>
        </div>
        <p v-else class="radar-archive-empty">该栏目暂时没有公开简报。</p>
      </section>

      <p class="radar-editorial-disclaimer">
        内容由公开来源经 AI 自动汇总，周度判断另行人工复核。市场信息仅用于研究与教育，不构成投资建议。
      </p>
    </div>
  </section>
</template>
