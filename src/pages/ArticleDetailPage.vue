<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { articles } from '../data/articles'

const route = useRoute()
const router = useRouter()
const slug = route.params.slug as string

const article = computed(() => articles.find(a => a.slug === slug))

function renderContent(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let inList = false
  let inCode = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Code block fence
    if (line.startsWith('```')) {
      if (inCode) {
        result.push('</pre>')
        inCode = false
      } else {
        if (inList) { result.push('</ul>'); inList = false }
        result.push('<pre class="code-block">')
        inCode = true
      }
      continue
    }

    if (inCode) {
      result.push(escapeHtml(line))
      continue
    }

    // Headers
    if (line.startsWith('### ')) {
      if (inList) { result.push('</ul>'); inList = false }
      result.push('<h4>' + line.slice(4) + '</h4>')
      continue
    }
    if (line.startsWith('## ')) {
      if (inList) { result.push('</ul>'); inList = false }
      result.push('<h3>' + line.slice(3) + '</h3>')
      continue
    }
    if (line.startsWith('# ')) {
      if (inList) { result.push('</ul>'); inList = false }
      result.push('<h2>' + line.slice(2) + '</h2>')
      continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      if (inList) { result.push('</ul>'); inList = false }
      result.push('<blockquote>' + line.slice(2) + '</blockquote>')
      continue
    }

    // List items
    if (line.startsWith('- ')) {
      if (!inList) {
        result.push('<ul class="article-list">')
        inList = true
      }
      result.push('<li>' + line.slice(2) + '</li>')
      continue
    } else if (inList) {
      result.push('</ul>')
      inList = false
    }

    // Empty line = paragraph break
    if (line.trim() === '') {
      if (inList) { result.push('</ul>'); inList = false }
      result.push('<p class="p-break"></p>')
      continue
    }

    // Regular paragraph
    if (inList) { result.push('</ul>'); inList = false }
    result.push('<p>' + line + '</p>')
  }

  // Close any open tags
  if (inList) result.push('</ul>')
  if (inCode) result.push('</pre>')

  return result.join('\n')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function goHome() {
  router.push('/')
}
</script>

<template>
  <section class="section page-top">
    <div class="container article-detail-container" v-if="article">
      <router-link to="/articles" class="back-link">&larr; Back to Writing</router-link>

      <article class="article-detail">
        <header class="article-detail-header">
          <div class="article-detail-meta">
            <time class="meta-tag">{{ article.date }}</time>
            <span class="meta-tag">{{ article.difficulty }}</span>
            <span class="meta-reading">{{ article.readingTime }}</span>
          </div>
          <h1 class="article-detail-title">{{ article.title }}</h1>
          <p class="article-detail-summary">{{ article.summary }}</p>
          <div class="article-tags">
            <span v-for="tag in article.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </header>

        <div
          class="article-detail-body"
          v-html="renderContent(article.content)"
        ></div>

        <footer class="article-detail-footer">
          <router-link to="/articles" class="back-link">&larr; Back to Writing</router-link>
          <a href="#" @click.prevent="goHome" class="back-link">Back to Home</a>
        </footer>
      </article>
    </div>

    <div class="container" v-else>
      <div class="not-found">
        <p class="not-found-title">Article not found</p>
        <p class="not-found-desc">The article you're looking for doesn't exist. Check the URL or browse all articles.</p>
        <router-link to="/articles" class="btn btn-primary">View All Writing</router-link>
      </div>
    </div>
  </section>
</template>
