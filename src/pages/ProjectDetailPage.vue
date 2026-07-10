<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { getArticlesBySlugs, getProjectById } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const route = useRoute()
const project = computed(() => getProjectById(Number(route.params.id)))
const relatedArticles = computed(() => (project.value ? getArticlesBySlugs(project.value.relatedArticleSlugs) : []))

watchEffect(() => {
  if (!project.value) {
    setSeoMeta({ title: 'Project not found | xiuqiu', path: route.fullPath })
    return
  }

  setSeoMeta({
    title: `${project.value.name}｜xiuqiu 学习档案`,
    description: project.value.positioning,
    path: route.fullPath,
  })
})
</script>

<template>
  <section class="section page-top">
    <div v-if="project" class="container project-detail-container">
      <router-link to="/#projects" class="back-link">&larr; 返回项目证据</router-link>

      <article class="project-detail">
        <header class="project-detail-header">
          <p class="section-label">项目学习记录</p>
          <div v-if="project.learning" class="learning-status">
            <span>{{ project.learning.stage }}</span>
            <time>更新于 {{ project.learning.updatedAt }}</time>
          </div>
          <h1>{{ project.name }}</h1>
          <p>{{ project.positioning }}</p>
          <div class="project-tech">
            <span v-for="tech in project.techStack" :key="tech" class="tech-tag">{{ tech }}</span>
          </div>
          <a :href="project.github" class="btn btn-primary" target="_blank" rel="noopener">查看 GitHub &rarr;</a>
        </header>

        <template v-if="project.learning">
          <div class="learning-overview">
            <section class="learning-card learning-card-primary">
              <p class="project-abilities-title">学习目标</p>
              <p>{{ project.learning.goal }}</p>
            </section>
            <section class="learning-card">
              <p class="project-abilities-title">已验证 / 已定位</p>
              <ul>
                <li v-for="item in project.learning.verified" :key="item">{{ item }}</li>
              </ul>
            </section>
            <section class="learning-card">
              <p class="project-abilities-title">验证方式</p>
              <code v-for="command in project.learning.verification" :key="command">{{ command }}</code>
              <p v-if="project.learning.verificationNote" class="verification-note">{{ project.learning.verificationNote }}</p>
            </section>
          </div>

          <div class="learning-detail-grid">
            <section class="learning-section">
              <p class="section-label">当前边界</p>
              <h2>哪些能力仍在继续验证</h2>
              <ul class="learning-list">
                <li v-for="item in project.learning.tradeoffs" :key="item">{{ item }}</li>
              </ul>
            </section>
            <section class="learning-section">
              <p class="section-label">下一步</p>
              <h2>接下来准备解决什么</h2>
              <ul class="learning-list">
                <li v-for="item in project.learning.nextSteps" :key="item">{{ item }}</li>
              </ul>
            </section>
          </div>
        </template>

        <section class="learning-section">
          <p class="section-label">相关工程笔记</p>
          <h2>这些文章解释了项目中的判断</h2>
          <div class="followup-links">
            <router-link
              v-for="article in relatedArticles"
              :key="article.slug"
              :to="`/articles/${article.slug}`"
              class="followup-link"
            >
              <span>{{ article.title }}</span>
              <small>{{ article.difficulty }} · {{ article.readingTime }}</small>
            </router-link>
          </div>
        </section>
      </article>
    </div>

    <div v-else class="container not-found">
      <p class="not-found-title">项目未公开或不存在</p>
      <router-link to="/" class="btn btn-primary">返回首页</router-link>
    </div>
  </section>
</template>
