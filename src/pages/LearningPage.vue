<script setup lang="ts">
import { onMounted } from 'vue'
import { learningRecords } from '../data/generatedLearningRecords'
import { projectStageLabels, siteArticlesByNewest, siteProjects } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const learningArticles = siteArticlesByNewest.filter(article => article.kind === 'learning-log')
const activeProjects = siteProjects.filter(project => project.learning)

onMounted(() => {
  setSeoMeta({
    title: '学习复盘｜xiuqiu',
    description: '精选公开的 Web3 钱包工程学习进度、验证证据、失败复盘与下一步。',
    path: '/learning',
  })
})
</script>

<template>
  <section class="section page-top learning-page">
    <div class="container">
      <header class="learning-page-header">
        <div>
          <p class="section-label">Curated Learning Log</p>
          <h1>学习复盘</h1>
          <p>这里只公开经过整理的阶段目标、验证结果与复盘结论。原始日记、私人计划和未经核验的内容继续留在本地 Obsidian。</p>
        </div>
      </header>

      <section v-if="learningRecords[0]" class="current-quest">
        <p class="section-label">当前主线 · {{ learningRecords[0].date }}</p>
        <h2>{{ learningRecords[0].title }}</h2>
        <p>{{ learningRecords[0].summary }}</p>
        <div class="current-quest-grid">
          <div>
            <p class="project-abilities-title">本阶段完成</p>
            <ul class="learning-list"><li v-for="item in learningRecords[0].achieved" :key="item">{{ item }}</li></ul>
          </div>
          <div>
            <p class="project-abilities-title">验证证据</p>
            <ul class="learning-list"><li v-for="item in learningRecords[0].evidence" :key="item">{{ item }}</li></ul>
          </div>
          <div>
            <p class="project-abilities-title">下一步</p>
            <ul class="learning-list"><li v-for="item in learningRecords[0].nextSteps" :key="item">{{ item }}</li></ul>
          </div>
        </div>
      </section>

      <section class="learning-page-section">
        <div class="section-heading section-heading-left">
          <p class="section-label">阶段记录</p>
          <h2 class="section-title">做了什么，以及判断发生了什么变化</h2>
        </div>
        <div class="reflection-list">
          <article v-for="record in learningRecords" :key="record.slug" class="reflection-card">
            <div class="reflection-date"><time>{{ record.date }}</time></div>
            <div>
              <h3>{{ record.title }}</h3>
              <p>{{ record.summary }}</p>
              <div class="reflection-insights">
                <span v-for="item in record.reflection" :key="item">{{ item }}</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section class="learning-page-section">
        <div class="section-heading section-heading-left">
          <p class="section-label">项目进度</p>
          <h2 class="section-title">每个进行中项目下一步准备验证什么</h2>
        </div>
        <div class="learning-project-grid">
          <router-link v-for="project in activeProjects" :key="project.id" :to="`/projects/${project.slug}`" class="learning-project-card">
            <span>{{ projectStageLabels[project.stage] }} · {{ project.updatedAt }}</span>
            <h3>{{ project.name }}</h3>
            <p>{{ project.learning?.nextSteps[0] }}</p>
          </router-link>
        </div>
      </section>

      <section v-if="learningArticles.length" class="learning-page-section">
        <div class="section-heading section-heading-left">
          <p class="section-label">公开复盘文章</p>
          <h2 class="section-title">完整方法和案例</h2>
        </div>
        <div class="followup-links">
          <router-link v-for="article in learningArticles" :key="article.slug" :to="`/articles/${article.slug}`" class="followup-link">
            <span>{{ article.title }}</span>
            <small>{{ article.date }} · {{ article.readingTime }}</small>
          </router-link>
        </div>
      </section>
    </div>
  </section>
</template>
