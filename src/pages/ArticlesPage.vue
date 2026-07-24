<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { engineeringMap, siteArticles, siteArticlesByNewest, siteKnowledge, type KnowledgeTag } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const route = useRoute()
const router = useRouter()
const query = ref('')
const selectedCapability = ref<KnowledgeTag | 'All'>('All')
const selectedTag = ref('All')
const selectedDifficulty = ref('All')
const selectedKind = ref<'All' | (typeof siteArticles)[number]['kind']>('All')
const allSeries = ['All', ...Array.from(new Set(siteArticles.map(article => article.series).filter((series): series is string => Boolean(series))))]
const requestedSeries = typeof route.query.series === 'string' ? route.query.series : 'All'
const selectedSeries = ref(allSeries.includes(requestedSeries) ? requestedSeries : 'All')

const capabilityOptions = computed(() => [
  { id: 'All' as const, title: '全部学习主题' },
  ...engineeringMap.map(node => ({ id: node.id, title: node.title })),
])
const allTags = computed(() => ['All', ...Array.from(new Set(siteArticles.flatMap(article => article.tags))).sort()])
const allDifficulties = computed(() => ['All', ...Array.from(new Set(siteArticles.map(article => article.difficulty)))])
const kindOptions = [
  { id: 'All', title: '全部内容类型' },
  { id: 'engineering-note', title: '工程笔记' },
  { id: 'research', title: '技术研究' },
  { id: 'learning-log', title: '学习复盘' },
] as const
const evidenceLabels = { design: '架构设计', 'source-reviewed': '资料与代码复核', 'local-verified': '本地已验证', integrated: '已集成验证', 'public-demo': '公开可运行' } as const

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
      selectedCapability.value === 'All' ||
      article.conceptTags.includes(selectedCapability.value as (typeof article.conceptTags)[number]) ||
      Boolean(
        engineeringMap
          .find(node => node.id === selectedCapability.value)
          ?.articleSlugs.includes(article.slug),
      )
    const matchesTag = selectedTag.value === 'All' || article.tags.includes(selectedTag.value)
    const matchesDifficulty = selectedDifficulty.value === 'All' || article.difficulty === selectedDifficulty.value
    const matchesKind = selectedKind.value === 'All' || article.kind === selectedKind.value
    const matchesSeries = selectedSeries.value === 'All' || article.series === selectedSeries.value

    return matchesKeyword && matchesCapability && matchesTag && matchesDifficulty && matchesKind && matchesSeries
  })
})

const readingPaths: {
  title: string
  desc: string
  capabilityId: KnowledgeTag
  slugs: string[]
}[] = [
  {
    title: '钱包签名与基础设施安全',
    desc: '从业务意图、密码学实现与密钥后端，延伸到供应链和 RPC 信任边界。',
    capabilityId: 'signer-service',
    slugs: [
      'wallet-signing-intent-abuse',
      'cryptographic-nonce-key-leak',
      'mpc-tss-security-boundaries',
      'hsm-key-extractability-boundaries',
      'wallet-software-supply-chain',
      'wallet-rpc-trust-boundary',
    ],
  },
  {
    title: '钱包后端学习路径',
    desc: '从 API 职责边界进入资金事务与异步一致性，再延伸到签名服务和多链模型。',
    capabilityId: 'wallet-backend',
    slugs: ['api-system-calls', 'wallet-api-boundary', 'wallet-ledger-transaction-mq-consistency', 'wallet-sign-signer', 'wallet-address-models'],
  },
  {
    title: 'Go 后端工程路径',
    desc: '理解服务通信、缓存、持久化与后端数据流。',
    capabilityId: 'go-infra',
    slugs: ['http-rpc-grpc', 'market-services-data-flow'],
  },
  {
    title: 'EVM 学习路径',
    desc: '沿合约调用、代理模式、create2、assembly 与协议演进继续学习。',
    capabilityId: 'evm',
    slugs: ['evm-call-proxy-patterns', 'evm-create2-assembly-lifecycle', 'eip-erc-protocol-evolution'],
  },
]

function resetFilters() {
  query.value = ''
  selectedCapability.value = 'All'
  selectedTag.value = 'All'
  selectedDifficulty.value = 'All'
  selectedKind.value = 'All'
  selectedSeries.value = 'All'
}

watch(selectedSeries, series => {
  const query = { ...route.query }
  if (series === 'All') delete query.series
  else query.series = series
  router.replace({ query })
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
  <section class="section page-top">
    <div class="container">
      <div class="section-heading">
        <p class="section-label">工程笔记</p>
        <h2 class="section-title">从项目问题到可复查的学习记录</h2>
        <p class="section-desc">
          记录钱包架构、服务通信、签名边界、资金状态与后端数据流中的真实问题和验证过程。
        </p>
        <p class="article-count">{{ filteredArticles.length }} / {{ siteArticles.length }} articles</p>
      </div>

      <div class="writing-tools">
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

        <label class="filter-box">
          <span>学习主题</span>
          <select v-model="selectedCapability">
            <option v-for="capability in capabilityOptions" :key="capability.id" :value="capability.id">
              {{ capability.title }}
            </option>
          </select>
        </label>

        <label class="filter-box">
          <span>文章系列</span>
          <select v-model="selectedSeries">
            <option v-for="series in allSeries" :key="series" :value="series">{{ series === 'All' ? '全部系列' : series }}</option>
          </select>
        </label>

        <label class="filter-box">
          <span>标签</span>
          <select v-model="selectedTag">
            <option v-for="tag in allTags" :key="tag" :value="tag">{{ tag }}</option>
          </select>
        </label>

        <label class="filter-box">
          <span>难度</span>
          <select v-model="selectedDifficulty">
            <option v-for="difficulty in allDifficulties" :key="difficulty" :value="difficulty">{{ difficulty }}</option>
          </select>
        </label>

        <button class="filter-reset" type="button" @click="resetFilters">重置</button>
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
            <span class="meta-tag">{{ kindOptions.find(kind => kind.id === a.kind)?.title }}</span>
            <span v-if="a.series" class="meta-tag">{{ a.series }} · {{ a.seriesOrder }}</span>
            <span v-if="a.evidenceLevel" class="meta-tag evidence-meta">{{ evidenceLabels[a.evidenceLevel] }}</span>
            <span class="meta-tag">{{ a.difficulty }}</span>
            <span class="meta-reading">{{ a.readingTime }}</span>
          </div>
          <div class="article-tags">
            <span v-for="tag in a.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
        </router-link>
      </div>

      <div v-if="filteredArticles.length === 0" class="empty-state">
        <p class="not-found-title">没有匹配的笔记</p>
        <p class="not-found-desc">可以尝试其他标签、难度或关键词。</p>
        <button class="btn btn-secondary" type="button" @click="resetFilters">重置筛选</button>
      </div>
    </div>
  </section>
</template>
