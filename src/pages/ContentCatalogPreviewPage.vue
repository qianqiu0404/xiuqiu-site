<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  normalizeContentCatalogPreviewPayload,
  type ContentCatalogPreviewPayload,
} from '../data/contentCatalogPreviewContract.ts'
import { buildContentCatalogStaticFallback } from '../data/contentCatalogPreviewFallback.ts'

type PreviewState = 'loading' | 'online' | 'stale' | 'offline'

const catalog = ref<ContentCatalogPreviewPayload | null>(null)
const fallbackCatalog = ref<ContentCatalogPreviewPayload | null>(null)
const state = ref<PreviewState>('loading')
const detail = ref('正在核对本地影子目录与这次 Preview 构建。')
const activeController = ref<AbortController | null>(null)

const statusLabel = computed(() => ({
  loading: '核对中',
  online: '在线 · 已对齐',
  stale: '在线 · 待同步',
  offline: '离线 · 构建快照',
})[state.value])

const shortCommit = computed(() => catalog.value?.audit.sourceCommit.slice(0, 12) ?? '—')
const shortCatalogHash = computed(() => catalog.value?.audit.catalogHash.slice(0, 12) ?? '—')

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(value.includes('T') ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date)
}

async function getFallback(): Promise<ContentCatalogPreviewPayload> {
  if (!fallbackCatalog.value) {
    fallbackCatalog.value = await buildContentCatalogStaticFallback({
      sourceCommit: __CONTENT_CATALOG_FALLBACK_COMMIT__,
      publishedAt: __CONTENT_CATALOG_FALLBACK_PUBLISHED_AT__,
    })
  }
  return fallbackCatalog.value
}

async function loadCatalog(): Promise<void> {
  activeController.value?.abort()
  const controller = new AbortController()
  activeController.value = controller
  state.value = 'loading'
  detail.value = '正在核对本地影子目录与这次 Preview 构建。'

  try {
    const fallback = await getFallback()
    catalog.value = fallback
    const timeout = window.setTimeout(() => controller.abort(), 5_000)
    try {
      const response = await fetch('/api/content-catalog-preview', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })
      if (!response.ok) throw new Error('preview catalog unavailable')
      const remote = normalizeContentCatalogPreviewPayload(await response.json())
      catalog.value = remote
      const aligned = remote.audit.sourceCommit === fallback.audit.sourceCommit
        && remote.audit.catalogHash === fallback.audit.catalogHash
      state.value = aligned ? 'online' : 'stale'
      detail.value = aligned
        ? '本地数据库发布记录与这次 Preview 构建完全一致。'
        : '本地数据库可以读取，但提交或目录哈希与这次 Preview 构建不同；下方展示数据库版本。'
    } finally {
      window.clearTimeout(timeout)
    }
  } catch {
    catalog.value = await getFallback()
    state.value = 'offline'
    detail.value = '本地目录暂时不可达；下方继续展示随这次 Preview 构建生成的 Git 快照。'
  } finally {
    if (activeController.value === controller) activeController.value = null
  }
}

let robotsMeta: HTMLMetaElement | null = null
let previousRobotsContent: string | null = null
let createdRobotsMeta = false

onMounted(() => {
  robotsMeta = document.querySelector('meta[name="robots"]')
  if (!robotsMeta) {
    robotsMeta = document.createElement('meta')
    robotsMeta.name = 'robots'
    document.head.append(robotsMeta)
    createdRobotsMeta = true
  } else {
    previousRobotsContent = robotsMeta.content
  }
  robotsMeta.content = 'noindex, nofollow'
  void loadCatalog()
})

onBeforeUnmount(() => {
  activeController.value?.abort()
  if (createdRobotsMeta) robotsMeta?.remove()
  else if (robotsMeta && previousRobotsContent !== null) robotsMeta.content = previousRobotsContent
})
</script>

<template>
  <section class="catalog-preview" aria-labelledby="catalog-preview-title">
    <header class="catalog-preview__hero">
      <p class="catalog-preview__eyebrow">Preview only · Article Catalog Shadow</p>
      <div class="catalog-preview__heading-row">
        <div>
          <h1 id="catalog-preview-title">文章目录发布校验</h1>
          <p class="catalog-preview__lede">
            核对 Git 构建快照与本地只读目录是否指向同一批公开元数据。
          </p>
        </div>
        <button type="button" class="catalog-preview__refresh" :disabled="state === 'loading'" @click="loadCatalog">
          {{ state === 'loading' ? '核对中…' : '重新核对' }}
        </button>
      </div>

      <div class="catalog-preview__status" :class="`is-${state}`" role="status" aria-live="polite">
        <span class="catalog-preview__status-dot" aria-hidden="true" />
        <div>
          <strong>{{ statusLabel }}</strong>
          <p>{{ detail }}</p>
        </div>
      </div>

      <dl class="catalog-preview__facts" :aria-busy="state === 'loading'">
        <div class="catalog-preview__fact catalog-preview__fact--count">
          <dt>公开文章</dt>
          <dd>{{ catalog?.audit.articleCount ?? '—' }}</dd>
        </div>
        <div class="catalog-preview__fact">
          <dt>提交</dt>
          <dd><code :title="catalog?.audit.sourceCommit">{{ shortCommit }}</code></dd>
        </div>
        <div class="catalog-preview__fact">
          <dt>目录哈希</dt>
          <dd><code :title="catalog?.audit.catalogHash">{{ shortCatalogHash }}</code></dd>
        </div>
        <div class="catalog-preview__fact">
          <dt>Schema</dt>
          <dd>v{{ catalog?.audit.schemaVersion ?? '—' }}</dd>
        </div>
        <div class="catalog-preview__fact">
          <dt>发布时间</dt>
          <dd>
            <time v-if="catalog" :datetime="catalog.audit.publishedAt">{{ formatDate(catalog.audit.publishedAt) }}</time>
            <span v-else>—</span>
          </dd>
        </div>
      </dl>
    </header>

    <div class="catalog-preview__boundary">
      <strong>边界说明</strong>
      <p>这里只展示公开目录字段，不提供正文、内部路径或私有 frontmatter；生产环境没有此页面或代理路由。</p>
    </div>

    <section class="catalog-preview__list" aria-labelledby="catalog-preview-list-title">
      <div class="catalog-preview__section-heading">
        <div>
          <p class="catalog-preview__eyebrow">Public metadata</p>
          <h2 id="catalog-preview-list-title">本次可见目录</h2>
        </div>
        <RouterLink to="/articles">打开正式文章列表</RouterLink>
      </div>

      <p v-if="!catalog" class="catalog-preview__loading">正在准备构建快照…</p>
      <ol v-else class="catalog-preview__articles">
        <li v-for="article in catalog.articles" :key="article.slug">
          <article>
            <div class="catalog-preview__article-meta">
              <time :datetime="article.publishedAt">发布 {{ formatDate(article.publishedAt) }}</time>
              <time v-if="article.updatedAt" :datetime="article.updatedAt">更新 {{ formatDate(article.updatedAt) }}</time>
              <code>{{ article.sourceHash.slice(0, 10) }}</code>
            </div>
            <h3><RouterLink :to="`/articles/${article.slug}`">{{ article.title }}</RouterLink></h3>
            <p>{{ article.summary }}</p>
          </article>
        </li>
      </ol>
    </section>
  </section>
</template>

<style scoped>
.catalog-preview {
  --catalog-ink: #17233b;
  --catalog-muted: #647089;
  --catalog-line: rgba(23, 35, 59, 0.14);
  --catalog-paper: #fbf8f1;
  width: min(1120px, calc(100% - 40px));
  margin: 0 auto;
  padding: clamp(56px, 7vw, 96px) 0 96px;
  color: var(--catalog-ink);
}

.catalog-preview__hero {
  padding: clamp(24px, 4vw, 48px);
  border: 1px solid var(--catalog-line);
  border-radius: 28px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.95), var(--catalog-paper));
  box-shadow: 0 20px 60px rgba(38, 46, 67, 0.08);
}

.catalog-preview__eyebrow {
  margin: 0 0 12px;
  color: #5b6096;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.catalog-preview__heading-row,
.catalog-preview__section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.catalog-preview h1 {
  max-width: 13ch;
  margin: 0;
  font-size: clamp(2.25rem, 5vw, 4.5rem);
  line-height: 0.98;
  letter-spacing: -0.055em;
}

.catalog-preview__lede {
  max-width: 650px;
  margin: 20px 0 0;
  color: var(--catalog-muted);
  font-size: clamp(1rem, 1.7vw, 1.2rem);
  line-height: 1.75;
}

.catalog-preview__refresh,
.catalog-preview__section-heading a {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(44, 61, 112, 0.22);
  border-radius: 999px;
  padding: 0 18px;
  color: #344ca1;
  background: rgba(255, 255, 255, 0.72);
  font: inherit;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}

.catalog-preview__refresh:disabled {
  cursor: wait;
  opacity: 0.65;
}

.catalog-preview__refresh:focus-visible,
.catalog-preview a:focus-visible {
  outline: 3px solid #ce5c40;
  outline-offset: 3px;
}

.catalog-preview__status {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-top: 32px;
  padding: 16px 18px;
  border: 1px solid rgba(49, 91, 76, 0.2);
  border-radius: 16px;
  background: rgba(226, 241, 233, 0.68);
}

.catalog-preview__status.is-stale { background: rgba(248, 229, 186, 0.55); }
.catalog-preview__status.is-offline { background: rgba(232, 232, 235, 0.7); }
.catalog-preview__status.is-loading { background: rgba(225, 231, 246, 0.65); }

.catalog-preview__status-dot {
  flex: 0 0 10px;
  width: 10px;
  height: 10px;
  margin-top: 7px;
  border-radius: 50%;
  background: #388466;
}

.catalog-preview__status.is-stale .catalog-preview__status-dot { background: #bd7b16; }
.catalog-preview__status.is-offline .catalog-preview__status-dot { background: #717788; }
.catalog-preview__status.is-loading .catalog-preview__status-dot { background: #5870ba; }

.catalog-preview__status p {
  margin: 4px 0 0;
  color: var(--catalog-muted);
  line-height: 1.55;
}

.catalog-preview__facts {
  display: grid;
  grid-template-columns: 1.15fr repeat(4, 1fr);
  margin: 24px 0 0;
  border-top: 1px solid var(--catalog-line);
}

.catalog-preview__fact {
  min-width: 0;
  padding: 20px 14px 0;
  border-left: 1px solid var(--catalog-line);
}

.catalog-preview__fact:first-child { border-left: 0; padding-left: 0; }
.catalog-preview__fact dt { color: var(--catalog-muted); font-size: 0.75rem; }
.catalog-preview__fact dd { margin: 8px 0 0; font-size: 1rem; font-weight: 700; }
.catalog-preview__fact--count dd { font-size: 2.5rem; line-height: 1; }
.catalog-preview__fact code { font-size: 0.82rem; overflow-wrap: anywhere; }

.catalog-preview__boundary {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 20px;
  margin: 28px 0 72px;
  padding: 18px 22px;
  border-left: 3px solid #d55f43;
  color: var(--catalog-muted);
  background: rgba(255, 255, 255, 0.55);
}

.catalog-preview__boundary strong { color: var(--catalog-ink); }
.catalog-preview__boundary p { margin: 0; line-height: 1.65; }
.catalog-preview__section-heading { align-items: flex-end; margin-bottom: 24px; }
.catalog-preview__section-heading h2 { margin: 0; font-size: clamp(1.75rem, 3vw, 2.6rem); letter-spacing: -0.035em; }
.catalog-preview__section-heading .catalog-preview__eyebrow { margin-bottom: 8px; }

.catalog-preview__articles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.catalog-preview__articles li {
  min-width: 0;
  border: 1px solid var(--catalog-line);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.72);
}

.catalog-preview__articles article { padding: clamp(20px, 3vw, 30px); }
.catalog-preview__article-meta { display: flex; flex-wrap: wrap; gap: 8px 14px; color: var(--catalog-muted); font-size: 0.75rem; }
.catalog-preview__articles h3 { margin: 18px 0 10px; font-size: clamp(1.15rem, 2vw, 1.45rem); line-height: 1.3; }
.catalog-preview__articles h3 a { display: flex; min-height: 44px; align-items: center; color: inherit; text-decoration-thickness: 1px; text-underline-offset: 5px; }
.catalog-preview__articles p { margin: 0; color: var(--catalog-muted); line-height: 1.7; }
.catalog-preview__loading { min-height: 160px; color: var(--catalog-muted); }

@media (max-width: 760px) {
  .catalog-preview { width: min(100% - 28px, 1120px); padding-top: 32px; }
  .catalog-preview__hero { border-radius: 20px; }
  .catalog-preview__heading-row,
  .catalog-preview__section-heading { align-items: stretch; flex-direction: column; }
  .catalog-preview__refresh,
  .catalog-preview__section-heading a { align-self: flex-start; }
  .catalog-preview__facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .catalog-preview__fact { padding: 18px 10px 0; border-left: 0; }
  .catalog-preview__fact:nth-child(even) { border-left: 1px solid var(--catalog-line); padding-left: 16px; }
  .catalog-preview__boundary { grid-template-columns: 1fr; gap: 8px; margin-bottom: 56px; }
  .catalog-preview__articles { grid-template-columns: 1fr; }
}

@media (max-width: 360px) {
  .catalog-preview { width: min(100% - 20px, 1120px); }
  .catalog-preview__hero { padding: 20px 16px; }
  .catalog-preview h1 { font-size: 2.15rem; }
  .catalog-preview__fact dd { font-size: 0.9rem; }
  .catalog-preview__article-meta { flex-direction: column; }
}

@media (prefers-reduced-motion: reduce) {
  .catalog-preview *,
  .catalog-preview *::before,
  .catalog-preview *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
</style>
