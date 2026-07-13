<script setup lang="ts">
import { onMounted } from 'vue'
import { learningRecords } from '../data/generatedLearningRecords'
import { dailyRadars } from '../data/generatedRadars'
import { aiStageLabels, projectStageLabels, siteAiCases, siteArticlesByNewest, siteKnowledge, siteProjects } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const featuredProjects = siteProjects.filter(project => project.featured)
const stableFlow = siteProjects.find(project => project.slug === 'stableflow')
const recentArticles = siteArticlesByNewest.slice(0, 3)
const latestLearning = learningRecords.slice(0, 2)
const latestRadar = dailyRadars[0]
const latestOutput = recentArticles[0] || latestLearning[0]

const controlItems = [
  { label: '开发中', title: featuredProjects[0]?.name || '钱包基础设施', text: featuredProjects[0]?.currentFocus || '继续验证钱包工程边界。', to: '/engineering' },
  { label: '研究中', title: latestRadar?.web3Design?.title || '多链钱包与签名安全', text: latestRadar?.summary || '从每日研究输入提炼可迁移的工程判断。', to: latestRadar ? `/radar/${latestRadar.slug}` : '/radar' },
  { label: '最近产出', title: latestOutput?.title || '工程学习记录', text: latestOutput?.summary || '把验证结果沉淀为可复核内容。', to: recentArticles[0] ? `/articles/${recentArticles[0].slug}` : '/learning' },
]

const capabilityTracks = [
  { index: '01', title: 'Web3 钱包工程', text: 'Exchange Wallet Infrastructure、wallet-core、可运行实验，以及 TSS/MPC 与数据服务扩展。', to: '/engineering', link: '查看工程证据' },
  { index: '02', title: 'AI 工程协作', text: '用计划、交接、测试和人工验收完成可审查的工程闭环。', to: '/ai#ai-coding-collaboration', link: '查看协作方法' },
  { index: '03', title: '每日研究雷达', text: 'Obsidian 输入经过来源、隐私和构建门禁后自动发布。', to: '/radar', link: '查看最新研究' },
]

onMounted(() => setSeoMeta({ title: 'xiuqiu｜Web3 钱包工程 × AI 协作', description: siteKnowledge.owner.summary, path: '/' }))
</script>

<template>
  <section class="section hero portfolio-hero control-hero">
    <div class="container portfolio-hero-grid">
      <div>
        <p class="hero-eyebrow">Web3 Wallet Backend · AI-assisted Engineering</p>
        <h1 class="hero-title">交易所钱包基础设施</h1>
        <p class="hero-desc hero-desc-primary">我在开发交易所钱包基础设施，也在持续研究多链资源、签名安全与 AI 工程协作。</p>
        <div class="hero-actions hero-actions-left">
          <router-link class="btn btn-primary" to="/engineering">查看工程档案</router-link>
          <router-link class="btn btn-secondary" to="/radar">最近在研究什么</router-link>
        </div>
      </div>
      <aside class="hero-proof-panel control-status-panel">
        <div class="control-status-top"><span class="status-dot"></span><span>当前主线</span><time>2026-07-13</time></div>
        <h2>Exchange Wallet Infrastructure</h2>
        <p>资金编排 · 风险控制 · 多链交互 · 签名后端</p>
        <dl>
          <div><dt>工程语言</dt><dd>Go · TypeScript</dd></div>
          <div><dt>验证重点</dt><dd>状态机 · 多链资源 · 风控与签名边界</dd></div>
          <div><dt>表达原则</dt><dd>事实 / 目标态 / 已知限制分开</dd></div>
        </dl>
      </aside>
    </div>
  </section>

  <section class="control-strip">
    <div class="container control-strip-grid">
      <router-link v-for="item in controlItems" :key="item.label" :to="item.to"><article><span>{{ item.label }}</span><h2>{{ item.title }}</h2><p>{{ item.text }}</p></article></router-link>
    </div>
  </section>

  <section v-if="stableFlow" class="section current-side-project">
    <div class="container side-project-row">
      <div><p class="section-label">Current Side Project</p><h2>StableFlow · 稳定币结算工程副线</h2><p>{{ stableFlow.positioning }}</p></div>
      <div class="side-project-proof"><span>{{ projectStageLabels[stableFlow.stage] }}</span><strong>本次验证</strong><p>{{ stableFlow.verifiedEvidence[1] }}</p><router-link :to="`/projects/${stableFlow.slug}`">查看边界与下一步 &rarr;</router-link></div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-heading section-heading-left"><p class="section-label">Three Tracks</p><h2 class="section-title">我持续在做的三件事</h2><p class="section-desc">先看方向，再进入工程证据、研究来源和学习复盘。</p></div>
      <div class="capability-track-grid">
        <router-link v-for="track in capabilityTracks" :key="track.index" :to="track.to" class="capability-track-card"><span>{{ track.index }}</span><h3>{{ track.title }}</h3><p>{{ track.text }}</p><strong>{{ track.link }} &rarr;</strong></router-link>
      </div>
    </div>
  </section>

  <section id="projects" class="section section-alt">
    <div class="container">
      <div class="section-heading section-heading-left"><p class="section-label">Core Engineering Work</p><h2 class="section-title">三个核心工程案例</h2><p class="section-desc">不是完成度排名。每个案例同时展示当前阶段、已经验证的事实和希望达到的目标形态。</p></div>
      <div class="home-project-grid control-project-grid">
        <article v-for="project in featuredProjects" :key="project.id" class="home-project-card control-project-card">
          <div class="card-status-row"><span>{{ project.category }}</span><strong>{{ projectStageLabels[project.stage] }}</strong></div>
          <h3>{{ project.name }}</h3><p>{{ project.positioning }}</p>
          <div class="project-proof-preview"><span>已验证</span><p>{{ project.verifiedEvidence[0] }}</p></div>
          <div class="project-proof-preview target"><span>目标态</span><p>{{ project.targetOutcome }}</p></div>
          <router-link :to="`/projects/${project.slug}`" class="project-link">查看完整档案 &rarr;</router-link>
        </article>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-heading section-heading-left"><p class="section-label">Four Loops</p><h2 class="section-title">AI 如何进入实际工作流</h2><p class="section-desc">工程协作、Skill 复用、研究发布和知识治理都用真实流程与边界说明。</p></div>
      <div class="ai-case-preview-grid">
        <router-link v-for="item in siteAiCases" :key="item.id" :to="`/ai#${item.slug}`" class="ai-case-preview-card">
          <div class="card-status-row"><span>{{ String(item.displayOrder).padStart(2, '0') }}</span><strong>{{ aiStageLabels[item.stage] }}</strong></div><h3>{{ item.title }}</h3><p>{{ item.summary }}</p><small>{{ item.flow.slice(0, 3).join(' → ') }}</small>
        </router-link>
      </div>
    </div>
  </section>

  <section v-if="latestRadar" class="section section-alt">
    <div class="container">
      <div class="section-heading section-heading-left"><p class="section-label">Latest Radar · {{ latestRadar.date }}</p><h2 class="section-title">最近在研究什么</h2><p class="section-desc">{{ latestRadar.summary }}</p></div>
      <div class="radar-home-grid">
        <article v-for="item in [latestRadar.aiTip, latestRadar.web3Design, latestRadar.vibeProject, latestRadar.readingPick].filter(Boolean)" :key="item!.title"><h3>{{ item!.title }}</h3><p>{{ item!.summary }}</p></article>
      </div>
      <router-link :to="`/radar/${latestRadar.slug}`" class="project-link">查看本期来源与后续行动 &rarr;</router-link>
    </div>
  </section>

  <section class="section section-alt">
    <div class="container home-update-grid">
      <div>
        <div class="section-heading section-heading-left"><p class="section-label">Recent Verification</p><h2 class="section-title">最近验证与复盘</h2></div>
        <div class="home-update-list"><router-link v-for="record in latestLearning" :key="record.id" to="/learning" class="home-update-item"><time>{{ record.date }}</time><div><h3>{{ record.title }}</h3><p>{{ record.summary }}</p></div></router-link></div>
      </div>
      <div>
        <div class="section-heading section-heading-left"><p class="section-label">Latest Writing</p><h2 class="section-title">最近工程笔记</h2></div>
        <div class="home-update-list"><router-link v-for="article in recentArticles" :key="article.slug" :to="`/articles/${article.slug}`" class="home-update-item"><time>{{ article.date }}</time><div><h3>{{ article.title }}</h3><p>{{ article.summary }}</p></div></router-link></div>
      </div>
    </div>
  </section>
</template>
