<script setup lang="ts">
import { onMounted } from 'vue'
import AiEngineeringProofRail from '../components/AiEngineeringProofRail.vue'
import {
  githubProfileUrl,
  githubRepositoriesUrl,
  homeAiProofContexts,
  homeAiWorkflow,
  homeSeo,
} from '../data/homePresentation'
import { productPresentations } from '../data/productPresentation'
import { projects, type Project, type ProjectStage } from '../data/generatedProjects'
import { evidenceRecords, type EvidenceRecord } from '../data/generatedEvidence'
import { deliveryRecords } from '../data/generatedDeliveries'
import { setSeoMeta } from '../utils/seo'

interface ProofScene {
  id: 'wallet' | 'market' | 'ai'
  label: string
  date: string
  title: string
  summary: string
  to: string
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

const walletProject = requireProject('wallet-launchpad')
const marketProject = requireProject('s78-market-services')
const walletEvidence = requireEvidence('wallet-launchpad-no-funds-acceptance')
const marketEvidence = requireEvidence('qiu-market-release-artifact')
const featuredAiDelivery = deliveryRecords.find(item => item.slug === 'wallet-reliability-lab-v1')

const productEntries = productPresentations.map(presentation => ({
  presentation,
  project: presentation.slug === walletProject.slug ? walletProject : marketProject,
  evidence: presentation.slug === walletProject.slug ? walletEvidence : marketEvidence,
}))

const proofScenes: ProofScene[] = [
  {
    id: 'wallet',
    label: 'Wallet proof',
    date: walletEvidence.verifiedAt,
    title: walletEvidence.title,
    summary: walletEvidence.summary,
    to: '/projects/wallet-launchpad',
  },
  {
    id: 'market',
    label: 'Market proof',
    date: marketEvidence.verifiedAt,
    title: marketEvidence.title,
    summary: marketEvidence.summary,
    to: '/projects/s78-market-services',
  },
  {
    id: 'ai',
    label: 'AI delivery',
    date: featuredAiDelivery?.date || '',
    title: featuredAiDelivery?.title || 'AI Engineering 交付账本',
    summary: featuredAiDelivery?.summary || 'AI 参与、人工判断、审查纠正和验证结果被记录在同一条交付轨迹中。',
    to: featuredAiDelivery ? `/ai/deliveries/${featuredAiDelivery.slug}` : '/ai/deliveries',
  },
]

function askAi(prompt: string, slug: string) {
  window.dispatchEvent(
    new CustomEvent('ai-chat:ask', {
      detail: {
        prompt,
        context: {
          type: 'home',
          title: 'xiuqiu · Wallet Launchpad × Qiu Market × AI Engineering',
          slug,
          summary: '两个 Web3 产品与一套 AI-native 工程工作流的公开工程叙事。',
        },
      },
    }),
  )
}

onMounted(() => setSeoMeta({ ...homeSeo, path: '/' }))
</script>

<template>
  <div id="overview" class="cinematic-home" lang="zh-CN">
    <section class="cinematic-hero" aria-labelledby="home-title">
      <div class="cinematic-hero-glow" aria-hidden="true"></div>
      <div class="container cinematic-hero-layout">
        <div class="cinematic-hero-copy">
          <p class="cinematic-kicker">xiuqiu / Web3 Products × AI Engineering</p>
          <h1 id="home-title">
            两个 Web3 产品。<br />
            <span>一套证据系统。</span>
          </h1>
          <p class="cinematic-hero-lead">
            Wallet Launchpad 负责资金与签名边界，Qiu Market 负责行情与虚拟交易事实；AI 贯穿需求、实现、审查、测试和知识治理。
          </p>
          <p class="cinematic-boundary">公开工程作品 · 本地与测试网证据 · 不包装成生产钱包或实盘交易经验</p>
          <div class="cinematic-actions" aria-label="直接进入两个项目主页">
            <router-link class="cinematic-button cinematic-button--primary" to="/projects/wallet-launchpad">
              进入 Wallet Platform
            </router-link>
            <router-link class="cinematic-button cinematic-button--quiet" to="/projects/s78-market-services">
              进入 Qiu Market
            </router-link>
          </div>
          <router-link class="cinematic-hero-proof-link" to="/engineering/evidence">检查全部工程证据 →</router-link>
        </div>

        <div class="cinematic-product-index" aria-label="两个产品与 AI 工程系统">
          <div class="cinematic-index-line" aria-hidden="true"></div>
          <router-link to="/projects/wallet-launchpad" class="cinematic-index-product cinematic-index-product--wallet">
            <span>01 / WALLET</span>
            <strong>Control funds.</strong>
            <small>state · risk · sign · recover</small>
          </router-link>
          <router-link to="/projects/s78-market-services" class="cinematic-index-product cinematic-index-product--market">
            <span>02 / MARKET</span>
            <strong>Trust the market.</strong>
            <small>source · ledger · recovery</small>
          </router-link>
          <div class="cinematic-index-core">
            <span>AI ENGINEERING</span>
            <strong>plan → review → verify</strong>
          </div>
        </div>
      </div>
      <a class="cinematic-scroll-cue" href="#products"><span>Choose a product</span><i aria-hidden="true"></i></a>
    </section>

    <section id="products" class="product-premiere" aria-labelledby="products-title">
      <div class="container">
        <header class="product-premiere-heading">
          <p class="cinematic-kicker">Product premiere</p>
          <h2 id="products-title">首页只负责选择产品。<br />产品页负责把系统讲清楚。</h2>
        </header>

        <div class="product-premiere-grid">
          <article
            v-for="entry in productEntries"
            :key="entry.presentation.slug"
            class="product-premiere-panel"
            :class="`product-premiere-panel--${entry.presentation.theme}`"
          >
            <header>
              <span>{{ entry.presentation.index }} / {{ entry.presentation.label }}</span>
              <strong>{{ projectStageLabels[entry.project.stage] }}</strong>
            </header>
            <h3>{{ entry.presentation.shortName }}</h3>
            <p class="product-premiere-promise">{{ entry.presentation.promise }}</p>
            <div class="product-premiere-proof">
              <span>Latest proof · {{ entry.evidence.verifiedAt }}</span>
              <p>{{ entry.evidence.summary }}</p>
            </div>
            <div class="product-premiere-actions">
              <router-link class="product-premiere-primary" :to="`/projects/${entry.project.slug}`">
                进入项目主页 <span aria-hidden="true">↗</span>
              </router-link>
              <router-link
                v-if="entry.presentation.publicAction.role === 'companion'"
                :to="entry.presentation.proofAction.to"
              >
                {{ entry.presentation.proofAction.label }} →
              </router-link>
              <a
                v-else
                :href="entry.presentation.publicAction.href"
                target="_blank"
                rel="noopener"
              >
                {{ entry.presentation.publicAction.label }} ↗
              </a>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section id="ai-engineering" class="home-ai-system" aria-labelledby="ai-title">
      <div class="container home-ai-layout">
        <div class="home-ai-copy">
          <p class="cinematic-kicker">AI Engineering OS</p>
          <h2 id="ai-title">AI 不替我判断。<br />它缩短判断抵达证据的距离。</h2>
          <p>
            两个产品共享同一套协作原则：AI 加速上下文整理、实现与审查，人负责资金边界、事实校准和最终放行。
          </p>
          <div class="home-ai-track" aria-label="AI 工程工作流">
            <span v-for="(step, index) in homeAiWorkflow" :key="step">
              <b>{{ String(index + 1).padStart(2, '0') }}</b>{{ step }}
            </span>
          </div>
          <div v-if="featuredAiDelivery" class="home-ai-delivery">
            <span>Featured delivery · {{ featuredAiDelivery.date }}</span>
            <h3>{{ featuredAiDelivery.title }}</h3>
            <p>{{ featuredAiDelivery.summary }}</p>
            <router-link :to="`/ai/deliveries/${featuredAiDelivery.slug}`">查看审查与纠正记录 ↗</router-link>
          </div>
          <div class="home-ai-actions">
            <router-link to="/ai">进入 AI Engineering OS</router-link>
            <button type="button" @click="askAi('AI 如何参与 Wallet Launchpad 和 Qiu Market 的工程交付？', 'home-ai')">
              Ask xiuqiu AI ↗
            </button>
          </div>
        </div>
        <AiEngineeringProofRail class="home-ai-proof" :context="homeAiProofContexts[2]" compact />
      </div>
    </section>

    <section id="evidence" class="proof-lab" aria-labelledby="evidence-title">
      <div class="container">
        <header class="proof-lab-heading">
          <p class="cinematic-kicker">Proof, not promises</p>
          <h2 id="evidence-title">叙事停在这里。<br />事实继续向下追溯。</h2>
          <p>每个入口只保留一条最新证据；完整测试、失败场景与边界进入独立证据页。</p>
        </header>

        <div class="proof-lab-list">
          <router-link v-for="scene in proofScenes" :key="scene.id" :to="scene.to">
            <span>{{ scene.label }}</span>
            <time :datetime="scene.date">{{ scene.date }}</time>
            <h3>{{ scene.title }}</h3>
            <p>{{ scene.summary }}</p>
            <strong>检查证据 ↗</strong>
          </router-link>
        </div>

        <div class="proof-lab-actions">
          <router-link to="/engineering/evidence">打开 Verification Matrix</router-link>
          <router-link to="/engineering/failures">查看 Failure Playbook</router-link>
          <router-link to="/projects">浏览全部项目</router-link>
        </div>
      </div>
    </section>

    <section class="cinematic-finale" aria-labelledby="finale-title">
      <div class="container cinematic-finale-inner">
        <p class="cinematic-kicker">Designed and engineered by xiuqiu</p>
        <h2 id="finale-title">Web3 是我构建的产品。<br />AI 是我扩展工程判断的方式。</h2>
        <p>从两个产品开始，继续检查真实交付、失败边界与公开代码。</p>
        <div class="cinematic-actions cinematic-finale-actions">
          <router-link class="cinematic-button cinematic-button--primary" to="/projects/wallet-launchpad">Wallet Platform</router-link>
          <a class="cinematic-button cinematic-button--quiet" href="https://qiu-market.vercel.app" target="_blank" rel="noopener">打开 Qiu Market</a>
          <a class="cinematic-text-action" :href="githubRepositoriesUrl" target="_blank" rel="noopener">GitHub 仓库 ↗</a>
        </div>
        <a class="cinematic-profile-link" :href="githubProfileUrl" target="_blank" rel="noopener">github.com/qianqiu0404</a>
      </div>
    </section>
  </div>
</template>

<style scoped src="../styles/home.css"></style>
