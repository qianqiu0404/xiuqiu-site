<script setup lang="ts">
import { onMounted } from 'vue'
import {
  aiEngineeringOutcomes,
  flagshipProjectSlug,
  githubProfileUrl,
  githubRepositoriesUrl,
  homeCapabilities,
  homeEvidenceHighlights,
  homeProofMethods,
  homeSeo,
  homeServiceFlow,
  representativeProjectSlugs,
  walletLabUrl,
  type HomeDestination,
} from '../data/homePresentation'
import {
  projects,
  type Project,
  type ProjectPortfolioTier,
  type ProjectStage,
} from '../data/generatedProjects'
import { evidenceRecords, type EvidenceRecord } from '../data/generatedEvidence'
import { aiCases } from '../data/generatedAiCases'
import { deliveryRecords } from '../data/generatedDeliveries'
import { articleKnowledge } from '../data/generatedArticleKnowledge'
import { dailyRadars } from '../data/generatedRadars'
import { setSeoMeta } from '../utils/seo'

type HomeAction = HomeDestination & { label: string }

interface HomeProjectCard {
  project: Project
  action: HomeAction
}

interface HomeEvidenceCard {
  record: EvidenceRecord
  label: string
  action: HomeAction
}

const projectStageLabels: Record<ProjectStage, string> = {
  exploring: '探索中',
  building: '实现中',
  'verified-local': '本地已验证',
  'showcase-ready': '可展示',
}
const projectPortfolioTierLabels: Record<ProjectPortfolioTier, string> = {
  flagship: '旗舰系统',
  verified: '可验证作品',
  exploration: '工程探索',
  paused: '暂停保留',
}
const projectsBySlug = new Map(projects.map(project => [project.slug, project]))
const evidenceBySlug = new Map(evidenceRecords.map(record => [record.slug, record]))

function requireProject(slug: string): Project {
  const project = projectsBySlug.get(slug)
  if (!project) {
    throw new Error(`Homepage project configuration references missing slug: ${slug}`)
  }
  return project
}

function requireEvidence(slug: string): EvidenceRecord {
  const record = evidenceBySlug.get(slug)
  if (!record) {
    throw new Error(`Homepage evidence configuration references missing slug: ${slug}`)
  }
  return record
}

function buildProjectAction(project: Project): HomeAction {
  if (project.slug === 'wallet-reliability-lab') {
    return { kind: 'external', label: '运行在线实验', href: walletLabUrl }
  }
  return { kind: 'internal', label: '查看项目详情', to: `/projects/${project.slug}` }
}

const flagshipProject = requireProject(flagshipProjectSlug)
const representativeProjectCards: HomeProjectCard[] = representativeProjectSlugs.map(slug => {
  const project = requireProject(slug)
  return { project, action: buildProjectAction(project) }
})
const evidenceCards: HomeEvidenceCard[] = homeEvidenceHighlights.map(item => ({
  record: requireEvidence(item.evidenceSlug),
  label: item.label,
  action: { ...item.destination, label: item.linkLabel },
}))
const primaryAiCase = aiCases.find(aiCase => aiCase.slug === 'ai-coding-collaboration')
const latestDelivery = [...deliveryRecords].sort((a, b) => b.date.localeCompare(a.date))[0]
const articlesByNewest = [...articleKnowledge].sort((a, b) => {
  const dateOrder = b.date.localeCompare(a.date)
  return dateOrder || b.id - a.id
})
const latestEngineeringArticle =
  articlesByNewest.find(
    article =>
      article.kind === 'engineering-note'
      && article.relatedProjectIds.includes(flagshipProject.id),
  )
  || articlesByNewest.find(article => article.kind === 'engineering-note')
const latestRadar = dailyRadars[0]

onMounted(() =>
  setSeoMeta({
    ...homeSeo,
    path: '/',
  }),
)
</script>

<template>
  <div class="value-home">
    <section class="value-home-hero" aria-labelledby="home-title">
      <div class="container value-home-hero-inner">
        <p class="value-home-eyebrow">Web3 Wallet Backend · Evidence-first Engineering</p>
        <h1 id="home-title">帮助 Web3 团队构建更可靠的钱包充值、提现、签名与多链基础设施</h1>
        <p class="value-home-lead">
          我专注交易所钱包后端，围绕资金状态、交易风控、多链交互、签名安全和异常恢复，提供可运行、可解释、可验证的工程实现。
        </p>
        <p class="value-home-trust">
          <span aria-hidden="true">✓</span>
          当前以本地运行、公开实验、源码、测试和失败场景复现作为主要工程证据。
        </p>
        <div class="hero-actions value-home-actions">
          <router-link class="btn btn-primary" to="/projects">查看代表项目</router-link>
          <a class="btn btn-secondary" :href="walletLabUrl" target="_blank" rel="noopener">运行 Wallet Lab</a>
          <router-link class="value-home-text-link" to="/engineering/evidence">查看工程证据 →</router-link>
        </div>

        <nav class="value-home-proof-strip" aria-label="工程证明方式">
          <template v-for="(proof, index) in homeProofMethods" :key="proof.id">
            <a
              v-if="proof.destination.kind === 'external'"
              :href="proof.destination.href"
              target="_blank"
              rel="noopener"
            >
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <strong>{{ proof.title }}</strong>
            </a>
            <router-link v-else :to="proof.destination.to">
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <strong>{{ proof.title }}</strong>
            </router-link>
          </template>
        </nav>
      </div>
    </section>

    <section id="capabilities" class="value-home-section value-home-capabilities" aria-labelledby="capabilities-title">
      <div class="container">
        <div class="value-home-heading">
          <div>
            <p class="section-label">Capabilities & Flagship Flow</p>
            <h2 id="capabilities-title">从资金风险出发，完成一笔可恢复的提现</h2>
          </div>
          <p>四类工程能力在同一条提现生命周期中协作；每个服务只拥有自己需要的状态与权限。</p>
        </div>

        <div class="value-home-capability-grid">
          <article
            v-for="(capability, index) in homeCapabilities"
            :key="capability.id"
            class="value-home-capability"
          >
            <span class="value-home-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <div>
              <h3>{{ capability.title }}</h3>
              <p>{{ capability.description }}</p>
              <p class="value-home-capability-tags">{{ capability.tags.join(' · ') }}</p>
            </div>
          </article>
        </div>

        <div class="value-home-lifecycle">
          <header class="value-home-lifecycle-heading">
            <div>
              <p class="section-label">Exchange Wallet Infrastructure</p>
              <h3>提现完整生命周期</h3>
            </div>
            <span>{{ projectStageLabels[flagshipProject.stage] }} · {{ flagshipProject.updatedAt }}</span>
          </header>

          <ol class="value-home-service-flow" aria-label="Exchange Wallet Infrastructure 四服务调用链">
            <li v-for="(service, index) in homeServiceFlow" :key="service.name">
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <h3>{{ service.name }}</h3>
              <p>{{ service.description }}</p>
            </li>
          </ol>

          <div class="value-home-lifecycle-proof">
            <p><strong>当前最强证据：</strong>{{ flagshipProject.verifiedEvidence[0] }}</p>
            <router-link class="value-home-inline-link" :to="`/projects/${flagshipProject.slug}`">
              查看旗舰系统详情 →
            </router-link>
          </div>
        </div>
      </div>
    </section>

    <section id="representative-projects" class="value-home-section value-home-projects" aria-labelledby="projects-title">
      <div class="container">
        <div class="value-home-heading">
          <div>
            <p class="section-label">Representative Work</p>
            <h2 id="projects-title">一套钱包平台，一个可信 Market Server</h2>
          </div>
          <p>先展示项目完成后的产品形态，再用当前最强证据说明实现基础；完整边界与验收门放在项目详情页。</p>
        </div>

        <div class="value-home-project-grid">
          <article
            v-for="({ project, action }, index) in representativeProjectCards"
            :key="project.id"
            class="value-home-project"
          >
            <header>
              <span>{{ String(index + 1).padStart(2, '0') }} · {{ projectPortfolioTierLabels[project.portfolioTier] }}</span>
              <strong>{{ projectStageLabels[project.stage] }}</strong>
            </header>
            <h3>{{ project.name }}</h3>
            <dl>
              <div>
                <dt>目标结果</dt>
                <dd>{{ project.targetOutcome }}</dd>
              </div>
              <div>
                <dt>最强证据</dt>
                <dd>{{ project.verifiedEvidence[0] }}</dd>
              </div>
            </dl>
            <footer>
              <time :datetime="project.updatedAt">更新于 {{ project.updatedAt }}</time>
              <a
                v-if="action.kind === 'external'"
                class="value-home-inline-link"
                :href="action.href"
                target="_blank"
                rel="noopener"
              >
                {{ action.label }} ↗
              </a>
              <router-link v-else class="value-home-inline-link" :to="action.to">
                {{ action.label }} →
              </router-link>
            </footer>
          </article>
        </div>

        <router-link class="value-home-projects-more" to="/projects">
          查看工程探索与完整项目图谱 →
        </router-link>
      </div>
    </section>

    <section class="value-home-section value-home-evidence" aria-labelledby="evidence-title">
      <div class="container">
        <div class="value-home-heading">
          <div>
            <p class="section-label">Evidence, Not Claims</p>
            <h2 id="evidence-title">三条可以继续追溯的工程证据</h2>
          </div>
          <p>测试网和本地验收、失败恢复手册、公开交互实验分别证明不同层级的能力，不互相替代。</p>
        </div>

        <div class="value-home-evidence-grid">
          <article v-for="{ record, label, action } in evidenceCards" :key="record.slug">
            <header>
              <span>{{ label }}</span>
              <time :datetime="record.verifiedAt">{{ record.verifiedAt }}</time>
            </header>
            <h3>{{ record.title }}</h3>
            <p>{{ record.summary }}</p>
            <a
              v-if="action.kind === 'external'"
              class="value-home-inline-link"
              :href="action.href"
              target="_blank"
              rel="noopener"
            >
              {{ action.label }} ↗
            </a>
            <router-link v-else class="value-home-inline-link" :to="action.to">
              {{ action.label }} →
            </router-link>
          </article>
        </div>
      </div>
    </section>

    <section id="engineering-judgments" class="value-home-section value-home-latest" aria-labelledby="latest-title">
      <div class="container">
        <div class="value-home-heading">
          <div>
            <p class="section-label">Latest Balance</p>
            <h2 id="latest-title">最近交付、工程文章与行业判断</h2>
          </div>
          <p>交付记录说明做了什么，工程文章沉淀可复用判断，雷达只保留与钱包基础设施相关的最新信号。</p>
        </div>

        <div class="value-home-latest-grid">
          <router-link
            v-if="latestDelivery"
            class="value-home-latest-card"
            :to="`/ai/deliveries/${latestDelivery.slug}`"
          >
            <div>
              <span>最新工程交付</span>
              <time :datetime="latestDelivery.date">{{ latestDelivery.date }}</time>
            </div>
            <h3>{{ latestDelivery.title }}</h3>
            <p>{{ latestDelivery.summary }}</p>
            <strong>查看交付记录 →</strong>
          </router-link>

          <router-link
            v-if="latestEngineeringArticle"
            class="value-home-latest-card"
            :to="`/articles/${latestEngineeringArticle.slug}`"
          >
            <div>
              <span>最新工程文章</span>
              <time :datetime="latestEngineeringArticle.date">{{ latestEngineeringArticle.date }}</time>
            </div>
            <h3>{{ latestEngineeringArticle.title }}</h3>
            <p>{{ latestEngineeringArticle.summary }}</p>
            <strong>阅读工程文章 →</strong>
          </router-link>

          <router-link
            v-if="latestRadar"
            class="value-home-latest-card"
            :to="`/radar/${latestRadar.slug}`"
          >
            <div>
              <span>最新行业雷达</span>
              <time :datetime="latestRadar.date">{{ latestRadar.date }}</time>
            </div>
            <h3>{{ latestRadar.web3Design?.title || latestRadar.title }}</h3>
            <p>{{ latestRadar.summary }}</p>
            <strong>查看行业简报 →</strong>
          </router-link>
        </div>

        <aside class="value-home-ai-strip" aria-labelledby="ai-method-title">
          <div>
            <p class="section-label">AI-assisted Engineering</p>
            <h3 id="ai-method-title">AI 加速工程，但不代替验证</h3>
            <p v-if="primaryAiCase">{{ primaryAiCase.summary }}</p>
          </div>
          <ul aria-label="AI 工程方法">
            <li v-for="outcome in aiEngineeringOutcomes" :key="outcome">{{ outcome }}</li>
          </ul>
          <div class="value-home-ai-links">
            <router-link class="value-home-inline-link" to="/ai">AI 协作案例 →</router-link>
            <router-link class="value-home-inline-link" to="/ai/deliveries">交付记录 →</router-link>
          </div>
        </aside>
      </div>
    </section>

    <section class="value-home-section value-home-contact" aria-labelledby="contact-title">
      <div class="container value-home-contact-inner">
        <p class="section-label">Work, Collaboration & About</p>
        <h2 id="contact-title">正在寻找钱包后端工作与工程合作机会</h2>
        <p>
          如果你正在建设交易所钱包、链上资产服务、多链交易系统或签名基础设施，可以从当前状态、项目证据和公开仓库了解我。
        </p>
        <div class="hero-actions value-home-contact-actions">
          <router-link class="btn btn-primary" to="/now">关于我与当前状态</router-link>
          <a class="btn btn-secondary" :href="githubRepositoriesUrl" target="_blank" rel="noopener">查看 GitHub 仓库</a>
          <a class="btn btn-ghost" :href="githubProfileUrl" target="_blank" rel="noopener">通过 GitHub 联系 ↗</a>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped src="../styles/home.css"></style>
