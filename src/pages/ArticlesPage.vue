<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { engineeringMap, siteArticles, siteArticlesByNewest, siteKnowledge, type KnowledgeTag } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const query = ref('')
const selectedCapability = ref<KnowledgeTag | 'All'>('All')
const selectedTag = ref('All')
const selectedDifficulty = ref('All')

const capabilityOptions = computed(() => [
  { id: 'All' as const, title: 'All capabilities' },
  ...engineeringMap.map(node => ({ id: node.id, title: node.title })),
])
const allTags = computed(() => ['All', ...Array.from(new Set(siteArticles.flatMap(article => article.tags))).sort()])
const allDifficulties = computed(() => ['All', ...Array.from(new Set(siteArticles.map(article => article.difficulty)))])

const filteredArticles = computed(() => {
  const keyword = query.value.trim().toLowerCase()

  return siteArticlesByNewest.filter(article => {
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
    const matchesCapability =
      selectedCapability.value === 'All' || article.conceptTags.includes(selectedCapability.value)
    const matchesTag = selectedTag.value === 'All' || article.tags.includes(selectedTag.value)
    const matchesDifficulty = selectedDifficulty.value === 'All' || article.difficulty === selectedDifficulty.value

    return matchesKeyword && matchesCapability && matchesTag && matchesDifficulty
  })
})

const readingPaths: {
  title: string
  desc: string
  capabilityId: KnowledgeTag
  slugs: string[]
}[] = [
  {
    title: 'Wallet Backend Path',
    desc: 'Start from API boundary, then move into signer and multi-chain models.',
    capabilityId: 'wallet-backend',
    slugs: ['api-system-calls', 'wallet-api-boundary', 'wallet-sign-signer', 'wallet-address-models'],
  },
  {
    title: 'Go Infra Path',
    desc: 'Understand service communication and backend data flow.',
    capabilityId: 'go-infra',
    slugs: ['http-rpc-grpc', 'market-services-data-flow'],
  },
  {
    title: 'EVM Engineering Path',
    desc: 'Follow contracts, proxy patterns, create2, assembly, and protocol evolution.',
    capabilityId: 'evm',
    slugs: ['evm-call-proxy-patterns', 'evm-create2-assembly-lifecycle', 'eip-erc-protocol-evolution'],
  },
]

function getReadingPathArticleTitles(slugs: string[]) {
  return slugs
    .map(slug => siteArticles.find(article => article.slug === slug)?.title)
    .filter((title): title is string => Boolean(title))
}

function askAboutReadingPath(path: (typeof readingPaths)[number]) {
  const articleTitles = getReadingPathArticleTitles(path.slugs)

  window.dispatchEvent(
    new CustomEvent('ai-chat:ask', {
      detail: {
        prompt: `请基于「${path.title}」给我一条学习路径，并说明这些文章分别解决什么问题：${articleTitles.join('、')}。`,
        context: {
          type: 'articles',
          title: path.title,
          summary: `${path.desc} Related articles: ${articleTitles.join(' | ')}`,
        },
      },
    }),
  )
}

function resetFilters() {
  query.value = ''
  selectedCapability.value = 'All'
  selectedTag.value = 'All'
  selectedDifficulty.value = 'All'
}

onMounted(() => {
  setSeoMeta({
    title: 'Writing | xiuqiu Web3 Wallet Engineering',
    description: `Technical writing on wallet architecture, signer services, backend communication, EVM, and MPC/TSS. ${siteKnowledge.articles.length} articles available.`,
    path: '/articles',
  })
})
</script>

<template>
  <section class="section page-top">
    <div class="container">
      <div class="section-heading">
        <p class="section-label">Writing</p>
        <h2 class="section-title">Writing</h2>
        <p class="section-desc">
          Technical writing on wallet architecture, service communication, signer boundaries, and backend data flow.
        </p>
        <p class="article-count">{{ filteredArticles.length }} / {{ siteArticles.length }} articles</p>
      </div>

      <div class="writing-tools">
        <label class="search-box">
          <span>Search</span>
          <input v-model="query" type="search" placeholder="wallet-api, gRPC, EVM, signer..." />
        </label>

        <label class="filter-box">
          <span>Capability</span>
          <select v-model="selectedCapability">
            <option v-for="capability in capabilityOptions" :key="capability.id" :value="capability.id">
              {{ capability.title }}
            </option>
          </select>
        </label>

        <label class="filter-box">
          <span>Tag</span>
          <select v-model="selectedTag">
            <option v-for="tag in allTags" :key="tag" :value="tag">{{ tag }}</option>
          </select>
        </label>

        <label class="filter-box">
          <span>Difficulty</span>
          <select v-model="selectedDifficulty">
            <option v-for="difficulty in allDifficulties" :key="difficulty" :value="difficulty">{{ difficulty }}</option>
          </select>
        </label>

        <button class="filter-reset" type="button" @click="resetFilters">Reset</button>
      </div>

      <div class="reading-paths">
        <article v-for="path in readingPaths" :key="path.title" class="reading-path">
          <div class="path-header">
            <h3>{{ path.title }}</h3>
            <span>{{ engineeringMap.find(node => node.id === path.capabilityId)?.title }}</span>
          </div>
          <p>{{ path.desc }}</p>
          <div class="path-links">
            <router-link
              v-for="slug in path.slugs"
              :key="slug"
              :to="'/articles/' + slug"
              class="path-link"
            >
              {{ siteArticles.find(article => article.slug === slug)?.title }}
            </router-link>
          </div>
          <button class="path-ai-button" type="button" @click="askAboutReadingPath(path)">
            Ask AI for this path ->
          </button>
        </article>
      </div>

      <div class="article-grid">
        <router-link
          v-for="a in filteredArticles"
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

      <div v-if="filteredArticles.length === 0" class="empty-state">
        <p class="not-found-title">No matching writing</p>
        <p class="not-found-desc">Try another tag, difficulty, or keyword.</p>
        <button class="btn btn-secondary" type="button" @click="resetFilters">Reset filters</button>
      </div>
    </div>
  </section>
</template>
