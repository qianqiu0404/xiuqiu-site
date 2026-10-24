<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { loadRadarBySlug, getLearningBriefs, getRadarDetailSections, isLearningEditionV2, radarSourceStatus, getProjectByKey, getSnapshotFreshness, readingReturnLink, sourceDisplayLabel } from '../data'
import type { DailyRadar } from '../data'
import { setSeoMeta } from '../../../utils/seo'
import '../../../design/brief.css'
import '../../../design/reader.css'

const route = useRoute()
const returnLink = computed(() => readingReturnLink(route.query.from))
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
const radarFreshness = computed(() => getSnapshotFreshness(radar.value?.date))

watchEffect(() => {
  if (loading.value) return
  setSeoMeta(radar.value ? { title: `${radar.value.title}｜xiuqiu`, description: radar.value.summary, path: `/radar/${radar.value.slug}`, type: 'article' } : { title: 'Radar not found｜xiuqiu', path: route.fullPath, indexable: false })
})
</script>

<template>
  <div v-if="loading" class="brief radar-state" aria-busy="true" aria-live="polite">
    <div class="brief-masthead"><div class="brief-shell">
      <p class="brief-dateline"><span>学习雷达</span></p>
      <h1>正在载入本期雷达…</h1>
      <p class="brief-lede">正在读取公开简报与来源状态，请稍候。</p>
    </div></div>
  </div>

  <div v-else-if="radar" class="brief radar-daily-reader-page" lang="zh-CN" :data-snapshot-state="radarFreshness.state">
    <header class="brief-masthead">
      <div class="brief-shell">
        <router-link :to="returnLink.href" class="brief-back">{{ returnLink.label }}</router-link>
        <p class="brief-dateline">
          <time :datetime="radar.date">{{ radar.date }}</time>
          <span>学习雷达</span>
          <span>{{ isV2 ? 'ResearchOps v2 门禁通过' : 'AI 自动汇总 · 未经人工复核' }}</span>
        </p>
        <h1>{{ radar.title }}</h1>
        <p class="brief-lede">{{ radar.summary }}</p>
        <dl class="reader-facts">
          <div><dt>{{ isV2 ? 'Researched' : 'Generated' }}</dt><dd><time :datetime="radar.researchedAt || radar.generatedAt">{{ radar.researchedAt || radar.generatedAt }}</time></dd></div>
          <div><dt>来源覆盖</dt><dd>{{ radarSourceStatus(radar) }}</dd></div>
        </dl>
        <p v-if="radarFreshness.isArchive" class="brief-fresh brief-fresh--stale" role="status">
          {{ radarFreshness.label }} · 这是 {{ radar.date }} 的冻结简报，不代表今天的新情报或当前项目状态。
        </p>
      </div>
    </header>

    <div class="brief-shell reader-layout">
      <nav v-if="isV2" class="reader-toc" aria-label="本期简报栏目">
        <span>本期目录</span>
        <a href="#ai-briefs">01 · AI</a>
        <template v-for="brief in aiBriefs" :key="brief.id"><a class="reader-toc-sub" :href="`#${brief.id}`">{{ brief.title }}</a></template>
        <a href="#web3-briefs">02 · Web3</a>
        <template v-for="brief in web3Briefs" :key="brief.id"><a class="reader-toc-sub" :href="`#${brief.id}`">{{ brief.title }}</a></template>
        <a href="#deep-dive">03 · 专题</a>
      </nav>
      <nav v-else class="reader-toc" aria-label="本期简报栏目">
        <span>本期目录</span>
        <a v-for="(section, index) in sections" :key="section.id" :href="`#${section.id}`">
          {{ String(index + 1).padStart(2, '0') }} · {{ section.label }}
        </a>
      </nav>

      <div class="reader-main">
        <template v-if="isV2">
          <section
            v-for="(group, groupIndex) in [{ id: 'ai-briefs', label: 'AI', domain: 'ai', items: aiBriefs }, { id: 'web3-briefs', label: 'Web3', domain: 'web3', items: web3Briefs }]"
            :id="group.id"
            :key="group.id"
            class="reader-section"
            tabindex="-1"
          >
            <header class="reader-section-header">
              <span>{{ String(groupIndex + 1).padStart(2, '0') }}</span>
              <h2>{{ group.label }}</h2>
              <small>2 briefs · 机制、例子与边界</small>
            </header>
            <div class="radar-reader-articles">
              <article v-for="brief in group.items" :id="brief.id" :key="brief.id" class="reader-article" tabindex="-1">
                <p class="brief-card-meta">
                  <b :class="`brief-tag brief-tag--${group.domain}`">{{ group.label.toUpperCase() }}</b>
                  <span>{{ brief.topic.replaceAll('_', ' ') }}</span>
                </p>
                <h3>{{ brief.title }}</h3>
                <p class="reader-why">{{ brief.whyItMatters }}</p>
                <dl class="reader-answers">
                  <div><dt>发生了什么</dt><dd>{{ brief.whatHappened }}</dd></div>
                  <div><dt>核心机制</dt><dd>{{ brief.mechanism }}</dd></div>
                  <div><dt>工作示例</dt><dd>{{ brief.workedExample }}</dd></div>
                  <div><dt>风险与限制</dt><dd><ul><li v-for="risk in brief.risksAndLimits" :key="risk">{{ risk }}</li></ul></dd></div>
                  <div><dt>下一步问题</dt><dd><ul><li v-for="question in brief.nextQuestions" :key="question">{{ question }}</li></ul></dd></div>
                </dl>
                <ul class="reader-sources" aria-label="一手来源与精选研究">
                  <li v-for="source in brief.sources" :key="source.url">
                    <a :href="source.url" target="_blank" rel="noopener noreferrer">
                      <b>{{ source.tier === 'tier1' ? '一手' : '解读' }}</b>
                      <span>{{ sourceDisplayLabel(source.url, source.name) }}</span>
                      <time v-if="source.publishedAt" :datetime="source.publishedAt">{{ source.publishedAt.slice(0, 10) }}</time>
                      <i aria-hidden="true">↗</i>
                    </a>
                  </li>
                </ul>
              </article>
            </div>
          </section>

          <section v-if="radar.deepDive" id="deep-dive" class="reader-section reader-deep" tabindex="-1">
            <header class="reader-section-header">
              <span>03</span>
              <h2>专题</h2>
              <small>基于 {{ radar.deepDive.basedOnBriefId }}</small>
            </header>
            <article class="reader-article">
              <p class="brief-card-meta">
                <b :class="`brief-tag brief-tag--${radar.deepDive.domain}`">{{ radar.deepDive.domain.toUpperCase() }}</b>
                <span>{{ radar.deepDive.topic.replaceAll('_', ' ') }}</span>
              </p>
              <h3>{{ radar.deepDive.title }}</h3>
              <p class="reader-why">{{ radar.deepDive.whyItMatters }}</p>
              <dl class="reader-answers">
                <div><dt>发生了什么</dt><dd>{{ radar.deepDive.whatHappened }}</dd></div>
                <div><dt>核心机制</dt><dd>{{ radar.deepDive.mechanism }}</dd></div>
                <div><dt>工作示例</dt><dd>{{ radar.deepDive.workedExample }}</dd></div>
                <div><dt>风险与限制</dt><dd><ul><li v-for="risk in radar.deepDive.risksAndLimits" :key="risk">{{ risk }}</li></ul></dd></div>
                <div><dt>下一步问题</dt><dd><ul><li v-for="question in radar.deepDive.nextQuestions" :key="question">{{ question }}</li></ul></dd></div>
              </dl>
              <ul class="reader-sources" aria-label="一手来源与精选研究">
                <li v-for="source in radar.deepDive.sources" :key="source.url">
                  <a :href="source.url" target="_blank" rel="noopener noreferrer">
                    <b>{{ source.tier === 'tier1' ? '一手' : '解读' }}</b>
                    <span>{{ sourceDisplayLabel(source.url, source.name) }}</span>
                    <time v-if="source.publishedAt" :datetime="source.publishedAt">{{ source.publishedAt.slice(0, 10) }}</time>
                    <i aria-hidden="true">↗</i>
                  </a>
                </li>
              </ul>
            </article>
          </section>
        </template>

        <section
          v-for="(group, groupIndex) in isV2 ? [] : sections"
          :id="group.id"
          :key="group.id"
          class="reader-section"
          tabindex="-1"
        >
          <header class="reader-section-header">
            <span>{{ String(groupIndex + 1).padStart(2, '0') }}</span>
            <h2>{{ group.label }}</h2>
            <small>{{ group.evidenceLabel }}</small>
          </header>
          <div class="radar-reader-articles">
            <article v-for="item in group.items" :key="item.title" class="reader-article reader-article--compact">
              <h3>{{ item.title }}</h3>
              <p>{{ item.summary }}</p>
              <a v-if="item.sourceUrl" class="reader-source-link" :href="item.sourceUrl" target="_blank" rel="noopener">
                {{ sourceDisplayLabel(item.sourceUrl) }}
                <span aria-hidden="true">↗</span>
              </a>
            </article>
          </div>
        </section>

        <section v-if="relatedProjects.length" class="reader-section">
          <header class="reader-section-header"><span>→</span><h2>哪些信号已经接近工程</h2></header>
          <div class="reader-related">
            <router-link v-for="project in relatedProjects" :key="project!.slug" :to="`/projects/${project!.slug}`">
              {{ project!.name }} <span aria-hidden="true">→</span>
            </router-link>
          </div>
        </section>

        <details class="reader-disclosure">
          <summary>来源、自动化与发布边界</summary>
          <div>
            <p>{{ isV2 ? '本期按 Learning Radar v2 合同发布：恰好 2 条 AI、2 条 Web3 与 1 篇专题；每条都必须有带发布时间的 Tier 1 事件来源，并逐项说明机制、示例与风险。任一栏目不足时整期停止发布。' : '本期由 AI 从允许公开的研究输入整理；少于三类来源、隐私校验失败或构建门禁不通过时停止发布。摘要中的推断和待验证边界不等同于来源方结论，市场内容仅供研究与教育，不构成投资建议。' }}</p>
            <div class="reader-source-status">
              <span v-for="source in radar.sourceSections" :key="source">{{ source }} / succeeded</span>
              <span v-for="source in radar.missingSections" :key="source" class="missing">{{ source }} / missing</span>
            </div>
            <small>{{ isV2 ? 'Researched' : 'Generated' }} {{ radar.researchedAt || radar.generatedAt }}</small>
          </div>
        </details>
      </div>
    </div>
  </div>

  <div v-else-if="loadError" class="brief radar-state" role="alert">
    <div class="brief-masthead"><div class="brief-shell">
      <p class="brief-dateline"><span>Load error</span></p>
      <h1>本期雷达暂时无法载入。</h1>
      <p class="brief-lede">公开简报资源可能暂时不可用。可重试一次，或返回情报流查看其他期数。</p>
      <div class="reader-actions">
        <button type="button" class="brief-button" @click="loadRadar(String(route.params.date || ''))">重新载入</button>
        <router-link :to="returnLink.href" class="brief-button">{{ returnLink.label }}</router-link>
      </div>
    </div></div>
  </div>

  <div v-else class="brief radar-state">
    <div class="brief-masthead"><div class="brief-shell">
      <p class="brief-dateline"><span>Brief unavailable</span></p>
      <h1>这期雷达不存在或未通过发布门禁。</h1>
      <p class="brief-lede">日期可能不在公开档案中。请返回情报流，从已公开的历史简报继续阅读。</p>
      <div class="reader-actions"><router-link :to="returnLink.href" class="brief-button">{{ returnLink.label }}</router-link></div>
    </div></div>
  </div>
</template>
