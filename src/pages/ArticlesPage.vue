<script setup lang="ts">
import { articles } from '../data/articles'
</script>

<template>
  <section class="section page-top">
    <div class="container">
      <div class="section-heading">
        <p class="section-eyebrow">Articles</p>
        <h2 class="section-title">技术文章</h2>
        <p class="section-desc">
          这些文章围绕 Web3 钱包、Go 后端、服务通信和 AI 编程工作流展开，
          用于沉淀项目拆解和面试表达。
        </p>
        <p class="article-count">共 {{ articles.length }} 篇</p>
      </div>

      <div class="article-grid">
        <router-link
          v-for="a in articles"
          :key="a.id"
          :to="'/articles/' + a.slug"
          class="article-card article-card-link"
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
        </router-link>
      </div>
    </div>
  </section>
</template>
