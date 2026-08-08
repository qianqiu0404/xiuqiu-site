<script setup lang="ts">
import { computed, onMounted } from 'vue'
import '../styles/cinematic-pages.css'
import {
  projectPortfolioTierLabels,
  projectStageLabels,
  siteProjects,
  type SiteProject,
} from '../data/siteKnowledge'
import { productPresentations } from '../data/productPresentation'
import { setSeoMeta } from '../utils/seo'

const productProjects = productPresentations.map(presentation => ({
  presentation,
  project: siteProjects.find(project => project.slug === presentation.slug)!,
}))

const tierOrder = ['flagship', 'verified', 'exploration', 'paused'] as const
const remainingGroups = computed(() =>
  tierOrder
    .map(tier => ({
      tier,
      projects: siteProjects
        .filter(project => project.portfolioTier === tier)
        .filter(project => !productPresentations.some(item => item.slug === project.slug))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    }))
    .filter(group => group.projects.length),
)

function projectAction(project: SiteProject) {
  if (project.slug === 'wallet-reliability-lab') {
    return { label: '运行在线实验', href: 'https://wallet-reliability-lab.vercel.app' }
  }
  return { label: '查看证据档案', to: `/projects/${project.slug}` }
}

onMounted(() =>
  setSeoMeta({
    title: '项目图谱｜xiuqiu',
    description: '先进入 Wallet Launchpad 与 Qiu Market 两个产品主页，再按证据层级浏览其他 Web3 与 AI 工程项目。',
    path: '/projects',
  }),
)
</script>

<template>
  <section class="project-atlas-page project-atlas-page--cinematic cinematic-page">
    <header class="project-atlas-hero cinematic-page-hero">
      <div class="container project-atlas-hero-layout project-atlas-hero-layout--focused">
        <div class="project-atlas-hero-copy">
          <p class="cinematic-page-kicker">Project Atlas / Two products, one evidence system</p>
          <h1>两个产品是主角。<span>其余项目是证据与能力模块。</span></h1>
          <p>先理解 Wallet Launchpad 与 Qiu Market 的完整产品形态，再按真实阶段查看基础设施、实验、工具与工程探索。</p>
        </div>
        <nav class="project-atlas-direct" aria-label="直接进入两个产品主页">
          <router-link v-for="entry in productProjects" :key="entry.presentation.slug" :to="`/projects/${entry.presentation.slug}`">
            <span>{{ entry.presentation.index }}</span>
            <div><small>{{ entry.presentation.label }}</small><strong>{{ entry.presentation.shortName }}</strong></div>
            <b>进入项目主页 ↗</b>
          </router-link>
        </nav>
      </div>
    </header>

    <div class="container project-atlas-focused-registry">
      <section class="project-atlas-premiere" aria-labelledby="atlas-products-title">
        <div class="project-atlas-group-heading">
          <div><p class="cinematic-page-kicker">Act 01</p><h2 id="atlas-products-title">Product home</h2></div>
          <p>产品页讲清目标形态、系统流、当前证据、限制与下一道 Gate。</p>
        </div>

        <div class="project-atlas-product-grid">
          <article v-for="entry in productProjects" :key="entry.project.slug" :class="`is-${entry.presentation.theme}`">
            <header><span>{{ entry.presentation.index }} / {{ entry.presentation.label }}</span><time :datetime="entry.project.updatedAt">{{ entry.project.updatedAt }}</time></header>
            <h3>{{ entry.project.name }}</h3>
            <p>{{ entry.presentation.promise }}</p>
            <blockquote>{{ entry.project.verifiedEvidence[0] }}</blockquote>
            <footer>
              <strong>{{ projectStageLabels[entry.project.stage] }}</strong>
              <router-link :to="`/projects/${entry.project.slug}`">进入产品主页 ↗</router-link>
            </footer>
          </article>
        </div>
      </section>

      <section class="project-atlas-archive" aria-labelledby="atlas-archive-title">
        <div class="project-atlas-group-heading">
          <div><p class="cinematic-page-kicker">Act 02</p><h2 id="atlas-archive-title">Evidence registry</h2></div>
          <p>这里只保留定位、阶段和一条证据。目标形态、完整限制与验证方式进入各自档案。</p>
        </div>

        <section v-for="group in remainingGroups" :id="group.tier" :key="group.tier" class="project-atlas-compact-group">
          <header><h3>{{ projectPortfolioTierLabels[group.tier] }}</h3><span>{{ group.projects.length }} 项</span></header>
          <div class="project-atlas-compact-list">
            <article v-for="project in group.projects" :key="project.id">
              <div class="project-atlas-compact-meta"><span>{{ project.category }}</span><time :datetime="project.updatedAt">{{ project.updatedAt }}</time></div>
              <h4>{{ project.name }}</h4>
              <p>{{ project.positioning }}</p>
              <blockquote>{{ project.verifiedEvidence[0] }}</blockquote>
              <footer>
                <strong>{{ projectStageLabels[project.stage] }}</strong>
                <a v-if="projectAction(project).href" :href="projectAction(project).href" target="_blank" rel="noopener">{{ projectAction(project).label }} ↗</a>
                <router-link v-else :to="projectAction(project).to!">{{ projectAction(project).label }} →</router-link>
              </footer>
            </article>
          </div>
        </section>
      </section>
    </div>
  </section>
</template>
