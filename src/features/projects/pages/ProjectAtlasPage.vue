<script setup lang="ts">
import { computed, onMounted } from 'vue'
import '../../../design/brief.css'
import '../../../design/reader.css'
import '../../../design/atlas.css'
import { projectClaimStateLabels, projectStageLabels, siteProjects, productPresentations } from '../data'
import type { SiteProject } from '../data'
import { setSeoMeta } from '../../../utils/seo'

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
  <div class="brief project-atlas-page" lang="zh-CN">
    <header class="brief-masthead">
      <div class="brief-shell">
        <p class="brief-dateline"><span>Project Atlas / One product, one evidence system</span></p>
        <div class="brief-masthead-row">
          <div>
            <h1>Qiu Market 是当前产品。<span class="atlas-h1-sub">其余项目按证据等级陈列。</span></h1>
            <p class="brief-lede">先理解 Qiu Market 的产品边界，再区分 Wallet Infrastructure 当前方向与不定义现役优先级的历史工程证据。</p>
          </div>
          <nav class="atlas-direct" aria-label="直接进入当前产品主页">
            <router-link v-for="entry in productProjects" :key="entry.presentation.slug" class="brief-button brief-button--primary" :to="`/projects/${entry.presentation.slug}`">
              {{ entry.presentation.shortName }} · 进入项目主页 ↗
            </router-link>
          </nav>
        </div>
      </div>
    </header>

    <div class="brief-shell product-body">
      <section id="current-product" class="reader-section" aria-labelledby="atlas-products-title">
        <header class="reader-section-header"><span>01</span><h2 id="atlas-products-title">Current product</h2><small>唯一当前产品。产品页讲清目标形态、系统流、当前证据、限制与下一道 Gate。</small></header>
        <article v-for="entry in productProjects" :key="entry.project.slug" class="reader-article atlas-product" :data-accent="entry.presentation.theme">
          <p class="brief-card-meta">
            <b class="brief-tag brief-tag--market">{{ entry.presentation.index }} / {{ entry.presentation.label }}</b>
            <time :datetime="entry.project.updatedAt">{{ entry.project.updatedAt }}</time>
          </p>
          <h3>{{ entry.project.name }}</h3>
          <p class="reader-why">{{ entry.presentation.promise }}</p>
          <blockquote class="atlas-evidence">{{ entry.project.verifiedEvidence[0] }}</blockquote>
          <footer class="atlas-footer">
            <strong>{{ projectClaimStateLabels[entry.project.claimState] }} · {{ projectStageLabels[entry.project.stage] }}</strong>
            <router-link class="brief-button" :to="`/projects/${entry.project.slug}`">进入产品主页 ↗</router-link>
          </footer>
        </article>
      </section>

      <section
        v-for="(group, groupIndex) in supportingGroups"
        :id="group.role"
        :key="group.role"
        class="reader-section"
        :aria-labelledby="`atlas-${group.role}-title`"
      >
        <header class="reader-section-header">
          <span>{{ String(groupIndex + 2).padStart(2, '0') }}</span>
          <h2 :id="`atlas-${group.role}-title`">{{ group.title }}</h2>
          <small>{{ group.projects.length }} 项 · {{ group.description }}</small>
        </header>
        <div class="atlas-grid">
          <article v-for="project in group.projects" :key="project.id" class="brief-panel atlas-card">
            <p class="brief-card-meta"><span>{{ project.category }}</span><time :datetime="project.updatedAt">{{ project.updatedAt }}</time></p>
            <h3>{{ project.name }}</h3>
            <p>{{ project.positioning }}</p>
            <blockquote class="atlas-evidence">{{ project.verifiedEvidence[0] }}</blockquote>
            <footer class="atlas-footer">
              <strong>{{ projectClaimStateLabels[project.claimState] }} · {{ projectStageLabels[project.stage] }}</strong>
              <a v-if="projectAction(project).href" class="reader-source-link" :href="projectAction(project).href" target="_blank" rel="noopener">{{ projectAction(project).label }} ↗</a>
              <router-link v-else class="reader-source-link" :to="projectAction(project).to!">{{ projectAction(project).label }} →</router-link>
            </footer>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>
