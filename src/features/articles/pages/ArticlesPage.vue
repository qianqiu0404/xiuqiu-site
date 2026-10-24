<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { articleKindOptions, articleReadingRows, filterArticleRows, projects, siteArticles } from '../data'
import { setSeoMeta } from '../../../utils/seo'
import ChipGroup from '../../../design/components/ChipGroup.vue'
import SearchBox from '../../../design/components/SearchBox.vue'
import LoadState from '../../../design/components/LoadState.vue'
import '../../../design/brief.css'
import '../../../design/collections.css'

const query = ref('')
const selectedKind = ref('All')
const visibleLimit = ref(16)
const rows = articleReadingRows(siteArticles, projects)
const filtered = computed(() => filterArticleRows(rows, { kind: selectedKind.value, query: query.value }))
const visible = computed(() => filtered.value.slice(0, visibleLimit.value))
const options = articleKindOptions.map(option => ({ key: option.key, label: option.shortLabel, count: filterArticleRows(rows, { kind: option.key }).length }))
const latestDate = rows[0]?.article.date
const selected = rows.slice(0, 3)
function resetFilters() { query.value = ''; selectedKind.value = 'All' }
watch([query, selectedKind], () => { visibleLimit.value = 16 })
onMounted(() => setSeoMeta({
  title: '工程笔记｜xiuqiu Web3 钱包学习档案',
  description: `${siteArticles.length} 篇关于交易所钱包、多链模型、签名服务、Go 后端与 AI 工程工作流的学习笔记。`,
  path: '/articles',
}))
</script>

<template>
  <div class="brief" lang="zh-CN">
    <header class="brief-masthead">
      <div class="brief-shell">
        <p class="brief-dateline"><span>工程笔记</span><span>问题 · 实现 · 复盘</span></p>
        <div class="brief-masthead-row">
          <div>
            <h1>工程笔记</h1>
            <p class="brief-lede">从项目里的具体问题出发，记录实现、取舍和验证。沿着钱包、交易系统与 AI 工作流继续阅读。</p>
          </div>
          <dl class="brief-stats">
            <div><dt>累计笔记</dt><dd>{{ rows.length }} 篇</dd></div>
            <div><dt>内容类型</dt><dd>{{ articleKindOptions.length - 1 }} 类</dd></div>
          </dl>
        </div>
        <p v-if="latestDate" class="brief-note">最新发布 <time :datetime="latestDate">{{ latestDate }}</time> · 发布日期与后续更新分别保留。</p>
      </div>
    </header>

    <div class="brief-shell brief-layout">
      <section aria-labelledby="notes-title">
        <h2 id="notes-title" class="brief-sr-only">全部笔记</h2>
        <div class="brief-toolbar">
          <div class="brief-toolbar-row">
            <ChipGroup label="按内容类型筛选" variant="tabs" :options="options" :active="selectedKind" @select="key => selectedKind = key" />
            <SearchBox v-model="query" label="搜索笔记" placeholder="搜索标题、主题或问题" />
          </div>
          <p class="brief-note" aria-live="polite">{{ filtered.length }} / {{ rows.length }} 篇</p>
        </div>
        <ol class="collection-list">
          <li v-for="row in visible" :key="row.article.slug" class="collection-row">
            <div class="collection-meta">
              <span class="collection-tag collection-tag--notes">{{ row.kindLabel }}</span>
              <span>发布 <time :datetime="row.article.date">{{ row.article.date }}</time></span>
              <span v-if="row.article.updatedAt">更新 <time :datetime="row.article.updatedAt">{{ row.article.updatedAt }}</time></span>
              <span>{{ row.article.readingTime }}</span>
            </div>
            <h3><router-link :to="`/articles/${row.article.slug}`">{{ row.article.title }}</router-link></h3>
            <p>{{ row.article.summary }}</p>
            <div v-if="row.seriesLabel || row.projectNames.length" class="collection-meta collection-context">
              <span v-if="row.seriesLabel">系列 · {{ row.seriesLabel }}</span>
              <span v-for="name in row.projectNames" :key="name">项目 · {{ name }}</span>
            </div>
            <div class="collection-footer">
              <span class="collection-tag">{{ row.evidenceLabel }}</span>
              <router-link class="collection-link" :to="`/articles/${row.article.slug}`" :aria-label="`阅读：${row.article.title}`">阅读笔记 →</router-link>
            </div>
          </li>
        </ol>
        <LoadState v-if="!filtered.length" state="empty" message="没有匹配的笔记。" hint="试试其他内容类型或更短的关键词。" action-label="清除筛选" @action="resetFilters" />
        <div v-if="visible.length < filtered.length" class="brief-more">
          <button class="brief-button" type="button" @click="visibleLimit += 16">再显示 {{ Math.min(16, filtered.length - visible.length) }} 篇</button>
        </div>
      </section>

      <aside class="brief-aside" aria-label="阅读入口">
        <section class="brief-panel">
          <h2>最近的记录</h2>
          <ol class="collection-selected">
            <li v-for="row in selected" :key="row.article.slug"><router-link :to="`/articles/${row.article.slug}`">{{ row.article.title }}</router-link></li>
          </ol>
        </section>
        <section class="brief-panel">
          <h2>沿项目阅读</h2>
          <ul>
            <li><router-link to="/projects/s78-market-services">Qiu Market <span>交易与数据流 →</span></router-link></li>
            <li><router-link to="/projects">工程项目 <span>实现与边界 →</span></router-link></li>
            <li><router-link to="/ai">AI 工程 <span>协作与审查 →</span></router-link></li>
          </ul>
        </section>
        <section class="brief-panel">
          <h2>如何阅读验证状态</h2>
          <p class="collection-panel-copy">架构设计、资料复核、本地验证和公开演示分别标注。笔记记录当时的结论，后续修订保留更新日期。</p>
          <router-link class="collection-link" to="/engineering/evidence">核对工程证据 →</router-link>
        </section>
      </aside>
    </div>
  </div>
</template>
