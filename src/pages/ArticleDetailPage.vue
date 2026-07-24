<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { loadArticleContent } from '../data/articles'
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

const articleSummary = computed(() => getArticleBySlug(slug.value))
const articleContent = ref<string>()
const loadingArticle = ref(false)
const articleLoadFailed = ref(false)
let loadVersion = 0

watch(slug, async currentSlug => {
  const version = ++loadVersion
  articleContent.value = undefined
  articleLoadFailed.value = false

  if (!getArticleBySlug(currentSlug)) {
    loadingArticle.value = false
    return
  }

  loadingArticle.value = true
  try {
    const content = await loadArticleContent(currentSlug)
    if (version !== loadVersion) return
    if (content === undefined) articleLoadFailed.value = true
    else articleContent.value = content
  } catch {
    if (version === loadVersion) articleLoadFailed.value = true
  } finally {
    if (version === loadVersion) loadingArticle.value = false
  }
}, { immediate: true })

const article = computed(() => {
  if (!articleSummary.value || articleContent.value === undefined) return undefined
  return { ...articleSummary.value, content: articleContent.value }
})
const relatedProjects = computed(() => (articleSummary.value ? getProjectsByIds(articleSummary.value.relatedProjectIds) : []))
const recommendedArticles = computed(() => (articleSummary.value ? getArticlesBySlugs(articleSummary.value.recommendedSlugs) : []))
const seriesArticles = computed(() => {
  if (!articleSummary.value?.series) return []
  return siteArticles
    .filter(item => item.series === articleSummary.value?.series)
    .sort((a, b) => (a.seriesOrder || 0) - (b.seriesOrder || 0))
})
const nextArticle = computed(() => {
  if (!articleSummary.value) return undefined

  const index = siteArticles.findIndex(a => a.slug === articleSummary.value?.slug)
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
  return `<tr>${normalizedCells.map(cell => `<${tag}>${renderInlineMarkdown(cell)}</${tag}>`).join('')}</tr>`
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
      result.push('<h4>' + renderInlineMarkdown(line.slice(4)) + '</h4>')
      continue
    }
    if (line.startsWith('## ')) {
      if (inList) { result.push('</ul>'); inList = false }
      result.push('<h3>' + renderInlineMarkdown(line.slice(3)) + '</h3>')
      continue
    }
    if (line.startsWith('# ')) {
      if (inList) { result.push('</ul>'); inList = false }
      result.push('<h2>' + renderInlineMarkdown(line.slice(2)) + '</h2>')
      continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      if (inList) { result.push('</ul>'); inList = false }
      result.push('<blockquote>' + renderInlineMarkdown(line.slice(2)) + '</blockquote>')
      continue
    }

    // List items
    if (line.startsWith('- ')) {
      if (!inList) {
        result.push('<ul class="article-list">')
        inList = true
      }
      result.push('<li>' + renderInlineMarkdown(line.slice(2)) + '</li>')
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
    result.push('<p>' + renderInlineMarkdown(line) + '</p>')
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

function renderInlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/g, (_, label: string, url: string) => {
      const external = url.startsWith('http')
      return `<a href="${url}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`
    })
}

function goHome() {
  router.push('/')
}

watchEffect(() => {
  if (!articleSummary.value) {
    setSeoMeta({
      title: 'Article not found | xiuqiu',
      description: 'The requested xiuqiu writing page was not found.',
      path: route.fullPath,
    })
    return
  }

  setSeoMeta({
    title: `${articleSummary.value.title}｜xiuqiu 工程笔记`,
    description: articleSummary.value.summary,
    path: `/articles/${articleSummary.value.slug}`,
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
            <span v-if="article.series" class="meta-tag">{{ article.series }} · {{ article.seriesOrder }}/{{ seriesArticles.length }}</span>
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
        <div v-if="article.series" class="followup-block article-series-block">
          <div class="article-series-heading">
            <div>
              <p class="section-label">系列阅读</p>
              <h2>{{ article.series }}</h2>
            </div>
            <span>{{ article.seriesOrder }} / {{ seriesArticles.length }}</span>
          </div>
          <div class="article-series-links">
            <router-link
              v-for="item in seriesArticles"
              :key="item.slug"
              :to="`/articles/${item.slug}`"
              :class="{ current: item.slug === article.slug }"
            >
              <span>{{ String(item.seriesOrder).padStart(2, '0') }}</span>
              <strong>{{ item.title }}</strong>
            </router-link>
          </div>
        </div>

        <div class="followup-block">
          <p class="section-label">相关项目</p>
          <div class="followup-grid">
            <article v-for="project in relatedProjects" :key="project.id" class="followup-card">
              <h3>{{ project.name }}</h3>
              <p>{{ project.positioning }}</p>
              <router-link class="project-link" :to="`/projects/${project.slug}`">
                查看项目档案 &rarr;
              </router-link>
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
          <p class="section-label">延伸问题</p>
          <div class="suggested-question-list">
            <p
              v-for="question in article.suggestedQuestions"
              :key="question"
              class="suggested-question"
            >
              {{ question }}
            </p>
          </div>
        </div>

        <router-link v-if="nextArticle" :to="'/articles/' + nextArticle.slug" class="next-article">
          <span>下一篇</span>
          <strong>{{ nextArticle.title }}</strong>
        </router-link>
      </section>
    </div>

    <div v-else-if="loadingArticle" class="container article-loading" role="status">
      <p class="section-label">工程笔记</p>
      <p>正在加载正文…</p>
    </div>

    <div class="container" v-else>
      <div class="not-found">
        <p class="not-found-title">{{ articleLoadFailed ? '正文加载失败' : '文章不存在' }}</p>
        <p class="not-found-desc">{{ articleLoadFailed ? '文章元数据存在，但正文暂时无法加载，请稍后重试。' : '请检查链接，或返回浏览全部工程笔记。' }}</p>
        <router-link to="/articles" class="btn btn-primary">查看全部工程笔记</router-link>
      </div>
    </div>
  </section>
</template>
