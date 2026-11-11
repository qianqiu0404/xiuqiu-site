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
import '../../../design/collections.css'

const selectedProjects = buildProfileProjects(projects)

onMounted(() => setSeoMeta({ ...profileSeo, path: '/profile' }))
</script>

<template>
  <div class="brief profile-page" lang="zh-CN">
    <header class="brief-masthead">
      <div class="brief-shell">
        <p class="brief-dateline"><span>个人主页 / xiuqiu</span><span>Web3 · AI · 工程记录</span></p>
        <h1>在实践里学习，把想法做成作品。</h1>
        <p class="brief-lede">关注 Web3 与 AI，在产品、工程和学习之间慢慢探索。这里放着我正在做的事、做过的作品，以及一路留下的记录。</p>
        <nav class="collection-meta" aria-label="个人主页快捷入口">
          <router-link class="collection-link" to="/profile#profile-projects">项目与作品 ↓</router-link>
          <a class="collection-link" :href="githubProfileUrl" target="_blank" rel="noopener">GitHub ↗<span class="brief-sr-only">（新窗口打开）</span></a>
        </nav>
      </div>
    </header>

    <div class="brief-shell brief-layout">
      <div>
        <section class="collection-section" aria-labelledby="profile-intro">
          <header class="collection-heading"><h2 id="profile-intro" tabindex="-1">关于我</h2><span>产品、工程与学习</span></header>
          <div class="collection-copy">
            <p>我是 xiuqiu，正在用实际项目理解技术，也尝试用技术把想法变成可以体验的东西。</p>
            <p>我在维护 Qiu Market，学习钱包基础设施，也在探索怎样与 AI 协作完成工程工作。读资料、写代码、做实验，再把问题和结论整理成记录，是我目前的日常。</p>
            <p>这个网站既是作品集，也是持续更新的学习档案。你可以从作品认识我，也可以沿着笔记和工程记录，看到一个想法是怎样一步步走到这里的。</p>
          </div>
        </section>

        <section class="collection-section" aria-labelledby="profile-focus">
          <header class="collection-heading"><h2 id="profile-focus" tabindex="-1">实践与学习方向</h2><span>从问题到验证</span></header>
          <ol class="collection-list">
            <li v-for="area in profileFocusAreas" :key="area.title" class="collection-row">
              <h3><router-link :to="area.to">{{ area.title }}</router-link></h3>
              <p>{{ area.description }}</p>
              <div class="collection-footer">
                <ul class="collection-list collection-meta" aria-label="涉及方向"><li v-for="topic in area.topics" :key="topic" class="collection-tag">{{ topic }}</li></ul>
                <router-link class="collection-link" :to="area.to">{{ area.linkLabel }} →</router-link>
              </div>
            </li>
          </ol>
        </section>

        <section class="collection-section" aria-labelledby="profile-projects">
          <header class="collection-heading"><h2 id="profile-projects" tabindex="-1">项目与作品</h2><router-link class="collection-link" to="/projects">全部项目 →</router-link></header>
          <ol class="collection-list">
            <li v-for="project in selectedProjects.current" :key="project.slug" class="collection-row">
              <div class="collection-meta"><span class="collection-tag" :class="project.role === 'current-product' ? 'collection-tag--market' : 'collection-tag--notes'">{{ project.roleLabel }}</span><span>{{ project.stageLabel }}</span></div>
              <h3><router-link :to="project.to">{{ project.name }}</router-link></h3>
              <p>{{ project.summary }}</p>
              <div class="collection-footer"><ul class="collection-list collection-meta" aria-label="项目技术与方向"><li v-for="tag in project.techStack" :key="tag" class="collection-tag">{{ tag }}</li></ul></div>
              <div class="collection-footer"><router-link class="collection-link" :to="project.to">了解项目与验证范围 →</router-link><span class="brief-note">资料更新于 <time :datetime="project.updatedAt">{{ project.updatedAt }}</time></span></div>
            </li>
          </ol>
          <div v-if="!selectedProjects.current.length" class="brief-state"><p>当前项目资料正在整理，可以先浏览项目图谱。</p><router-link class="brief-button" to="/projects">浏览项目图谱 →</router-link></div>
          <ol v-if="selectedProjects.historical.length" class="collection-list">
            <li v-for="project in selectedProjects.historical" :key="project.slug" class="collection-row">
              <div class="collection-meta"><span class="collection-tag">{{ project.roleLabel }}</span><span>资料更新于 <time :datetime="project.updatedAt">{{ project.updatedAt }}</time></span></div>
              <h3><router-link :to="project.to">{{ project.name }}</router-link></h3>
              <p>{{ project.summary }}</p>
              <router-link class="collection-link" :to="project.to">查看历史作品与验证范围 →</router-link>
            </li>
          </ol>
          <p class="brief-note">Qiu Market 使用虚拟资金；钱包基础设施仍在学习与验证中。历史模拟、局部测试和公开演示的具体边界，保留在各项目页中。</p>
        </section>

        <section class="collection-section" aria-labelledby="profile-workflow">
          <header class="collection-heading"><h2 id="profile-workflow" tabindex="-1">怎样与 AI 协作</h2><router-link class="collection-link" to="/ai">协作记录 →</router-link></header>
          <ol class="collection-list">
            <li v-for="(principle, index) in profileWorkingPrinciples" :key="principle.title" class="collection-row">
              <div class="collection-meta"><span>{{ String(index + 1).padStart(2, '0') }}</span></div>
              <h3>{{ principle.title }}</h3>
              <p>{{ principle.description }}</p>
            </li>
          </ol>
        </section>

        <section class="collection-section" aria-labelledby="profile-links">
          <header class="collection-heading"><h2 id="profile-links" tabindex="-1">继续了解，或找到我</h2><span>公开代码与记录</span></header>
          <div class="collection-copy">
            <p>如果你也对 AI、Web3 或把想法做成作品感兴趣，欢迎从公开代码和记录开始认识。</p>
            <div class="collection-footer">
              <a class="collection-link" :href="githubProfileUrl" target="_blank" rel="noopener">GitHub · qianqiu0404 ↗<span class="brief-sr-only">（新窗口打开）</span></a>
              <a class="collection-link" :href="githubRepositoriesUrl" target="_blank" rel="noopener">公开仓库 ↗<span class="brief-sr-only">（新窗口打开）</span></a>
              <router-link class="collection-link" to="/articles">工程与学习笔记 →</router-link>
              <router-link class="collection-link" to="/now">目前在做什么 →</router-link>
            </div>
          </div>
        </section>
      </div>

      <aside class="brief-aside" aria-label="个人主页目录与公开入口">
        <section class="brief-panel">
          <h2>本页目录</h2>
          <nav aria-label="个人主页目录"><ul><li v-for="section in profileSections" :key="section.id"><router-link :to="`/profile#${section.id}`">{{ section.label }} <span>→</span></router-link></li></ul></nav>
        </section>
        <section class="brief-panel">
          <h2>目前在做什么</h2>
          <ul>
            <li v-for="project in selectedProjects.current" :key="project.slug"><router-link :to="project.to">{{ project.name }} <span>→</span></router-link><p class="brief-note">{{ project.roleLabel }}</p></li>
            <li><router-link to="/ai">AI Engineering <span>→</span></router-link><p class="brief-note">与 AI 协作的过程和记录。</p></li>
          </ul>
        </section>
        <section class="brief-panel">
          <h2>继续阅读</h2>
          <ul>
            <li><router-link to="/about">关于本站 <span>→</span></router-link></li>
            <li><router-link to="/engineering/evidence">工程证据 <span>→</span></router-link></li>
            <li><router-link to="/articles">工程笔记 <span>→</span></router-link></li>
          </ul>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.profile-page h2[id] {
  scroll-margin-top: calc(var(--header-height) + var(--space-6));
}
</style>
