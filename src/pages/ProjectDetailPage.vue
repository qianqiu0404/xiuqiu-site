<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getArticlesBySlugs, getProjectByKey, projectSourceLabels, projectStageLabels, projectVisibilityLabels } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const route = useRoute()
const router = useRouter()
const projectKey = computed(() => String(route.params.project || ''))
const project = computed(() => getProjectByKey(projectKey.value))
const relatedArticles = computed(() => project.value ? getArticlesBySlugs(project.value.relatedArticleSlugs) : [])

watchEffect(() => {
  if (!project.value) {
    setSeoMeta({ title: 'Project not found | xiuqiu', path: route.fullPath })
    return
  }
  setSeoMeta({ title: `${project.value.name}｜xiuqiu 工程档案`, description: project.value.positioning, path: `/projects/${project.value.slug}` })
  if (projectKey.value !== project.value.slug) void router.replace(`/projects/${project.value.slug}`)
})
</script>

<template>
  <section class="section page-top">
    <div v-if="project" class="container project-detail-container">
      <router-link to="/engineering" class="back-link">&larr; 返回工程档案</router-link>
      <article class="project-detail">
        <header class="project-detail-header">
          <p class="section-label">{{ project.category }}</p>
          <div class="project-state-tags"><span>{{ projectStageLabels[project.stage] }}</span><span>{{ projectSourceLabels[project.sourceType] }}</span><span>{{ projectVisibilityLabels[project.visibility] }}</span><time>更新于 {{ project.updatedAt }}</time></div>
          <h1>{{ project.name }}</h1><p>{{ project.positioning }}</p>
          <div class="project-tech"><span v-for="tech in project.techStack" :key="tech" class="tech-tag">{{ tech }}</span></div>
          <a v-if="project.visibility === 'public' && project.repositoryUrl" :href="project.repositoryUrl" class="btn btn-primary" target="_blank" rel="noopener">查看公开仓库 &rarr;</a>
        </header>

        <div class="project-state-overview">
          <section><p class="project-abilities-title">当前重点</p><p>{{ project.currentFocus }}</p></section>
          <section><p class="project-abilities-title">目标完成形态</p><p>{{ project.targetOutcome }}</p></section>
          <section class="milestone-card"><p class="project-abilities-title">下一里程碑</p><p>{{ project.nextMilestone }}</p></section>
        </div>

        <section class="learning-section"><p class="section-label">已验证证据</p><h2>目前能够被代码、测试或运行记录支持的事实</h2><ul class="learning-list evidence-detail-list"><li v-for="item in project.verifiedEvidence" :key="item">{{ item }}</li></ul></section>

        <div class="learning-detail-grid">
          <section class="learning-section"><p class="section-label">系统边界</p><h2>这个项目负责什么</h2><p>{{ project.engineering.systemBoundary }}</p></section>
          <section class="learning-section"><p class="section-label">关键调用链</p><h2>核心流程如何推进</h2><ol class="numbered-evidence"><li v-for="item in project.engineering.callFlow" :key="item">{{ item }}</li></ol></section>
        </div>

        <div class="learning-detail-grid">
          <section class="learning-section"><p class="section-label">失败场景</p><h2>不能只讲 happy path</h2><ul class="learning-list"><li v-for="item in project.engineering.failureScenarios" :key="item">{{ item }}</li></ul></section>
          <section class="learning-section"><p class="section-label">当前限制</p><h2>哪些还没有完成</h2><ul class="learning-list"><li v-for="item in project.knownLimits" :key="item">{{ item }}</li></ul></section>
        </div>

        <section class="learning-section">
          <p class="section-label">验证方式</p><h2>可复现命令与说明</h2>
          <div v-if="project.learning.verification.length" class="verification-command-grid"><code v-for="command in project.learning.verification" :key="command">{{ command }}</code></div>
          <p v-else class="verification-note">当前还没有记录为稳定可复现的完整命令。</p>
          <p v-if="project.learning.verificationNote" class="verification-note">{{ project.learning.verificationNote }}</p>
        </section>

        <section class="learning-section"><p class="section-label">相关工程笔记</p><h2>这些文章继续解释项目中的判断</h2><div class="followup-links"><router-link v-for="article in relatedArticles" :key="article.slug" :to="`/articles/${article.slug}`" class="followup-link"><span>{{ article.title }}</span><small>{{ article.difficulty }} · {{ article.readingTime }}</small></router-link></div></section>
      </article>
    </div>
    <div v-else class="container not-found"><p class="not-found-title">项目未公开或不存在</p><router-link to="/engineering" class="btn btn-primary">返回工程档案</router-link></div>
  </section>
</template>
