<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { radarReviews, reviewDomainCounts, reviewMilestoneCount, reviewPeriodDays, trendMonthTicks, trendSpan, trendTrack, radarTopicLabel, readingReturnLink, getRadarCorrections } from '../data'
import { setSeoMeta } from '../../../utils/seo'
import '../../../design/brief.css'
import '../../../design/reader.css'
import '../../../styles/radar-review.css'

const route = useRoute()
const returnLink = computed(() => readingReturnLink(route.query.from))
const review = computed(() => radarReviews.find(item => item.slug === String(route.params.period || '')))
const corrections = computed(() => getRadarCorrections('review', review.value?.slug))
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
  <div v-if="review" class="brief radar-review-page" lang="zh-CN">
    <header class="brief-masthead">
      <div class="brief-shell">
        <router-link :to="returnLink.href" class="brief-back">{{ returnLink.label }}</router-link>
        <p class="brief-dateline">
          <span>趋势回顾</span>
          <span><time :datetime="review.periodStart">{{ review.periodStart }}</time> – <time :datetime="review.periodEnd">{{ review.periodEnd }}</time></span>
          <span>{{ reviewPeriodDays(review) }} 天</span>
        </p>
        <div class="brief-masthead-row">
          <div>
            <h1>{{ review.title }}</h1>
            <p class="brief-lede">{{ review.summary }}</p>
          </div>
          <dl class="brief-stats">
            <div><dt>AI</dt><dd>{{ domainCounts.ai }}</dd></div>
            <div><dt>Web3</dt><dd>{{ domainCounts.web3 }}</dd></div>
            <div><dt>里程碑</dt><dd>{{ reviewMilestoneCount(review) }}</dd></div>
          </dl>
        </div>
        <aside v-for="correction in corrections" :key="correction.id" class="brief-state" role="note" :aria-labelledby="`correction-${correction.id}`">
          <strong :id="`correction-${correction.id}`"><time :datetime="correction.date">{{ correction.date }}</time> 更正</strong>
          <p>{{ correction.summary }}</p>
          <p>{{ correction.boundary }}</p>
          <a class="brief-button" :href="correction.source.url" target="_blank" rel="noopener noreferrer">{{ correction.source.label }} · {{ correction.source.publishedAt }} ↗</a>
        </aside>
        <p class="brief-note review-boundary">由公开来源自动汇总，未经人工复核；计数口径写在每条趋势里。</p>
      </div>
    </header>

    <div class="brief-shell reader-layout">
      <nav class="reader-toc" aria-label="趋势目录">
        <span>趋势线</span>
        <a v-for="(trend, index) in review.trends" :key="trend.id" :href="`#${trend.id}`">
          {{ String(index + 1).padStart(2, '0') }} · {{ trend.title }}
        </a>
      </nav>

      <div class="reader-main">
        <article v-for="(trend, index) in review.trends" :id="trend.id" :key="trend.id" class="reader-article review-trend" :aria-labelledby="`${trend.id}-title`">
          <p class="brief-card-meta">
            <span class="review-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <b :class="`brief-tag brief-tag--${trend.domain}`">{{ trend.domain.toUpperCase() }}</b>
            <span>{{ radarTopicLabel(trend.topic) }}</span>
          </p>
          <h2 :id="`${trend.id}-title`">{{ trend.title }}</h2>
          <p class="reader-why">{{ trend.thesis }}</p>
          <p class="review-signal"><strong>信号</strong><span>{{ trend.signal }}</span></p>

          <div
            class="review-track"
            aria-hidden="true"
            :style="{ '--track-from': `${trendSpan(trendTrack(review, trend)).from}%`, '--track-to': `${trendSpan(trendTrack(review, trend)).to}%` }"
          >
            <span v-for="tick in ticks" :key="tick.label" class="review-tick" :style="{ left: `${tick.offset}%` }">{{ tick.label }}</span>
            <span :class="`review-span review-span--${trend.domain}`" />
            <span
              v-for="point in trendTrack(review, trend)"
              :key="`${point.date}-${point.url}`"
              :class="`review-dot review-dot--${trend.domain}`"
              :style="{ left: `${point.offset}%` }"
            />
          </div>

          <ol class="review-milestones">
            <li v-for="milestone in trend.milestones" :key="`${milestone.date}-${milestone.url}`">
              <time :datetime="milestone.date">{{ milestone.date.slice(5) }}</time>
              <p>{{ milestone.text }}</p>
              <a :href="milestone.url" target="_blank" rel="noopener noreferrer" :aria-label="`来源：${milestone.text}`">来源 ↗</a>
            </li>
          </ol>

          <dl class="review-reading">
            <div><dt>对工程的意义</dt><dd>{{ trend.implication }}</dd></div>
            <div><dt>什么会推翻它</dt><dd>{{ trend.falsifier }}</dd></div>
          </dl>
        </article>
      </div>
    </div>
  </div>

  <section v-else class="brief" aria-labelledby="review-not-found-title">
    <div class="brief-masthead"><div class="brief-shell">
      <p class="brief-dateline"><span>趋势回顾</span></p>
      <h1 id="review-not-found-title">没有找到这期趋势回顾</h1>
      <router-link :to="returnLink.href" class="brief-back">{{ returnLink.label }}</router-link>
    </div></div>
  </section>
</template>
