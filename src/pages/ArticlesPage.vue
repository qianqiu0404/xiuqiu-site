<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { siteArticles, siteArticlesByNewest, siteKnowledge } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

type SiteArticle = (typeof siteArticles)[number]
type ArticleKind = SiteArticle['kind']

const query = ref('')
const selectedKind = ref<'All' | ArticleKind>('All')
const visibleLimit = ref(16)

const kindOptions = [
  { id: 'All', title: '全部内容类型' },
  { id: 'engineering-note', title: '工程笔记' },
  { id: 'research', title: '技术研究' },
  { id: 'learning-log', title: '学习复盘' },
] as const
const evidenceLabels = {
  design: '架构设计',
  'source-reviewed': '资料与代码复核',
  'local-verified': '本地已验证',
  integrated: '已集成验证',
  'public-demo': '公开可运行',
} as const

const prioritizedArticles = [...siteArticlesByNewest].sort((a, b) =>
  b.date.localeCompare(a.date) || (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || b.id - a.id,
)

const featuredPriority = [
  'evm-broadcast-unknown-canonical-recovery',
  'qiu-market-virtual-funds-recovery',
  'codex-ai-workflow-system-retrospective',
]
const featuredArticles = [
  ...featuredPriority
    .map(slug => prioritizedArticles.find(article => article.slug === slug))
    .filter((article): article is SiteArticle => Boolean(article)),
  ...prioritizedArticles,
]
  .filter((article, index, all) => all.findIndex(candidate => candidate.slug === article.slug) === index)
  .slice(0, 3)

interface EditorialLaneDefinition {
  id: string
  label: string
  title: string
  description: string
  matches: (article: SiteArticle) => boolean
}

const laneDefinitions: EditorialLaneDefinition[] = [
  {
    id: 'wallet-platform',
    label: 'Wallet Platform',
    title: '资金状态与签名边界',
    description: '从提现生命周期、多链资源到签名安全，理解钱包后端如何守住资产控制权。',
    matches: article =>
      article.relatedProjectIds.includes(1)
      || article.conceptTags.some(tag => ['wallet-backend', 'signer-service', 'multi-chain', 'mpc-tss'].includes(tag)),
  },
  {
    id: 'qiu-market',
    label: 'Qiu Market',
    title: '交易系统与后端数据流',
    description: '围绕虚拟资金、撮合、账本、恢复和 Go 服务边界，记录另一条项目主线。',
    matches: article =>
      article.relatedProjectIds.includes(3)
      || article.conceptTags.some(tag => ['go-infra', 'api-design'].includes(tag)),
  },
  {
    id: 'ai-engineering',
    label: 'AI Engineering',
    title: '把 AI 变成可复核工作流',
    description: '关注计划、执行、审查、验证与知识治理，而不是把模型输出当作完成证据。',
    matches: article => article.conceptTags.includes('ai-engineering') || article.kind === 'learning-log',
  },
]

const usedInEditorial = new Set(featuredArticles.map(article => article.slug))
const editorialLanes = laneDefinitions
  .map(lane => {
    const articles = prioritizedArticles
      .filter(article => !usedInEditorial.has(article.slug) && lane.matches(article))
      .slice(0, 3)
    articles.forEach(article => usedInEditorial.add(article.slug))
    return { ...lane, articles }
  })
  .filter(lane => lane.articles.length)

const filteredArticles = computed(() => {
  const keyword = query.value.trim().toLowerCase()

  return prioritizedArticles.filter(article => {
    const matchesKeyword =
      !keyword
      || [
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

    return matchesKeyword && matchesKind
  })
})

const visibleArticles = computed(() => filteredArticles.value.slice(0, visibleLimit.value))

function kindLabel(kind: ArticleKind) {
  return kindOptions.find(option => option.id === kind)?.title ?? kind
}

function resetFilters() {
  query.value = ''
  selectedKind.value = 'All'
}

function showMore() {
  visibleLimit.value += 16
}

watch([query, selectedKind], () => {
  visibleLimit.value = 16
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
  <main class="articles-editorial-page">
    <header class="articles-hero">
      <div class="container articles-shell">
        <p class="articles-kicker">Engineering Notes / {{ siteArticles.length }} Records</p>
        <div class="articles-hero-copy">
          <h1>从项目问题，<br />写到可复查的判断。</h1>
          <p>
            这里不是知识卡片墙。每篇记录都从 Wallet Platform、Qiu Market 或 AI 工程中的具体问题出发，
            区分设计、资料复核与真实验证。
          </p>
        </div>

        <section v-if="featuredArticles.length" class="featured-reading" aria-labelledby="featured-reading-title">
          <div class="editorial-section-heading">
            <div>
              <p class="articles-kicker">01 · Selected Reading</p>
              <h2 id="featured-reading-title">先从这三篇开始</h2>
            </div>
            <p>两条项目主线与一条 AI 工作流，各选一篇最能说明工程判断的记录。</p>
          </div>

          <div class="featured-reading-grid">
            <router-link
              v-for="(article, index) in featuredArticles"
              :key="article.slug"
              :to="`/articles/${article.slug}`"
              class="featured-reading-item"
            >
              <div class="featured-reading-meta">
                <span>{{ String(index + 1).padStart(2, '0') }}</span>
                <time :datetime="article.date">{{ article.updatedAt ?? article.date }}</time>
              </div>
              <div>
                <p>{{ kindLabel(article.kind) }}</p>
                <h3>{{ article.title }}</h3>
                <p>{{ article.summary }}</p>
              </div>
              <span class="featured-reading-arrow" aria-hidden="true">↗</span>
            </router-link>
          </div>
        </section>
      </div>
    </header>

    <section v-if="editorialLanes.length" class="reading-lanes" aria-labelledby="reading-lanes-title">
      <div class="container articles-shell">
        <div class="editorial-section-heading">
          <div>
            <p class="articles-kicker">02 · Project Lanes</p>
            <h2 id="reading-lanes-title">沿项目继续阅读</h2>
          </div>
          <p>三个入口足够：钱包基础设施、交易系统，以及贯穿两者的 AI 工程方法。</p>
        </div>

        <div class="reading-lanes-grid">
          <article v-for="lane in editorialLanes" :key="lane.id" class="reading-lane">
            <header>
              <p>{{ lane.label }}</p>
              <h3>{{ lane.title }}</h3>
              <span>{{ lane.description }}</span>
            </header>
            <ol>
              <li v-for="(article, index) in lane.articles" :key="article.slug">
                <router-link :to="`/articles/${article.slug}`">
                  <span>{{ String(index + 1).padStart(2, '0') }}</span>
                  <strong>{{ article.title }}</strong>
                  <time :datetime="article.date">{{ article.date }}</time>
                </router-link>
              </li>
            </ol>
          </article>
        </div>
      </div>
    </section>

    <section class="all-articles" aria-labelledby="all-articles-title">
      <div class="container articles-shell">
        <div class="editorial-section-heading all-articles-heading">
          <div>
            <p class="articles-kicker">03 · Full Index</p>
            <h2 id="all-articles-title">全部笔记</h2>
          </div>
          <p>搜索与内容类型只服务于完整索引，不干扰前面的精选阅读路径。</p>
        </div>

        <div class="articles-index-tools">
          <label class="articles-search">
            <span>搜索标题、主题或关键词</span>
            <input v-model="query" type="search" placeholder="wallet-api, gRPC, EVM, signer..." />
          </label>

          <label class="articles-filter">
            <span>内容类型</span>
            <select v-model="selectedKind">
              <option v-for="kind in kindOptions" :key="kind.id" :value="kind.id">{{ kind.title }}</option>
            </select>
          </label>

          <button class="articles-reset" type="button" @click="resetFilters">重置</button>
          <p class="articles-result-count" aria-live="polite">
            {{ filteredArticles.length }} / {{ siteArticles.length }} 篇
          </p>
        </div>

        <div v-if="visibleArticles.length" class="articles-index" role="list">
          <router-link
            v-for="article in visibleArticles"
            :key="article.id"
            :to="`/articles/${article.slug}`"
            class="articles-index-row"
            role="listitem"
          >
            <time :datetime="article.date">{{ article.date }}</time>
            <span>{{ kindLabel(article.kind) }}</span>
            <div>
              <h3>{{ article.title }}</h3>
              <p>{{ article.summary }}</p>
            </div>
            <span class="articles-index-evidence">
              {{ article.evidenceLevel ? evidenceLabels[article.evidenceLevel] : article.difficulty }}
            </span>
            <span class="articles-index-time">{{ article.readingTime }}</span>
            <span class="articles-index-arrow" aria-hidden="true">→</span>
          </router-link>
        </div>

        <div v-if="visibleArticles.length < filteredArticles.length" class="articles-load-more">
          <button type="button" @click="showMore">
            再显示 {{ Math.min(16, filteredArticles.length - visibleArticles.length) }} 篇
          </button>
        </div>

        <div v-if="filteredArticles.length === 0" class="articles-empty-state">
          <p>没有匹配的笔记</p>
          <span>可以尝试其他内容类型或更短的关键词。</span>
          <button type="button" @click="resetFilters">重置筛选</button>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.articles-editorial-page {
  --articles-ink: #11161f;
  --articles-muted: #667080;
  --articles-line: rgba(17, 22, 31, 0.12);
  --articles-paper: #f5f3ee;
  min-width: 0;
  overflow: clip;
  background: #fff;
  color: var(--articles-ink);
}

.articles-shell {
  min-width: 0;
  max-width: 1200px;
}

.articles-hero {
  padding: clamp(120px, 15vw, 184px) 0 clamp(72px, 9vw, 112px);
  background:
    linear-gradient(90deg, transparent 0, transparent calc(50% - 1px), rgba(17, 22, 31, 0.035) 50%, transparent calc(50% + 1px)),
    #fff;
}

.articles-kicker {
  margin: 0;
  color: #53766e;
  font: 700 0.7rem/1.4 var(--mono);
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.articles-hero-copy {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(270px, 0.65fr);
  gap: clamp(36px, 7vw, 96px);
  align-items: end;
  margin: clamp(22px, 3vw, 36px) 0 clamp(70px, 9vw, 118px);
}

.articles-hero-copy h1 {
  grid-column: 1 / -1;
  max-width: 1120px;
  margin: 0;
  font-size: clamp(3.35rem, 7.3vw, 7rem);
  font-weight: 630;
  line-height: 0.96;
  letter-spacing: -0.07em;
  text-wrap: balance;
}

.articles-hero-copy > p {
  grid-column: 2;
  max-width: 490px;
  margin: 0 0 0.45rem;
  color: var(--articles-muted);
  font-size: clamp(1rem, 1.35vw, 1.13rem);
  line-height: 1.78;
  text-wrap: pretty;
}

.editorial-section-heading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 0.48fr);
  gap: clamp(28px, 6vw, 80px);
  align-items: end;
  padding-bottom: 28px;
  border-bottom: 1px solid var(--articles-line);
}

.editorial-section-heading h2 {
  margin: 0.55rem 0 0;
  font-size: clamp(2rem, 4vw, 3.75rem);
  font-weight: 630;
  line-height: 1.05;
  letter-spacing: -0.055em;
}

.editorial-section-heading > p {
  margin: 0;
  color: var(--articles-muted);
  line-height: 1.75;
}

.featured-reading-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-bottom: 1px solid var(--articles-line);
}

.featured-reading-item {
  position: relative;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 28px;
  min-width: 0;
  padding: 34px 32px 32px 0;
  color: inherit;
}

.featured-reading-item + .featured-reading-item {
  border-left: 1px solid var(--articles-line);
  padding-left: 32px;
}

.featured-reading-meta {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  color: var(--articles-muted);
  font: 600 0.72rem/1.4 var(--mono);
}

.featured-reading-item > div:nth-child(2) > p:first-child {
  margin: 0 0 0.7rem;
  color: #53766e;
  font: 700 0.68rem/1.4 var(--mono);
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.featured-reading-item h3 {
  margin: 0;
  font-size: clamp(1.32rem, 2vw, 1.75rem);
  line-height: 1.28;
  letter-spacing: -0.025em;
  text-wrap: pretty;
}

.featured-reading-item > div:nth-child(2) > p:last-child {
  display: -webkit-box;
  margin: 1rem 0 0;
  overflow: hidden;
  color: var(--articles-muted);
  font-size: 0.9rem;
  line-height: 1.72;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.featured-reading-arrow {
  justify-self: end;
  color: #53766e;
  font-size: 1.15rem;
  transition: transform 180ms ease;
}

.featured-reading-item:hover h3,
.featured-reading-item:focus-visible h3 {
  color: #245d52;
}

.featured-reading-item:hover .featured-reading-arrow,
.featured-reading-item:focus-visible .featured-reading-arrow {
  transform: translate(3px, -3px);
}

.featured-reading-item:focus-visible,
.reading-lane a:focus-visible,
.articles-index-row:focus-visible {
  outline: 2px solid #2c6f62;
  outline-offset: 4px;
}

.reading-lanes {
  padding: clamp(76px, 10vw, 128px) 0;
  background: var(--articles-paper);
}

.reading-lanes-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.reading-lane {
  min-width: 0;
  padding: 34px 32px 0 0;
}

.reading-lane + .reading-lane {
  border-left: 1px solid var(--articles-line);
  padding-left: 32px;
}

.reading-lane header > p {
  margin: 0 0 0.7rem;
  color: #53766e;
  font: 700 0.68rem/1.4 var(--mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.reading-lane h3 {
  margin: 0;
  font-size: 1.42rem;
  line-height: 1.25;
  letter-spacing: -0.025em;
}

.reading-lane header > span {
  display: block;
  min-height: 5.2rem;
  margin-top: 0.75rem;
  color: var(--articles-muted);
  font-size: 0.9rem;
  line-height: 1.72;
}

.reading-lane ol {
  margin: 1.5rem 0 0;
  padding: 0;
  border-top: 1px solid var(--articles-line);
  list-style: none;
}

.reading-lane li + li {
  border-top: 1px solid var(--articles-line);
}

.reading-lane a {
  display: grid;
  grid-template-columns: 1.8rem minmax(0, 1fr);
  gap: 0.3rem 0.8rem;
  min-width: 0;
  padding: 1rem 0;
  color: inherit;
}

.reading-lane a > span,
.reading-lane time {
  color: var(--articles-muted);
  font: 600 0.68rem/1.4 var(--mono);
}

.reading-lane strong {
  min-width: 0;
  font-size: 0.92rem;
  line-height: 1.55;
  text-wrap: pretty;
}

.reading-lane time {
  grid-column: 2;
}

.reading-lane a:hover strong,
.reading-lane a:focus-visible strong {
  color: #245d52;
}

.all-articles {
  padding: clamp(76px, 10vw, 132px) 0;
}

.all-articles-heading {
  margin-bottom: 36px;
}

.articles-index-tools {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(190px, 0.3fr) auto auto;
  gap: 12px;
  align-items: end;
  margin-bottom: 26px;
}

.articles-search,
.articles-filter {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.articles-search span,
.articles-filter span {
  color: var(--articles-muted);
  font: 700 0.67rem/1.4 var(--mono);
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.articles-search input,
.articles-filter select,
.articles-reset,
.articles-load-more button,
.articles-empty-state button {
  min-height: 46px;
  border: 1px solid var(--articles-line);
  border-radius: 0;
  background: #fff;
  color: var(--articles-ink);
  font: 600 0.84rem/1.2 var(--font);
}

.articles-search input,
.articles-filter select {
  width: 100%;
  padding: 0 14px;
  outline: none;
}

.articles-search input:focus,
.articles-filter select:focus {
  border-color: #2c6f62;
  box-shadow: 0 0 0 3px rgba(44, 111, 98, 0.1);
}

.articles-reset,
.articles-load-more button,
.articles-empty-state button {
  padding: 0 18px;
  cursor: pointer;
}

.articles-reset:hover,
.articles-reset:focus-visible,
.articles-load-more button:hover,
.articles-load-more button:focus-visible,
.articles-empty-state button:hover,
.articles-empty-state button:focus-visible {
  border-color: #2c6f62;
  color: #245d52;
  outline: none;
}

.articles-result-count {
  min-width: 84px;
  margin: 0 0 0.9rem;
  color: var(--articles-muted);
  font: 600 0.72rem/1.4 var(--mono);
  text-align: right;
}

.articles-index {
  border-top: 1px solid var(--articles-ink);
  border-bottom: 1px solid var(--articles-line);
}

.articles-index-row {
  display: grid;
  grid-template-columns: 6.4rem 7rem minmax(0, 1fr) 8.5rem 4.4rem 1.2rem;
  gap: 18px;
  align-items: start;
  min-width: 0;
  padding: 20px 0;
  color: inherit;
}

.articles-index-row + .articles-index-row {
  border-top: 1px solid var(--articles-line);
}

.articles-index-row > time,
.articles-index-row > span {
  color: var(--articles-muted);
  font: 600 0.7rem/1.55 var(--mono);
}

.articles-index-row > div {
  min-width: 0;
}

.articles-index-row h3 {
  margin: -0.1rem 0 0;
  font-size: 1rem;
  line-height: 1.5;
  letter-spacing: -0.01em;
  text-wrap: pretty;
}

.articles-index-row p {
  display: -webkit-box;
  margin: 0.45rem 0 0;
  overflow: hidden;
  color: var(--articles-muted);
  font-size: 0.82rem;
  line-height: 1.65;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.articles-index-arrow {
  justify-self: end;
  color: #53766e !important;
  transition: transform 180ms ease;
}

.articles-index-row:hover h3,
.articles-index-row:focus-visible h3 {
  color: #245d52;
}

.articles-index-row:hover .articles-index-arrow,
.articles-index-row:focus-visible .articles-index-arrow {
  transform: translateX(3px);
}

.articles-load-more {
  display: flex;
  justify-content: center;
  margin-top: 32px;
}

.articles-empty-state {
  display: grid;
  justify-items: start;
  gap: 0.75rem;
  padding: 48px 0;
  border-top: 1px solid var(--articles-ink);
  border-bottom: 1px solid var(--articles-line);
}

.articles-empty-state p,
.articles-empty-state span {
  margin: 0;
}

.articles-empty-state p {
  font-size: 1.3rem;
  font-weight: 650;
}

.articles-empty-state span {
  color: var(--articles-muted);
}

@media (max-width: 900px) {
  .articles-hero-copy,
  .editorial-section-heading {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }

  .articles-hero-copy h1,
  .articles-hero-copy > p {
    grid-column: 1;
  }

  .featured-reading-grid,
  .reading-lanes-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .featured-reading-item,
  .reading-lane,
  .featured-reading-item + .featured-reading-item,
  .reading-lane + .reading-lane {
    border-left: 0;
    padding-right: 0;
    padding-left: 0;
  }

  .featured-reading-item + .featured-reading-item,
  .reading-lane + .reading-lane {
    border-top: 1px solid var(--articles-line);
  }

  .reading-lane header > span {
    min-height: 0;
  }

  .articles-index-row {
    grid-template-columns: 5.8rem minmax(0, 1fr) 5rem 1.2rem;
  }

  .articles-index-row > span:nth-child(2),
  .articles-index-evidence {
    display: none;
  }
}

@media (max-width: 640px) {
  .articles-hero {
    padding-top: 104px;
  }

  .articles-hero-copy {
    margin-bottom: 62px;
  }

  .articles-hero-copy h1 {
    font-size: clamp(2.8rem, 14.5vw, 4.2rem);
    letter-spacing: -0.065em;
  }

  .articles-index-tools {
    grid-template-columns: minmax(0, 1fr);
  }

  .articles-reset {
    width: 100%;
  }

  .articles-result-count {
    grid-row: 1;
    min-width: 0;
    margin: 0 0 0.1rem;
    text-align: left;
  }

  .articles-index-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px 16px;
    padding: 18px 0;
  }

  .articles-index-row > time {
    grid-column: 1;
    grid-row: 1;
  }

  .articles-index-row > div {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .articles-index-row p {
    -webkit-line-clamp: 2;
  }

  .articles-index-time {
    grid-column: 1;
    grid-row: 3;
  }

  .articles-index-arrow {
    grid-column: 2;
    grid-row: 1 / span 3;
    align-self: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .featured-reading-arrow,
  .articles-index-arrow {
    transition: none;
  }
}
</style>
