<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { loadResearchDetail, researchHref, researchEvidenceLabel, researchAccessLabel, researchTypeLabel, researchDateLabel, researchCalendarDate, RESEARCH_HOME, ResearchRequestError, readingReturnLink, sourceDisplayLabel, withReadingReturn } from '../data'
import type { ResearchDetail } from '../data'
import { setSeoMeta } from '../../../utils/seo'
import LoadState from '../../../design/components/LoadState.vue'
import ResearchContent from '../components/ResearchContent.vue'
import '../../../design/brief.css'
import '../../../design/reader.css'
import '../../../design/research.css'

const route = useRoute()
const returnLink = computed(() => readingReturnLink(route.query.from || '/?domain=research'))
const detail = ref<ResearchDetail>()
const state = ref<'loading' | 'ready' | 'error' | 'missing'>('loading')
const record = computed(() => detail.value?.record)
let version = 0
async function load(force = false) {
  const request = ++version
  detail.value = undefined
  state.value = 'loading'
  try {
    const value = await loadResearchDetail(String(route.query.id || ''), force)
    if (request !== version) return
    detail.value = value
    state.value = 'ready'
  } catch (error) {
    if (request !== version) return
    state.value = error instanceof ResearchRequestError && error.status === 404 ? 'missing' : 'error'
  }
}
watch(() => route.query.id, () => load(), { immediate: true })
watchEffect(() => {
  setSeoMeta({ title: record.value ? `${record.value.title}｜共享研究｜xiuqiu` : '共享研究｜xiuqiu',
    description: record.value?.summary, path: route.path, type: 'article', indexable: false })
})
</script>

<template>
  <div class="brief" lang="zh-CN">
    <header class="brief-masthead">
      <div class="brief-shell">
        <router-link :to="returnLink.href" class="brief-back">{{ returnLink.label }}</router-link>
        <p class="brief-dateline"><span>共享研究</span><span>自动整理 · 未经人工复核</span></p>
        <h1>{{ record?.title || (state === 'loading' ? '正在载入资料…' : state === 'missing' ? '没有找到这条资料' : '资料暂时无法载入') }}</h1>
        <template v-if="record">
          <p v-if="record.summary" class="brief-lede">{{ record.summary }}</p>
          <dl class="reader-facts">
            <div><dt>{{ researchDateLabel(record.date_basis) }}</dt><dd><time :datetime="record.date">{{ record.date }}</time></dd></div>
            <div><dt>核实范围</dt><dd>{{ researchEvidenceLabel(record.evidence_status) }}</dd></div>
            <div v-if="record.collected_at"><dt>最近收录</dt><dd>{{ researchCalendarDate(record.collected_at) }}</dd></div>
          </dl>
          <p class="brief-note">收录不等于证实。正文保留原始输入、模型整理和贡献者观点各自的归属；市场内容不构成投资建议。</p>
        </template>
      </div>
    </header>
    <div class="brief-shell brief-reading">
      <LoadState v-if="state === 'loading'" state="loading" message="正在读取资料正文与来源…" />
      <LoadState v-else-if="state === 'error'" state="error" message="共享研究暂时无法载入。" action-label="重试" @action="load(true)" />
      <LoadState v-else-if="state === 'missing'" state="empty" message="这条资料尚未发布，或链接有误。" />
      <template v-else-if="detail && record">
        <article class="research-content" aria-label="资料正文"><ResearchContent :nodes="detail.content" /></article>
        <section v-if="record.materials.length" class="research-materials" aria-labelledby="research-materials-title">
          <h2 id="research-materials-title">来源与原始材料 · {{ record.materials.length }}</h2>
          <ul>
            <li v-for="material in record.materials" :key="material.id">
              <router-link :to="withReadingReturn(researchHref(material.id), returnLink.href)">{{ material.title }}</router-link>
              <p>{{ researchTypeLabel(material.source_type) }} · {{ researchAccessLabel(material.source_access) }}</p>
              <a v-if="material.source_url" :href="material.source_url" rel="noopener noreferrer">{{ sourceDisplayLabel(material.source_url) }} ↗</a>
            </li>
          </ul>
        </section>
        <p class="research-original"><a :href="record.url" rel="noopener noreferrer">在共享研究原站查看这条资料 ↗</a></p>
      </template>
      <p v-if="state === 'error' || state === 'missing'" class="research-original"><a :href="RESEARCH_HOME" rel="noopener noreferrer">打开共享研究原站 ↗</a></p>
    </div>
  </div>
</template>
