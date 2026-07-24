<script setup lang="ts">
import { computed, onMounted } from 'vue'
import {
  projectActivityLabels,
  projectPortfolioTierLabels,
  projectStageLabels,
  siteProjects,
  type SiteProject,
} from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const tierOrder = ['flagship', 'verified', 'exploration', 'paused'] as const
const tierDescriptions = {
  flagship: '承载当前工程身份和主要系统判断。',
  verified: '已有公开演示、测试或本地复现证据。',
  exploration: '源码研究、集成中能力和相邻业务实验。',
  paused: '保留历史与阶段判断，不作为当前能力主张。',
}
const groupedProjects = computed(() =>
  tierOrder
    .map(tier => ({
      tier,
      projects: siteProjects
        .filter(project => project.portfolioTier === tier)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    }))
    .filter(group => group.projects.length),
)

function projectAction(project: SiteProject) {
  if (project.slug === 'wallet-reliability-lab') {
    return { label: '运行在线实验', href: 'https://wallet-reliability-lab.vercel.app' }
  }
  return { label: '查看项目档案', to: `/projects/${project.slug}` }
}

onMounted(() =>
  setSeoMeta({
    title: '项目图谱｜xiuqiu',
    description: '按旗舰系统、可验证作品、工程探索与暂停项目分层展示 Web3 钱包后端和 AI 协作工程。',
    path: '/projects',
  }),
)
</script>

<template>
  <section class="section page-top project-atlas-page">
    <div class="container">
      <header class="project-atlas-hero">
        <p class="section-label">Project Atlas</p>
        <h1>项目不是数量列表，而是一张证据地图</h1>
        <p>每个项目都标明当前阶段、已验证事实和下一里程碑。公开演示、本地验证、源码研究与计划不会混在同一个完成状态里。</p>
      </header>

      <nav class="project-atlas-summary" aria-label="项目层级">
        <a v-for="group in groupedProjects" :key="group.tier" :href="`#${group.tier}`">
          <strong>{{ group.projects.length }}</strong>
          <span>{{ projectPortfolioTierLabels[group.tier] }}</span>
        </a>
      </nav>

      <section
        v-for="group in groupedProjects"
        :id="group.tier"
        :key="group.tier"
        class="project-atlas-group"
      >
        <div class="project-atlas-group-heading">
          <div>
            <p class="section-label">{{ projectPortfolioTierLabels[group.tier] }}</p>
            <h2>{{ projectPortfolioTierLabels[group.tier] }}</h2>
          </div>
          <p>{{ tierDescriptions[group.tier] }}</p>
        </div>

        <div class="project-atlas-grid" :class="`tier-${group.tier}`">
          <article v-for="project in group.projects" :key="project.id" class="project-atlas-card">
            <div class="project-atlas-card-meta">
              <span>{{ project.category }}</span>
              <time :datetime="project.updatedAt">{{ project.updatedAt }}</time>
            </div>
            <h3>{{ project.name }}</h3>
            <p>{{ project.positioning }}</p>
            <div class="project-atlas-status">
              <span>{{ projectStageLabels[project.stage] }}</span>
              <span>{{ projectActivityLabels[project.activityStatus] }}</span>
            </div>
            <div class="project-atlas-proof">
              <small>当前证据</small>
              <p>{{ project.verifiedEvidence[0] }}</p>
            </div>
            <div class="project-atlas-next">
              <small>下一里程碑</small>
              <p>{{ project.nextMilestone }}</p>
            </div>
            <a
              v-if="projectAction(project).href"
              class="project-link"
              :href="projectAction(project).href"
              target="_blank"
              rel="noopener"
            >
              {{ projectAction(project).label }} ↗
            </a>
            <router-link v-else class="project-link" :to="projectAction(project).to!">
              {{ projectAction(project).label }} →
            </router-link>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>
