<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import '../../../design/brief.css'
import '../../../design/reader.css'
import '../../../design/evidence-reader.css'
import { evidenceCapabilities, evidenceCellStatus, evidenceForCell, evidenceKinds, evidenceStatusLabels, deliveryStatusLabels, evidenceKindLabels, evidenceLedgerRecords, evidenceLedgerStats, evidenceProjectOptions, evidenceVisibilityLabels, failureEvidenceStatusLabels } from '../data'
import type { EvidenceKind, EvidenceStatus, EvidenceVisibility, ProjectClaimState, ProjectPublicRole } from '../data'
import { setSeoMeta } from '../../../utils/seo'

type ProjectFilter = 'all' | string
type KindFilter = 'all' | EvidenceKind
type StatusFilter = 'all' | EvidenceStatus
type VisibilityFilter = 'all' | EvidenceVisibility

// Reader-facing wording for this page. The projects pages keep their own
// (English) role and claim labels; this page maps the same keys to plain Chinese.
const readerRoleLabels: Record<ProjectPublicRole, string> = {
  'current-product': '当前产品',
  'current-direction': '当前方向',
  'historical-evidence': '历史记录',
}
const readerClaimLabels: Record<ProjectClaimState, string> = {
  locked: '公开结论待补证据',
  'evidence-ready': '有证据支撑有限结论',
  publishable: '证据可公开复核',
}
const projectFilter = ref<ProjectFilter>('all')
const kindFilter = ref<KindFilter>('all')
const statusFilter = ref<StatusFilter>('all')
const visibilityFilter = ref<VisibilityFilter>('all')

const kindOptions: Array<{ id: EvidenceKind; label: string }> = [
  { id: 'implementation', label: '工程实现' },
  { id: 'test', label: '自动化测试' },
  { id: 'demo', label: '可运行演示' },
  { id: 'writeup', label: '公开说明' },
]

const statusOptions: Array<{ id: EvidenceStatus; label: string }> = [
  { id: 'verified', label: '已验证' },
  { id: 'partial', label: '部分验证' },
  { id: 'design', label: '工程设计' },
]

const visibilityOptions: Array<{ id: EvidenceVisibility; label: string }> = [
  { id: 'public', label: '公开可复核' },
  { id: 'private-summary', label: '私有工程去敏摘要' },
]

const filteredLedgerRecords = computed(() => evidenceLedgerRecords.filter(record => (
  (projectFilter.value === 'all' || record.evidence.projectSlugs.includes(projectFilter.value))
  && (kindFilter.value === 'all' || record.evidence.kind === kindFilter.value)
  && (statusFilter.value === 'all' || record.evidence.status === statusFilter.value)
  && (visibilityFilter.value === 'all' || record.evidence.visibility === visibilityFilter.value)
)))

const hasActiveFilters = computed(() => [
  projectFilter.value,
  kindFilter.value,
  statusFilter.value,
  visibilityFilter.value,
].some(value => value !== 'all'))

function resetFilters() {
  projectFilter.value = 'all'
  kindFilter.value = 'all'
  statusFilter.value = 'all'
  visibilityFilter.value = 'all'
}

async function revealEvidence(slug: string, clearFilters = true) {
  if (clearFilters) resetFilters()
  await nextTick()

  const row = document.getElementById(slug)
  if (!row) return
  if (row instanceof HTMLDetailsElement) row.open = true

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  row.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#${slug}`)
}

onMounted(() => {
  setSeoMeta({
    title: '工程证据｜xiuqiu',
    description: '按项目、类型和状态查看工程证据：Qiu Market 是当前产品，Wallet Infrastructure 是当前方向（公开结论还在补齐证据），其余钱包材料是历史记录。',
    path: '/engineering/evidence',
  })

  const requestedEvidence = window.location.hash.slice(1)
  if (requestedEvidence) void revealEvidence(requestedEvidence, false)
})
</script>

<template>
  <section class="brief evidence-reader" lang="zh-CN">
    <header class="brief-masthead">
      <div class="brief-shell">
        <p class="brief-dateline">
          <span>证据</span>
          <span>{{ evidenceLedgerStats.total }} 条公开记录</span>
          <span>最近复核 <time :datetime="evidenceLedgerStats.latestVerifiedAt">{{ evidenceLedgerStats.latestVerifiedAt }}</time></span>
        </p>
        <h1>工程证据</h1>
        <p class="brief-lede">
          每条记录写明做了什么、哪天核对、覆盖到哪里。Qiu Market 是当前产品；Wallet Infrastructure 是当前方向，公开结论还在补齐证据；其余钱包项目和 AI 交付作为历史记录保留。
        </p>
        <dl class="reader-facts">
          <div><dt>已验证</dt><dd>{{ evidenceLedgerStats.verified }}</dd></div>
          <div><dt>部分验证</dt><dd>{{ evidenceLedgerStats.partial }}</dd></div>
          <div><dt>仅设计</dt><dd>{{ evidenceLedgerStats.design }}</dd></div>
          <div><dt>可直接打开</dt><dd>{{ evidenceLedgerStats.public }}</dd></div>
        </dl>
      </div>
    </header>

    <div class="brief-shell reader-layout">
      <nav class="reader-toc" aria-label="证据页栏目">
        <span>本页目录</span>
        <a href="#ledger-title">证据记录 · {{ evidenceLedgerStats.total }}</a>
        <a href="#coverage-title">能力覆盖</a>
        <a href="#boundary-title">状态说明</a>
      </nav>

      <div class="reader-main">
        <section class="reader-section" aria-labelledby="ledger-title">
          <header class="reader-section-header">
            <span>01</span>
            <h2 id="ledger-title" tabindex="-1">证据记录</h2>
            <small>按复核日期排列 · 展开一行查看关联的项目、交付与失败记录</small>
          </header>

          <form class="evidence-filters" aria-label="筛选证据记录" @submit.prevent>
            <label>
              <span>项目</span>
              <select v-model="projectFilter">
                <option value="all">全部项目</option>
                <option v-for="project in evidenceProjectOptions" :key="project.slug" :value="project.slug">
                  {{ project.name }} · {{ readerRoleLabels[project.publicRole] }}
                </option>
              </select>
            </label>
            <label>
              <span>类型</span>
              <select v-model="kindFilter">
                <option value="all">全部类型</option>
                <option v-for="option in kindOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
              </select>
            </label>
            <label>
              <span>状态</span>
              <select v-model="statusFilter">
                <option value="all">全部状态</option>
                <option v-for="option in statusOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
              </select>
            </label>
            <label>
              <span>可见性</span>
              <select v-model="visibilityFilter">
                <option value="all">全部可见性</option>
                <option v-for="option in visibilityOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
              </select>
            </label>
            <button type="button" class="brief-button" :disabled="!hasActiveFilters" @click="resetFilters">重置</button>
          </form>

          <p class="evidence-count" aria-live="polite">显示 {{ filteredLedgerRecords.length }} / {{ evidenceLedgerStats.total }} 条</p>

          <div v-if="filteredLedgerRecords.length" class="evidence-list">
            <details
              v-for="record in filteredLedgerRecords"
              :id="record.evidence.slug"
              :key="record.evidence.slug"
              class="reader-disclosure verification-ledger-row"
            >
              <summary>
                <span class="evidence-row-head">
                  <strong>{{ record.evidence.title }}</strong>
                  <time :datetime="record.evidence.verifiedAt">{{ record.evidence.verifiedAt }}</time>
                </span>
                <span class="evidence-row-summary">{{ record.evidence.summary }}</span>
                <span class="brief-card-meta">
                  <b :class="`brief-tag evidence-tag--${record.evidence.status}`">{{ evidenceStatusLabels[record.evidence.status] }}</b>
                  <span>{{ evidenceKindLabels[record.evidence.kind] }}</span>
                  <span>{{ evidenceVisibilityLabels[record.evidence.visibility] }}</span>
                  <span>{{ record.projects.map(project => project.name).join(' / ') }}</span>
                </span>
              </summary>

              <div>
                <dl class="reader-answers">
                  <div v-if="record.evidence.command">
                    <dt>复核命令</dt>
                    <dd><code class="evidence-command">{{ record.evidence.command }}</code></dd>
                  </div>
                  <div>
                    <dt>证据入口</dt>
                    <dd>
                      <a
                        v-if="record.evidence.visibility === 'public' && record.evidence.url"
                        class="reader-source-link"
                        :href="record.evidence.url"
                        target="_blank"
                        rel="noopener"
                      >打开公开证据 ↗</a>
                      <span v-else class="evidence-muted">私有工程去敏摘要 · 不提供私有仓库链接</span>
                    </dd>
                  </div>
                  <div v-if="record.projects.length">
                    <dt>项目</dt>
                    <dd>
                      <ul class="evidence-links">
                        <li v-for="project in record.projects" :key="project.slug">
                          <router-link :to="`/projects/${project.slug}`">{{ project.name }}</router-link>
                          <small>{{ readerRoleLabels[project.publicRole] }} · {{ readerClaimLabels[project.claimState] }} · 更新于 {{ project.updatedAt }}</small>
                        </li>
                      </ul>
                    </dd>
                  </div>
                  <div v-if="record.deliveries.length">
                    <dt>历史交付</dt>
                    <dd>
                      <ul class="evidence-links">
                        <li v-for="delivery in record.deliveries" :key="delivery.slug">
                          <router-link :to="`/ai/deliveries/${delivery.slug}`">{{ delivery.title }}</router-link>
                          <small>{{ deliveryStatusLabels[delivery.status] }} · {{ delivery.date }}</small>
                          <small v-if="delivery.knownLimits[0]">最后记录的限制：{{ delivery.knownLimits[0] }}</small>
                        </li>
                      </ul>
                    </dd>
                  </div>
                  <div v-if="record.failures.length">
                    <dt>失败边界</dt>
                    <dd>
                      <ul class="evidence-links">
                        <li v-for="failure in record.failures" :key="failure.slug">
                          <router-link :to="`/engineering/failures#${failure.slug}`">{{ failure.title }}</router-link>
                          <small>{{ failureEvidenceStatusLabels[failure.evidenceStatus] }} · {{ failure.currentBoundary }}</small>
                        </li>
                      </ul>
                    </dd>
                  </div>
                  <div v-if="record.articles.length">
                    <dt>工程笔记</dt>
                    <dd>
                      <ul class="evidence-links">
                        <li v-for="article in record.articles" :key="article.slug">
                          <router-link :to="`/articles/${article.slug}`">{{ article.title }}</router-link>
                          <small>{{ article.kind }} · {{ article.date }}</small>
                        </li>
                      </ul>
                    </dd>
                  </div>
                </dl>
              </div>
            </details>
          </div>

          <div v-else class="brief-state">
            <strong>当前筛选没有证据记录</strong>
            <p>可以重置筛选，或选择更宽的项目与状态范围。</p>
            <button type="button" class="brief-button" @click="resetFilters">重置筛选</button>
          </div>
        </section>

        <section class="reader-section" aria-labelledby="coverage-title">
          <header class="reader-section-header">
            <span>02</span>
            <h2 id="coverage-title" tabindex="-1">能力覆盖</h2>
            <small>每项能力有哪些证据，空白在哪里</small>
          </header>

          <div class="evidence-coverage-shell">
            <div class="evidence-coverage" role="table" aria-label="工程证据覆盖图">
              <div class="evidence-coverage-head" role="columnheader">能力</div>
              <div v-for="kind in evidenceKinds" :key="kind.id" class="evidence-coverage-head" role="columnheader">{{ kind.title }}</div>
              <template v-for="capability in evidenceCapabilities" :key="capability.id">
                <div class="evidence-coverage-capability" role="rowheader">
                  <strong>{{ capability.title }}</strong>
                  <span>{{ capability.summary }}</span>
                </div>
                <div v-for="kind in evidenceKinds" :key="`${capability.id}-${kind.id}`" class="evidence-coverage-cell" role="cell">
                  <details v-if="evidenceForCell(capability.id, kind.id).length">
                    <summary :data-status="evidenceCellStatus(evidenceForCell(capability.id, kind.id))">
                      <i aria-hidden="true"></i>
                      {{ evidenceStatusLabels[evidenceCellStatus(evidenceForCell(capability.id, kind.id))] }}
                      <small>{{ evidenceForCell(capability.id, kind.id).length }} 条</small>
                    </summary>
                    <div>
                      <a
                        v-for="item in evidenceForCell(capability.id, kind.id)"
                        :key="item.slug"
                        :href="`#${item.slug}`"
                        @click.prevent="revealEvidence(item.slug)"
                      >{{ item.title }}</a>
                    </div>
                  </details>
                  <span v-else class="evidence-coverage-none" data-status="none"><i aria-hidden="true"></i>暂无</span>
                </div>
              </template>
            </div>
          </div>
          <p class="evidence-legend"><i data-status="verified" aria-hidden="true"></i>已验证 <i data-status="partial" aria-hidden="true"></i>部分验证 <i data-status="design" aria-hidden="true"></i>仅设计 <i data-status="none" aria-hidden="true"></i>暂无证据 · 手机上可左右滑动表格</p>
        </section>

        <section class="reader-section" aria-labelledby="boundary-title">
          <header class="reader-section-header">
            <span>03</span>
            <h2 id="boundary-title" tabindex="-1">状态说明</h2>
            <small>证据状态不是生产承诺</small>
          </header>
          <dl class="reader-answers">
            <div><dt>已验证 ≠ 生产</dt><dd>“已验证”只表示当前链接、测试或运行记录能够支撑对应事实；它不自动等于生产可用、经过审计或处理过真实资金。</dd></div>
            <div><dt>私有摘要</dt><dd>私有项目只公开去敏后的边界、命令和结论，不生成仓库入口，也不把摘要包装成公开源码。</dd></div>
            <div><dt>各自的状态</dt><dd>证据、历史交付与失败记录使用各自的状态语义；“历史已交付”“当前已实现”和“已验证”不会互相替代。</dd></div>
          </dl>
          <nav class="evidence-next" aria-label="继续检查工程证据">
            <router-link to="/engineering">工程总览 →</router-link>
            <router-link to="/engineering/failures">失败恢复手册 →</router-link>
            <router-link to="/ai/deliveries">AI 历史交付记录 →</router-link>
          </nav>
        </section>
      </div>
    </div>
  </section>
</template>
