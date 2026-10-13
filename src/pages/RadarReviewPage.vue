<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { radarReviews } from '../data/generatedRadarReviews'
import {
  reviewDomainCounts,
  reviewMilestoneCount,
  reviewPeriodDays,
  trendMonthTicks,
  trendSpan,
  trendTrack,
} from '../data/radarReviewPresentation'
import { radarTopicLabel } from '../data/radarPresentation'
import { setSeoMeta } from '../utils/seo'
import '../styles/radar.css'
import '../styles/radar-review.css'

const route = useRoute()
const review = computed(() => radarReviews.find(item => item.slug === String(route.params.period || '')))
const ticks = computed(() => (review.value ? trendMonthTicks(review.value) : []))
const domainCounts = computed(() => (review.value ? reviewDomainCounts(review.value) : { ai: 0, web3: 0 }))

watchEffect(() =>
  setSeoMeta(
    review.value
      ? { title: `${review.value.title}｜xiuqiu`, description: review.value.summary, path: `/radar/review/${review.value.slug}`, type: 'article' }
      : { title: 'Trend review not found｜xiuqiu', path: route.fullPath, indexable: false },
  ),
)
</script>

<template>
  <div v-if="review" class="radar-weekly-reader-page radar-review-page" lang="zh-CN">
    <header class="radar-reader-hero radar-reader-hero--weekly">
      <div class="container radar-reader-shell">
        <router-link to="/radar" class="radar-reader-back">← Intelligence Radar</router-link>
        <div class="radar-reader-hero-grid">
          <div>
            <p class="radar-kicker">Trend Review</p>
            <h1>{{ review.title }}</h1>
          </div>
          <div class="radar-reader-summary">
            <p>{{ review.summary }}</p>
            <dl>
              <div><dt>Period</dt><dd><time :datetime="review.periodStart">{{ review.periodStart }}</time> – <time :datetime="review.periodEnd">{{ review.periodEnd }}</time></dd></div>
              <div><dt>Trends</dt><dd>AI {{ domainCounts.ai }} · Web3 {{ domainCounts.web3 }}</dd></div>
              <div><dt>Milestones</dt><dd>{{ reviewMilestoneCount(review) }} 个 · {{ reviewPeriodDays(review) }} 天</dd></div>
            </dl>
            <p class="radar-review-boundary">由公开来源自动汇总，未经人工复核；计数口径写在每条趋势里。</p>
          </div>
        </div>
      </div>
    </header>

    <div class="radar-reader-body">
      <div class="container radar-reader-shell">
        <nav class="radar-review-index" aria-label="趋势目录">
          <a v-for="(trend, index) in review.trends" :key="trend.id" :href="`#${trend.id}`">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <b :class="`radar-feed-domain radar-feed-domain--${trend.domain}`">{{ trend.domain.toUpperCase() }}</b>
            {{ trend.title }}
          </a>
        </nav>

        <article v-for="(trend, index) in review.trends" :id="trend.id" :key="trend.id" class="radar-review-trend" :aria-labelledby="`${trend.id}-title`">
          <header>
            <p class="radar-feed-meta">
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <b :class="`radar-feed-domain radar-feed-domain--${trend.domain}`">{{ trend.domain.toUpperCase() }}</b>
              <span>{{ radarTopicLabel(trend.topic) }}</span>
            </p>
            <h2 :id="`${trend.id}-title`">{{ trend.title }}</h2>
            <p class="radar-review-thesis">{{ trend.thesis }}</p>
          </header>

          <p class="radar-review-signal"><strong>信号</strong>{{ trend.signal }}</p>

          <div
            class="radar-review-track"
            aria-hidden="true"
            :style="{ '--track-from': `${trendSpan(trendTrack(review, trend)).from}%`, '--track-to': `${trendSpan(trendTrack(review, trend)).to}%` }"
          >
            <span :class="`radar-review-span radar-review-span--${trend.domain}`" />
            <span v-for="tick in ticks" :key="tick.label" class="radar-review-tick" :style="{ left: `${tick.offset}%` }">{{ tick.label }}</span>
            <span
              v-for="point in trendTrack(review, trend)"
              :key="`${point.date}-${point.url}`"
              :class="`radar-review-dot radar-review-dot--${trend.domain}`"
              :style="{ left: `${point.offset}%` }"
            />
          </div>

          <ol class="radar-review-milestones">
            <li v-for="milestone in trend.milestones" :key="`${milestone.date}-${milestone.url}`">
              <time :datetime="milestone.date">{{ milestone.date }}</time>
              <p>{{ milestone.text }}</p>
              <a :href="milestone.url" target="_blank" rel="noopener noreferrer">来源 ↗</a>
            </li>
          </ol>

          <dl class="radar-review-reading">
            <div><dt>对工程的意义</dt><dd>{{ trend.implication }}</dd></div>
            <div><dt>什么会推翻它</dt><dd>{{ trend.falsifier }}</dd></div>
          </dl>
        </article>
      </div>
    </div>
  </div>

  <section v-else class="radar-reader-not-found" aria-labelledby="review-not-found-title">
    <div class="container radar-reader-shell">
      <p class="radar-kicker">Trend Review</p>
      <h1 id="review-not-found-title">没有找到这期趋势回顾</h1>
      <router-link to="/radar" class="radar-reader-back">← 返回学习雷达</router-link>
    </div>
  </section>
</template>
