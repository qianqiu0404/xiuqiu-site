<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { siteArticlesByNewest, siteKnowledge, siteProjects, type SiteProject } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const route = useRoute()
const router = useRouter()
const interviewMode = computed(() => route.query.mode === 'interview')
const projectOrder = [1, 2, 7, 3, 5]
const projects = computed(() =>
  projectOrder
    .map(id => siteProjects.find(project => project.id === id))
    .filter((project): project is SiteProject => Boolean(project)),
)
const engineeringArticles = siteArticlesByNewest.filter(article => article.kind === 'engineering-note').slice(0, 6)

const systemFlow = [
  { name: 'wallet service', detail: '充值提现状态、余额、幂等、worker 与通知' },
  { name: 'wallet-api', detail: '多链节点查询、交易构建与广播' },
  { name: 'wallet-sign', detail: '地址生成、密钥边界与交易签名' },
]

const failureCases = [
  {
    title: '广播请求超时，但交易可能已经进入节点',
    handling: '把结果标记为未知，优先按 request_id、raw transaction 或 tx hash 查询，不直接重新构建并发送第二笔。',
  },
  {
    title: '链上已经成功，本地状态更新失败',
    handling: '补偿任务以链上 receipt/确认数为事实来源，幂等推进本地提现、账本和通知状态。',
  },
]

function toggleInterviewMode() {
  void router.replace({
    path: '/engineering',
    query: interviewMode.value ? {} : { mode: 'interview' },
  })
}

function askEngineering() {
  window.dispatchEvent(
    new CustomEvent('ai-chat:ask', {
      detail: {
        prompt: '请用 3 分钟介绍 xiuqiu 的交易所钱包工程主线，并区分当前代码事实、已知边界和生产化方向。',
        context: {
          type: 'engineering',
          title: '工程档案',
          summary: siteKnowledge.owner.summary,
        },
      },
    }),
  )
}

onMounted(() => {
  setSeoMeta({
    title: '工程档案｜xiuqiu Web3 钱包后端',
    description: '面向技术面试官的交易所钱包工程档案：三服务架构、项目边界、失败场景和验证证据。',
    path: '/engineering',
  })
})
</script>

<template>
  <section class="section page-top engineering-page">
    <div class="container">
      <header class="engineering-header">
        <div>
          <p class="section-label">Engineering Portfolio</p>
          <h1>Web3 钱包后端工程档案</h1>
          <p>
            重点不是列出技术栈，而是说明资金状态如何推进、多链差异如何隔离、失败之后如何恢复，以及这些判断对应什么代码和验证证据。
          </p>
        </div>
        <div class="engineering-header-actions">
          <button class="btn btn-primary" type="button" @click="toggleInterviewMode">
            {{ interviewMode ? '退出快速模式' : '开启 3 分钟快速模式' }}
          </button>
          <button class="btn btn-secondary" type="button" @click="askEngineering">请 AI 讲解</button>
        </div>
      </header>

      <section class="interview-summary" :class="{ active: interviewMode }">
        <div class="interview-summary-top">
          <div>
            <p class="section-label">30 秒工程定位</p>
            <h2>围绕交易所钱包资金链路，理解 Go 服务边界、多链适配和签名安全</h2>
          </div>
          <span class="mode-badge">{{ interviewMode ? 'INTERVIEW MODE' : 'QUICK OVERVIEW' }}</span>
        </div>
        <p>
          主线项目按 wallet service、wallet-api、wallet-sign 拆分业务状态、链节点能力和私钥能力；`wallet-core` 补充 TypeScript 多链离线交易构建，S78 与 TSS 分别验证数据链路和签名安全理解。
        </p>
        <div class="interview-proof-grid">
          <div><strong>5</strong><span>公开项目</span></div>
          <div><strong>{{ engineeringArticles.length }}+</strong><span>工程证据入口</span></div>
          <div><strong>2</strong><span>重点异常恢复案例</span></div>
        </div>
      </section>

      <section class="engineering-section">
        <div class="section-heading section-heading-left">
          <p class="section-label">01 · 系统边界</p>
          <h2 class="section-title">三服务各自保护一类不变量</h2>
        </div>
        <div class="system-flow">
          <template v-for="(step, index) in systemFlow" :key="step.name">
            <article class="system-step">
              <span>0{{ index + 1 }}</span>
              <h3>{{ step.name }}</h3>
              <p>{{ step.detail }}</p>
            </article>
            <div v-if="index < systemFlow.length - 1" class="system-arrow">&rarr;</div>
          </template>
        </div>
      </section>

      <section class="engineering-section">
        <div class="section-heading section-heading-left">
          <p class="section-label">02 · 异常恢复</p>
          <h2 class="section-title">面试里最值得讲的不是 happy path</h2>
        </div>
        <div class="failure-grid">
          <article v-for="item in failureCases" :key="item.title" class="failure-card">
            <p class="project-abilities-title">Failure case</p>
            <h3>{{ item.title }}</h3>
            <p>{{ item.handling }}</p>
          </article>
        </div>
      </section>

      <section class="engineering-section">
        <div class="section-heading section-heading-left">
          <p class="section-label">03 · 项目证据</p>
          <h2 class="section-title">实现、边界和证据放在同一张卡片里</h2>
        </div>
        <div class="engineering-projects">
          <article v-for="project in projects" :key="project.id" class="engineering-project">
            <div class="engineering-project-heading">
              <div>
                <p class="section-label">{{ project.engineering.role }}</p>
                <h3>{{ project.name }}</h3>
              </div>
              <router-link :to="`/projects/${project.id}`" class="project-link">完整记录 &rarr;</router-link>
            </div>
            <p class="engineering-boundary">{{ project.engineering.systemBoundary }}</p>
            <div class="engineering-project-columns">
              <div>
                <p class="project-abilities-title">关键调用链</p>
                <ol class="numbered-evidence">
                  <li v-for="step in project.engineering.callFlow" :key="step">{{ step }}</li>
                </ol>
              </div>
              <div>
                <p class="project-abilities-title">验证证据</p>
                <ul class="learning-list">
                  <li v-for="item in project.engineering.evidence" :key="item">{{ item }}</li>
                </ul>
              </div>
              <div>
                <p class="project-abilities-title">已知限制</p>
                <ul class="learning-list">
                  <li v-for="item in project.engineering.knownLimits" :key="item">{{ item }}</li>
                </ul>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section class="engineering-section">
        <div class="section-heading section-heading-left">
          <p class="section-label">04 · 延伸阅读</p>
          <h2 class="section-title">从代码入口继续验证工程判断</h2>
        </div>
        <div class="article-grid">
          <router-link
            v-for="article in engineeringArticles"
            :key="article.slug"
            :to="`/articles/${article.slug}`"
            class="article-card article-card-link"
          >
            <time class="article-date">{{ article.date }}</time>
            <h3 class="article-title">{{ article.title }}</h3>
            <p class="article-summary">{{ article.summary }}</p>
          </router-link>
        </div>
      </section>
    </div>
  </section>
</template>
