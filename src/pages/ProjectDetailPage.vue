<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getArticlesBySlugs, getProjectByKey, projectSourceLabels, projectStageLabels, projectVisibilityLabels } from '../data/siteKnowledge'
import { productPresentationBySlug } from '../data/productPresentation'
import { setSeoMeta } from '../utils/seo'
import '../styles/product-pages.css'

const route = useRoute()
const router = useRouter()
const projectKey = computed(() => String(route.params.project || ''))
const project = computed(() => getProjectByKey(projectKey.value))
const presentation = computed(() => productPresentationBySlug.get(project.value?.slug as 'wallet-launchpad' | 's78-market-services'))
const relatedArticles = computed(() => project.value ? getArticlesBySlugs(project.value.relatedArticleSlugs).slice(0, 3) : [])

watchEffect(() => {
  if (!project.value) {
    setSeoMeta({ title: 'Project not found | xiuqiu', path: route.fullPath, indexable: false })
    return
  }
  setSeoMeta({
    title: `${project.value.name}｜xiuqiu 工程项目`,
    description: project.value.positioning,
    path: `/projects/${project.value.slug}`,
  })
  if (projectKey.value !== project.value.slug) void router.replace(`/projects/${project.value.slug}`)
})
</script>

<template>
  <div
    v-if="project && presentation"
    class="product-narrative-page cinematic-page"
    :class="`product-narrative-page--${presentation.theme}`"
    lang="zh-CN"
  >
    <section class="product-hero" aria-labelledby="product-title">
      <div class="container product-hero-layout">
        <div class="product-hero-copy">
          <router-link class="product-back-link" to="/">← 返回双项目首页</router-link>
          <p class="cinematic-page-kicker">{{ presentation.index }} / {{ presentation.label }}</p>
          <h1 id="product-title"><span v-for="line in presentation.heroLines" :key="line">{{ line }}</span></h1>
          <p class="product-hero-lead">{{ presentation.promise }}</p>
          <div class="product-hero-actions">
            <template v-if="presentation.publicAction.role === 'companion'">
              <router-link class="product-button product-button--primary" :to="presentation.proofAction.to">
                {{ presentation.proofAction.label }}
              </router-link>
              <a class="product-button product-button--quiet" :href="presentation.publicAction.href" target="_blank" rel="noopener">
                {{ presentation.publicAction.label }} ↗
              </a>
            </template>
            <template v-else>
              <a class="product-button product-button--primary" :href="presentation.publicAction.href" target="_blank" rel="noopener">
                {{ presentation.publicAction.label }} ↗
              </a>
              <router-link class="product-button product-button--quiet" :to="presentation.proofAction.to">
                {{ presentation.proofAction.label }}
              </router-link>
            </template>
          </div>
          <p class="product-public-boundary">{{ presentation.publicAction.boundary }}</p>
        </div>

        <div class="product-status-object" aria-label="当前项目状态">
          <span class="product-status-index">{{ presentation.index }}</span>
          <div>
            <small>PRODUCT</small>
            <strong>{{ presentation.shortName }}</strong>
          </div>
          <div>
            <small>STAGE</small>
            <strong>{{ projectStageLabels[project.stage] }}</strong>
          </div>
          <div>
            <small>LAST VERIFIED</small>
            <strong>{{ project.updatedAt }}</strong>
          </div>
          <i aria-hidden="true"></i>
        </div>
      </div>
    </section>

    <section class="product-promise" aria-labelledby="promise-title">
      <div class="container product-promise-layout">
        <div>
          <p class="cinematic-page-kicker">Product promise</p>
          <h2 id="promise-title">完成后的产品，不是一组功能，而是一条可以被操作和恢复的事实链。</h2>
        </div>
        <p>{{ project.targetOutcome }}</p>
      </div>
      <div class="container product-ability-strip">
        <span v-for="(ability, index) in project.coreAbilities.slice(0, 6)" :key="ability">
          <b>{{ String(index + 1).padStart(2, '0') }}</b>{{ ability }}
        </span>
      </div>
    </section>

    <section class="product-flow" aria-labelledby="flow-title">
      <div class="container">
        <header class="product-section-heading">
          <div>
            <p class="cinematic-page-kicker">System flow</p>
            <h2 id="flow-title">{{ presentation.flowLabel }}</h2>
          </div>
          <p>{{ project.engineering.systemBoundary }}</p>
        </header>
        <ol class="product-flow-list">
          <li v-for="(step, index) in project.engineering.callFlow" :key="step">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <p>{{ step }}</p>
          </li>
        </ol>
      </div>
    </section>

    <section class="product-proof" aria-labelledby="proof-title">
      <div class="container">
        <header class="product-section-heading product-section-heading--light">
          <div>
            <p class="cinematic-page-kicker">Verified now</p>
            <h2 id="proof-title">{{ presentation.proofTitle }}</h2>
          </div>
          <p>目标形态说明方向；下面的证据、限制和下一道 Gate 说明当前事实。</p>
        </header>

        <div class="product-proof-layout">
          <div class="product-proof-list">
            <article v-for="(item, index) in project.verifiedEvidence.slice(0, 4)" :key="item">
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <p>{{ item }}</p>
            </article>
          </div>
          <aside class="product-boundary-panel">
            <p class="product-boundary-label">CURRENT BOUNDARY</p>
            <ul>
              <li v-for="item in project.knownLimits.slice(0, 3)" :key="item">{{ item }}</li>
            </ul>
            <div>
              <span>NEXT GATE</span>
              <p>{{ project.nextMilestone }}</p>
            </div>
          </aside>
        </div>
      </div>
    </section>

    <section class="product-finale" aria-labelledby="product-finale-title">
      <div class="container product-finale-layout">
        <div>
          <p class="cinematic-page-kicker">Continue from evidence</p>
          <h2 v-if="presentation.publicAction.role === 'companion'" id="product-finale-title">
            先检查 Launchpad 的工程证据，再运行独立的配套实验。
          </h2>
          <h2 v-else id="product-finale-title">先体验产品，再检查它如何被证明。</h2>
        </div>
        <div class="product-finale-actions">
          <template v-if="presentation.publicAction.role === 'companion'">
            <router-link class="product-button product-button--primary" :to="presentation.proofAction.to">
              {{ presentation.proofAction.label }}
            </router-link>
            <a class="product-button product-button--quiet" :href="presentation.publicAction.href" target="_blank" rel="noopener">
              {{ presentation.publicAction.label }} ↗
            </a>
          </template>
          <template v-else>
            <a class="product-button product-button--primary" :href="presentation.publicAction.href" target="_blank" rel="noopener">
              {{ presentation.publicAction.label }} ↗
            </a>
            <router-link class="product-button product-button--quiet" :to="presentation.proofAction.to">
              {{ presentation.proofAction.label }}
            </router-link>
          </template>
          <router-link class="product-text-link" to="/projects">全部项目 →</router-link>
        </div>
      </div>
    </section>
  </div>

  <section v-else-if="project" class="section page-top project-dossier-page">
    <div class="container project-detail-container">
      <router-link to="/projects" class="back-link">&larr; 返回项目图谱</router-link>
      <article class="project-detail project-dossier">
        <header class="project-detail-header">
          <p class="section-label">Proof dossier / {{ project.category }}</p>
          <div class="project-state-tags">
            <span>{{ projectStageLabels[project.stage] }}</span>
            <span>{{ projectSourceLabels[project.sourceType] }}</span>
            <span>{{ projectVisibilityLabels[project.visibility] }}</span>
            <time>更新于 {{ project.updatedAt }}</time>
          </div>
          <h1>{{ project.name }}</h1>
          <p>{{ project.positioning }}</p>
          <a v-if="project.visibility === 'public' && project.repositoryUrl" :href="project.repositoryUrl" class="btn btn-primary" target="_blank" rel="noopener">查看公开仓库 &rarr;</a>
        </header>

        <div class="project-dossier-summary">
          <section><small>Target outcome</small><p>{{ project.targetOutcome }}</p></section>
          <section><small>Next gate</small><p>{{ project.nextMilestone }}</p></section>
        </div>

        <section class="learning-section">
          <p class="section-label">Verified evidence</p>
          <h2>当前能被代码、测试或运行记录支持的事实</h2>
          <ul class="learning-list evidence-detail-list"><li v-for="item in project.verifiedEvidence" :key="item">{{ item }}</li></ul>
        </section>

        <div class="learning-detail-grid">
          <section class="learning-section"><p class="section-label">System boundary</p><h2>负责什么，不负责什么</h2><p>{{ project.engineering.systemBoundary }}</p></section>
          <section class="learning-section"><p class="section-label">Current limits</p><h2>仍未完成的边界</h2><ul class="learning-list"><li v-for="item in project.knownLimits" :key="item">{{ item }}</li></ul></section>
        </div>

        <details class="learning-section project-evidence-details">
          <summary><span><small>Verification</small>查看可复现命令与说明</span></summary>
          <div v-if="project.learning.verification.length" class="verification-command-grid"><code v-for="command in project.learning.verification" :key="command">{{ command }}</code></div>
          <p v-if="project.learning.verificationNote" class="verification-note">{{ project.learning.verificationNote }}</p>
        </details>

        <section v-if="relatedArticles.length" class="learning-section">
          <p class="section-label">Continue reading</p>
          <h2>继续理解项目中的工程判断</h2>
          <div class="followup-links"><router-link v-for="article in relatedArticles" :key="article.slug" :to="`/articles/${article.slug}`" class="followup-link"><span>{{ article.title }}</span><small>{{ article.difficulty }} · {{ article.readingTime }}</small></router-link></div>
        </section>
      </article>
    </div>
  </section>

  <div v-else class="container not-found">
    <p class="not-found-title">项目未公开或不存在</p>
    <router-link to="/projects" class="btn btn-primary">返回项目图谱</router-link>
  </div>
</template>
