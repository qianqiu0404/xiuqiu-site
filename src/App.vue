<script setup lang="ts">
import { ref } from 'vue'
import { projects } from './data/projects'
import { articles } from './data/articles'

const navOpen = ref(false)
const sections = ['hero', 'projects', 'articles', 'about', 'contact'] as const

function scrollTo(id: string) {
  navOpen.value = false
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <!-- Navigation -->
  <header class="site-header">
    <nav class="nav container">
      <a class="brand" href="#" @click.prevent="scrollTo('hero')">xiuqiu</a>

      <button
        class="nav-toggle"
        :class="{ open: navOpen }"
        type="button"
        aria-label="Toggle menu"
        @click="navOpen = !navOpen"
      >
        <span></span><span></span><span></span>
      </button>

      <div class="nav-links" :class="{ open: navOpen }">
        <a href="#" @click.prevent="scrollTo('hero')">首页</a>
        <a href="#" @click.prevent="scrollTo('projects')">项目</a>
        <a href="#" @click.prevent="scrollTo('articles')">文章</a>
        <a href="#" @click.prevent="scrollTo('about')">关于我</a>
        <a href="#" @click.prevent="scrollTo('contact')">联系</a>
      </div>
    </nav>
  </header>

  <main>
    <!-- Hero -->
    <section id="hero" class="section hero">
      <div class="container hero-inner">
        <p class="hero-eyebrow">Web3 Wallet Developer in Progress</p>
        <h1 class="hero-title">
          xiuqiu<br />
          <span class="hero-sub">Building Web3 Wallet Infrastructure</span>
        </h1>
        <p class="hero-desc">
          我正在系统学习 Web3 钱包开发、Go 后端服务和 AI 编程，
          当前重点项目包括 wallet-api、wallet-sign、market-services。
        </p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#" @click.prevent="scrollTo('projects')">查看项目</a>
          <a class="btn btn-secondary" href="#" @click.prevent="scrollTo('articles')">阅读文章</a>
          <a
            class="btn btn-ghost"
            href="https://github.com/qianqiu0404"
            target="_blank"
            rel="noopener"
          >GitHub →</a>
        </div>
      </div>
    </section>

    <!-- Projects -->
    <section id="projects" class="section">
      <div class="container">
        <div class="section-heading">
          <p class="section-eyebrow">Projects</p>
          <h2 class="section-title">项目展示</h2>
          <p class="section-desc">从实战出发，理解 Web3 钱包后端服务体系</p>
        </div>

        <div class="project-grid">
          <article
            v-for="p in projects"
            :key="p.id"
            class="project-card"
          >
            <div class="project-top">
              <span class="project-number">{{ '0' + p.id }}</span>
              <span class="project-tag">Web3</span>
            </div>
            <h3 class="project-name">{{ p.name }}</h3>
            <p class="project-desc">{{ p.description }}</p>
            <div class="project-tech">
              <span v-for="t in p.techStack" :key="t" class="tech-tag">{{ t }}</span>
            </div>
            <details class="project-details">
              <summary>重点学习</summary>
              <ul>
                <li v-for="l in p.learnings" :key="l">{{ l }}</li>
              </ul>
            </details>
            <a
              :href="p.github"
              class="project-link"
              target="_blank"
              rel="noopener"
            >GitHub ↗</a>
          </article>
        </div>
      </div>
    </section>

    <!-- Articles -->
    <section id="articles" class="section section-alt">
      <div class="container">
        <div class="section-heading">
          <p class="section-eyebrow">Articles</p>
          <h2 class="section-title">学习文章</h2>
          <p class="section-desc">用输出倒逼输入，把学到的整理成可回溯的知识</p>
        </div>

        <div class="article-grid">
          <article
            v-for="a in articles"
            :key="a.id"
            class="article-card"
          >
            <time class="article-date">{{ a.date }}</time>
            <h3 class="article-title">{{ a.title }}</h3>
            <p class="article-summary">{{ a.summary }}</p>
            <div class="article-tags">
              <span v-for="tag in a.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- About -->
    <section id="about" class="section">
      <div class="container about-inner">
        <div class="section-heading">
          <p class="section-eyebrow">About Me</p>
          <h2 class="section-title">关于我</h2>
        </div>

        <div class="about-content">
          <div class="about-block">
            <h3>当前方向</h3>
            <p>Web3 钱包开发 / Go 后端服务 / AI 编程实践</p>
          </div>

          <div class="about-block">
            <h3>当前目标</h3>
            <p>
              把 wallet-api、wallet-sign、market-services 等项目吃透，
              整理成可展示、可面试、可复盘的作品集。
            </p>
          </div>

          <div class="about-block">
            <h3>技术栈</h3>
            <div class="stack-tags">
              <span v-for="s in ['Go','TypeScript','Vue','gRPC','HTTP','PostgreSQL','Redis','Web3 RPC','BTC','ETH','Solana','Cosmos']" :key="s" class="tag">{{ s }}</span>
            </div>
          </div>

          <div class="about-block">
            <h3>个人定位</h3>
            <p>
              我正在从项目实战出发，系统建立 Web3 钱包开发、后端服务设计和 AI 辅助编程能力。
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Contact -->
    <section id="contact" class="section section-contact">
      <div class="container contact-inner">
        <div class="section-heading">
          <p class="section-eyebrow">Contact</p>
          <h2 class="section-title">联系方式</h2>
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
  </main>

  <footer class="footer">
    <div class="container footer-inner">
      <p>© {{ new Date().getFullYear() }} xiuqiu</p>
      <p>Built with Vue · Deployed on Vercel</p>
    </div>
  </footer>
</template>
