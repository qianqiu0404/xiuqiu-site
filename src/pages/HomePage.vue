<script setup lang="ts">
import { onMounted } from 'vue'
import { dailyRadars } from '../data/generatedRadars'
import { radarWeeklies } from '../data/generatedRadarWeeklies'
import { deliveryRecords } from '../data/generatedDeliveries'
import {
  projectStageLabels,
  siteProjects,
  type SiteProject,
} from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const walletLabUrl = 'https://wallet-reliability-lab.vercel.app'
const githubUrl = 'https://github.com/qianqiu0404'
const flagshipProject = siteProjects.find(project => project.portfolioTier === 'flagship')!
const verifiedOrder = [
  'wallet-reliability-lab',
  'web3-wallet-engineer-lab',
  'wallet-core',
  's78-market-services',
]
const explorationOrder = ['tss-mpc', 'stableflow', 'risk-server']
const verifiedProjects = siteProjects
  .filter(project => verifiedOrder.includes(project.slug))
  .sort((a, b) => verifiedOrder.indexOf(a.slug) - verifiedOrder.indexOf(b.slug))
const explorationProjects = siteProjects
  .filter(project => explorationOrder.includes(project.slug))
  .sort((a, b) => explorationOrder.indexOf(a.slug) - explorationOrder.indexOf(b.slug))
const latestDelivery = deliveryRecords[0]
const latestRadar = dailyRadars[0]
const latestWeekly = radarWeeklies[0]
const serviceFlow = [
  ['wallet-service', '资金状态与业务编排'],
  ['risk-service', '提现校验与风控放行'],
  ['wallet-api', '多链节点与交易构建'],
  ['wallet-sign', '密钥边界与交易签名'],
]

function projectAction(project: SiteProject) {
  if (project.slug === 'wallet-reliability-lab') {
    return { label: '运行在线实验', href: walletLabUrl }
  }
  return { label: '查看项目档案', to: `/projects/${project.slug}` }
}

onMounted(() =>
  setSeoMeta({
    title: 'xiuqiu｜Web3 钱包后端 × AI 协作工程',
    description: '面向工程合作者的 Web3 钱包后端作品集，展示资金状态、多链交易、签名安全、异常恢复与可复核工程证据。',
    path: '/',
  }),
)
</script>

<template>
  <div class="portfolio-home">
    <section class="portfolio-home-hero" aria-labelledby="home-title">
      <div class="container portfolio-home-intro">
        <p class="hero-eyebrow">Web3 Wallet Backend · AI-assisted Engineering</p>
        <h1 id="home-title">把钱包系统做成可运行、可解释、可验证的工程</h1>
        <p class="portfolio-home-lead">
          聚焦资金状态、多链交易、签名安全与异常恢复；用公开实验、源码和测试说明边界，也明确哪些仍在研究与集成。
        </p>
        <div class="hero-actions portfolio-home-actions">
          <router-link class="btn btn-primary" to="/projects">查看项目图谱</router-link>
          <a class="btn btn-secondary" :href="walletLabUrl" target="_blank" rel="noopener">运行 Wallet Lab</a>
        </div>
      </div>
    </section>

    <section class="portfolio-home-section portfolio-home-flagship" aria-labelledby="flagship-title">
      <div class="container">
        <div class="portfolio-home-heading">
          <div>
            <p class="section-label">Flagship System</p>
            <h2 id="flagship-title">{{ flagshipProject.name }}</h2>
          </div>
          <p>{{ flagshipProject.positioning }}</p>
        </div>

        <div class="flagship-flow" aria-label="Exchange Wallet Infrastructure 服务边界">
          <template v-for="(service, index) in serviceFlow" :key="service[0]">
            <article>
              <span>0{{ index + 1 }}</span>
              <h3>{{ service[0] }}</h3>
              <p>{{ service[1] }}</p>
            </article>
            <span v-if="index < serviceFlow.length - 1" class="flagship-flow-arrow" aria-hidden="true">→</span>
          </template>
        </div>

        <div class="flagship-status">
          <div>
            <span>当前阶段</span>
            <strong>{{ projectStageLabels[flagshipProject.stage] }}</strong>
          </div>
          <div>
            <span>最近验证</span>
            <strong>{{ flagshipProject.verifiedEvidence[0] }}</strong>
          </div>
          <div>
            <span>下一里程碑</span>
            <strong>{{ flagshipProject.nextMilestone }}</strong>
          </div>
        </div>
        <router-link class="portfolio-home-link" :to="`/projects/${flagshipProject.slug}`">
          查看旗舰系统档案 →
        </router-link>
      </div>
    </section>

    <section class="portfolio-home-section portfolio-home-work" aria-labelledby="work-title">
      <div class="container">
        <div class="portfolio-home-heading">
          <div>
            <p class="section-label">Layered Project Atlas</p>
            <h2 id="work-title">从验证作品到工程探索</h2>
          </div>
          <p>成熟作品给出可复核证据；探索项目只陈述当前已经验证到哪一步，不用完成百分比制造确定性。</p>
        </div>

        <div class="portfolio-home-projects">
          <article v-for="(project, index) in verifiedProjects" :key="project.id" class="portfolio-home-project">
            <div class="portfolio-home-project-meta">
              <span>{{ String(index + 1).padStart(2, '0') }} · Verified Work</span>
              <strong>{{ projectStageLabels[project.stage] }}</strong>
            </div>
            <h3>{{ project.name }}</h3>
            <p class="portfolio-home-project-desc">{{ project.positioning }}</p>
            <div class="portfolio-home-project-proof">
              <span>当前证据</span>
              <p>{{ project.verifiedEvidence[0] }}</p>
            </div>
            <a
              v-if="projectAction(project).href"
              class="portfolio-home-link"
              :href="projectAction(project).href"
              target="_blank"
              rel="noopener"
            >
              {{ projectAction(project).label }} ↗
            </a>
            <router-link v-else class="portfolio-home-link" :to="projectAction(project).to!">
              {{ projectAction(project).label }} →
            </router-link>
          </article>
        </div>

        <div class="portfolio-home-explorations">
          <div class="portfolio-home-explorations-heading">
            <p class="section-label">Engineering Explorations</p>
            <router-link to="/projects">查看完整项目图谱 →</router-link>
          </div>
          <router-link
            v-for="project in explorationProjects"
            :key="project.id"
            class="portfolio-home-exploration"
            :to="`/projects/${project.slug}`"
          >
            <div>
              <span>{{ project.category }}</span>
              <h3>{{ project.name }}</h3>
            </div>
            <p>{{ project.verifiedEvidence[0] }}</p>
            <strong>{{ projectStageLabels[project.stage] }} →</strong>
          </router-link>
        </div>
      </div>
    </section>

    <section class="portfolio-home-section portfolio-home-latest" aria-labelledby="latest-title">
      <div class="container">
        <div class="portfolio-home-heading portfolio-home-latest-heading">
          <div>
            <p class="section-label">Latest Engineering & Research</p>
            <h2 id="latest-title">最近工程与研究</h2>
          </div>
          <p>工程交付说明做成了什么；雷达说明当前正在观察什么，以及哪些判断已经收敛。</p>
        </div>

        <div class="portfolio-home-latest-pair">
          <router-link
            v-if="latestDelivery"
            class="portfolio-home-latest-item"
            :to="`/ai/deliveries/${latestDelivery.slug}`"
          >
            <div><span>最新工程交付</span><time :datetime="latestDelivery.date">{{ latestDelivery.date }}</time></div>
            <h3>{{ latestDelivery.title }}</h3>
            <p>{{ latestDelivery.summary }}</p>
            <strong>查看交付记录 →</strong>
          </router-link>

          <article class="portfolio-home-research">
            <router-link v-if="latestRadar" :to="`/radar/${latestRadar.slug}`">
              <div><span>最新每日简报</span><time :datetime="latestRadar.date">{{ latestRadar.date }}</time></div>
              <h3>{{ latestRadar.web3Design?.title || latestRadar.title }}</h3>
              <p>{{ latestRadar.summary }}</p>
            </router-link>
            <router-link v-if="latestWeekly" :to="`/radar/week/${latestWeekly.slug}`" class="weekly-link">
              <span>本周收敛</span>
              <strong>{{ latestWeekly.title }} →</strong>
            </router-link>
          </article>
        </div>
      </div>
    </section>

    <section class="portfolio-home-section portfolio-home-cta" aria-labelledby="cta-title">
      <div class="container portfolio-home-cta-inner">
        <p class="section-label">Explore & Collaborate</p>
        <h2 id="cta-title">从项目边界和验证证据开始协作</h2>
        <p>先通过项目图谱理解整体工程，再进入证据矩阵或公开仓库复核具体实现。</p>
        <div class="hero-actions">
          <router-link class="btn btn-primary" to="/projects">查看项目图谱</router-link>
          <router-link class="btn btn-secondary" to="/engineering/evidence">查看工程证据</router-link>
          <a class="btn btn-ghost" :href="githubUrl" target="_blank" rel="noopener">查看 GitHub</a>
        </div>
      </div>
    </section>
  </div>
</template>
