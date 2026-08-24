<script setup lang="ts">
import { computed, onMounted } from 'vue'
import '../styles/cinematic-pages.css'
import {
  projectClaimStateLabels,
  projectStageLabels,
  siteProjects,
  type SiteProject,
} from '../data/siteKnowledge'
import { productPresentations } from '../data/productPresentation'
import { setSeoMeta } from '../utils/seo'

const productProjects = productPresentations.map(presentation => ({
  presentation,
  project: siteProjects.find(project => project.slug === presentation.slug)!,
})).filter(entry => entry.project.publicRole === 'current-product')

const supportingRoleOrder = [
  {
    role: 'current-direction',
    title: 'Current direction',
    act: 'Act 02',
    description: '当前学习与工程证据建设方向；Claim 通过门禁前保持 locked，不把私有基线写成公开实现。',
  },
  {
    role: 'historical-evidence',
    title: 'Historical evidence',
    act: 'Act 03',
    description: '保留可追溯的历史工程证据；即使证据可发布，也不改变当前产品与方向的优先级。',
  },
] as const

const supportingGroups = computed(() =>
  supportingRoleOrder
    .map(group => ({
      ...group,
      projects: siteProjects
        .filter(project => project.publicRole === group.role)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name)),
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
    description: '按 Current product、Current direction 与 Historical evidence 浏览经过审核的公开项目证据。',
    path: '/projects',
  }),
)
</script>

<template>
  <section class="project-atlas-page project-atlas-page--cinematic cinematic-page">
    <header class="project-atlas-hero cinematic-page-hero">
      <div class="container project-atlas-hero-layout project-atlas-hero-layout--focused">
        <div class="project-atlas-hero-copy">
          <p class="cinematic-page-kicker">Project Atlas / One product, one evidence system</p>
          <h1>Qiu Market 是当前产品。<span>其余项目按证据等级陈列。</span></h1>
          <p>先理解 Qiu Market 的产品边界，再区分 Wallet Infrastructure 当前方向与不定义现役优先级的历史工程证据。</p>
        </div>
        <nav class="project-atlas-direct" aria-label="直接进入当前产品主页">
          <router-link v-for="entry in productProjects" :key="entry.presentation.slug" :to="`/projects/${entry.presentation.slug}`">
            <span>{{ entry.presentation.index }}</span>
            <div><small>{{ entry.presentation.label }}</small><strong>{{ entry.presentation.shortName }}</strong></div>
            <b>进入项目主页 ↗</b>
          </router-link>
        </nav>
      </div>
    </header>

    <div class="container project-atlas-focused-registry">
      <section id="current-product" class="project-atlas-premiere" aria-labelledby="atlas-products-title">
        <div class="project-atlas-group-heading">
          <div><p class="cinematic-page-kicker">Act 01</p><h2 id="atlas-products-title">Current product</h2></div>
          <p>唯一当前产品。产品页讲清目标形态、系统流、当前证据、限制与下一道 Gate。</p>
        </div>

        <div class="project-atlas-product-grid">
          <article v-for="entry in productProjects" :key="entry.project.slug" :class="`is-${entry.presentation.theme}`">
            <header><span>{{ entry.presentation.index }} / {{ entry.presentation.label }}</span><time :datetime="entry.project.updatedAt">{{ entry.project.updatedAt }}</time></header>
            <h3>{{ entry.project.name }}</h3>
            <p>{{ entry.presentation.promise }}</p>
            <blockquote>{{ entry.project.verifiedEvidence[0] }}</blockquote>
            <footer>
              <strong>{{ projectClaimStateLabels[entry.project.claimState] }} · {{ projectStageLabels[entry.project.stage] }}</strong>
              <router-link :to="`/projects/${entry.project.slug}`">进入产品主页 ↗</router-link>
            </footer>
          </article>
        </div>
      </section>

      <section
        v-for="group in supportingGroups"
        :id="group.role"
        :key="group.role"
        class="project-atlas-archive"
        :aria-labelledby="`atlas-${group.role}-title`"
      >
        <div class="project-atlas-group-heading">
          <div><p class="cinematic-page-kicker">{{ group.act }}</p><h2 :id="`atlas-${group.role}-title`">{{ group.title }}</h2></div>
          <p>{{ group.description }}</p>
        </div>

        <section class="project-atlas-compact-group">
          <header><h3>{{ group.title }}</h3><span>{{ group.projects.length }} 项</span></header>
          <div class="project-atlas-compact-list" :class="{ 'project-atlas-compact-list--single': group.projects.length === 1 }">
            <article v-for="project in group.projects" :key="project.id">
              <div class="project-atlas-compact-meta"><span>{{ project.category }}</span><time :datetime="project.updatedAt">{{ project.updatedAt }}</time></div>
              <h4>{{ project.name }}</h4>
              <p>{{ project.positioning }}</p>
              <blockquote>{{ project.verifiedEvidence[0] }}</blockquote>
              <footer>
                <strong>{{ projectClaimStateLabels[project.claimState] }} · {{ projectStageLabels[project.stage] }}</strong>
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
