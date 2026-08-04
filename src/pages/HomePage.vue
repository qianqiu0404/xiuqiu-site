<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AiEngineeringProofRail from '../components/AiEngineeringProofRail.vue'
import {
  githubProfileUrl,
  githubRepositoriesUrl,
  homeAiProofContexts,
  homeAiWorkflow,
  homeCapabilities,
  homeSeo,
  homeServiceFlow,
  type HomeStoryId,
} from '../data/homePresentation'
import { projects, type Project, type ProjectStage } from '../data/generatedProjects'
import { evidenceRecords, type EvidenceRecord } from '../data/generatedEvidence'
import { aiCases } from '../data/generatedAiCases'
import { deliveryRecords } from '../data/generatedDeliveries'
import { setSeoMeta } from '../utils/seo'

interface ProofScene {
  id: HomeStoryId
  label: string
  date: string
  title: string
  summary: string
  to: string
  linkLabel: string
}

const projectStageLabels: Record<ProjectStage, string> = {
  exploring: '探索中',
  building: '实现中',
  'verified-local': '本地已验证',
  'showcase-ready': '可展示',
}

const projectsBySlug = new Map(projects.map(project => [project.slug, project]))
const evidenceBySlug = new Map(evidenceRecords.map(record => [record.slug, record]))

function requireProject(slug: string): Project {
  const project = projectsBySlug.get(slug)
  if (!project) throw new Error(`Homepage references missing project: ${slug}`)
  return project
}

function requireEvidence(slug: string): EvidenceRecord {
  const record = evidenceBySlug.get(slug)
  if (!record) throw new Error(`Homepage references missing evidence: ${slug}`)
  return record
}

const exchangeProject = requireProject('exchange-wallet-system')
const launchpadProject = requireProject('wallet-launchpad')
const walletLabProject = requireProject('wallet-reliability-lab')
const marketProject = requireProject('s78-market-services')
const walletEvidence = requireEvidence('wallet-launchpad-no-funds-acceptance')
const marketEvidence = requireEvidence('qiu-market-release-artifact')
const aiCase = aiCases.find(item => item.slug === 'ai-coding-collaboration')
const featuredAiDelivery = deliveryRecords.find(item => item.slug === 'wallet-reliability-lab-v1')

const proofScenes: ProofScene[] = [
  {
    id: 'wallet',
    label: 'Wallet evidence',
    date: walletEvidence.verifiedAt,
    title: walletEvidence.title,
    summary: walletEvidence.summary,
    to: '/engineering/evidence',
    linkLabel: '检查钱包证据',
  },
  {
    id: 'market',
    label: 'Market evidence',
    date: marketEvidence.verifiedAt,
    title: marketEvidence.title,
    summary: marketEvidence.summary,
    to: '/engineering/evidence',
    linkLabel: '检查 Market 证据',
  },
  {
    id: 'ai',
    label: 'AI delivery',
    date: featuredAiDelivery?.date || aiCase?.updatedAt || '',
    title: featuredAiDelivery?.title || aiCase?.title || 'AI Coding 协作',
    summary: featuredAiDelivery?.summary || aiCase?.summary || '',
    to: featuredAiDelivery ? `/ai/deliveries/${featuredAiDelivery.slug}` : '/ai',
    linkLabel: '检查 AI 交付',
  },
]

const activeStory = ref<HomeStoryId>('wallet')
const activeProofContext = computed(
  () => homeAiProofContexts.find(context => context.id === activeStory.value) || homeAiProofContexts[0],
)
let storyObserver: IntersectionObserver | null = null

function askAi(prompt: string, slug: string) {
  window.dispatchEvent(
    new CustomEvent('ai-chat:ask', {
      detail: {
        prompt,
        context: {
          type: 'home',
          title: 'xiuqiu · Web3 Systems × AI Engineering',
          slug,
          summary: 'Wallet Platform、Market Server 与 AI-native Engineering 的公开工程叙事。',
        },
      },
    }),
  )
}

onMounted(() => {
  setSeoMeta({ ...homeSeo, path: '/' })

  const storySections = document.querySelectorAll<HTMLElement>('[data-proof-context]')
  storyObserver = new IntersectionObserver(
    entries => {
      const visibleEntry = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      const context = visibleEntry?.target.getAttribute('data-proof-context') as HomeStoryId | null
      if (context && context !== activeStory.value) activeStory.value = context
    },
    {
      rootMargin: '-28% 0px -48% 0px',
      threshold: [0.12, 0.3, 0.55],
    },
  )
  storySections.forEach(section => storyObserver?.observe(section))
})

onBeforeUnmount(() => storyObserver?.disconnect())
</script>

<template>
  <div id="overview" class="cinematic-home" lang="zh-CN">
    <section class="cinematic-hero" aria-labelledby="home-title">
      <div class="cinematic-hero-glow" aria-hidden="true"></div>
      <div class="container cinematic-hero-layout">
        <div class="cinematic-hero-copy">
          <p class="cinematic-kicker">xiuqiu / Web3 Systems × AI Engineering</p>
          <h1 id="home-title">
            让资金系统更可靠。<br />
            <span>让工程判断更快抵达证据。</span>
          </h1>
          <p class="cinematic-hero-lead">
            我构建 Wallet Platform 与可信 Market Server，也将 AI 深度嵌入需求拆解、实现、审查、测试、文档和知识治理。
          </p>
          <p class="cinematic-boundary">
            公开工程作品 · 本地与测试网证据 · 不包装成生产钱包运营经验
          </p>
          <div class="cinematic-actions">
            <a class="cinematic-button cinematic-button--primary" href="#wallet">观看系统如何工作</a>
            <router-link class="cinematic-button cinematic-button--quiet" to="/engineering/evidence">
              检查工程证据
            </router-link>
          </div>
        </div>

        <div class="cinematic-system-object" role="img" aria-label="Wallet、Market 与 AI Engineering 围绕 xiuqiu 工程核心协作">
          <div class="cinematic-orbit cinematic-orbit--outer" aria-hidden="true"></div>
          <div class="cinematic-orbit cinematic-orbit--middle" aria-hidden="true"></div>
          <div class="cinematic-orbit cinematic-orbit--inner" aria-hidden="true"></div>
          <div class="cinematic-core">
            <small>ENGINEERING CORE</small>
            <strong>xiuqiu</strong>
            <span>Evidence decides</span>
          </div>
          <div class="cinematic-node cinematic-node--wallet">
            <span>01</span>
            <strong>Wallet</strong>
            <small>state · sign · recover</small>
          </div>
          <div class="cinematic-node cinematic-node--market">
            <span>02</span>
            <strong>Market</strong>
            <small>source · ledger · truth</small>
          </div>
          <div class="cinematic-node cinematic-node--ai">
            <span>∞</span>
            <strong>AI Engineering</strong>
            <small>plan · review · verify</small>
          </div>
          <div class="cinematic-signal cinematic-signal--one" aria-hidden="true"></div>
          <div class="cinematic-signal cinematic-signal--two" aria-hidden="true"></div>
        </div>
      </div>
      <a class="cinematic-scroll-cue" href="#wallet">
        <span>Enter the system</span>
        <i aria-hidden="true"></i>
      </a>
    </section>

    <div class="cinematic-story-shell">
      <div class="cinematic-story-chapters">
        <section id="wallet" class="cinematic-chapter cinematic-chapter--wallet" data-proof-context="wallet" aria-labelledby="wallet-title">
          <div class="cinematic-chapter-intro">
            <p class="cinematic-kicker">Act I · Wallet Platform</p>
            <h2 id="wallet-title">一笔提现，穿过四个彼此隔离的信任边界。</h2>
            <p>
              从资金状态出发，让风险、链上资源与签名权限各自拥有清晰边界；任何结果未知都沿原交易身份恢复，而不是重新制造一笔交易。
            </p>
          </div>

          <div class="wallet-lifecycle-stage">
            <header>
              <div>
                <span>Exchange Wallet Infrastructure</span>
                <strong>{{ projectStageLabels[exchangeProject.stage] }}</strong>
              </div>
              <time :datetime="exchangeProject.updatedAt">{{ exchangeProject.updatedAt }}</time>
            </header>
            <ol aria-label="提现完整生命周期">
              <li v-for="(service, index) in homeServiceFlow" :key="service.name">
                <span>{{ String(index + 1).padStart(2, '0') }}</span>
                <div>
                  <h3>{{ service.name }}</h3>
                  <p>{{ service.description }}</p>
                </div>
              </li>
            </ol>
            <footer>
              <p>{{ exchangeProject.verifiedEvidence[0] }}</p>
              <router-link :to="`/projects/${exchangeProject.slug}`">进入系统档案 ↗</router-link>
            </footer>
          </div>

          <div class="cinematic-capability-line" aria-label="Wallet Platform 四类能力">
            <div v-for="(capability, index) in homeCapabilities" :key="capability.id">
              <span>0{{ index + 1 }}</span>
              <strong>{{ capability.title }}</strong>
              <small>{{ capability.tags.slice(0, 3).join(' · ') }}</small>
            </div>
          </div>

          <div class="cinematic-product-pair">
            <router-link class="cinematic-product-panel" :to="`/projects/${launchpadProject.slug}`">
              <span>Control plane</span>
              <h3>{{ launchpadProject.name }}</h3>
              <p>{{ launchpadProject.positioning }}</p>
              <small>{{ projectStageLabels[launchpadProject.stage] }} · 查看产品形态 ↗</small>
            </router-link>
            <a class="cinematic-product-panel" href="https://wallet-reliability-lab.vercel.app" target="_blank" rel="noopener">
              <span>Public experiment</span>
              <h3>{{ walletLabProject.name }}</h3>
              <p>{{ walletLabProject.positioning }}</p>
              <small>{{ projectStageLabels[walletLabProject.stage] }} · 运行实验 ↗</small>
            </a>
          </div>

          <AiEngineeringProofRail class="cinematic-proof-inline" :context="homeAiProofContexts[0]" compact />
        </section>

        <section id="market" class="cinematic-chapter cinematic-chapter--market" data-proof-context="market" aria-labelledby="market-title">
          <div class="cinematic-chapter-intro">
            <p class="cinematic-kicker">Act II · Market Server</p>
            <h2 id="market-title">市场数据不是价格列表。它是一层可信事实。</h2>
            <p>
              将来源、新鲜度、降级状态、虚拟交易、账本和恢复放入同一条可解释链路，让上层系统知道数据从哪里来、是否仍可信。
            </p>
          </div>

          <div class="market-stage">
            <div class="market-stage-header">
              <div>
                <span>Qiu Market Server</span>
                <strong>{{ projectStageLabels[marketProject.stage] }}</strong>
              </div>
              <time :datetime="marketProject.updatedAt">{{ marketProject.updatedAt }}</time>
            </div>
            <div class="market-signal-board" aria-label="Market Server 事实流">
              <div class="market-source-column">
                <span>Sources</span>
                <strong>CEX</strong>
                <strong>Perp</strong>
                <strong>AMM</strong>
              </div>
              <div class="market-pulse" aria-hidden="true">
                <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
              </div>
              <div class="market-truth-column">
                <span>Truth layer</span>
                <strong>freshness</strong>
                <strong>degraded</strong>
                <strong>recovery</strong>
              </div>
            </div>
            <div class="market-flow">
              <span v-for="(step, index) in marketProject.engineering.callFlow.slice(0, 5)" :key="step">
                <b>0{{ index + 1 }}</b>{{ step }}
              </span>
            </div>
            <div class="market-stage-proof">
              <p>{{ marketProject.verifiedEvidence[0] }}</p>
              <router-link :to="`/projects/${marketProject.slug}`">查看 Market Server ↗</router-link>
            </div>
          </div>

          <AiEngineeringProofRail class="cinematic-proof-inline" :context="homeAiProofContexts[1]" compact />
        </section>

        <section id="ai-engineering" class="cinematic-chapter cinematic-chapter--ai" data-proof-context="ai" aria-labelledby="ai-title">
          <div class="cinematic-chapter-intro">
            <p class="cinematic-kicker">Act III · AI Engineering System</p>
            <h2 id="ai-title">AI 不替我判断。它让每一次判断更快进入验证。</h2>
            <p v-if="aiCase">{{ aiCase.summary }}</p>
          </div>

          <div class="ai-workflow-stage">
            <div class="ai-workflow-track" aria-label="AI 工程工作流">
              <div v-for="(step, index) in homeAiWorkflow" :key="step">
                <span>{{ String(index + 1).padStart(2, '0') }}</span>
                <strong>{{ step }}</strong>
              </div>
            </div>
            <div class="ai-workflow-split">
              <div>
                <span class="ai-workflow-label">What AI accelerates</span>
                <ul>
                  <li v-for="item in aiCase?.responsibilities.slice(1, 2)" :key="item">{{ item }}</li>
                  <li v-for="item in featuredAiDelivery?.aiContribution.slice(0, 2)" :key="item">{{ item }}</li>
                </ul>
              </div>
              <div>
                <span class="ai-workflow-label">What remains human</span>
                <ul>
                  <li v-for="item in aiCase?.responsibilities.slice(0, 1)" :key="item">{{ item }}</li>
                  <li v-for="item in featuredAiDelivery?.humanDecisions.slice(0, 2)" :key="item">{{ item }}</li>
                </ul>
              </div>
            </div>
            <div v-if="featuredAiDelivery" class="ai-delivery-feature">
              <div>
                <span>Featured real delivery · {{ featuredAiDelivery.date }}</span>
                <h3>{{ featuredAiDelivery.title }}</h3>
                <p>{{ featuredAiDelivery.summary }}</p>
              </div>
              <router-link :to="`/ai/deliveries/${featuredAiDelivery.slug}`">查看审查与纠正记录 ↗</router-link>
            </div>
            <button class="ai-workflow-ask" type="button" @click="askAi(homeAiProofContexts[2].assistantPrompt, 'home-ai')">
              Ask xiuqiu AI <span aria-hidden="true">↗</span>
            </button>
          </div>

          <AiEngineeringProofRail class="cinematic-proof-inline" :context="homeAiProofContexts[2]" compact />
        </section>
      </div>

      <aside class="cinematic-proof-sticky" aria-label="随章节变化的 AI 工程证据">
        <Transition name="proof-shift" mode="out-in">
          <AiEngineeringProofRail :key="activeProofContext.id" :context="activeProofContext" />
        </Transition>
      </aside>
    </div>

    <section id="evidence" class="proof-lab" aria-labelledby="evidence-title">
      <div class="container">
        <div class="proof-lab-heading">
          <p class="cinematic-kicker">Proof, not promises</p>
          <h2 id="evidence-title">漂亮的叙事之后，只留下可以继续追溯的事实。</h2>
          <p>Wallet、Market 与 AI 分别使用自己的证据层级；本地、测试网、虚拟资金和生产验收不互相替代。</p>
        </div>

        <div class="proof-lab-grid">
          <router-link v-for="scene in proofScenes" :key="scene.id" class="proof-lab-item" :to="scene.to">
            <header>
              <span>{{ scene.label }}</span>
              <time :datetime="scene.date">{{ scene.date }}</time>
            </header>
            <h3>{{ scene.title }}</h3>
            <p>{{ scene.summary }}</p>
            <strong>{{ scene.linkLabel }} ↗</strong>
          </router-link>
        </div>

        <nav class="proof-lab-paths" aria-label="完整工程验证路径">
          <span>Verification paths</span>
          <router-link to="/projects">项目图谱</router-link>
          <router-link to="/engineering/evidence">自动化测试</router-link>
          <router-link to="/engineering/failures">失败恢复</router-link>
          <router-link to="/ai/deliveries">AI 交付</router-link>
          <router-link to="/radar">工程研究</router-link>
        </nav>
      </div>
    </section>

    <section class="cinematic-finale" aria-labelledby="finale-title">
      <div class="container cinematic-finale-inner">
        <p class="cinematic-kicker">Designed and engineered by xiuqiu</p>
        <h2 id="finale-title">Web3 是我构建的系统。<br />AI 是我放大工程判断的方式。</h2>
        <div class="cinematic-principles">
          <span>Recovery-first</span>
          <span>Evidence-driven</span>
          <span>Security boundaries</span>
          <span>AI-assisted · Human-verified</span>
        </div>
        <p>
          如果你正在建设交易所钱包、链上资产服务、市场事实层或 AI-native 工程工作流，可以从项目、证据和真实交付开始了解我。
        </p>
        <div class="cinematic-actions cinematic-finale-actions">
          <router-link class="cinematic-button cinematic-button--primary" to="/projects">查看完整项目</router-link>
          <a class="cinematic-button cinematic-button--quiet" :href="githubRepositoriesUrl" target="_blank" rel="noopener">GitHub 仓库</a>
          <button class="cinematic-text-action" type="button" @click="askAi('介绍 xiuqiu 的 Wallet、Market 与 AI Engineering 能力和证据。', 'home-finale')">
            Ask xiuqiu AI ↗
          </button>
        </div>
        <a class="cinematic-profile-link" :href="githubProfileUrl" target="_blank" rel="noopener">github.com/qianqiu0404</a>
      </div>
    </section>
  </div>
</template>

<style scoped src="../styles/home.css"></style>
