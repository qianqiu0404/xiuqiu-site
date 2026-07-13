<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { projectSourceLabels, projectStageLabels, projectVisibilityLabels, siteArticlesByNewest, siteKnowledge, siteProjects } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const route = useRoute()
const router = useRouter()
const interviewMode = computed(() => route.query.mode === 'interview')
const primaryProjects = siteProjects.filter(project => project.featured)
const extensionProjects = siteProjects.filter(project => !project.featured)
const engineeringArticles = siteArticlesByNewest.filter(article => article.kind === 'engineering-note').slice(0, 6)
const systemFlow = [
  { name: 'wallet-service', detail: '业务状态、充值提现、余额、幂等、worker 与通知' },
  { name: 'risk-service', detail: '提现内容校验、风控放行、审批哈希与重复请求识别' },
  { name: 'wallet-api', detail: '多链节点查询、链级资源、交易构建与广播' },
  { name: 'wallet-sign', detail: '地址生成、密钥隔离、策略校验与交易签名' },
]
const failureCases = [
  { title: '广播请求超时，但交易可能已经进入节点', handling: '把结果标记为未知，优先按 request_id、raw transaction 或 tx hash 查询，不直接重新构建并发送第二笔。' },
  { title: '链上已经成功，本地状态更新失败', handling: '补偿任务以链上 receipt 或确认数为事实来源，幂等推进提现、账本和通知状态。' },
]
const signerBackends = [
  { name: 'Local Signer', state: '已验证', detail: '当前 wallet-sign 的本地密钥与签名后端，作为接口和策略基线。' },
  { name: 'MPC / TSS', state: '接入中', detail: '独立三节点 Keygen / Sign 已本地验证；正在收敛为 wallet-sign 后端，尚未完成端到端接入。' },
  { name: 'HSM', state: '下一阶段', detail: '计划保持同一签名契约，接入硬件密钥边界与生产级策略能力。' },
]
const interviewProofs = [
  { label: '系统主线', title: 'Exchange Wallet Infrastructure', evidence: '四个服务的代码入口、risk-service 核心单测和关键异常路径已经完成定位与记录。', slug: 'exchange-wallet-system' },
  { label: 'TypeScript 多链', title: 'wallet-core', evidence: '类型检查、构建和多链 Jest 测试可以运行，链级资源输入保持显式。', slug: 'wallet-core' },
  { label: '签名安全', title: 'TSS / MPC', evidence: '独立三节点 Keygen / Sign 已本地验证；wallet-sign 后端接入仍在进行。', slug: 'tss-mpc' },
]

function toggleInterviewMode() {
  void router.replace({ path: '/engineering', query: interviewMode.value ? {} : { mode: 'interview' } })
}

function askEngineering() {
  window.dispatchEvent(new CustomEvent('ai-chat:ask', { detail: { prompt: '请用 3 分钟介绍 xiuqiu 的 Exchange Wallet Infrastructure，并严格区分四个服务边界、已验证事实、当前限制和目标完成形态。', context: { type: 'engineering', title: '工程档案', summary: siteKnowledge.owner.summary } } }))
}

onMounted(() => setSeoMeta({ title: '工程档案｜xiuqiu Web3 钱包后端', description: 'Exchange Wallet Infrastructure、wallet-core、可运行实验以及 TSS/MPC 与数据服务扩展的阶段、证据和目标态。', path: '/engineering' }))
</script>

<template>
  <section class="section page-top engineering-page">
    <div class="container">
      <header class="engineering-header">
        <div><p class="section-label">Engineering Portfolio</p><h1>Web3 钱包后端工程档案</h1><p>这里不按仓库数量展示能力，而是按系统问题组织证据：资金状态如何推进、多链差异如何隔离、签名边界如何保护、失败之后如何恢复。</p></div>
        <div class="engineering-header-actions"><button class="btn btn-primary" type="button" @click="toggleInterviewMode">{{ interviewMode ? '返回完整档案' : '进入面试速览' }}</button><button class="btn btn-secondary" type="button" @click="askEngineering">请 AI 讲解</button></div>
      </header>

      <section class="interview-summary" :class="{ active: interviewMode }">
        <div class="interview-summary-top"><div><p class="section-label">30 秒工程定位</p><h2>以 Exchange Wallet Infrastructure 为主线，用可运行实验和多链库补足验证证据</h2></div><span class="mode-badge">{{ interviewMode ? 'INTERVIEW MODE' : 'QUICK OVERVIEW' }}</span></div>
        <p>wallet-service、risk-service、wallet-api、wallet-sign 分别守住资金编排、风险控制、链交互和签名边界；wallet-core 用 TypeScript 验证多链离线交易；Wallet Engineer Lab 提供轻量可运行闭环。</p>
        <div class="interview-proof-grid"><div><strong>{{ systemFlow.length }} 个</strong><span>服务边界</span></div><div><strong>{{ signerBackends.length }} 种</strong><span>签名后端</span></div><div><strong>{{ failureCases.length }} 个</strong><span>重点异常恢复案例</span></div></div>
      </section>

      <section class="engineering-section">
        <div class="section-heading section-heading-left"><p class="section-label">01 · 系统边界</p><h2 class="section-title">四个服务分别守住一类工程边界</h2></div>
        <div class="system-flow"><template v-for="(step, index) in systemFlow" :key="step.name"><article class="system-step"><span>0{{ index + 1 }}</span><h3>{{ step.name }}</h3><p>{{ step.detail }}</p></article><div v-if="index < systemFlow.length - 1" class="system-arrow">&rarr;</div></template></div>
      </section>

      <section class="engineering-section signer-backend-section">
        <div class="section-heading section-heading-left"><p class="section-label">02 · 签名后端</p><h2 class="section-title">wallet-sign 是稳定边界，后端可以演进</h2><p class="section-desc">Local、MPC/TSS 与 HSM 不是三个平级服务，而是 wallet-sign 后方的不同密钥与签名实现。</p></div>
        <div class="signer-backend-grid"><article v-for="backend in signerBackends" :key="backend.name"><div class="card-status-row"><h3>{{ backend.name }}</h3><strong>{{ backend.state }}</strong></div><p>{{ backend.detail }}</p></article></div>
      </section>

      <section class="engineering-section">
        <div class="section-heading section-heading-left"><p class="section-label">03 · 异常恢复</p><h2 class="section-title">资金系统最值得讲的是结果未知之后怎么办</h2></div>
        <div class="failure-grid"><article v-for="item in failureCases" :key="item.title" class="failure-card"><p class="project-abilities-title">Failure case</p><h3>{{ item.title }}</h3><p>{{ item.handling }}</p></article></div>
      </section>

      <section v-if="interviewMode" class="engineering-section interview-evidence-section">
        <div class="section-heading section-heading-left"><p class="section-label">04 · 核心证据</p><h2 class="section-title">三项可以继续追问的工程证据</h2><p class="section-desc">速览到这里结束。每项证据都能继续进入项目边界、验证方式和当前限制。</p></div>
        <div class="interview-evidence-grid"><router-link v-for="proof in interviewProofs" :key="proof.slug" :to="`/projects/${proof.slug}`"><span>{{ proof.label }}</span><h3>{{ proof.title }}</h3><p>{{ proof.evidence }}</p><strong>查看完整档案 &rarr;</strong></router-link></div>
      </section>

      <section v-if="!interviewMode" class="engineering-section">
        <div class="section-heading section-heading-left"><p class="section-label">04 · 核心案例</p><h2 class="section-title">阶段、证据和目标态放在一起</h2></div>
        <div class="engineering-projects">
          <article v-for="project in primaryProjects" :key="project.id" class="engineering-project evidence-state-card">
            <div class="engineering-project-heading"><div><p class="section-label">{{ project.category }}</p><h3>{{ project.name }}</h3></div><router-link :to="`/projects/${project.slug}`" class="project-link">完整档案 &rarr;</router-link></div>
            <div class="project-state-tags"><span>{{ projectStageLabels[project.stage] }}</span><span>{{ projectSourceLabels[project.sourceType] }}</span><span>{{ projectVisibilityLabels[project.visibility] }}</span></div>
            <p class="engineering-boundary">{{ project.positioning }}</p>
            <div class="engineering-project-columns">
              <div><p class="project-abilities-title">当前重点</p><p>{{ project.currentFocus }}</p></div>
              <div><p class="project-abilities-title">已验证证据</p><ul class="learning-list"><li v-for="item in project.verifiedEvidence" :key="item">{{ item }}</li></ul></div>
              <div><p class="project-abilities-title">目标完成形态</p><p>{{ project.targetOutcome }}</p><p class="next-milestone"><strong>下一里程碑：</strong>{{ project.nextMilestone }}</p></div>
            </div>
          </article>
        </div>
      </section>

      <section v-if="!interviewMode" class="engineering-section">
        <div class="section-heading section-heading-left"><p class="section-label">05 · 扩展探索</p><h2 class="section-title">安全与数据服务补充</h2><p class="section-desc">这些项目帮助扩展系统视野，但不会被包装成已经完成的生产能力。</p></div>
        <div class="extension-project-grid"><router-link v-for="project in extensionProjects" :key="project.id" :to="`/projects/${project.slug}`" class="extension-project-card"><div class="card-status-row"><span>{{ project.category }}</span><strong>{{ projectStageLabels[project.stage] }}</strong></div><h3>{{ project.name }}</h3><p>{{ project.positioning }}</p><small>下一里程碑：{{ project.nextMilestone }}</small></router-link></div>
      </section>

      <section v-if="!interviewMode" class="engineering-section">
        <div class="section-heading section-heading-left"><p class="section-label">06 · 延伸阅读</p><h2 class="section-title">从文章继续复核工程判断</h2></div>
        <div class="article-grid"><router-link v-for="article in engineeringArticles" :key="article.slug" :to="`/articles/${article.slug}`" class="article-card article-card-link"><time class="article-date">{{ article.date }}</time><h3 class="article-title">{{ article.title }}</h3><p class="article-summary">{{ article.summary }}</p></router-link></div>
      </section>
    </div>
  </section>
</template>
