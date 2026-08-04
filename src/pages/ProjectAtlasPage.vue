<script setup lang="ts">
import { computed, onMounted } from 'vue'
import '../styles/cinematic-pages.css'
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
  <section class="project-atlas-page project-atlas-page--cinematic cinematic-page">
    <header class="project-atlas-hero cinematic-page-hero">
      <div class="container project-atlas-hero-layout">
        <div class="project-atlas-hero-copy">
          <p class="cinematic-page-kicker">Project Atlas / Evidence Registry</p>
          <h1>项目不是数量列表，<span>而是一张证据地图。</span></h1>
          <p>每个项目先说明完成后的产品形态，再标明当前阶段与已验证事实。愿景负责方向，证据负责可信，二者不会混成同一个完成状态。</p>
          <div class="project-atlas-tracks" aria-label="三条系统主线">
            <router-link to="/projects/exchange-wallet-system"><span>01</span>Wallet Platform</router-link>
            <router-link to="/projects/s78-market-services"><span>02</span>Market Server</router-link>
            <router-link to="/ai/deliveries"><span>03</span>AI Engineering</router-link>
          </div>
        </div>

        <nav class="project-atlas-summary" aria-label="项目层级">
          <a v-for="group in groupedProjects" :key="group.tier" :href="`#${group.tier}`">
            <span>{{ projectPortfolioTierLabels[group.tier] }}</span>
            <strong>{{ String(group.projects.length).padStart(2, '0') }}</strong>
            <small>进入层级 ↘</small>
          </a>
        </nav>
      </div>
    </header>

    <div class="container project-atlas-registry">
      <section
        v-for="(group, groupIndex) in groupedProjects"
        :id="group.tier"
        :key="group.tier"
        class="project-atlas-group"
      >
        <div class="project-atlas-group-heading">
          <div>
            <p class="cinematic-page-kicker">Scene {{ String(groupIndex + 1).padStart(2, '0') }}</p>
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
              <small>Verified Evidence / 已验证到哪里</small>
              <p>{{ project.verifiedEvidence[0] }}</p>
            </div>
            <div class="project-atlas-future-grid">
              <div class="project-atlas-next">
                <small>Target Outcome / 产品完成形态</small>
                <p>{{ project.targetOutcome }}</p>
              </div>
              <div class="project-atlas-next">
                <small>Next Gate / 完成标准</small>
                <p>{{ project.nextMilestone }}</p>
              </div>
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
