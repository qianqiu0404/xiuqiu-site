<script setup lang="ts">
import { useRouter } from 'vue-router'
import { projects } from '../data/projects'
import { articles } from '../data/articles'
import { ref } from 'vue'

const router = useRouter()

function scrollTo(id: string) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}

const homeArticles = articles.slice(0, 6)

const capabilities = [
  {
    title: 'Web3 钱包系统能力',
    desc: '围绕多链钱包场景，构建对地址生成、余额查询、交易构建、离线签名、链 RPC 接入和签名机架构的系统理解。',
  },
  {
    title: 'Go 后端工程能力',
    desc: '通过 wallet-api、market-services 等项目，沉淀 HTTP API、gRPC 服务、配置管理、数据库、Redis、服务拆分和数据同步能力。',
  },
  {
    title: '多链签名与链模型理解',
    desc: '对比 BTC、ETH、Solana、Cosmos 等链的地址格式、交易结构、签名流程和账户模型差异，形成多链钱包开发视角。',
  },
  {
    title: 'AI 编程工作流',
    desc: '使用 AI Agent 辅助项目拆解、代码生成、文档整理和 MVP 构建，同时通过 build、diff、测试和复盘控制质量。',
  },
]

const workflowSteps = [
  { step: '01', title: '定位问题', desc: '先明确目标、边界、涉及文件和验收标准，避免为了修改而修改。' },
  { step: '02', title: '小步修改', desc: '优先做最小可行版本，只改必要文件，不做无意义重构。' },
  { step: '03', title: '验证结果', desc: '通过 npm run build、测试命令、diff 和本地预览验证结果。' },
  { step: '04', title: '沉淀表达', desc: '把项目逻辑整理成文章、面试问答和作品集内容，形成长期可复用资产。' },
]

const tags = ['Web3 Wallet', 'Go Backend', 'Multi-chain', 'gRPC', 'Chain RPC', 'AI Coding', 'TypeScript']

function goArticle(slug: string) {
  router.push('/articles/' + slug)
}
</script>

<template>
  <!-- Hero -->
  <section id="hero" class="section hero">
    <div class="container hero-inner">
      <p class="hero-eyebrow">Building Web3 Wallet Infrastructure</p>
      <h1 class="hero-title">xiuqiu</h1>
      <p class="hero-desc">
        我正在构建 Web3 钱包开发、Go 后端服务和 AI 编程工作流，围绕 wallet-api、wallet-sign、market-services
        等项目，持续沉淀多链钱包、签名机、gRPC 服务、链 RPC 接入和后端系统设计能力。
      </p>
      <p class="hero-position">
        从项目实战出发，构建可展示、可复盘、可面试的 Web3 后端作品集。
      </p>
      <div class="hero-tags">
        <span v-for="t in tags" :key="t" class="hero-tag">{{ t }}</span>
      </div>
      <div class="hero-actions">
        <a class="btn btn-primary" href="#" @click.prevent="scrollTo('projects')">查看项目</a>
        <router-link class="btn btn-secondary" to="/articles">阅读文章</router-link>
        <a class="btn btn-ghost" href="https://github.com/qianqiu0404" target="_blank" rel="noopener">GitHub →</a>
      </div>
    </div>
  </section>

  <!-- Capabilities -->
  <section id="capabilities" class="section section-alt">
    <div class="container">
      <div class="section-heading">
        <p class="section-eyebrow">Capabilities</p>
        <h2 class="section-title">我正在构建的能力</h2>
        <p class="section-desc">围绕 Web3 钱包开发，把项目实践、后端工程、链上交互和 AI 编程工作流沉淀成长期能力。</p>
      </div>
      <div class="capability-grid">
        <article v-for="(c, i) in capabilities" :key="i" class="capability-card">
          <span class="capability-number">{{ '0' + (i + 1) }}</span>
          <h3 class="capability-title">{{ c.title }}</h3>
          <p class="capability-desc">{{ c.desc }}</p>
        </article>
      </div>
    </div>
  </section>

  <!-- Projects -->
  <section id="projects" class="section">
    <div class="container">
      <div class="section-heading">
        <p class="section-eyebrow">Projects</p>
        <h2 class="section-title">项目实践</h2>
        <p class="section-desc">这些项目不是简单展示，而是我构建 Web3 钱包开发能力的核心载体。</p>
      </div>
      <div class="project-grid">
        <article v-for="p in projects" :key="p.id" class="project-card">
          <div class="project-top">
            <span class="project-number">{{ '0' + p.id }}</span>
            <span class="project-tag">Web3</span>
          </div>
          <h3 class="project-name">{{ p.name }}</h3>
          <p class="project-role">{{ p.positioning }}</p>
          <div class="project-block">
            <h4 class="project-block-title">核心能力</h4>
            <ul class="project-block-list">
              <li v-for="a in p.coreAbilities" :key="a">{{ a }}</li>
            </ul>
          </div>
          <details class="project-details">
            <summary>可讲解点</summary>
            <ul>
              <li v-for="t in p.talkingPoints" :key="t">{{ t }}</li>
            </ul>
          </details>
          <div class="project-tech">
            <span v-for="t in p.techStack" :key="t" class="tech-tag">{{ t }}</span>
          </div>
          <a :href="p.github" class="project-link" target="_blank" rel="noopener">GitHub ↗</a>
        </article>
      </div>
    </div>
  </section>

  <!-- Articles Preview -->
  <section id="articles" class="section section-alt">
    <div class="container">
      <div class="section-heading">
        <p class="section-eyebrow">Articles</p>
        <h2 class="section-title">技术文章</h2>
        <p class="section-desc">文章用于沉淀项目拆解、系统理解和面试表达，不做碎片化记录。</p>
      </div>
      <div class="article-grid">
        <article v-for="a in homeArticles" :key="a.id" class="article-card article-card-link" @click="goArticle(a.slug)">
          <time class="article-date">{{ a.date }}</time>
          <h3 class="article-title">{{ a.title }}</h3>
          <p class="article-summary">{{ a.summary }}</p>
          <div class="article-meta">
            <span class="meta-tag">{{ a.difficulty }}</span>
            <span class="meta-reading">{{ a.readingTime }}</span>
          </div>
          <div class="article-tags">
            <span v-for="tag in a.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </article>
      </div>
      <div class="section-footer-link">
        <router-link to="/articles" class="btn btn-secondary">查看全部文章 →</router-link>
      </div>
    </div>
  </section>

  <!-- Workflow -->
  <section id="workflow" class="section">
    <div class="container">
      <div class="section-heading">
        <p class="section-eyebrow">Workflow</p>
        <h2 class="section-title">我的构建工作流</h2>
        <p class="section-desc">我使用 AI Agent 提升构建效率，但所有输出都通过运行、验证和复盘回到自己的理解中。</p>
      </div>
      <div class="workflow-grid">
        <div v-for="w in workflowSteps" :key="w.step" class="workflow-step">
          <span class="workflow-number">{{ w.step }}</span>
          <h3 class="workflow-title">{{ w.title }}</h3>
          <p class="workflow-desc">{{ w.desc }}</p>
        </div>
      </div>
    </div>
  </section>

  <!-- About -->
  <section id="about" class="section section-alt">
    <div class="container about-inner">
      <div class="section-heading">
        <p class="section-eyebrow">About Me</p>
        <h2 class="section-title">关于我</h2>
      </div>
      <div class="about-content">
        <p class="about-lead">我专注于 Web3 钱包开发、Go 后端服务和 AI 编程工作流。</p>
        <p>我的核心方向不是简单堆技术名词，而是围绕真实项目建立系统能力：一个 API 如何被调用，一个 gRPC 服务如何启动，一个签名机为什么要独立，一个钱包后端如何对接不同公链节点。</p>
        <p>目前我正在围绕 wallet-api、wallet-sign、market-services 等项目构建自己的 Web3 后端作品集，把项目实践整理成文章、架构理解、面试表达和可展示成果。</p>
        <p>我希望这个网站长期作为我的技术主页，持续沉淀项目、文章和 AI 编程实践。</p>
        <div class="about-stack">
          <span v-for="s in ['Go','TypeScript','Vue','gRPC','HTTP','PostgreSQL','Redis','Web3 RPC','BTC','ETH','Solana','Cosmos']" :key="s" class="tag">{{ s }}</span>
        </div>
      </div>
    </div>
  </section>

  <!-- Contact -->
  <section id="contact" class="section">
    <div class="container contact-inner">
      <div class="section-heading">
        <p class="section-eyebrow">Contact</p>
        <h2 class="section-title">联系我</h2>
        <p class="section-desc contact-desc">如果你想了解我的项目拆解、Web3 钱包开发实践、AI 编程工作流，或者查看我的持续构建记录，可以通过 GitHub 或 Email 联系我。</p>
      </div>
      <div class="contact-links">
        <a href="https://github.com/qianqiu0404" target="_blank" rel="noopener" class="contact-item">
          <span class="contact-label">GitHub</span>
          <span class="contact-value">qianqiu0404</span>
        </a>
        <a href="mailto:qianqiuquq@gmail.com" class="contact-item">
          <span class="contact-label">Email</span>
          <span class="contact-value">qianqiuquq@gmail.com</span>
        </a>
      </div>
    </div>
  </section>
</template>
