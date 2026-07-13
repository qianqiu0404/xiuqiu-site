<script setup lang="ts">
import { onMounted } from 'vue'
import { learningRecords } from '../data/generatedLearningRecords'
import { aiStageLabels, projectStageLabels, siteAiCases, siteArticlesByNewest, siteKnowledge, siteProjects } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const featuredProjects = siteProjects.filter(project => project.featured)
const recentArticles = siteArticlesByNewest.slice(0, 3)
const latestLearning = learningRecords.slice(0, 2)

const controlItems = [
  { label: '现在', title: '建设 Exchange Wallet Infrastructure', text: '围绕资金编排、链交互、签名与风险控制四个边界持续实现和验证。' },
  { label: '为什么', title: '资金系统需要可解释的边界', text: '多链差异可以被适配，但风控放行、nonce、UTXO、签名和账务状态不能被隐藏。' },
  { label: '下一步', title: '跑通带风控与失败注入的提现链路', text: '固定四个服务的兼容基线，验证风控拒绝、广播结果未知、重启恢复和本地补偿。' },
]

const capabilityTracks = [
  { index: '01', title: 'Web3 钱包工程', text: 'Exchange Wallet Infrastructure、wallet-core、可运行实验，以及 TSS/MPC 与数据服务扩展。', to: '/engineering', link: '查看工程证据' },
  { index: '02', title: 'AI Coding 协作', text: 'Planner、Worker、Reviewer 与人工验收组成可交接、可审查的工程闭环。', to: '/ai#ai-coding-collaboration', link: '查看协作方法' },
  { index: '03', title: '知识与研究自动化', text: 'Obsidian 审核流、发布门禁、来源核验、去重和不会覆盖人工记录的自动化。', to: '/ai#obsidian-knowledge-system', link: '查看知识系统' },
]

onMounted(() => setSeoMeta({ title: 'xiuqiu｜Web3 钱包工程 × AI 协作', description: siteKnowledge.owner.summary, path: '/' }))
</script>

<template>
  <section class="section hero portfolio-hero control-hero">
    <div class="container portfolio-hero-grid">
      <div>
        <p class="hero-eyebrow">Web3 Wallet Backend · AI-assisted Engineering</p>
        <h1 class="hero-title">交易所钱包基础设施</h1>
        <p class="hero-desc hero-desc-primary">我专注 Web3 钱包后端，用 Go 和 TypeScript 理解资金状态、多链资源与签名安全；同时用 AI 组织计划、实现、审查、知识沉淀和持续复盘。</p>
        <div class="hero-actions hero-actions-left">
          <router-link class="btn btn-primary" to="/engineering">查看工程档案</router-link>
          <router-link class="btn btn-secondary" to="/ai">查看 AI 协作</router-link>
          <router-link class="btn btn-ghost" to="/learning">最近在学什么 &rarr;</router-link>
        </div>
      </div>
      <aside class="hero-proof-panel control-status-panel">
        <div class="control-status-top"><span class="status-dot"></span><span>当前主线</span><time>2026-07-13</time></div>
        <h2>Exchange Wallet Infrastructure</h2>
        <p>wallet-service → risk-service → wallet-api → wallet-sign</p>
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
      <article v-for="item in controlItems" :key="item.label"><span>{{ item.label }}</span><h2>{{ item.title }}</h2><p>{{ item.text }}</p></article>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-heading section-heading-left"><p class="section-label">Three Tracks</p><h2 class="section-title">三条持续建设的能力轨道</h2><p class="section-desc">朋友可以先看我在做什么；面试官可以继续进入代码边界、验证证据和失败场景。</p></div>
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
      <div class="section-heading section-heading-left"><p class="section-label">AI Collaboration</p><h2 class="section-title">AI 能力用三个真实流程证明</h2></div>
      <div class="ai-case-preview-grid">
        <router-link v-for="item in siteAiCases" :key="item.id" :to="`/ai#${item.slug}`" class="ai-case-preview-card">
          <div class="card-status-row"><span>0{{ item.id }}</span><strong>{{ aiStageLabels[item.stage] }}</strong></div><h3>{{ item.title }}</h3><p>{{ item.summary }}</p><small>{{ item.flow.slice(0, 3).join(' → ') }}</small>
        </router-link>
      </div>
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
