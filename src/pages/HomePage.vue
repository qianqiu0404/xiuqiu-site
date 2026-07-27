<script setup lang="ts">
import { onMounted } from 'vue'
import {
  aiEngineeringOutcomes,
  githubProfileUrl,
  githubRepositoriesUrl,
  homeCapabilities,
  homeProofMethods,
  homeServiceFlow,
  walletLabUrl,
} from '../data/homePresentation'
import {
  latestRadar,
  projectPortfolioTierLabels,
  projectStageLabels,
  siteAiCases,
  siteArticlesByNewest,
  siteDeliveryRecords,
  siteProjects,
  type SiteProject,
} from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const representativeOrder = [
  'exchange-wallet-system',
  'wallet-reliability-lab',
  'wallet-core',
  's78-market-services',
]
const explorationOrder = ['tss-mpc', 'stableflow', 'risk-server']

function projectsInOrder(slugs: string[]): SiteProject[] {
  return siteProjects
    .filter(project => slugs.includes(project.slug))
    .sort((a, b) => slugs.indexOf(a.slug) - slugs.indexOf(b.slug))
}

const flagshipProject = siteProjects.find(project => project.portfolioTier === 'flagship')!
const representativeProjects = projectsInOrder(representativeOrder)
const explorationProjects = projectsInOrder(explorationOrder)
const primaryAiCase = siteAiCases.find(aiCase => aiCase.slug === 'ai-coding-collaboration')
const latestDelivery = siteDeliveryRecords[0]
const latestEngineeringArticle = siteArticlesByNewest.find(article => article.kind === 'engineering-note')

function projectAction(project: SiteProject) {
  if (project.slug === 'wallet-reliability-lab') {
    return { label: '运行在线实验', href: walletLabUrl }
  }
  return { label: '查看项目详情', to: `/projects/${project.slug}` }
}

onMounted(() =>
  setSeoMeta({
    title: 'xiuqiu｜Web3 钱包后端与多链基础设施工程',
    description:
      '专注交易所钱包充值、提现、资金状态、多链交易、签名安全与异常恢复，通过可运行项目、源码、测试和工程证据展示 Web3 钱包后端能力。',
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
      </div>
    </section>

    <section id="capabilities" class="value-home-section value-home-capabilities" aria-labelledby="capabilities-title">
      <div class="container">
        <div class="value-home-heading">
          <div>
            <p class="section-label">Problems I Can Help Solve</p>
            <h2 id="capabilities-title">我能参与解决的工程问题</h2>
          </div>
          <p>先从资金结果和系统风险出发，再选择适合不同链、不同信任边界的工程实现。</p>
        </div>

        <div class="value-home-capability-grid">
          <article
            v-for="(capability, index) in homeCapabilities"
            :key="capability.id"
            class="value-home-capability"
          >
            <span class="value-home-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <h3>{{ capability.title }}</h3>
            <p>{{ capability.description }}</p>
            <ul aria-label="相关工程能力">
              <li v-for="tag in capability.tags" :key="tag">{{ tag }}</li>
            </ul>
          </article>
        </div>
      </div>
    </section>

    <section class="value-home-section value-home-flagship" aria-labelledby="flagship-title">
      <div class="container">
        <div class="value-home-heading">
          <div>
            <p class="section-label">Flagship System</p>
            <h2 id="flagship-title">一笔提现如何安全地走完完整生命周期</h2>
          </div>
          <p>
            从业务请求、风险校验、链上资源获取、交易构建和独立签名，到广播、确认、账务更新与通知，每个阶段都需要明确状态、责任边界和恢复策略。
          </p>
        </div>

        <ol class="value-home-service-flow" aria-label="Exchange Wallet Infrastructure 四服务调用链">
          <li v-for="(service, index) in homeServiceFlow" :key="service.name">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <h3>{{ service.name }}</h3>
            <p>{{ service.description }}</p>
          </li>
        </ol>

        <div class="value-home-system-proof">
          <p class="section-label">这个系统正在证明什么</p>
          <p>
            一笔提现如何经过风险校验、交易构建、独立签名和链上广播，并在结果未知或局部失败时安全恢复。
          </p>
        </div>

        <dl class="value-home-status">
          <div>
            <dt>当前阶段</dt>
            <dd>{{ projectStageLabels[flagshipProject.stage] }}</dd>
          </div>
          <div>
            <dt>最近验证</dt>
            <dd>{{ flagshipProject.verifiedEvidence[0] }}</dd>
          </div>
          <div>
            <dt>下一里程碑</dt>
            <dd>{{ flagshipProject.nextMilestone }}</dd>
          </div>
        </dl>

        <router-link class="value-home-inline-link" :to="`/projects/${flagshipProject.slug}`">
          查看 {{ flagshipProject.name }} 档案 →
        </router-link>
      </div>
    </section>

    <section class="value-home-section value-home-proof" aria-labelledby="proof-title">
      <div class="container">
        <div class="value-home-heading">
          <div>
            <p class="section-label">Evidence, Not Claims</p>
            <h2 id="proof-title">不只展示架构，也展示证据</h2>
          </div>
          <p>完成的定义不是文档写完，而是访问者能够从判断继续追到运行结果、代码入口、测试和已知边界。</p>
        </div>

        <div class="value-home-proof-list">
          <article v-for="(proof, index) in homeProofMethods" :key="proof.id">
            <span class="value-home-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <h3>{{ proof.title }}</h3>
            <p>{{ proof.description }}</p>
            <a
              v-if="proof.href"
              :href="proof.href"
              target="_blank"
              rel="noopener"
              class="value-home-inline-link"
            >
              {{ proof.linkLabel }} ↗
            </a>
            <router-link v-else class="value-home-inline-link" :to="proof.to!">
              {{ proof.linkLabel }} →
            </router-link>
          </article>
        </div>

        <div class="hero-actions value-home-proof-actions">
          <router-link class="btn btn-primary" to="/engineering/evidence">进入工程证据</router-link>
          <a class="btn btn-secondary" :href="walletLabUrl" target="_blank" rel="noopener">运行 Wallet Lab</a>
          <a class="btn btn-ghost" :href="githubRepositoriesUrl" target="_blank" rel="noopener">查看 GitHub</a>
        </div>
      </div>
    </section>

    <section id="representative-projects" class="value-home-section value-home-projects" aria-labelledby="projects-title">
      <div class="container">
        <div class="value-home-heading">
          <div>
            <p class="section-label">Representative Work</p>
            <h2 id="projects-title">从工程问题到可复核结果</h2>
          </div>
          <p>每个代表项目同时说明目标、当前证据和限制；工程探索单独分组，不与已经形成证据的作品混为一谈。</p>
        </div>

        <div class="value-home-project-grid">
          <article v-for="(project, index) in representativeProjects" :key="project.id" class="value-home-project">
            <header>
              <span>{{ String(index + 1).padStart(2, '0') }} · {{ projectPortfolioTierLabels[project.portfolioTier] }}</span>
              <strong>{{ projectStageLabels[project.stage] }}</strong>
            </header>
            <h3>{{ project.name }}</h3>
            <dl>
              <div>
                <dt>解决的问题</dt>
                <dd>{{ project.positioning }}</dd>
              </div>
              <div>
                <dt>目标结果</dt>
                <dd>{{ project.targetOutcome }}</dd>
              </div>
              <div>
                <dt>当前证据</dt>
                <dd>{{ project.verifiedEvidence[0] }}</dd>
              </div>
              <div>
                <dt>已知边界</dt>
                <dd>{{ project.knownLimits[0] }}</dd>
              </div>
              <div>
                <dt>下一里程碑</dt>
                <dd>{{ project.nextMilestone }}</dd>
              </div>
            </dl>
            <a
              v-if="projectAction(project).href"
              class="value-home-inline-link"
              :href="projectAction(project).href"
              target="_blank"
              rel="noopener"
            >
              {{ projectAction(project).label }} ↗
            </a>
            <router-link v-else class="value-home-inline-link" :to="projectAction(project).to!">
              {{ projectAction(project).label }} →
            </router-link>
          </article>
        </div>

        <div class="value-home-explorations">
          <div class="value-home-exploration-heading">
            <div>
              <p class="section-label">Engineering Explorations</p>
              <h3>工程探索 · 当前只陈述已经验证到哪一步</h3>
            </div>
            <router-link class="value-home-inline-link" to="/projects">查看完整项目图谱 →</router-link>
          </div>

          <router-link
            v-for="project in explorationProjects"
            :key="project.id"
            class="value-home-exploration"
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

    <section class="value-home-section value-home-ai" aria-labelledby="ai-title">
      <div class="container value-home-ai-grid">
        <div>
          <p class="section-label">AI-assisted Engineering</p>
          <h2 id="ai-title">用 AI 加速工程，但不让 AI 代替验证</h2>
          <p class="value-home-ai-lead">
            我使用 AI 拆解需求、规划实现、审查代码、整理测试、维护知识和复盘失败；最终结论仍然需要回到源码、运行结果和测试证据。
          </p>
          <p v-if="primaryAiCase" class="value-home-ai-evidence">
            <strong>当前案例：</strong>{{ primaryAiCase.summary }}
          </p>
          <div class="hero-actions value-home-ai-actions">
            <router-link class="btn btn-primary" to="/ai">查看 AI 协作案例</router-link>
            <router-link class="btn btn-secondary" to="/ai/deliveries">查看最新交付记录</router-link>
          </div>
        </div>

        <ul class="value-home-ai-outcomes" aria-label="AI 协作能够支持的工程结果">
          <li v-for="(outcome, index) in aiEngineeringOutcomes" :key="outcome">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <strong>{{ outcome }}</strong>
          </li>
        </ul>
      </div>
    </section>

    <section id="engineering-judgments" class="value-home-section value-home-judgments" aria-labelledby="judgments-title">
      <div class="container">
        <div class="value-home-heading">
          <div>
            <p class="section-label">Engineering Judgments</p>
            <h2 id="judgments-title">我正在形成的工程判断</h2>
          </div>
          <p>项目证明我能做什么，文章和雷达说明我如何理解行业变化、系统设计和工程取舍。</p>
        </div>

        <div class="value-home-judgment-grid">
          <router-link
            v-if="latestDelivery"
            class="value-home-judgment"
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
            v-if="latestRadar"
            class="value-home-judgment"
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

          <router-link
            v-if="latestEngineeringArticle"
            class="value-home-judgment"
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
        </div>
      </div>
    </section>

    <section class="value-home-section value-home-contact" aria-labelledby="contact-title">
      <div class="container value-home-contact-inner">
        <p class="section-label">Work & Collaboration</p>
        <h2 id="contact-title">正在寻找钱包后端工作与工程合作机会</h2>
        <p>
          如果你正在建设交易所钱包、链上资产服务、多链交易系统或签名基础设施，可以从代表项目和工程证据开始了解我。
        </p>
        <div class="hero-actions value-home-contact-actions">
          <router-link class="btn btn-primary" to="/projects">查看代表项目</router-link>
          <a class="btn btn-secondary" :href="githubRepositoriesUrl" target="_blank" rel="noopener">查看 GitHub</a>
          <a class="btn btn-ghost" :href="githubProfileUrl" target="_blank" rel="noopener">通过 GitHub 联系 ↗</a>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped src="../styles/home.css"></style>
