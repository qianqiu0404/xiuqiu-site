<script setup lang="ts">
import { useRouter } from 'vue-router'
import { projects } from '../data/projects'
import { articles } from '../data/articles'

const router = useRouter()

function scrollTo(id: string) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}

const homeArticles = articles.slice(0, 6)

const highlights = [
  {
    title: 'Multi-chain Wallet API',
    desc: 'Backend API design for wallet services, chain RPC access, transaction construction, and service boundaries.',
  },
  {
    title: 'Signer Service Boundary',
    desc: 'Signer service design around private-key isolation, offline signing, multi-chain transaction models, and security boundaries.',
  },
  {
    title: 'Go Market Service',
    desc: 'Go backend service with HTTP/gRPC entrypoints, Redis cache, PostgreSQL persistence, and dashboard data flow.',
  },
  {
    title: 'Solidity & EVM Engineering',
    desc: 'Proxy patterns, contract upgradeability, create2 deployment, inline assembly, and EIP protocol evolution.',
  },
  {
    title: 'MPC & TSS',
    desc: 'Threshold Signature Scheme with distributed key generation, Byzantine fault tolerance, and multi-party signing protocols.',
  },
  {
    title: 'AI-assisted Engineering',
    desc: 'Using AI agents to accelerate project analysis, MVP delivery, documentation, and engineering review workflows.',
  },
]

const focuses = [
  'Web3 Wallet Backend',
  'Multi-chain Signer',
  'Solidity / EVM',
  'Smart Contracts',
  'MPC / TSS',
  'Go Backend Infrastructure',
  'Technical Writing',
  'AI-assisted Development',
]

function goArticle(slug: string) {
  router.push('/articles/' + slug)
}
</script>

<template>
  <!-- Hero -->
  <section id="hero" class="section hero">
    <div class="container hero-inner">
      <h1 class="hero-title">xiuqiu</h1>
      <p class="hero-sub">Web3 Wallet &amp; Backend Developer</p>
      <p class="hero-desc">
        Building practical systems around multi-chain wallets, signer services, Go backend infrastructure, and AI-assisted engineering workflows.
      </p>
      <p class="hero-desc-cn">专注 Web3 钱包后端、多链签名服务、Go 工程与 AI 编程工作流。</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="#" @click.prevent="scrollTo('projects')">View Projects</a>
        <router-link class="btn btn-secondary" to="/articles">Read Writing</router-link>
        <a class="btn btn-ghost" href="https://github.com/qianqiu0404" target="_blank" rel="noopener">GitHub &rarr;</a>
      </div>
    </div>
  </section>

  <!-- Engineering Highlights -->
  <section id="highlights" class="section section-alt">
    <div class="container">
      <div class="section-heading">
        <p class="section-label">Highlights</p>
        <h2 class="section-title">Engineering&nbsp;Highlights</h2>
        <p class="section-desc">Key areas of focus and practical engineering work.</p>
      </div>
      <div class="highlight-grid">
        <article v-for="(h, i) in highlights" :key="i" class="highlight-card">
          <h3 class="highlight-title">{{ h.title }}</h3>
          <p class="highlight-desc">{{ h.desc }}</p>
        </article>
      </div>
    </div>
  </section>

  <!-- Projects -->
  <section id="projects" class="section">
    <div class="container">
      <div class="section-heading">
        <p class="section-label">Projects</p>
        <h2 class="section-title">Projects</h2>
        <p class="section-desc">
          Selected projects and engineering notes around Web3 wallet systems, signer services, and backend infrastructure.
        </p>
      </div>
      <div class="project-grid">
        <article v-for="p in projects" :key="p.id" class="project-card">
          <h3 class="project-name">{{ p.name }}</h3>
          <p class="project-role">{{ p.positioning }}</p>
          <p class="project-abilities-title">Engineering Focus</p>
          <ul class="project-abilities">
            <li v-for="a in p.coreAbilities" :key="a">{{ a }}</li>
          </ul>
          <div class="project-tech">
            <span v-for="t in p.techStack" :key="t" class="tech-tag">{{ t }}</span>
          </div>
          <a :href="p.github" class="project-link" target="_blank" rel="noopener">View on GitHub &rarr;</a>
        </article>
      </div>
    </div>
  </section>

  <!-- Writing Preview -->
  <section id="writing" class="section section-alt">
    <div class="container">
      <div class="section-heading">
        <p class="section-label">Writing</p>
        <h2 class="section-title">Writing</h2>
        <p class="section-desc">
          Technical writing on wallet architecture, service communication, signer boundaries, and backend data flow.
        </p>
      </div>
      <div class="article-grid">
        <article
          v-for="a in homeArticles"
          :key="a.id"
          class="article-card article-card-link"
          @click="goArticle(a.slug)"
        >
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
        <router-link to="/articles" class="btn btn-secondary">View All Writing &rarr;</router-link>
      </div>
    </div>
  </section>

  <!-- About -->
  <section id="about" class="section">
    <div class="container about-inner">
      <div class="section-heading">
        <p class="section-label">About</p>
        <h2 class="section-title">About</h2>
      </div>
      <div class="about-content">
        <p class="about-lead">I build and document practical Web3 backend systems.</p>
        <p>
          My work focuses on wallet APIs, signer services, multi-chain models, and AI-assisted engineering workflows. 
          Every project is an opportunity to distill real engineering decisions into clear, reviewable artifacts.
        </p>
        <p>
          我关注的是如何把真实项目拆解成可理解、可复盘、可持续沉淀的工程资产。
        </p>
      </div>

      <div class="focus-grid">
        <div v-for="f in focuses" :key="f" class="focus-item">{{ f }}</div>
      </div>
    </div>
  </section>

  <!-- Contact -->
  <section id="contact" class="section section-alt">
    <div class="container contact-inner">
      <div class="section-heading">
        <p class="section-label">Contact</p>
        <h2 class="section-title">Contact</h2>
        <p class="section-desc">
          Reach out via GitHub or email for collaboration, project discussions, or technical conversations.
        </p>
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
