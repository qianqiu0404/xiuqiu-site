<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { radarWeeklies } from '../data/generatedRadarWeeklies'
import { getProjectByKey } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const route = useRoute()
const weekly = computed(() => radarWeeklies.find(item => item.slug === String(route.params.week || '')))
const relatedProjects = computed(() =>
  weekly.value?.relatedProjectSlugs.map(getProjectByKey).filter(Boolean) || [],
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
        }
      : { title: 'Weekly radar not found｜xiuqiu', path: route.fullPath },
  ),
)
</script>

<template>
  <section class="page-top radar-reader-page">
    <div v-if="weekly" class="container radar-reader radar-weekly-reader">
      <router-link to="/radar" class="radar-reader-back">← 返回行业情报雷达</router-link>
      <header class="radar-reader-header">
        <p class="radar-kicker">Human Reviewed Weekly</p>
        <div class="radar-reader-meta">
          <time :datetime="weekly.reviewedAt">复核于 {{ weekly.reviewedAt }}</time>
          <span>人工复核后公开</span>
        </div>
        <h1>{{ weekly.title }}</h1>
        <p>{{ weekly.summary }}</p>
      </header>

      <aside class="radar-weekly-boundary" aria-label="本页事实与推断边界">
        <div>
          <strong>来源事实</strong>
          <p>原始来源只作为复核输入，可在页尾逐项打开。</p>
        </div>
        <div>
          <strong>人工判断</strong>
          <p>明确标在“形成判断”，不能代替工程验证。</p>
        </div>
        <div>
          <strong>工程记录</strong>
          <p>“已进入工程”表示已有复核记录，不等于生产验收。</p>
        </div>
      </aside>

      <nav class="radar-weekly-reader-stats" aria-label="本周五类收敛结论">
        <a v-for="section in sections" :key="section.id" :href="`#${section.id}`">
          <strong>{{ section.items.length }}</strong>
          <span>{{ section.shortLabel }}</span>
        </a>
      </nav>

      <div class="radar-weekly-flow" aria-hidden="true">
        <span>公开来源</span>
        <i>→</i>
        <span>人工判断</span>
        <i>→</i>
        <span>工程验证</span>
      </div>

      <section
        v-for="(section, index) in sections"
        :id="section.id"
        :key="section.id"
        class="radar-weekly-reader-section"
        :data-tone="section.tone"
      >
        <header>
          <span>{{ String(index + 1).padStart(2, '0') }}</span>
          <div>
            <p class="radar-kicker">{{ section.label }}</p>
            <strong>{{ section.boundary }}</strong>
          </div>
        </header>
        <ol>
          <li v-for="item in section.items" :key="item">{{ item }}</li>
        </ol>
      </section>

      <section v-if="relatedProjects.length" class="radar-reader-projects">
        <p class="radar-kicker">Related Engineering</p>
        <h2>关联工程</h2>
        <div>
          <router-link v-for="project in relatedProjects" :key="project!.slug" :to="`/projects/${project!.slug}`">
            {{ project!.name }} <span aria-hidden="true">→</span>
          </router-link>
        </div>
      </section>

      <details class="radar-reader-disclosure">
        <summary>复核说明与来源 <span aria-hidden="true">＋</span></summary>
        <div>
          <p>周度收敛只公开经过人工复核并通过公开门禁的内容，不复制私人每日记录；来源用于复核，不代表采用或背书。</p>
          <div class="radar-weekly-source-links">
            <a v-for="(url, index) in weekly.sourceUrls" :key="url" :href="url" target="_blank" rel="noopener">
              来源 {{ index + 1 }} <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </details>
    </div>
    <div v-else class="container not-found">
      <p class="not-found-title">这份周度收敛不存在或尚未公开</p>
      <router-link to="/radar" class="btn btn-primary">返回雷达</router-link>
    </div>
  </section>
</template>
