<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { siteKnowledge, siteProjects, type SiteProject } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const featuredProjects = computed(() =>
  [1, 2, 7]
    .map(id => siteProjects.find(project => project.id === id))
    .filter((project): project is SiteProject => Boolean(project)),
)

const proofPoints = [
  { value: '3 层', label: '业务、节点与签名边界' },
  { value: '5 个', label: '有公开证据的项目' },
  { value: '30 篇', label: '工程笔记与研究' },
]

onMounted(() => {
  setSeoMeta({
    title: 'xiuqiu｜Web3 钱包后端工程档案',
    description: siteKnowledge.owner.summary,
    path: '/',
  })
})
</script>

<template>
  <section class="section hero portfolio-hero">
    <div class="container portfolio-hero-grid">
      <div>
        <p class="hero-eyebrow">Web3 Wallet Backend · Go · TypeScript</p>
        <h1 class="hero-title">围绕资金状态、多链适配与签名安全构建钱包后端</h1>
        <p class="hero-desc hero-desc-primary">
          我的工程主线是交易所钱包三服务：业务层管理充值提现和状态恢复，wallet-api 隔离多链节点能力，wallet-sign 隔离私钥和签名能力。
        </p>
        <div class="hero-actions hero-actions-left">
          <router-link class="btn btn-primary" to="/engineering">查看工程档案</router-link>
          <router-link class="btn btn-secondary" to="/engineering?mode=interview">3 分钟快速模式</router-link>
          <router-link class="btn btn-ghost" to="/learning">查看学习复盘 &rarr;</router-link>
        </div>
      </div>
      <aside class="hero-proof-panel">
        <p class="project-abilities-title">最强工程证据</p>
        <ul>
          <li>ChainDispatcher + Chain Adaptor 多链路由</li>
          <li>充值提现异步状态机与失败补偿</li>
          <li>独立签名服务与 HSM/TSS 演进边界</li>
          <li>TypeScript 多链离线交易构建与测试</li>
        </ul>
        <a href="https://github.com/qianqiu0404" target="_blank" rel="noopener">GitHub / qianqiu0404 &rarr;</a>
      </aside>
    </div>
  </section>

  <section class="home-proof-strip">
    <div class="container proof-strip-grid">
      <div v-for="item in proofPoints" :key="item.label">
        <strong>{{ item.value }}</strong>
        <span>{{ item.label }}</span>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-heading section-heading-left">
        <p class="section-label">Selected Engineering Work</p>
        <h2 class="section-title">三项核心证据</h2>
        <p class="section-desc">首页只展示最能解释工程方向的项目；完整调用链、失败场景和验证方式放在工程档案。</p>
      </div>
      <div class="home-project-grid">
        <article v-for="project in featuredProjects" :key="project.id" class="home-project-card">
          <p class="project-abilities-title">{{ project.engineering.role }}</p>
          <h3>{{ project.name }}</h3>
          <p>{{ project.engineering.interviewSummary }}</p>
          <div class="project-tech">
            <span v-for="tech in project.techStack.slice(0, 5)" :key="tech" class="tech-tag">{{ tech }}</span>
          </div>
          <div class="project-actions">
            <router-link :to="`/projects/${project.id}`" class="project-link">查看证据 &rarr;</router-link>
            <a :href="project.github" class="project-link" target="_blank" rel="noopener">GitHub &rarr;</a>
          </div>
        </article>
      </div>
    </div>
  </section>

  <section class="section section-alt">
    <div class="container dual-entry-grid">
      <router-link to="/engineering" class="entry-panel engineering-entry">
        <p class="section-label">For Interviewers & Peers</p>
        <h2>工程档案</h2>
        <p>看系统边界、调用链、状态机、异常恢复和可运行证据。</p>
        <span>进入工程档案 &rarr;</span>
      </router-link>
      <router-link to="/learning" class="entry-panel learning-entry">
        <p class="section-label">Curated Reflection</p>
        <h2>学习复盘</h2>
        <p>看当前目标、阶段进度、判断变化、失败记录和下一步。</p>
        <span>进入学习复盘 &rarr;</span>
      </router-link>
    </div>
  </section>

  <section class="section home-about">
    <div class="container home-about-grid">
      <div>
        <p class="section-label">About</p>
        <h2 class="section-title">工程事实与学习过程分开表达</h2>
      </div>
      <div>
        <p>
          我使用 AI 辅助检索、方案比较、测试生成和代码审查；由我负责目标拆解、运行调试、失败验证、工程取舍与最终验收。没有亲自验证的内容不会写成已经完成的能力。
        </p>
        <div class="contact-links contact-links-left">
          <a href="mailto:qianqiuquq@gmail.com" class="contact-item"><span class="contact-label">Email</span><span class="contact-value">qianqiuquq@gmail.com</span></a>
          <router-link to="/articles" class="contact-item"><span class="contact-label">Writing</span><span class="contact-value">全部工程笔记</span></router-link>
        </div>
      </div>
    </div>
  </section>
</template>
