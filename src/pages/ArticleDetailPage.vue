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
const evidenceLabels = { design: '架构设计', 'source-reviewed': '资料与代码复核', 'local-verified': '本地已验证', integrated: '已集成验证', 'public-demo': '公开可运行' } as const

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

function splitTableRow(line: string): string[] {
  let row = line.trim()

  if (row.startsWith('|')) row = row.slice(1)
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1)

  const cells: string[] = []
  let cell = ''
  let escaped = false

  for (const char of row) {
    if (escaped) {
      cell += char === '|' ? '|' : `\\${char}`
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '|') {
      cells.push(cell.trim())
      cell = ''
      continue
    }

    cell += char
  }

  if (escaped) cell += '\\'
  cells.push(cell.trim())

  return cells
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line)
  return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell))
}

function renderTableRow(cells: string[], tag: 'th' | 'td', columnCount: number): string {
  const normalizedCells = Array.from({ length: columnCount }, (_, index) => cells[index] || '')
  return `<tr>${normalizedCells.map(cell => `<${tag}>${escapeHtml(cell)}</${tag}>`).join('')}</tr>`
}

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

    // GFM-style table: header row followed by a separator row.
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headerCells = splitTableRow(line)
      const separatorCells = splitTableRow(lines[i + 1])

      if (headerCells.length === separatorCells.length) {
        if (inList) { result.push('</ul>'); inList = false }

        const bodyRows: string[][] = []
        let nextLineIndex = i + 2

        while (nextLineIndex < lines.length && lines[nextLineIndex].trim() && lines[nextLineIndex].includes('|')) {
          bodyRows.push(splitTableRow(lines[nextLineIndex]))
          nextLineIndex++
        }

        result.push('<div class="article-table-wrap">')
        result.push('<table class="article-table">')
        result.push(`<thead>${renderTableRow(headerCells, 'th', headerCells.length)}</thead>`)
        if (bodyRows.length) {
          result.push(`<tbody>${bodyRows.map(row => renderTableRow(row, 'td', headerCells.length)).join('')}</tbody>`)
        }
        result.push('</table>')
        result.push('</div>')

        i = nextLineIndex - 1
        continue
      }
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
    title: `${article.value.title}｜xiuqiu 工程笔记`,
    description: article.value.summary,
    path: `/articles/${article.value.slug}`,
    type: 'article',
  })
})
</script>

<template>
  <section class="section page-top">
    <div class="container article-detail-container" v-if="article">
      <router-link to="/articles" class="back-link">&larr; 返回工程笔记</router-link>

      <article class="article-detail">
        <header class="article-detail-header">
          <div class="article-detail-meta">
            <time class="meta-tag">{{ article.date }}</time>
            <span v-if="article.updatedAt" class="meta-tag">Updated {{ article.updatedAt }}</span>
            <span class="meta-tag">{{ article.difficulty }}</span>
            <span v-if="article.evidenceLevel" class="meta-tag evidence-meta">{{ evidenceLabels[article.evidenceLevel] }}</span>
            <span class="meta-reading">{{ article.readingTime }}</span>
          </div>
          <h1 class="article-detail-title">{{ article.title }}</h1>
          <p class="article-detail-summary">{{ article.summary }}</p>
          <aside v-if="article.evidenceSummary" class="article-evidence-note"><strong>证据边界</strong><p>{{ article.evidenceSummary }}</p></aside>
          <div class="article-tags">
            <span v-for="tag in article.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </header>

        <div
          class="article-detail-body"
          v-html="renderContent(article.content)"
        ></div>

        <footer class="article-detail-footer">
          <router-link to="/articles" class="back-link">&larr; 返回工程笔记</router-link>
          <a href="#" @click.prevent="goHome" class="back-link">返回首页</a>
        </footer>
      </article>

      <section class="article-followup">
        <div class="followup-block">
          <p class="section-label">相关项目</p>
          <div class="followup-grid">
            <article v-for="project in relatedProjects" :key="project.id" class="followup-card">
              <h3>{{ project.name }}</h3>
              <p>{{ project.positioning }}</p>
              <button
                class="project-link project-link-button"
                type="button"
                @click="askQuestion(`请结合《${article.title}》解释 ${project.name} 项目的工程价值。`)"
              >
                请 AI 结合文章解释 &rarr;
              </button>
            </article>
          </div>
        </div>

        <div class="followup-block">
          <p class="section-label">推荐阅读</p>
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
          <p class="section-label">继续追问</p>
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
          <span>下一篇</span>
          <strong>{{ nextArticle.title }}</strong>
        </router-link>
      </section>
    </div>

    <div class="container" v-else>
      <div class="not-found">
        <p class="not-found-title">文章不存在</p>
        <p class="not-found-desc">请检查链接，或返回浏览全部工程笔记。</p>
        <router-link to="/articles" class="btn btn-primary">查看全部工程笔记</router-link>
      </div>
    </div>
  </section>
</template>
