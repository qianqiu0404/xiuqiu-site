<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { failureCases, type FailureAction, type FailureCase, type FailureCategory, type FailureEvidenceStatus, type FailurePriority } from '../data/generatedFailureCases'
import { getArticleBySlug, getProjectByKey } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

type PracticeRating = '待学习' | '不确定' | '已理解'

const route = useRoute()
const router = useRouter()
const practiceMode = computed(() => route.query.mode === 'practice')
const query = ref('')
const category = ref('')
const service = ref('')
const chain = ref('')
const action = ref('')
const priority = ref('')
const evidence = ref('')
const revealed = ref(false)
const practiceIndex = ref(0)
const ratings = ref<Record<string, PracticeRating>>({})
const STORAGE_KEY = 'xiuqiu.failure-practice.v1'

const categoryLabels: Record<FailureCategory, string> = { 'request-state': '请求与状态机', 'node-scanning': '节点与扫链', deposit: '充值识别', 'withdrawal-finality': '提现广播与最终性', 'multi-chain': '多链资源', 'risk-signing': '风控与签名', 'funds-operations': '资金与运维' }
const priorityLabels: Record<FailurePriority, string> = { key: '重点', common: '高频', advanced: '进阶' }
const evidenceLabels: Record<FailureEvidenceStatus, string> = { implemented: '当前已实现', partial: '部分验证', design: '生产设计' }
const actionLabels: Record<FailureAction, string> = { retry: 'retry', compensate: 'compensate', pause: 'pause', 'manual-review': 'manual-review' }
const allServices = [...new Set(failureCases.flatMap(item => item.services))].sort()
const allChains = [...new Set(failureCases.flatMap(item => item.chains))].sort()
const filteredCases = computed(() => failureCases.filter(item => {
  const text = `${item.title} ${item.symptom} ${item.fundRisk}`.toLowerCase()
  return (!query.value || text.includes(query.value.toLowerCase())) && (!category.value || item.category === category.value) && (!service.value || item.services.includes(service.value)) && (!chain.value || item.chains.includes(chain.value)) && (!action.value || item.actions.includes(action.value as FailureAction)) && (!priority.value || item.priority === priority.value) && (!evidence.value || item.evidenceStatus === evidence.value)
}))
const practiceCase = computed(() => filteredCases.value[practiceIndex.value])

function setMode(mode?: 'practice') {
  void router.replace({ path: '/engineering/failures', query: mode ? { mode } : {} })
}
function resetFilters() { query.value = ''; category.value = ''; service.value = ''; chain.value = ''; action.value = ''; priority.value = ''; evidence.value = '' }
function rate(value: PracticeRating) {
  if (!practiceCase.value) return
  ratings.value = { ...ratings.value, [practiceCase.value.slug]: value }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings.value))
}
function nextPractice() {
  if (!filteredCases.value.length) return
  practiceIndex.value = (practiceIndex.value + 1) % filteredCases.value.length
  revealed.value = false
}
function relatedArticles(item: FailureCase) { return item.relatedArticleSlugs.map(getArticleBySlug).filter(Boolean) }
function relatedProjects(item: FailureCase) { return item.relatedProjectSlugs.map(getProjectByKey).filter(Boolean) }

watch(filteredCases, () => { practiceIndex.value = 0; revealed.value = false })
onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, string>
    ratings.value = Object.fromEntries(Object.entries(saved).map(([slug, value]) => [slug, value === '不会' ? '待学习' : value === '模糊' ? '不确定' : value === '能讲' ? '已理解' : value]).filter((entry): entry is [string, PracticeRating] => ['待学习', '不确定', '已理解'].includes(entry[1])))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings.value))
  } catch { ratings.value = {} }
  setSeoMeta({ title: '钱包异常恢复手册｜xiuqiu', description: '30 个钱包后端核心异常，按资金事实、止损动作、排查证据和恢复依据组织。', path: '/engineering/failures' })
})
</script>

<template>
  <section class="section page-top failure-page">
    <div class="container">
      <header class="failure-hero">
        <div><p class="section-label">Wallet Failure Playbook</p><h1>钱包异常恢复手册</h1><p>不是事故履历，而是一套可复核的工程判断：先确认资金事实，再决定重试、补偿、暂停或人工复核。</p></div>
        <div class="failure-mode-actions"><button class="btn" :class="practiceMode ? 'btn-secondary' : 'btn-primary'" @click="setMode()">浏览手册</button><button class="btn" :class="practiceMode ? 'btn-primary' : 'btn-secondary'" @click="setMode('practice')">进入自测</button></div>
      </header>

      <section class="failure-framework">
        <div class="failure-stats"><div><strong>{{ failureCases.length }}</strong><span>核心场景</span></div><div><strong>7</strong><span>异常分组</span></div><div><strong>6</strong><span>重点场景</span></div></div>
        <div><p class="section-label">五个判断问题</p><ol><li>链上事实是否已经发生？</li><li>订单、冻结、账务和通知分别到哪一步？</li><li>下一动作是否可逆？</li><li>重试依靠什么幂等标识？</li><li>最终以 canonical 链、账务分录还是业务确认恢复？</li></ol></div>
        <div><p class="section-label">四种处理动作</p><dl class="action-definitions"><div><dt>retry</dt><dd>没有产生新资金事实</dd></div><div><dt>compensate</dt><dd>链上事实明确，本地状态落后</dd></div><div><dt>pause</dt><dd>结果不确定，继续可能重复出金</dd></div><div><dt>manual-review</dt><dd>多哈希、账务不平或授权异常</dd></div></dl></div>
      </section>

      <section class="failure-filters" aria-label="异常筛选">
        <input v-model="query" type="search" placeholder="搜索现象、风险或标题" aria-label="搜索异常" />
        <select v-model="category" aria-label="分类"><option value="">全部分类</option><option v-for="(label, key) in categoryLabels" :key="key" :value="key">{{ label }}</option></select>
        <select v-model="service" aria-label="服务"><option value="">全部服务</option><option v-for="item in allServices" :key="item">{{ item }}</option></select>
        <select v-model="chain" aria-label="链"><option value="">全部链</option><option v-for="item in allChains" :key="item">{{ item }}</option></select>
        <select v-model="action" aria-label="动作"><option value="">全部动作</option><option v-for="(label, key) in actionLabels" :key="key" :value="key">{{ label }}</option></select>
        <select v-model="priority" aria-label="优先级"><option value="">全部优先级</option><option v-for="(label, key) in priorityLabels" :key="key" :value="key">{{ label }}</option></select>
        <select v-model="evidence" aria-label="证据状态"><option value="">全部证据</option><option v-for="(label, key) in evidenceLabels" :key="key" :value="key">{{ label }}</option></select>
        <button type="button" @click="resetFilters">重置</button><span>{{ filteredCases.length }} / {{ failureCases.length }}</span>
      </section>

      <section v-if="practiceMode" class="practice-panel">
        <p v-if="!practiceCase" class="empty-state">当前筛选没有题目。</p>
        <article v-else :key="practiceCase.slug" class="practice-card">
          <div class="failure-card-meta"><span>{{ categoryLabels[practiceCase.category] }}</span><span>{{ priorityLabels[practiceCase.priority] }}</span><span>{{ evidenceLabels[practiceCase.evidenceStatus] }}</span></div>
          <p class="practice-progress">{{ practiceIndex + 1 }} / {{ filteredCases.length }} · 当前自评：{{ ratings[practiceCase.slug] || '未评' }}</p>
          <h2>{{ practiceCase.title }}</h2><p>{{ practiceCase.symptom }}</p>
          <div class="practice-prompts"><span>资金事实是什么？</span><span>先止损做什么？</span><span>查哪些证据？</span><span>如何恢复？</span></div>
          <button v-if="!revealed" class="btn btn-primary" type="button" @click="revealed = true">揭示答案</button>
          <div v-else class="practice-answer">
            <div><strong>资金风险</strong><p>{{ practiceCase.fundRisk }}</p></div><div><strong>先止损</strong><p>{{ practiceCase.stopLoss }}</p></div>
            <div><strong>排查</strong><ol><li v-for="value in practiceCase.investigate" :key="value">{{ value }}</li></ol></div><div><strong>恢复</strong><ol><li v-for="value in practiceCase.recovery" :key="value">{{ value }}</li></ol></div>
            <div class="practice-rating"><span>当前状态：</span><button v-for="value in ['待学习','不确定','已理解'] as const" :key="value" :class="{ active: ratings[practiceCase.slug] === value }" @click="rate(value)">{{ value }}</button><button class="next" @click="nextPractice">下一题 &rarr;</button></div>
          </div>
        </article>
      </section>

      <section v-else class="failure-catalog">
        <p v-if="!filteredCases.length" class="empty-state">当前筛选没有匹配场景。</p>
        <article v-for="item in filteredCases" :id="item.slug" :key="item.slug" class="failure-case-card">
          <div class="failure-card-meta"><span>{{ categoryLabels[item.category] }}</span><span>{{ priorityLabels[item.priority] }}</span><span :class="`evidence-${item.evidenceStatus}`">{{ evidenceLabels[item.evidenceStatus] }}</span></div>
          <h2>{{ item.title }}</h2><p>{{ item.symptom }}</p>
          <div class="failure-conclusion"><div><strong>资金风险</strong><p>{{ item.fundRisk }}</p></div><div><strong>先止损</strong><p>{{ item.stopLoss }}</p></div></div>
          <details><summary>展开排查与恢复全过程</summary><div class="failure-details-grid">
            <section><h3>排查证据</h3><ol><li v-for="value in item.investigate" :key="value">{{ value }}</li></ol></section><section><h3>恢复步骤</h3><ol><li v-for="value in item.recovery" :key="value">{{ value }}</li></ol></section>
            <section><h3>幂等依据</h3><p>{{ item.idempotencyBasis }}</p></section><section><h3>当前项目边界</h3><p>{{ item.currentBoundary }}</p><ul><li v-for="value in item.verificationEvidence" :key="value">{{ value }}</li></ul></section>
          </div><footer class="failure-related"><router-link v-for="value in relatedProjects(item)" :key="value!.slug" :to="`/projects/${value!.slug}`">项目：{{ value!.name }}</router-link><router-link v-for="value in relatedArticles(item)" :key="value!.slug" :to="`/articles/${value!.slug}`">文章：{{ value!.title }}</router-link></footer></details>
        </article>
      </section>
    </div>
  </section>
</template>
