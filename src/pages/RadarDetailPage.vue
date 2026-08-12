<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import type { DailyRadar } from '../data/generatedRadars'
import { loadRadarBySlug } from '../data/generatedRadarLoader'
import { getLearningBriefs, getRadarDetailSections, isLearningEditionV2, radarSourceStatus } from '../data/radarPresentation'
import { getProjectByKey } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'
import '../styles/radar.css'

const route = useRoute()
const radar = ref<DailyRadar>()
const loading = ref(true)
const loadError = ref(false)
let requestVersion = 0

async function loadRadar(slug: string) {
  const version = ++requestVersion
  loading.value = true
  loadError.value = false
  radar.value = undefined
  let loadedRadar: DailyRadar | undefined
  try {
    loadedRadar = await loadRadarBySlug(slug)
  } catch {
    if (version !== requestVersion) return
    loadError.value = true
  }
  if (version !== requestVersion) return
  radar.value = loadedRadar
  loading.value = false
}

watch(
  () => String(route.params.date || ''),
  slug => loadRadar(slug),
  { immediate: true },
)

const sections = computed(() => radar.value ? getRadarDetailSections(radar.value) : [])
const isV2 = computed(() => Boolean(radar.value && isLearningEditionV2(radar.value)))
const aiBriefs = computed(() => radar.value ? getLearningBriefs(radar.value, 'ai') : [])
const web3Briefs = computed(() => radar.value ? getLearningBriefs(radar.value, 'web3') : [])
const relatedProjects = computed(() => radar.value?.relatedProjectSlugs.map(getProjectByKey).filter(Boolean) || [])

watchEffect(() => {
  if (loading.value) return
  setSeoMeta(radar.value ? { title: `${radar.value.title}｜xiuqiu`, description: radar.value.summary, path: `/radar/${radar.value.slug}`, type: 'article' } : { title: 'Radar not found｜xiuqiu', path: route.fullPath, indexable: false })
})
</script>

<template>
  <div v-if="loading" class="radar-reader-not-found radar-state" aria-busy="true" aria-live="polite">
    <div class="container radar-state__content">
      <p class="radar-state__eyebrow">Daily Industry Brief</p>
      <h1 class="radar-state__title">正在载入本期雷达…</h1>
      <p class="radar-state__message">正在读取公开简报与来源状态，请稍候。</p>
    </div>
  </div>

  <div v-else-if="radar" class="radar-daily-reader-page" lang="zh-CN">
    <header class="radar-reader-hero">
      <div class="container radar-reader-shell">
        <router-link to="/radar" class="radar-reader-back">← Intelligence Radar</router-link>
        <div class="radar-reader-hero-grid">
          <div>
            <p class="radar-kicker">Daily Industry Brief</p>
            <h1>{{ radar.title }}</h1>
          </div>
          <div class="radar-reader-summary">
            <p>{{ radar.summary }}</p>
            <dl>
              <div><dt>Date</dt><dd><time :datetime="radar.date">{{ radar.date }}</time></dd></div>
              <div><dt>{{ isV2 ? 'Researched' : 'Generated' }}</dt><dd><time :datetime="radar.researchedAt || radar.generatedAt">{{ radar.researchedAt || radar.generatedAt }}</time></dd></div>
              <div><dt>Review</dt><dd>{{ isV2 ? 'ResearchOps v2 门禁通过' : 'AI 自动汇总 · 未经人工复核' }}</dd></div>
              <div><dt>Sources</dt><dd>{{ radarSourceStatus(radar) }}</dd></div>
            </dl>
          </div>
        </div>
      </div>
    </header>

    <div class="radar-reader-body">
      <div class="container radar-reader-shell">
        <nav v-if="isV2" class="radar-reader-index" aria-label="本期简报栏目">
          <span>Read by section</span>
          <a href="#ai-briefs">01 · AI</a>
          <a href="#web3-briefs">02 · Web3</a>
          <a href="#deep-dive">03 · 专题</a>
        </nav>
        <nav v-else class="radar-reader-index" aria-label="本期简报栏目">
          <span>Read by section</span>
          <a v-for="(section, index) in sections" :key="section.id" :href="`#${section.id}`">
            {{ String(index + 1).padStart(2, '0') }} · {{ section.label }}
          </a>
        </nav>

        <template v-if="isV2">
          <section
            v-for="(group, groupIndex) in [{ id: 'ai-briefs', label: 'AI', items: aiBriefs }, { id: 'web3-briefs', label: 'Web3', items: web3Briefs }]"
            :id="group.id"
            :key="group.id"
            class="radar-reader-section learning-v2-section"
          >
            <header>
              <span>{{ String(groupIndex + 1).padStart(2, '0') }}</span>
              <div><p class="radar-kicker">{{ group.label }}</p><strong>2 briefs · 机制、例子与边界</strong></div>
            </header>
            <div class="radar-reader-articles">
              <article v-for="brief in group.items" :id="brief.id" :key="brief.id" class="learning-brief-article">
                <small>{{ brief.topic.replaceAll('_', ' ') }}</small>
                <h2>{{ brief.title }}</h2>
                <dl class="learning-answer-grid">
                  <div><dt>01 · 发生了什么</dt><dd>{{ brief.whatHappened }}</dd></div>
                  <div><dt>02 · 核心机制</dt><dd>{{ brief.mechanism }}</dd></div>
                  <div><dt>03 · 工作示例</dt><dd>{{ brief.workedExample }}</dd></div>
                  <div><dt>04 · 为什么与你有关</dt><dd>{{ brief.whyItMatters }}</dd></div>
                  <div><dt>05 · 风险与限制</dt><dd><ul><li v-for="risk in brief.risksAndLimits" :key="risk">{{ risk }}</li></ul></dd></div>
                  <div><dt>06 · 一手来源与精选研究</dt><dd class="learning-source-list">
                    <a v-for="source in brief.sources" :key="source.url" :href="source.url" target="_blank" rel="noopener">
                      <b>{{ source.tier.toUpperCase() }}</b><span>{{ source.name }}</span><time v-if="source.publishedAt" :datetime="source.publishedAt">{{ source.publishedAt.slice(0, 10) }}</time>
                    </a>
                  </dd></div>
                  <div><dt>07 · 下一步问题</dt><dd><ul><li v-for="question in brief.nextQuestions" :key="question">{{ question }}</li></ul></dd></div>
                </dl>
              </article>
            </div>
          </section>

          <section v-if="radar.deepDive" id="deep-dive" class="radar-reader-section learning-v2-section learning-deep-dive-section">
            <header><span>03</span><div><p class="radar-kicker">Deep Dive</p><strong>基于 {{ radar.deepDive.basedOnBriefId }}</strong></div></header>
            <div class="radar-reader-articles">
              <article class="learning-brief-article">
                <small>{{ radar.deepDive.domain.toUpperCase() }} · {{ radar.deepDive.topic.replaceAll('_', ' ') }}</small>
                <h2>{{ radar.deepDive.title }}</h2>
                <dl class="learning-answer-grid">
                  <div><dt>01 · 发生了什么</dt><dd>{{ radar.deepDive.whatHappened }}</dd></div>
                  <div><dt>02 · 核心机制</dt><dd>{{ radar.deepDive.mechanism }}</dd></div>
                  <div><dt>03 · 工作示例</dt><dd>{{ radar.deepDive.workedExample }}</dd></div>
                  <div><dt>04 · 为什么与你有关</dt><dd>{{ radar.deepDive.whyItMatters }}</dd></div>
                  <div><dt>05 · 风险与限制</dt><dd><ul><li v-for="risk in radar.deepDive.risksAndLimits" :key="risk">{{ risk }}</li></ul></dd></div>
                  <div><dt>06 · 一手来源与精选研究</dt><dd class="learning-source-list"><a v-for="source in radar.deepDive.sources" :key="source.url" :href="source.url" target="_blank" rel="noopener"><b>{{ source.tier.toUpperCase() }}</b><span>{{ source.name }}</span><time v-if="source.publishedAt" :datetime="source.publishedAt">{{ source.publishedAt.slice(0, 10) }}</time></a></dd></div>
                  <div><dt>07 · 下一步问题</dt><dd><ul><li v-for="question in radar.deepDive.nextQuestions" :key="question">{{ question }}</li></ul></dd></div>
                </dl>
              </article>
            </div>
          </section>
        </template>

        <section
          v-for="(group, groupIndex) in isV2 ? [] : sections"
          :id="group.id"
          :key="group.id"
          class="radar-reader-section"
        >
          <header>
            <span>{{ String(groupIndex + 1).padStart(2, '0') }}</span>
            <div>
              <p class="radar-kicker">{{ group.label }}</p>
              <strong>{{ group.evidenceLabel }}</strong>
            </div>
          </header>
          <div class="radar-reader-articles">
            <article v-for="item in group.items" :key="item.title">
              <h2>{{ item.title }}</h2>
              <p>{{ item.summary }}</p>
              <a v-if="item.sourceUrl" :href="item.sourceUrl" target="_blank" rel="noopener">
                {{ item.sourceUrl.includes('coinmarketcap.com') ? '查看实时币价' : '打开原始来源' }}
                <span aria-hidden="true">↗</span>
              </a>
            </article>
          </div>
        </section>

        <section v-if="relatedProjects.length" class="radar-reader-projects">
          <header>
            <p class="radar-kicker">Related Engineering</p>
            <h2>哪些信号已经接近工程。</h2>
          </header>
          <div>
            <router-link v-for="project in relatedProjects" :key="project!.slug" :to="`/projects/${project!.slug}`">
              {{ project!.name }} <span aria-hidden="true">→</span>
            </router-link>
          </div>
        </section>

        <details class="radar-reader-disclosure">
          <summary>来源、自动化与发布边界 <span aria-hidden="true">＋</span></summary>
          <div>
            <p>{{ isV2 ? '本期按 Learning Radar v2 合同发布：恰好 2 条 AI、2 条 Web3 与 1 篇专题；每条都必须有带发布时间的 Tier 1 事件来源，并逐项说明机制、示例与风险。任一栏目不足时整期停止发布。' : '本期由 AI 从允许公开的研究输入整理；少于三类来源、隐私校验失败或构建门禁不通过时停止发布。摘要中的推断和待验证边界不等同于来源方结论，市场内容仅供研究与教育，不构成投资建议。' }}</p>
            <div class="radar-source-status">
              <span v-for="source in radar.sourceSections" :key="source">{{ source }} / succeeded</span>
              <span v-for="source in radar.missingSections" :key="source" class="missing">{{ source }} / missing</span>
            </div>
            <small>{{ isV2 ? 'Researched' : 'Generated' }} {{ radar.researchedAt || radar.generatedAt }}</small>
          </div>
        </details>
      </div>
    </div>
  </div>

  <div v-else-if="loadError" class="radar-reader-not-found radar-state" role="alert">
    <div class="container radar-state__content">
      <p class="radar-state__eyebrow">Load error</p>
      <h1 class="radar-state__title">本期雷达暂时无法载入。</h1>
      <p class="radar-state__message">公开简报资源可能暂时不可用。可重试一次，或返回雷达查看其他期数。</p>
      <div class="radar-state__actions">
        <button type="button" class="btn btn-primary" @click="loadRadar(String(route.params.date || ''))">重新载入</button>
        <router-link to="/radar" class="btn btn-secondary">返回雷达</router-link>
      </div>
    </div>
  </div>

  <div v-else class="radar-reader-not-found radar-state">
    <div class="container radar-state__content">
      <p class="radar-state__eyebrow">Brief unavailable</p>
      <h1 class="radar-state__title">这期雷达不存在或未通过发布门禁。</h1>
      <p class="radar-state__message">日期可能不在公开档案中。请返回雷达，从已公开的历史简报继续阅读。</p>
      <div class="radar-state__actions">
        <router-link to="/radar" class="btn btn-primary">返回雷达</router-link>
      </div>
    </div>
  </div>
</template>
