<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { radarWeeklies, radarIndex, getRadarReviewBoundary, getProjectByKey, readingReturnLink } from '../data'
import { setSeoMeta } from '../../../utils/seo'
import '../../../design/brief.css'
import '../../../design/reader.css'

const route = useRoute()
const returnLink = computed(() => readingReturnLink(route.query.from))
const weekly = computed(() => radarWeeklies.find(item => item.slug === String(route.params.week || '')))
const relatedProjects = computed(() =>
  weekly.value?.relatedProjectSlugs.map(getProjectByKey).filter(Boolean) || [],
)
const reviewBoundary = computed(() =>
  weekly.value
    ? getRadarReviewBoundary(weekly.value.reviewedAt, radarIndex[0]?.date)
    : undefined,
)
const sections = computed(() =>
  weekly.value
    ? [
        {
          id: 'judgments',
          label: '本周形成的判断',
          shortLabel: '判断',
          boundary: '人工推断 · 不是已验证事实',
          tone: 'decision',
          items: weekly.value.judgments,
        },
        {
          id: 'shipped',
          label: '已进入工程',
          shortLabel: '工程',
          boundary: '复核记录 · 不等于生产验收',
          tone: 'shipped',
          items: weekly.value.shipped,
        },
        {
          id: 'watch',
          label: '继续观察',
          shortLabel: '观察',
          boundary: '待验证信息 · 尚未进入结论',
          tone: 'watch',
          items: weekly.value.watch,
        },
        {
          id: 'stopped',
          label: '停止追踪',
          shortLabel: '停止',
          boundary: '研究取舍 · 不代表事实被否定',
          tone: 'stopped',
          items: weekly.value.stopped,
        },
        {
          id: 'next-focus',
          label: '下周只保留',
          shortLabel: '下一步',
          boundary: '行动计划 · 完成后仍需验证',
          tone: 'next',
          items: weekly.value.nextFocus,
        },
      ].filter(section => section.items.length)
    : [],
)

watchEffect(() =>
  setSeoMeta(
    weekly.value
      ? {
          title: `${weekly.value.title}｜xiuqiu`,
          description: weekly.value.summary,
          path: `/radar/week/${weekly.value.slug}`,
          type: 'article',
        }
      : { title: 'Weekly radar not found｜xiuqiu', path: route.fullPath, indexable: false },
  ),
)
</script>

<template>
  <div v-if="weekly" class="brief radar-weekly-reader-page" lang="zh-CN">
    <header class="brief-masthead">
      <div class="brief-shell">
        <router-link :to="returnLink.href" class="brief-back">{{ returnLink.label }}</router-link>
        <p class="brief-dateline">
          <span>{{ weekly.week }}</span>
          <span>人工复核周报</span>
          <time :datetime="weekly.reviewedAt">{{ reviewBoundary?.lastReviewedLabel }}</time>
        </p>
        <h1>{{ weekly.title }}</h1>
        <p class="brief-lede">{{ weekly.summary }}</p>
        <p v-if="reviewBoundary" class="brief-fresh brief-fresh--stale" role="status">
          {{ reviewBoundary.statusLabel }} {{ reviewBoundary.nextReviewLabel }}
        </p>
      </div>
    </header>

    <div class="brief-shell reader-layout">
      <nav class="reader-toc" aria-label="本周收敛结论">
        <span>本周收敛</span>
        <a v-for="section in sections" :key="section.id" :href="`#${section.id}`">
          {{ section.shortLabel }} · {{ section.items.length }}
        </a>
      </nav>

      <div class="reader-main">
        <aside class="radar-weekly-boundary reader-boundary" aria-label="本页事实与推断边界">
          <div><span>01</span><strong>来源事实</strong><p>原始来源只作为复核输入，可在页尾逐项打开。</p></div>
          <div><span>02</span><strong>人工判断</strong><p>明确标在“形成判断”，不能代替工程验证。</p></div>
          <div><span>03</span><strong>工程记录</strong><p>“已进入工程”表示已有复核记录，不等于生产验收。</p></div>
        </aside>

        <section
          v-for="(section, index) in sections"
          :id="section.id"
          :key="section.id"
          class="reader-section"
          :data-tone="section.tone"
        >
          <header class="reader-section-header">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <h2 class="radar-kicker">{{ section.label }}</h2>
            <small>{{ section.boundary }}</small>
          </header>
          <ol class="reader-list"><li v-for="item in section.items" :key="item">{{ item }}</li></ol>
        </section>

        <section v-if="relatedProjects.length" class="reader-section">
          <header class="reader-section-header"><span>→</span><h2>已经建立连接的项目</h2></header>
          <div class="reader-related">
            <router-link v-for="project in relatedProjects" :key="project!.slug" :to="`/projects/${project!.slug}`">
              {{ project!.name }} <span aria-hidden="true">→</span>
            </router-link>
          </div>
        </section>

        <details class="reader-disclosure">
          <summary>复核说明与原始来源</summary>
          <div>
            <p>周度收敛只公开经过人工复核并通过公开门禁的内容，不复制私人每日记录；来源用于复核，不代表采用或背书。</p>
            <div class="reader-related">
              <a v-for="(url, index) in weekly.sourceUrls" :key="url" :href="url" target="_blank" rel="noopener">
                Source {{ String(index + 1).padStart(2, '0') }} <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </details>
      </div>
    </div>
  </div>

  <div v-else class="brief radar-state">
    <div class="brief-masthead"><div class="brief-shell">
      <p class="brief-dateline"><span>Weekly review unavailable</span></p>
      <h1>这份周度收敛不存在或尚未公开。</h1>
      <p class="brief-lede">周报只在人工复核并通过公开门禁后出现。请返回情报流阅读已公开日报与最近一次周报。</p>
      <div class="reader-actions"><router-link :to="returnLink.href" class="brief-button">{{ returnLink.label }}</router-link></div>
    </div></div>
  </div>
</template>
