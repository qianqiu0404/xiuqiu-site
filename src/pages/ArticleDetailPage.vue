<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { loadArticleContent } from '../data/articles'
import { getAdjacentArticles } from '../data/articlePresentation'
import { evidenceStatusLabels } from '../data/evidence'
import { evidenceRecords } from '../data/generatedEvidence'
import {
  getArticleBySlug,
  getArticlesBySlugs,
  getProjectsByIds,
  siteArticles,
} from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const route = useRoute()
const slug = computed(() => route.params.slug as string)
const evidenceLabels = { design: '架构设计', 'source-reviewed': '资料与代码复核', 'local-verified': '本地已验证', integrated: '已集成验证', 'public-demo': '公开可运行' } as const
const evidenceKindLabels = { implementation: '工程实现', test: '自动化测试', demo: '可运行演示', writeup: '公开说明' } as const

const articleSummary = computed(() => getArticleBySlug(slug.value))
const articleContent = ref<string>()
const loadingArticle = ref(false)
const articleLoadFailed = ref(false)
let loadVersion = 0

async function loadCurrentArticle(currentSlug: string) {
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
}

watch(slug, currentSlug => loadCurrentArticle(currentSlug), { immediate: true })

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
const linkedEvidence = computed(() => evidenceRecords
  .filter(record => record.articleSlugs?.includes(slug.value))
  .sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt)))
const adjacentArticles = computed(() => getAdjacentArticles(siteArticles, slug.value))
const previousArticle = computed(() => adjacentArticles.value.previous)
const nextArticle = computed(() => adjacentArticles.value.next)
const hasEditorialRelations = computed(() =>
  Boolean(seriesArticles.value.length || relatedProjects.value.length || recommendedArticles.value.length),
)

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

function renderContent(text: string, documentTitle?: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let inList = false
  let inCode = false
  let hasSeenLevelOneHeading = false

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
      const headingText = line.slice(2).trim()
      const repeatsDocumentTitle = !hasSeenLevelOneHeading && headingText === documentTitle
      hasSeenLevelOneHeading = true
      if (!repeatsDocumentTitle) result.push('<h2>' + renderInlineMarkdown(headingText) + '</h2>')
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

watchEffect(() => {
  if (!articleSummary.value) {
    setSeoMeta({
      title: 'Article not found | xiuqiu',
      description: 'The requested xiuqiu writing page was not found.',
      path: route.fullPath,
      indexable: false,
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
  <section class="section page-top article-reader-page">
    <div v-if="article" class="container article-detail-container article-reader-shell">
      <router-link to="/articles" class="back-link">&larr; 返回工程笔记</router-link>

      <article class="article-detail">
        <header class="article-detail-header">
          <div class="article-publish-meta" aria-label="文章发布与更新时间">
            <span>发布 <time :datetime="article.date">{{ article.date }}</time></span>
            <span v-if="article.updatedAt">更新 <time :datetime="article.updatedAt">{{ article.updatedAt }}</time></span>
          </div>
          <div v-if="article.series || relatedProjects.length" class="article-context-meta" aria-label="文章所属系列与项目">
            <span v-if="article.series">系列 · {{ article.series }} · {{ article.seriesOrder }}/{{ seriesArticles.length }}</span>
            <router-link v-for="project in relatedProjects" :key="project.id" :to="`/projects/${project.slug}`">
              项目 · {{ project.name }}
            </router-link>
          </div>
          <div class="article-detail-meta">
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
          v-html="renderContent(article.content, article.title)"
        ></div>
      </article>

      <section class="article-followup" aria-label="文章后续阅读">
        <section v-if="article.series" class="followup-block article-series-block">
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
        </section>

        <section v-if="linkedEvidence.length" class="followup-block">
          <h2 class="section-label">工程证据</h2>
          <div class="article-evidence-links">
            <article v-for="record in linkedEvidence" :key="record.slug">
              <div>
                <span>{{ evidenceKindLabels[record.kind] }}</span>
                <strong :data-status="record.status">{{ evidenceStatusLabels[record.status] }}</strong>
              </div>
              <h3>{{ record.title }}</h3>
              <p>{{ record.summary }}</p>
              <a v-if="record.visibility === 'public' && record.url" :href="record.url" target="_blank" rel="noopener">查看公开证据 &rarr;</a>
              <small v-else>当前为去敏摘要，不提供私有仓库链接。</small>
            </article>
          </div>
        </section>

        <section v-if="relatedProjects.length" class="followup-block">
          <h2 class="section-label">相关项目</h2>
          <div class="followup-grid">
            <article v-for="project in relatedProjects" :key="project.id" class="followup-card">
              <h3>{{ project.name }}</h3>
              <p>{{ project.positioning }}</p>
              <router-link class="project-link" :to="`/projects/${project.slug}`">
                查看项目档案 &rarr;
              </router-link>
            </article>
          </div>
        </section>

        <section v-if="recommendedArticles.length" class="followup-block">
          <h2 class="section-label">推荐阅读</h2>
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
        </section>

        <section v-if="!hasEditorialRelations" class="followup-block article-followup-empty">
          <h2 class="section-label">继续阅读</h2>
          <p>这篇文章暂时没有已公开的系列、相关项目或推荐文章。</p>
          <router-link to="/articles">返回工程笔记列表 &rarr;</router-link>
        </section>

        <nav v-if="previousArticle || nextArticle" class="article-navigation" aria-label="按发布时间继续阅读">
          <router-link v-if="previousArticle" :to="`/articles/${previousArticle.slug}`">
            <span>上一篇</span>
            <strong>{{ previousArticle.title }}</strong>
          </router-link>
          <router-link v-if="nextArticle" :to="`/articles/${nextArticle.slug}`">
            <span>下一篇</span>
            <strong>{{ nextArticle.title }}</strong>
          </router-link>
        </nav>
      </section>

      <footer class="article-detail-footer">
        <router-link to="/articles" class="back-link">&larr; 返回工程笔记</router-link>
      </footer>
    </div>

    <div v-else-if="loadingArticle" class="container article-reader-state" role="status" aria-live="polite" aria-busy="true">
      <p class="article-reader-state__eyebrow">Engineering Notes</p>
      <h1 class="article-reader-state__title">正在加载正文…</h1>
      <p class="article-reader-state__message">文章元数据已经找到，正在读取正文内容。</p>
    </div>

    <div v-else-if="articleLoadFailed" class="container article-reader-state" role="alert">
      <p class="article-reader-state__eyebrow">Load error</p>
      <h1 class="article-reader-state__title">正文暂时无法加载。</h1>
      <p class="article-reader-state__message">文章元数据仍然有效，可重新载入正文，或返回工程笔记列表。</p>
      <div class="article-reader-state__actions">
        <button type="button" class="btn btn-primary" @click="loadCurrentArticle(slug)">重新载入</button>
        <router-link to="/articles" class="btn btn-secondary">查看全部工程笔记</router-link>
      </div>
    </div>

    <div v-else class="container article-reader-state">
      <p class="article-reader-state__eyebrow">Article unavailable</p>
      <h1 class="article-reader-state__title">这篇文章不存在。</h1>
      <p class="article-reader-state__message">链接中的文章标识不在公开内容索引中。请返回列表，从已发布的工程笔记继续阅读。</p>
      <div class="article-reader-state__actions">
        <router-link to="/articles" class="btn btn-primary">查看全部工程笔记</router-link>
      </div>
    </div>
  </section>
</template>
