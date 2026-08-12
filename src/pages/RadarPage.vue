<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { latestRadars, radarIndex, type RadarIndexEntry } from '../data/generatedRadars'
import { radarWeeklies } from '../data/generatedRadarWeeklies'
import {
  getRadarReviewBoundary,
  getLearningBriefs,
  getSupportingRadarItems,
  isLearningEditionV2,
  radarSignalCountLabel,
  radarSourceStatus,
} from '../data/radarPresentation'
import { setSeoMeta } from '../utils/seo'
import '../styles/radar.css'

const latestRadar = latestRadars[0]
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
  radars: RadarIndexEntry[]
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
const latestIsV2 = computed(() => Boolean(latestRadar && isLearningEditionV2(latestRadar)))
const aiBriefs = computed(() => latestRadar ? getLearningBriefs(latestRadar, 'ai') : [])
const web3Briefs = computed(() => latestRadar ? getLearningBriefs(latestRadar, 'web3') : [])
const latestSignalLabel = computed(() => radarSignalCountLabel(latestRadar?.marketSignals.length ?? 0))
const latestReviewBoundary = computed(() =>
  latestWeekly
    ? getRadarReviewBoundary(latestWeekly.reviewedAt, latestRadar?.date)
    : undefined,
)

function radarMatchesFilter(radar: RadarIndexEntry, filter: ArchiveFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'crypto') return radar.marketSignals.length > 0 || Boolean(radar.briefs?.some(brief => brief.domain === 'web3'))
  if (filter === 'ai') return Boolean(radar.aiTip) || Boolean(radar.briefs?.some(brief => brief.domain === 'ai'))
  if (filter === 'web3') return Boolean(radar.web3Design) || Boolean(radar.briefs?.some(brief => brief.domain === 'web3'))
  if (filter === 'tools') return Boolean(radar.vibeProject)
  return Boolean(radar.readingPick)
}

function radarArchiveTitle(radar: RadarIndexEntry): string {
  if (archiveFilter.value === 'ai') return radar.briefs?.find(brief => brief.domain === 'ai')?.title || radar.aiTip?.title || radar.summary
  if (archiveFilter.value === 'web3') return radar.briefs?.find(brief => brief.domain === 'web3')?.title || radar.web3Design?.title || radar.summary
  if (archiveFilter.value === 'tools') return radar.vibeProject?.title || radar.summary
  if (archiveFilter.value === 'reading') return radar.readingPick?.title || radar.summary
  return radar.deepDive?.title || radar.briefs?.[0]?.title || radar.marketSignals[0]?.title || radar.summary
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
      radarIndex.filter(radar => radarMatchesFilter(radar, option.key)).length,
    ]),
  ) as Record<ArchiveFilter, number>,
)

const filteredArchive = computed(() =>
  radarIndex.filter(radar => radarMatchesFilter(radar, archiveFilter.value)),
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
  <div
    class="radar-intelligence-page"
    lang="zh-CN"
    :data-snapshot-id="latestRadar?.snapshotId"
    :data-snapshot-as-of="latestRadar?.asOf"
  >
    <section class="radar-intelligence-hero" aria-labelledby="radar-title">
      <div class="container radar-intelligence-shell radar-hero-layout">
        <div class="radar-hero-copy">
          <p class="radar-kicker">Industry Intelligence / Human Convergence</p>
          <h1 id="radar-title">每天学懂<br /><span>AI 与 Web3。</span></h1>
          <p>
            每天 2 条 AI、2 条 Web3，再选择一个问题做专题。先讲机制，再给例子和边界。
          </p>
        </div>

        <aside v-if="latestRadar" class="radar-hero-status" aria-label="最新情报状态">
          <div>
            <span>Latest brief</span>
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
          <p>ResearchOps 门禁通过 · {{ radarSourceStatus(latestRadar) }}</p>
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

    <section v-if="latestRadar" class="radar-daily-stage" aria-labelledby="radar-daily-title">
      <div class="container radar-intelligence-shell">
        <header class="radar-stage-heading">
          <div>
            <p class="radar-kicker">01 / Daily Brief</p>
            <h2 id="radar-daily-title">{{ latestIsV2 ? '今天：4 条快报 + 1 篇专题。' : latestSignalLabel }}</h2>
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
            <p class="radar-kicker">03 / Intelligence Archive</p>
            <h2 id="radar-archive-title">历史不是卡片墙，<br />是可检索的判断轨迹。</h2>
          </div>
          <span>{{ filteredArchive.length }} / {{ radarIndex.length }} 期</span>
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
        <div v-else class="radar-archive-empty" role="status">
          <p>该栏目暂时没有公开简报。</p>
          <button v-if="archiveFilter !== 'all'" type="button" @click="archiveFilter = 'all'">查看全部历史简报</button>
          <p v-else>请稍后返回确认新的公开简报。</p>
        </div>

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
  </div>
</template>
