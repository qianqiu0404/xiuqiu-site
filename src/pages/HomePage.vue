<script setup lang="ts">
import { onMounted } from 'vue'
import { dailyRadars } from '../data/generatedRadars'
import { deliveryRecords } from '../data/generatedDeliveries'
import { nowSnapshot } from '../data/generatedNow'
import { projectStageLabels, siteArticlesByNewest, siteKnowledge, siteProjects } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const walletLabUrl = 'https://wallet-reliability-lab.vercel.app'
const githubUrl = 'https://github.com/qianqiu0404'

const featuredProjectSlugs = ['exchange-wallet-system', 'wallet-reliability-lab', 'wallet-core']
const featuredProjects = siteProjects
  .filter(project => featuredProjectSlugs.includes(project.slug))
  .sort((a, b) => featuredProjectSlugs.indexOf(a.slug) - featuredProjectSlugs.indexOf(b.slug))

const projectDescriptions: Record<string, string> = {
  'exchange-wallet-system': '围绕充值、提现与资金安全组织四个 Go 服务，明确资金状态、风控、多链节点与签名边界。',
  'wallet-reliability-lab': '通过三种提现路径，交互演示正常状态机、可重试广播和链上事实补偿。',
  'wallet-core': '统一多链离线密钥派生、交易构建与签名，同时保留每条链的资源差异。',
}

const projectActions: Record<string, { label: string; href?: string }> = {
  'exchange-wallet-system': { label: '查看工程档案' },
  'wallet-reliability-lab': { label: '打开在线实验', href: walletLabUrl },
  'wallet-core': { label: '查看 GitHub 源码', href: 'https://github.com/qianqiu0404/wallet-core' },
}

const evidenceItems = [
  {
    index: '01',
    label: 'Architecture',
    title: '工程档案',
    text: '查看资金状态、多链交互和签名边界。',
    to: '/engineering',
  },
  {
    index: '02',
    label: 'Interactive Lab',
    title: '在线实验',
    text: '亲自运行三种提现与恢复路径。',
    href: walletLabUrl,
  },
  {
    index: '03',
    label: 'Verification',
    title: '测试证据',
    text: '从工程判断继续定位到公开证据。',
    to: '/engineering/evidence',
  },
]

interface LatestActivity {
  label: string
  title: string
  summary: string
  date: string
  to: string
  priority: number
}

const latestDelivery = deliveryRecords[0]
const latestArticle = siteArticlesByNewest[0]
const latestRadar = dailyRadars[0]
const activityCandidates: LatestActivity[] = [
  {
    label: '当前动态',
    title: nowSnapshot.headline,
    summary: nowSnapshot.summary,
    date: nowSnapshot.updatedAt,
    to: '/now',
    priority: 3,
  },
]

if (latestDelivery) {
  activityCandidates.push({
    label: '工程交付',
    title: latestDelivery.title,
    summary: latestDelivery.summary,
    date: latestDelivery.date,
    to: `/ai/deliveries/${latestDelivery.slug}`,
    priority: 1,
  })
}

if (latestArticle) {
  activityCandidates.push({
    label: '工程文章',
    title: latestArticle.title,
    summary: latestArticle.summary,
    date: latestArticle.date,
    to: `/articles/${latestArticle.slug}`,
    priority: 2,
  })
}

if (latestRadar) {
  activityCandidates.push({
    label: '每日雷达',
    title: latestRadar.web3Design?.title || `每日雷达 · ${latestRadar.date}`,
    summary: latestRadar.summary,
    date: latestRadar.date,
    to: `/radar/${latestRadar.slug}`,
    priority: 4,
  })
}

const latestActivity = activityCandidates.sort(
  (a, b) => b.date.localeCompare(a.date) || a.priority - b.priority,
)[0]

onMounted(() =>
  setSeoMeta({
    title: 'xiuqiu｜Web3 钱包后端工程作品集',
    description: '面向交易所钱包基础设施的公开工程作品集，展示资金状态、多链交互、签名边界、在线实验与可复核证据。',
    path: '/',
  }),
)
</script>

<template>
  <div class="portfolio-home">
    <section class="portfolio-home-hero" aria-labelledby="home-title">
      <div class="container portfolio-home-intro">
        <p class="hero-eyebrow">Web3 Wallet Backend · AI-assisted Engineering</p>
        <h1 id="home-title">构建可验证的交易所钱包基础设施</h1>
        <p class="portfolio-home-lead">
          聚焦充值、提现、资金状态、多链交易与签名边界；用公开实验、源码和测试证据说明实现，而不是堆砌概念。
        </p>
        <div class="hero-actions portfolio-home-actions">
          <router-link class="btn btn-primary" to="/engineering">查看工程档案</router-link>
          <a class="btn btn-secondary" :href="walletLabUrl" target="_blank" rel="noopener">运行 Wallet Lab</a>
        </div>
      </div>
    </section>

    <section class="portfolio-home-evidence" aria-labelledby="evidence-title">
      <h2 id="evidence-title" class="visually-hidden">可信证据入口</h2>
      <div class="container portfolio-home-evidence-grid">
        <template v-for="item in evidenceItems" :key="item.index">
          <a
            v-if="item.href"
            class="portfolio-home-evidence-item"
            :href="item.href"
            target="_blank"
            rel="noopener"
          >
            <span>{{ item.index }} · {{ item.label }}</span>
            <strong>{{ item.title }}</strong>
            <p>{{ item.text }}</p>
          </a>
          <router-link v-else class="portfolio-home-evidence-item" :to="item.to!">
            <span>{{ item.index }} · {{ item.label }}</span>
            <strong>{{ item.title }}</strong>
            <p>{{ item.text }}</p>
          </router-link>
        </template>
      </div>
    </section>

    <section class="portfolio-home-section portfolio-home-work" aria-labelledby="work-title">
      <div class="container">
        <div class="portfolio-home-heading">
          <div>
            <p class="section-label">Selected Work</p>
            <h2 id="work-title">三个代表项目</h2>
          </div>
          <p>从系统边界、交互实验到多链离线钱包，展示同一条工程主线的不同验证层。</p>
        </div>

        <div class="portfolio-home-projects">
          <article v-for="(project, index) in featuredProjects" :key="project.id" class="portfolio-home-project">
            <div class="portfolio-home-project-meta">
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <strong>{{ projectStageLabels[project.stage] }}</strong>
            </div>
            <h3>{{ project.name }}</h3>
            <p class="portfolio-home-project-desc">{{ projectDescriptions[project.slug] }}</p>
            <div class="portfolio-home-project-proof">
              <span>已验证</span>
              <p>{{ project.verifiedEvidence[0] }}</p>
            </div>
            <a
              v-if="projectActions[project.slug]?.href"
              class="portfolio-home-link"
              :href="projectActions[project.slug].href"
              target="_blank"
              rel="noopener"
            >
              {{ projectActions[project.slug].label }} ↗
            </a>
            <router-link v-else class="portfolio-home-link" :to="`/projects/${project.slug}`">
              {{ projectActions[project.slug]?.label }} →
            </router-link>
          </article>
        </div>
      </div>
    </section>

    <section class="portfolio-home-section portfolio-home-latest" aria-labelledby="latest-title">
      <div class="container portfolio-home-latest-grid">
        <div>
          <p class="section-label">Latest Activity</p>
          <h2 id="latest-title">最近更新</h2>
          <p>首页只保留一条最新进展，完整记录继续沉淀在对应页面。</p>
        </div>
        <router-link class="portfolio-home-latest-item" :to="latestActivity.to">
          <div>
            <span>{{ latestActivity.label }}</span>
            <time :datetime="latestActivity.date">{{ latestActivity.date }}</time>
          </div>
          <h3>{{ latestActivity.title }}</h3>
          <p>{{ latestActivity.summary }}</p>
          <strong>查看完整记录 →</strong>
        </router-link>
      </div>
    </section>

    <section class="portfolio-home-section portfolio-home-cta" aria-labelledby="cta-title">
      <div class="container portfolio-home-cta-inner">
        <p class="section-label">Explore the Work</p>
        <h2 id="cta-title">从一条可运行的链路开始</h2>
        <p>先看工程档案理解系统边界，或直接运行 Wallet Lab，观察一次提现如何推进、失败与恢复。</p>
        <div class="hero-actions">
          <router-link class="btn btn-primary" to="/engineering">进入工程档案</router-link>
          <a class="btn btn-secondary" :href="walletLabUrl" target="_blank" rel="noopener">运行 Wallet Lab</a>
          <a class="btn btn-ghost" :href="githubUrl" target="_blank" rel="noopener">查看 GitHub</a>
        </div>
      </div>
    </section>
  </div>
</template>
