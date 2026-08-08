<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { dailyRadars, type DailyRadar } from '../data/generatedRadars'
import { radarWeeklies } from '../data/generatedRadarWeeklies'
import { getSupportingRadarItems, radarSourceStatus } from '../data/radarPresentation'
import { setSeoMeta } from '../utils/seo'
import '../styles/radar.css'

const latestRadar = dailyRadars[0]
const latestWeekly = radarWeeklies[0]
const archiveLimit = 10
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
const archiveExpanded = ref(false)
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
  return { key: `${weekYear}-W${week}`, label: `${weekYear} · W${week}` }
}

const archiveFilterCounts = computed(() =>
  Object.fromEntries(
    archiveFilters.map(option => [
      option.key,
      dailyRadars.filter(radar => radarMatchesFilter(radar, option.key)).length,
    ]),
  ) as Record<ArchiveFilter, number>,
)

const filteredArchive = computed(() =>
  dailyRadars.filter(radar => radarMatchesFilter(radar, archiveFilter.value)),
)

const visibleArchive = computed(() =>
  archiveExpanded.value ? filteredArchive.value : filteredArchive.value.slice(0, archiveLimit),
)

const archiveGroups = computed<RadarArchiveGroup[]>(() => {
  const groups = new Map<string, RadarArchiveGroup>()
  visibleArchive.value.forEach((radar) => {
    const week = getIsoWeek(radar.date)
    const current = groups.get(week.key)
    if (current) current.radars.push(radar)
    else groups.set(week.key, { week: week.key, label: week.label, radars: [radar] })
  })
  return [...groups.values()]
})

watch(archiveFilter, () => {
  archiveExpanded.value = false
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
  <main class="radar-intelligence-page" lang="zh-CN">
    <section class="radar-intelligence-hero" aria-labelledby="radar-title">
      <div class="container radar-intelligence-shell radar-hero-layout">
        <div class="radar-hero-copy">
          <p class="radar-kicker">Industry Intelligence / Human Convergence</p>
          <h1 id="radar-title">把行业信号，<br /><span>压缩成<br />工程判断。</span></h1>
          <p>
            日报负责保留公开事实与待验证线索，周报负责决定哪些进入 Wallet、Market 与 AI Engineering。
          </p>
        </div>

        <aside v-if="latestRadar" class="radar-hero-status" aria-label="最新情报状态">
          <div>
            <span>Latest brief</span>
            <time :datetime="latestRadar.date">{{ latestRadar.date }}</time>
          </div>
          <dl>
            <div>
              <dt>Signals</dt>
              <dd>{{ latestRadar.marketSignals.length }}</dd>
            </div>
            <div>
              <dt>Archive</dt>
              <dd>{{ dailyRadars.length }}</dd>
            </div>
          </dl>
          <p>AI 自动汇总 · {{ radarSourceStatus(latestRadar) }}</p>
        </aside>
      </div>
    </section>

    <section v-if="latestRadar" class="radar-daily-stage" aria-labelledby="radar-daily-title">
      <div class="container radar-intelligence-shell">
        <header class="radar-stage-heading">
          <div>
            <p class="radar-kicker">01 / Daily Brief</p>
            <h2 id="radar-daily-title">今天值得留下的三条信号。</h2>
          </div>
          <router-link :to="`/radar/${latestRadar.slug}`">阅读完整简报 <span aria-hidden="true">↗</span></router-link>
        </header>

        <div class="radar-daily-layout">
          <div class="radar-daily-primary">
            <header>
              <time :datetime="latestRadar.date">{{ latestRadar.date }}</time>
              <p>{{ latestRadar.summary }}</p>
            </header>

            <ol class="radar-signal-ledger">
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
          </div>

          <aside v-if="supportingSignals.length" class="radar-research-index" aria-label="本期研究分支">
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

    <section v-if="latestWeekly" class="radar-convergence-stage" aria-labelledby="radar-weekly-title">
      <div class="container radar-intelligence-shell">
        <header class="radar-stage-heading radar-stage-heading--dark">
          <div>
            <p class="radar-kicker">02 / Human Reviewed Weekly</p>
            <h2 id="radar-weekly-title">信号只有经过取舍，<br />才配进入工程。</h2>
          </div>
          <time :datetime="latestWeekly.reviewedAt">Reviewed {{ latestWeekly.reviewedAt }}</time>
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

    <section class="radar-archive-stage" aria-labelledby="radar-archive-title">
      <div class="container radar-intelligence-shell">
        <header class="radar-stage-heading">
          <div>
            <p class="radar-kicker">03 / Intelligence Archive</p>
            <h2 id="radar-archive-title">历史不是卡片墙，<br />是可检索的判断轨迹。</h2>
          </div>
          <span>{{ filteredArchive.length }} / {{ dailyRadars.length }} 期</span>
        </header>

        <div class="radar-filter-line" role="group" aria-label="按栏目筛选历史简报">
          <button
            v-for="option in archiveFilters"
            :key="option.key"
            type="button"
            :class="{ active: archiveFilter === option.key }"
            :aria-pressed="archiveFilter === option.key"
            @click="archiveFilter = option.key"
          >
            {{ option.label }} <span>{{ archiveFilterCounts[option.key] }}</span>
          </button>
        </div>

        <p class="sr-only" aria-live="polite">当前显示 {{ visibleArchive.length }} 期简报</p>
        <div v-if="archiveGroups.length" class="radar-archive-ledger">
          <section v-for="group in archiveGroups" :key="group.week">
            <header><h3>{{ group.label }}</h3><span>{{ group.radars.length }} briefs</span></header>
            <router-link v-for="radar in group.radars" :key="radar.slug" :to="`/radar/${radar.slug}`">
              <time :datetime="radar.date">{{ radar.date.slice(5).replace('-', '.') }}</time>
              <strong>{{ radarArchiveTitle(radar) }}</strong>
              <span aria-hidden="true">→</span>
            </router-link>
          </section>
        </div>
        <p v-else class="radar-archive-empty">该栏目暂时没有公开简报。</p>

        <button
          v-if="filteredArchive.length > archiveLimit"
          class="radar-archive-toggle"
          type="button"
          :aria-expanded="archiveExpanded"
          @click="archiveExpanded = !archiveExpanded"
        >
          {{ archiveExpanded ? '收起历史记录' : `展开全部 ${filteredArchive.length} 期` }}
        </button>

        <p class="radar-editorial-disclaimer">
          内容由公开来源经 AI 自动汇总，周度判断另行人工复核。市场信息仅用于研究与教育，不构成投资建议。
        </p>
      </div>
    </section>
  </main>
</template>
