<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { articles } from '../data/articles'
import {
  getArticleBySlug,
  getArticlesBySlugs,
  getProjectsByIds,
  siteArticles,
} from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const route = useRoute()
const router = useRouter()
const slug = computed(() => route.params.slug as string)

const article = computed(() => {
  const summary = getArticleBySlug(slug.value)
  const fullArticle = articles.find(item => item.slug === slug.value)

  if (!summary || !fullArticle) return undefined
  return {
    ...fullArticle,
    ...summary,
  }
})
const relatedProjects = computed(() => (article.value ? getProjectsByIds(article.value.relatedProjectIds) : []))
const recommendedArticles = computed(() => (article.value ? getArticlesBySlugs(article.value.recommendedSlugs) : []))
const nextArticle = computed(() => {
  if (!article.value) return undefined

  const index = siteArticles.findIndex(a => a.slug === article.value?.slug)
  return siteArticles[(index + 1) % siteArticles.length]
})

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

function askQuestion(question: string) {
  if (!article.value) return

  window.dispatchEvent(
    new CustomEvent('ai-chat:ask', {
      detail: {
        prompt: question,
        context: {
          type: 'article',
          title: article.value.title,
          slug: article.value.slug,
          summary: article.value.summary,
        },
      },
    }),
  )
}

watchEffect(() => {
  if (!article.value) {
    setSeoMeta({
      title: 'Article not found | xiuqiu',
      description: 'The requested xiuqiu writing page was not found.',
      path: route.fullPath,
    })
    return
  }

  setSeoMeta({
    title: `${article.value.title} | xiuqiu Writing`,
    description: article.value.summary,
    path: `/articles/${article.value.slug}`,
    type: 'article',
  })
})
</script>

<template>
  <section class="section page-top">
    <div class="container article-detail-container" v-if="article">
      <router-link to="/articles" class="back-link">&larr; Back to Writing</router-link>

      <article class="article-detail">
        <header class="article-detail-header">
          <div class="article-detail-meta">
            <time class="meta-tag">{{ article.date }}</time>
            <span v-if="article.updatedAt" class="meta-tag">Updated {{ article.updatedAt }}</span>
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

      <section class="article-followup">
        <div class="followup-block">
          <p class="section-label">Related Projects</p>
          <div class="followup-grid">
            <article v-for="project in relatedProjects" :key="project.id" class="followup-card">
              <h3>{{ project.name }}</h3>
              <p>{{ project.positioning }}</p>
              <button
                class="project-link project-link-button"
                type="button"
                @click="askQuestion(`请结合《${article.title}》解释 ${project.name} 项目的工程价值。`)"
              >
                Ask AI &rarr;
              </button>
            </article>
          </div>
        </div>

        <div class="followup-block">
          <p class="section-label">Recommended Reading</p>
          <div class="followup-links">
            <router-link
              v-for="item in recommendedArticles"
              :key="item.slug"
              :to="'/articles/' + item.slug"
              class="followup-link"
            >
              <span>{{ item.title }}</span>
              <small>{{ item.difficulty }} · {{ item.readingTime }}</small>
            </router-link>
          </div>
        </div>

        <div class="followup-block">
          <p class="section-label">Ask Next</p>
          <div class="suggested-question-list">
            <button
              v-for="question in article.suggestedQuestions"
              :key="question"
              class="suggested-question"
              type="button"
              @click="askQuestion(question)"
            >
              {{ question }}
            </button>
          </div>
        </div>

        <router-link v-if="nextArticle" :to="'/articles/' + nextArticle.slug" class="next-article">
          <span>Next Article</span>
          <strong>{{ nextArticle.title }}</strong>
        </router-link>
      </section>
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
