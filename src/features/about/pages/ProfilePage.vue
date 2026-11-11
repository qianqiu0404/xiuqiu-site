<script setup lang="ts">
import { onMounted } from 'vue'
import {
  buildProfileProjects,
  githubProfileUrl,
  githubRepositoriesUrl,
  profileFocusAreas,
  profileSections,
  profileSeo,
  profileWorkingPrinciples,
  projects,
} from '../data'
import { setSeoMeta } from '../../../utils/seo'
import '../../../design/brief.css'
import '../../../styles/profile.css'

const selectedProjects = buildProfileProjects(projects)

onMounted(() => setSeoMeta({ ...profileSeo, path: '/profile' }))
</script>

<template>
  <div class="brief profile-page" lang="zh-CN">
    <div class="brief-shell">
      <header class="profile-cover">
        <div class="profile-cover-copy">
          <p class="profile-eyebrow"><span class="profile-mark" aria-hidden="true">x.</span>个人主页 / PROFILE</p>
          <h1>xiuqiu<span>在实践里学习，<br />把想法做成作品。</span></h1>
          <p class="profile-description">关注 Web3 与 AI，在产品、工程和学习之间慢慢探索。这里放着我正在做的事、做过的作品，以及一路留下的记录。</p>
          <div class="profile-actions">
            <router-link class="profile-button profile-button--primary" to="/profile#profile-projects">看看我的作品 <span aria-hidden="true">↓</span></router-link>
            <a class="profile-button" :href="githubProfileUrl" target="_blank" rel="noopener">GitHub <span aria-hidden="true">↗</span><span class="brief-sr-only">（新窗口打开）</span></a>
          </div>
        </div>
        <aside class="profile-cover-note" aria-labelledby="profile-now-title">
          <p id="profile-now-title" class="profile-eyebrow">当前关注 / ON MY DESK</p>
          <router-link to="/projects/s78-market-services"><span>产品实践</span><strong>Qiu Market</strong><span aria-hidden="true">↗</span></router-link>
          <router-link to="/projects/exchange-wallet-system"><span>学习方向</span><strong>Wallet Infrastructure</strong><span aria-hidden="true">↗</span></router-link>
          <router-link to="/ai"><span>工作方式</span><strong>AI Engineering</strong><span aria-hidden="true">↗</span></router-link>
          <p>保持好奇，动手验证。<br />让每一次尝试都留下点什么。</p>
        </aside>
      </header>

      <div class="profile-layout">
        <aside class="profile-index">
          <nav aria-label="个人主页目录">
            <router-link v-for="section in profileSections" :key="section.id" :to="`/profile#${section.id}`"><span>{{ section.index }}</span>{{ section.label }}</router-link>
          </nav>
          <p>作品、学习与过程，<br />都在这里慢慢积累。</p>
          <router-link class="profile-inline-link" to="/about">更多关于本站 <span aria-hidden="true">→</span></router-link>
        </aside>

        <div class="profile-content">
          <section class="profile-section" aria-labelledby="profile-intro">
            <h2 id="profile-intro" tabindex="-1"><span>01 / ABOUT</span>关于我</h2>
            <p class="profile-intro">我是 xiuqiu，正在用实际项目理解技术，也尝试用技术把想法变成可以体验的东西。</p>
            <p>我在维护 Qiu Market，学习钱包基础设施，也在探索怎样与 AI 协作完成工程工作。读资料、写代码、做实验，再把问题和结论整理成记录，是我目前的日常。</p>
            <p>这个网站既是作品集，也是持续更新的学习档案。你可以从作品认识我，也可以沿着笔记和工程记录，看到一个想法是怎样一步步走到这里的。</p>
          </section>

          <section class="profile-section" aria-labelledby="profile-focus">
            <h2 id="profile-focus" tabindex="-1"><span>02 / PRACTICE</span>实践与学习方向</h2>
            <div class="profile-focus-grid">
              <article v-for="(area, index) in profileFocusAreas" :key="area.title" class="profile-focus-card">
                <span class="profile-card-number">{{ String(index + 1).padStart(2, '0') }}</span>
                <h3>{{ area.title }}</h3>
                <p>{{ area.description }}</p>
                <ul class="profile-tags" aria-label="涉及方向"><li v-for="topic in area.topics" :key="topic">{{ topic }}</li></ul>
                <router-link class="profile-inline-link" :to="area.to">{{ area.linkLabel }} <span aria-hidden="true">→</span></router-link>
              </article>
            </div>
          </section>

          <section class="profile-section" aria-labelledby="profile-projects">
            <h2 id="profile-projects" tabindex="-1"><span>03 / SELECTED WORK</span>项目与作品</h2>
            <p class="profile-section-lede">一个正在维护的产品，一个持续学习的方向，以及一些留得下来的工程尝试。</p>
            <div v-if="selectedProjects.current.length" class="profile-project-list">
              <article v-for="project in selectedProjects.current" :key="project.slug" class="profile-project">
                <div class="profile-project-meta"><span class="profile-role" :class="{ 'profile-role--direction': project.role === 'current-direction' }">{{ project.roleLabel }}</span><span>{{ project.stageLabel }}</span></div>
                <h3><router-link :to="project.to">{{ project.name }} <span aria-hidden="true">↗</span></router-link></h3>
                <p>{{ project.summary }}</p>
                <ul class="profile-tags" aria-label="项目技术与方向"><li v-for="tag in project.techStack" :key="tag">{{ tag }}</li></ul>
                <div class="profile-project-footer"><router-link class="profile-inline-link" :to="project.to">了解项目与验证范围 <span aria-hidden="true">→</span></router-link><span>资料更新于 <time :datetime="project.updatedAt">{{ project.updatedAt }}</time></span></div>
              </article>
            </div>
            <p v-else class="profile-empty">当前项目资料正在整理，可以先浏览<router-link class="profile-inline-link" to="/projects">项目图谱 →</router-link>。</p>

            <div v-if="selectedProjects.historical.length" class="profile-history">
              <h3>做过的工程尝试</h3>
              <p>保留原有的历史作品与验证范围，可以继续体验和回看。</p>
              <div class="profile-history-grid">
                <article v-for="project in selectedProjects.historical" :key="project.slug" class="profile-history-card">
                  <span class="profile-eyebrow">{{ project.roleLabel }}</span>
                  <h4><router-link :to="project.to">{{ project.name }} <span aria-hidden="true">↗</span></router-link></h4>
                  <p>{{ project.summary }}</p>
                </article>
              </div>
            </div>
            <p class="profile-boundary">Qiu Market 使用虚拟资金；钱包基础设施仍在学习与验证中。历史模拟、局部测试和公开演示的具体边界，保留在各项目页中。</p>
            <router-link class="profile-inline-link" to="/projects">浏览全部项目与工程记录 <span aria-hidden="true">→</span></router-link>
          </section>

          <section class="profile-section" aria-labelledby="profile-workflow">
            <h2 id="profile-workflow" tabindex="-1"><span>04 / HOW I WORK</span>怎样与 AI 协作</h2>
            <p class="profile-section-lede">把问题、执行、审查和验证连起来，也为人的判断留出位置。</p>
            <ol class="profile-principles">
              <li v-for="(principle, index) in profileWorkingPrinciples" :key="principle.title"><span>{{ String(index + 1).padStart(2, '0') }}</span><div><h3>{{ principle.title }}</h3><p>{{ principle.description }}</p></div></li>
            </ol>
            <router-link class="profile-inline-link" to="/ai">看看实际的协作记录 <span aria-hidden="true">→</span></router-link>
          </section>

          <section class="profile-section profile-contact" aria-labelledby="profile-links">
            <h2 id="profile-links" tabindex="-1"><span>05 / ELSEWHERE</span>继续了解，或找到我</h2>
            <p>如果你也对 AI、Web3 或把想法做成作品感兴趣，欢迎从公开代码和记录开始认识。</p>
            <div class="profile-contact-links">
              <a :href="githubProfileUrl" target="_blank" rel="noopener"><span>GitHub</span><strong>qianqiu0404</strong><span aria-hidden="true">↗</span><span class="brief-sr-only">（新窗口打开）</span></a>
              <a :href="githubRepositoriesUrl" target="_blank" rel="noopener"><span>CODE</span><strong>公开仓库</strong><span aria-hidden="true">↗</span><span class="brief-sr-only">（新窗口打开）</span></a>
              <router-link to="/articles"><span>NOTES</span><strong>工程与学习笔记</strong><span aria-hidden="true">→</span></router-link>
              <router-link to="/now"><span>NOW</span><strong>目前在做什么</strong><span aria-hidden="true">→</span></router-link>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>
