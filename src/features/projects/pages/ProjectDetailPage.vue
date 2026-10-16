<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getArticlesBySlugs, getProjectByKey, projectActivityLabels, projectClaimStateLabels, projectPublicRoleLabels, projectSourceLabels, projectStageLabels, projectVisibilityLabels, productPresentationBySlug } from '../data'
import { setSeoMeta } from '../../../utils/seo'
import '../../../design/brief.css'
import '../../../design/reader.css'
import '../../../design/product.css'

const route = useRoute()
const router = useRouter()
const projectKey = computed(() => String(route.params.project || ''))
const project = computed(() => getProjectByKey(projectKey.value))
const presentation = computed(() => productPresentationBySlug.get(project.value?.slug as 's78-market-services'))
const relatedArticles = computed(() => project.value ? getArticlesBySlugs(project.value.relatedArticleSlugs).slice(0, 3) : [])
const isHistoricalEvidence = computed(() => project.value?.publicRole === 'historical-evidence')
const projectMetaKinds = {
  'current-product': '当前产品',
  'current-direction': '当前工程方向',
  'historical-evidence': '历史工程证据',
} as const

watchEffect(() => {
  if (!project.value) {
    setSeoMeta({
      title: '项目未公开或不存在｜xiuqiu',
      description: '这个项目页面不存在、已退役或尚未公开。请返回项目图谱查看当前产品与工程证据。',
      path: route.fullPath,
      indexable: false,
    })
    return
  }
  setSeoMeta({
    title: `${project.value.name}｜xiuqiu ${projectMetaKinds[project.value.publicRole]}`,
    description: project.value.positioning,
    path: `/projects/${project.value.slug}`,
  })
  if (projectKey.value !== project.value.slug) void router.replace(`/projects/${project.value.slug}`)
})
</script>

<template>
  <div
    v-if="project && presentation"
    class="brief product-page"
    :data-theme-accent="presentation.theme"
    lang="zh-CN"
  >
    <header class="brief-masthead">
      <div class="brief-shell">
        <router-link class="brief-back product-back-link" to="/">← 情报流</router-link>
        <p class="brief-dateline">
          <span>{{ presentation.index }} / {{ presentation.label }}</span>
          <span>{{ projectPublicRoleLabels[project.publicRole] }}</span>
          <time :datetime="project.updatedAt">更新于 {{ project.updatedAt }}</time>
        </p>
        <div class="product-hero">
          <div>
            <h1 id="product-title">{{ presentation.shortName }}<span>{{ presentation.heroLines.join(' · ') }}</span></h1>
            <p class="brief-lede">{{ presentation.promise }}</p>
            <div class="product-actions">
              <a class="brief-button brief-button--primary" :href="presentation.publicAction.href" target="_blank" rel="noopener">
                {{ presentation.publicAction.label }} ↗
              </a>
              <router-link class="brief-button" :to="presentation.proofAction.to">{{ presentation.proofAction.label }}</router-link>
            </div>
            <p class="brief-note">{{ presentation.publicAction.boundary }}</p>
          </div>

          <dl class="product-status" aria-label="当前项目状态">
            <div><dt>Public role</dt><dd>{{ projectPublicRoleLabels[project.publicRole] }} · {{ presentation.shortName }}</dd></div>
            <div><dt>Claim / Stage</dt><dd>{{ projectClaimStateLabels[project.claimState] }} · {{ projectStageLabels[project.stage] }}</dd></div>
            <div><dt>Activity</dt><dd>{{ projectActivityLabels[project.activityStatus] }}</dd></div>
            <div><dt>Last verified</dt><dd>{{ project.updatedAt }}</dd></div>
          </dl>
        </div>
      </div>
    </header>

    <div class="brief-shell product-body">
      <section class="reader-section" aria-labelledby="promise-title">
        <header class="reader-section-header">
          <span>01</span>
          <h2 id="promise-title">产品承诺</h2>
          <small>Product promise</small>
        </header>
        <p class="product-promise">完成后的产品，不是一组功能，而是一条可以被操作和恢复的事实链。</p>
        <p class="reader-why">{{ project.targetOutcome }}</p>
        <ol class="product-abilities">
          <li v-for="ability in project.coreAbilities.slice(0, 6)" :key="ability">{{ ability }}</li>
        </ol>
      </section>

      <section class="reader-section" aria-labelledby="flow-title">
        <header class="reader-section-header">
          <span>02</span>
          <h2 id="flow-title">系统流</h2>
          <small>{{ presentation.flowLabel }}</small>
        </header>
        <p class="product-boundary-copy">{{ project.engineering.systemBoundary }}</p>
        <ol class="product-flow">
          <li v-for="step in project.engineering.callFlow" :key="step">{{ step }}</li>
        </ol>
      </section>

      <section class="reader-section" aria-labelledby="proof-title">
        <header class="reader-section-header">
          <span>03</span>
          <h2 id="proof-title">Evidence ready</h2>
          <small>{{ presentation.proofTitle }}</small>
        </header>
        <p class="brief-note">目标形态说明方向；下面只列已复核证据与当前边界。跨日 Owner Gate 尚未通过。</p>
        <div class="product-proof">
          <ol class="reader-list">
            <li v-for="item in project.verifiedEvidence.slice(0, 4)" :key="item">{{ item }}</li>
          </ol>
          <aside class="brief-panel product-limits" aria-label="当前边界">
            <h2>Current boundary</h2>
            <ul>
              <li v-for="item in project.knownLimits.slice(0, 3)" :key="item">{{ item }}</li>
            </ul>
            <div class="product-gate">
              <span>OWNER GATE PENDING</span>
              <p>{{ project.nextMilestone }}</p>
            </div>
          </aside>
        </div>
      </section>

      <section class="reader-section product-finale" aria-labelledby="product-finale-title">
        <h2 id="product-finale-title">先体验产品，再检查它如何被证明。</h2>
        <div class="product-actions">
          <a class="brief-button brief-button--primary" :href="presentation.publicAction.href" target="_blank" rel="noopener">
            {{ presentation.publicAction.label }} ↗
          </a>
          <router-link class="brief-button" :to="presentation.proofAction.to">{{ presentation.proofAction.label }}</router-link>
          <router-link class="reader-source-link" to="/projects">全部项目 →</router-link>
        </div>
      </section>
    </div>
  </div>

  <div v-else-if="project" class="brief project-dossier-page" lang="zh-CN">
    <header class="brief-masthead">
      <div class="brief-shell brief-reading">
        <router-link to="/projects" class="brief-back back-link">← 返回项目图谱</router-link>
        <p class="brief-dateline">
          <span>{{ projectPublicRoleLabels[project.publicRole] }}</span>
          <span>{{ project.category }}</span>
          <time :datetime="project.updatedAt">更新于 {{ project.updatedAt }}</time>
        </p>
        <h1>{{ project.name }}</h1>
        <p class="brief-lede">{{ project.positioning }}</p>
        <ul class="product-tags" aria-label="项目状态">
          <li>{{ projectPublicRoleLabels[project.publicRole] }}</li>
          <li>{{ projectClaimStateLabels[project.claimState] }}</li>
          <li>{{ projectActivityLabels[project.activityStatus] }}</li>
          <li>{{ projectStageLabels[project.stage] }}</li>
          <li>{{ projectSourceLabels[project.sourceType] }}</li>
          <li>{{ projectVisibilityLabels[project.visibility] }}</li>
        </ul>
        <p v-if="isHistoricalEvidence" class="brief-fresh brief-fresh--stale project-role-boundary">该档案保留为历史工程证据，不代表当前产品、当前方向或现役优先级。</p>
        <div v-if="project.visibility === 'public' && project.repositoryUrl" class="product-actions">
          <a :href="project.repositoryUrl" class="brief-button brief-button--primary" target="_blank" rel="noopener">查看公开仓库 →</a>
        </div>
      </div>
    </header>

    <article class="brief-shell brief-reading product-body project-dossier">
      <dl class="product-summary">
        <div><dt>Target outcome</dt><dd>{{ project.targetOutcome }}</dd></div>
        <div><dt>{{ isHistoricalEvidence ? 'Last recorded evidence next step' : 'Next gate' }}</dt><dd>{{ project.nextMilestone }}</dd></div>
      </dl>

      <section class="reader-section">
        <header class="reader-section-header"><span>01</span><h2>{{ isHistoricalEvidence ? '历史记录中由代码、测试或运行记录支持的事实' : '当前能被代码、测试或运行记录支持的事实' }}</h2><small>Verified evidence</small></header>
        <ol class="reader-list"><li v-for="item in project.verifiedEvidence" :key="item">{{ item }}</li></ol>
      </section>

      <div class="product-pair">
        <section class="brief-panel">
          <h2>System boundary · 负责什么，不负责什么</h2>
          <p>{{ project.engineering.systemBoundary }}</p>
        </section>
        <section class="brief-panel">
          <h2>Evidence limits · 仍未完成的边界</h2>
          <ul class="product-bullets"><li v-for="item in project.knownLimits" :key="item">{{ item }}</li></ul>
        </section>
      </div>

      <details class="reader-disclosure">
        <summary>Verification · 查看可复现命令与说明</summary>
        <div>
          <div v-if="project.learning.verification.length" class="product-commands"><code v-for="command in project.learning.verification" :key="command">{{ command }}</code></div>
          <p v-if="project.learning.verificationNote">{{ project.learning.verificationNote }}</p>
        </div>
      </details>

      <section v-if="relatedArticles.length" class="reader-section">
        <header class="reader-section-header"><span>→</span><h2>继续理解项目中的工程判断</h2><small>Continue reading</small></header>
        <div class="brief-panel">
          <ul>
            <li v-for="article in relatedArticles" :key="article.slug">
              <router-link :to="`/articles/${article.slug}`">{{ article.title }} <span>{{ article.difficulty }} · {{ article.readingTime }}</span></router-link>
            </li>
          </ul>
        </div>
      </section>
    </article>
  </div>

  <div v-else class="container not-found" aria-labelledby="project-not-found-title">
    <h1 id="project-not-found-title" class="not-found-title">项目未公开或不存在</h1>
    <p class="not-found-desc">这个项目可能已退役、移动或尚未公开；项目图谱只保留当前产品与可核验的工程证据。</p>
    <router-link to="/projects" class="btn btn-primary">返回项目图谱</router-link>
  </div>
</template>
