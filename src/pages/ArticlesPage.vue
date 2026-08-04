<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { siteArticles, siteArticlesByNewest, siteKnowledge } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const route = useRoute()

type SiteArticle = (typeof siteArticles)[number]
type ArticleKind = SiteArticle['kind']
type CuratedTopicId =
  | 'all'
  | 'wallet-security'
  | 'wallet-backend'
  | 'multi-chain'
  | 'signing'
  | 'go-infra'
  | 'evm'
  | 'ai-engineering'

const walletSecuritySeries = '钱包签名与基础设施安全'
const query = ref('')
const selectedKind = ref<'All' | ArticleKind>('All')
const selectedTopic = ref<CuratedTopicId>(
  route.query.series === walletSecuritySeries ? 'wallet-security' : 'all',
)
const visibleLimit = ref(12)

const curatedTopics: { id: CuratedTopicId; title: string }[] = [
  { id: 'all', title: '全部' },
  { id: 'wallet-security', title: '钱包安全' },
  { id: 'wallet-backend', title: '钱包后端' },
  { id: 'multi-chain', title: '多链模型' },
  { id: 'signing', title: '签名与 TSS' },
  { id: 'go-infra', title: 'Go 工程' },
  { id: 'evm', title: 'EVM' },
  { id: 'ai-engineering', title: 'AI 工程' },
]
const kindOptions = [
  { id: 'All', title: '全部内容类型' },
  { id: 'engineering-note', title: '工程笔记' },
  { id: 'research', title: '技术研究' },
  { id: 'learning-log', title: '学习复盘' },
] as const
const evidenceLabels = { design: '架构设计', 'source-reviewed': '资料与代码复核', 'local-verified': '本地已验证', integrated: '已集成验证', 'public-demo': '公开可运行' } as const

const prioritizedArticles = [...siteArticlesByNewest].sort((a, b) => {
  const securityOrder = Number(b.series === walletSecuritySeries) - Number(a.series === walletSecuritySeries)
  return securityOrder || b.date.localeCompare(a.date) || b.id - a.id
})

function matchesTopic(article: SiteArticle, topic: CuratedTopicId) {
  if (topic === 'all') return true
  if (topic === 'wallet-security') return article.series === walletSecuritySeries
  if (topic === 'signing') {
    return article.conceptTags.includes('signer-service') || article.conceptTags.includes('mpc-tss')
  }
  return article.conceptTags.includes(topic)
}

const filteredArticles = computed(() => {
  const keyword = query.value.trim().toLowerCase()

  return prioritizedArticles.filter(article => {
    const matchesKeyword =
      !keyword ||
      [
        article.title,
        article.summary,
        article.tags.join(' '),
        article.conceptTags.join(' '),
        article.suggestedQuestions.join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    const matchesKind = selectedKind.value === 'All' || article.kind === selectedKind.value

    return matchesKeyword && matchesKind && matchesTopic(article, selectedTopic.value)
  })
})

const visibleArticles = computed(() => filteredArticles.value.slice(0, visibleLimit.value))
const securitySeriesArticles = [...siteArticles]
  .filter(article => article.series === walletSecuritySeries)
  .sort((a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0))

function resetFilters() {
  query.value = ''
  selectedKind.value = 'All'
  selectedTopic.value = 'all'
}

function showMore() {
  visibleLimit.value += 12
}

watch([query, selectedKind, selectedTopic], () => {
  visibleLimit.value = 12
})

onMounted(() => {
  setSeoMeta({
    title: '工程笔记｜xiuqiu Web3 钱包学习档案',
    description: `${siteKnowledge.articles.length} 篇关于交易所钱包、多链模型、签名服务、Go 后端与 AI 工程工作流的学习笔记。`,
    path: '/articles',
  })
})
</script>

<template>
  <section class="section page-top articles-page">
    <div class="container">
      <div class="section-heading">
        <p class="section-label">工程笔记</p>
        <h1 class="section-title">从项目问题到可复查的学习记录</h1>
        <p class="section-desc">
          记录钱包架构、服务通信、签名边界、资金状态与后端数据流中的真实问题和验证过程。
        </p>
        <p class="article-count">显示 {{ visibleArticles.length }} / 匹配 {{ filteredArticles.length }} / 共 {{ siteArticles.length }} 篇</p>
      </div>

      <div class="writing-tools articles-tools">
        <label class="search-box">
          <span>搜索</span>
          <input v-model="query" type="search" placeholder="wallet-api, gRPC, EVM, signer..." />
        </label>

        <label class="filter-box">
          <span>内容类型</span>
          <select v-model="selectedKind">
            <option v-for="kind in kindOptions" :key="kind.id" :value="kind.id">{{ kind.title }}</option>
          </select>
        </label>

        <button class="filter-reset" type="button" @click="resetFilters">重置</button>
      </div>

      <div class="article-curated-topics" aria-label="精选主题">
        <button
          v-for="topic in curatedTopics"
          :key="topic.id"
          type="button"
          :aria-pressed="selectedTopic === topic.id"
          :class="{ active: selectedTopic === topic.id }"
          @click="selectedTopic = topic.id"
        >
          {{ topic.title }}
        </button>
      </div>

      <section v-if="securitySeriesArticles.length" class="articles-security-path" aria-labelledby="security-path-title">
        <div>
          <p class="section-label">Recommended First</p>
          <h2 id="security-path-title">钱包签名与基础设施安全</h2>
          <p>从业务意图、密码学实现与密钥后端，延伸到供应链和 RPC 信任边界。</p>
        </div>
        <ol>
          <li v-for="article in securitySeriesArticles" :key="article.slug">
            <router-link :to="`/articles/${article.slug}`">
              <span>{{ String(article.seriesOrder ?? 0).padStart(2, '0') }}</span>
              {{ article.title }}
            </router-link>
          </li>
        </ol>
      </section>

      <div class="article-grid">
        <router-link
          v-for="a in visibleArticles"
          :key="a.id"
          :to="'/articles/' + a.slug"
          class="article-card article-card-link"
        >
          <time class="article-date">{{ a.date }}</time>
          <h3 class="article-title">{{ a.title }}</h3>
          <p class="article-summary">{{ a.summary }}</p>
          <div class="article-meta">
            <span class="meta-tag">{{ kindOptions.find(kind => kind.id === a.kind)?.title }}</span>
            <span v-if="a.series" class="meta-tag">{{ a.series }} · {{ a.seriesOrder }}</span>
            <span v-if="a.evidenceLevel" class="meta-tag evidence-meta">{{ evidenceLabels[a.evidenceLevel] }}</span>
            <span class="meta-tag">{{ a.difficulty }}</span>
            <span class="meta-reading">{{ a.readingTime }}</span>
          </div>
          <div class="article-tags">
            <span v-for="tag in a.tags.slice(0, 3)" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </router-link>
      </div>

      <div v-if="visibleArticles.length < filteredArticles.length" class="articles-load-more">
        <button class="btn btn-secondary" type="button" @click="showMore">
          再显示 {{ Math.min(12, filteredArticles.length - visibleArticles.length) }} 篇
        </button>
      </div>

      <div v-if="filteredArticles.length === 0" class="empty-state">
        <p class="not-found-title">没有匹配的笔记</p>
        <p class="not-found-desc">可以尝试其他主题、内容类型或关键词。</p>
        <button class="btn btn-secondary" type="button" @click="resetFilters">重置筛选</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.articles-tools {
  grid-template-columns: minmax(260px, 1fr) minmax(190px, 0.38fr) auto;
}

.article-curated-topics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin: 1rem 0 2.25rem;
}

.article-curated-topics button {
  padding: 0.52rem 0.85rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg);
  color: var(--text-secondary);
  font: inherit;
  font-size: 0.84rem;
  cursor: pointer;
}

.article-curated-topics button:hover,
.article-curated-topics button:focus-visible,
.article-curated-topics button.active {
  border-color: var(--accent);
  color: var(--accent);
}

.article-curated-topics button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 28%, transparent);
  outline-offset: 2px;
}

.articles-security-path {
  display: grid;
  grid-template-columns: minmax(220px, 0.7fr) minmax(0, 1.3fr);
  gap: 2rem;
  margin-bottom: 2.5rem;
  padding: 1.75rem 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.articles-security-path h2 {
  margin: 0.45rem 0 0.6rem;
  font-size: clamp(1.3rem, 2.4vw, 1.85rem);
}

.articles-security-path > div > p:last-child {
  margin: 0;
  color: var(--text-muted);
}

.articles-security-path ol {
  display: grid;
  gap: 0;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.articles-security-path li + li {
  border-top: 1px solid var(--border-light);
}

.articles-security-path a {
  display: grid;
  grid-template-columns: 2.2rem minmax(0, 1fr);
  gap: 0.65rem;
  min-width: 0;
  padding: 0.55rem 0;
  line-height: 1.5;
}

.articles-security-path a:hover,
.articles-security-path a:focus-visible {
  color: var(--accent);
}

.articles-security-path a span {
  color: var(--text-muted);
  font-family: var(--mono);
  font-size: 0.76rem;
}

.articles-load-more {
  display: flex;
  justify-content: center;
  margin-top: 2rem;
}

@media (max-width: 768px) {
  .articles-tools,
  .articles-security-path {
    grid-template-columns: minmax(0, 1fr);
  }

  .articles-security-path {
    gap: 1.25rem;
  }
}
</style>
