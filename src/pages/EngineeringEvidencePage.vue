<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import '../styles/cinematic-pages.css'
import {
  evidenceCapabilities,
  evidenceCellStatus,
  evidenceForCell,
  evidenceKinds,
  evidenceStatusLabels,
} from '../data/evidence'
import {
  deliveryStatusLabels,
  evidenceKindLabels,
  evidenceLedgerRecords,
  evidenceLedgerStats,
  evidenceProjectOptions,
  evidenceVisibilityLabels,
  failureEvidenceStatusLabels,
} from '../data/evidenceLedger'
import type {
  EvidenceKind,
  EvidenceStatus,
  EvidenceVisibility,
} from '../data/generatedEvidence'
import { setSeoMeta } from '../utils/seo'

type ProjectFilter = 'all' | string
type KindFilter = 'all' | EvidenceKind
type StatusFilter = 'all' | EvidenceStatus
type VisibilityFilter = 'all' | EvidenceVisibility

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
    title: '工程证据覆盖｜xiuqiu',
    description: '按工程实现、自动化测试、可运行演示和公开说明查看 Web3 钱包工程证据与当前边界。',
    path: '/engineering/evidence',
  })

  const requestedEvidence = window.location.hash.slice(1)
  if (requestedEvidence) void revealEvidence(requestedEvidence, false)
})
</script>

<template>
  <section class="verification-ledger-page cinematic-page">
    <header class="verification-hero cinematic-page-hero">
      <div class="container verification-hero-layout">
        <div class="verification-hero-copy">
          <p class="cinematic-page-kicker">Engineering Evidence / Verification Ledger</p>
          <h1>每一个工程判断，<span>都应该能沿证据链追溯。</span></h1>
          <p>
            账本按日期记录实现、测试、演示与公开说明，并把项目、AI 交付、失败边界和相关文章连接起来。没有关联记录时，就不补一个看似完整的节点。
          </p>
          <div class="verification-hero-meta">
            <span>{{ evidenceLedgerStats.total }} 条公开字段记录</span>
            <span>最新复核 {{ evidenceLedgerStats.latestVerifiedAt }}</span>
          </div>
        </div>

        <dl class="verification-state-grid" aria-label="证据状态统计">
          <div data-state="verified">
            <dt>Verified</dt>
            <dd>{{ evidenceLedgerStats.verified }}</dd>
            <span>已验证</span>
          </div>
          <div data-state="partial">
            <dt>Partial</dt>
            <dd>{{ evidenceLedgerStats.partial }}</dd>
            <span>部分验证</span>
          </div>
          <div data-state="design">
            <dt>Design</dt>
            <dd>{{ evidenceLedgerStats.design }}</dd>
            <span>工程设计</span>
          </div>
          <div data-state="public">
            <dt>Public</dt>
            <dd>{{ evidenceLedgerStats.public }}</dd>
            <span>可直接打开</span>
          </div>
        </dl>
      </div>
    </header>

    <div class="verification-ledger-surface">
      <div class="container">
        <section class="verification-ledger-section" aria-labelledby="ledger-title">
          <header class="verification-section-heading">
            <div>
              <p class="verification-index">Ledger / 01</p>
              <h2 id="ledger-title">Verification Ledger</h2>
            </div>
            <p>先按项目或证据状态筛选，再展开任意一行查看它真实存在的关系节点。</p>
          </header>

          <form class="verification-filters" aria-label="筛选验证账本" @submit.prevent>
            <label>
              <span>Project</span>
              <select v-model="projectFilter">
                <option value="all">全部项目</option>
                <option v-for="project in evidenceProjectOptions" :key="project.slug" :value="project.slug">
                  {{ project.name }}
                </option>
              </select>
            </label>
            <label>
              <span>Kind</span>
              <select v-model="kindFilter">
                <option value="all">全部类型</option>
                <option v-for="option in kindOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
              </select>
            </label>
            <label>
              <span>Status</span>
              <select v-model="statusFilter">
                <option value="all">全部状态</option>
                <option v-for="option in statusOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
              </select>
            </label>
            <label>
              <span>Visibility</span>
              <select v-model="visibilityFilter">
                <option value="all">全部可见性</option>
                <option v-for="option in visibilityOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
              </select>
            </label>
            <button type="button" :disabled="!hasActiveFilters" @click="resetFilters">重置</button>
          </form>

          <div class="verification-result-count" aria-live="polite">
            显示 {{ filteredLedgerRecords.length }} / {{ evidenceLedgerStats.total }} 条证据
          </div>

          <div v-if="filteredLedgerRecords.length" class="verification-ledger">
            <details
              v-for="(record, index) in filteredLedgerRecords"
              :id="record.evidence.slug"
              :key="record.evidence.slug"
              class="verification-ledger-row"
            >
              <summary>
                <span class="verification-row-index">{{ String(index + 1).padStart(2, '0') }}</span>
                <div class="verification-row-meta">
                  <time :datetime="record.evidence.verifiedAt">{{ record.evidence.verifiedAt }}</time>
                  <span :data-status="record.evidence.status">{{ evidenceStatusLabels[record.evidence.status] }}</span>
                  <small>{{ evidenceKindLabels[record.evidence.kind] }}</small>
                </div>
                <div class="verification-row-copy">
                  <h3>{{ record.evidence.title }}</h3>
                  <p>{{ record.evidence.summary }}</p>
                </div>
                <div class="verification-row-projects">
                  <span>{{ evidenceVisibilityLabels[record.evidence.visibility] }}</span>
                  <strong>{{ record.projects.map(project => project.name).join(' / ') }}</strong>
                </div>
                <i aria-hidden="true"></i>
              </summary>

              <div class="proof-chain-panel">
                <header>
                  <div>
                    <p class="verification-index">Proof chain</p>
                    <h4>只连接当前记录已有的公开关系</h4>
                  </div>
                  <span>{{ record.projects.length + record.deliveries.length + 1 + record.failures.length + record.articles.length }} 个节点</span>
                </header>

                <div class="proof-chain">
                  <section v-if="record.projects.length" class="proof-chain-node" data-node="project">
                    <span>Project</span>
                    <div class="proof-chain-records">
                      <router-link v-for="project in record.projects" :key="project.slug" :to="`/projects/${project.slug}`">
                        <strong>{{ project.name }}</strong>
                        <small>{{ project.category }} · 更新于 {{ project.updatedAt }}</small>
                      </router-link>
                    </div>
                  </section>

                  <section v-if="record.deliveries.length" class="proof-chain-node" data-node="delivery">
                    <span>Delivery / Run</span>
                    <div class="proof-chain-records">
                      <router-link v-for="delivery in record.deliveries" :key="delivery.slug" :to="`/ai/deliveries/${delivery.slug}`">
                        <small>{{ deliveryStatusLabels[delivery.status] }} · {{ delivery.date }}</small>
                        <strong>{{ delivery.title }}</strong>
                        <p>{{ delivery.summary }}</p>
                        <em v-if="delivery.knownLimits[0]">当前限制：{{ delivery.knownLimits[0] }}</em>
                      </router-link>
                    </div>
                  </section>

                  <section class="proof-chain-node proof-chain-node--artifact" data-node="evidence">
                    <span>Evidence artifact</span>
                    <div class="proof-artifact">
                      <div>
                        <strong>{{ record.evidence.title }}</strong>
                        <span :data-status="record.evidence.status">{{ evidenceStatusLabels[record.evidence.status] }}</span>
                      </div>
                      <p>{{ record.evidence.summary }}</p>
                      <code v-if="record.evidence.command">{{ record.evidence.command }}</code>
                      <a
                        v-if="record.evidence.visibility === 'public' && record.evidence.url"
                        :href="record.evidence.url"
                        target="_blank"
                        rel="noopener"
                      >打开公开证据 ↗</a>
                      <small v-else>私有工程去敏摘要 · 不提供私有仓库链接</small>
                    </div>
                  </section>

                  <section v-if="record.failures.length" class="proof-chain-node" data-node="failure">
                    <span>Failure boundary</span>
                    <div class="proof-chain-records">
                      <router-link
                        v-for="failure in record.failures"
                        :key="failure.slug"
                        :to="`/engineering/failures#${failure.slug}`"
                      >
                        <small>{{ failureEvidenceStatusLabels[failure.evidenceStatus] }}</small>
                        <strong>{{ failure.title }}</strong>
                        <p>{{ failure.currentBoundary }}</p>
                      </router-link>
                    </div>
                  </section>

                  <section v-if="record.articles.length" class="proof-chain-node" data-node="article">
                    <span>Engineering note</span>
                    <div class="proof-chain-records proof-chain-records--compact">
                      <router-link v-for="article in record.articles" :key="article.slug" :to="`/articles/${article.slug}`">
                        <strong>{{ article.title }}</strong>
                        <small>{{ article.kind }} · {{ article.date }}</small>
                      </router-link>
                    </div>
                  </section>
                </div>
              </div>
            </details>
          </div>

          <div v-else class="verification-empty-state">
            <strong>当前筛选没有证据记录</strong>
            <p>可以重置筛选，或选择更宽的项目与状态范围。</p>
            <button type="button" @click="resetFilters">重置筛选</button>
          </div>
        </section>

        <section class="coverage-map-section" aria-labelledby="coverage-title">
          <header class="verification-section-heading">
            <div>
              <p class="verification-index">Coverage / 02</p>
              <h2 id="coverage-title">Coverage Map</h2>
            </div>
            <p>账本回答“证据从哪里来”，覆盖图回答“哪些能力和证明方式仍有空白”。</p>
          </header>

          <div class="coverage-desktop">
            <div class="coverage-table-shell">
              <div class="coverage-table" role="table" aria-label="工程证据覆盖图">
                <div class="coverage-head coverage-capability-head" role="columnheader">能力维度</div>
                <div v-for="kind in evidenceKinds" :key="kind.id" class="coverage-head" role="columnheader">{{ kind.title }}</div>
                <template v-for="capability in evidenceCapabilities" :key="capability.id">
                  <div class="coverage-capability" role="rowheader">
                    <strong>{{ capability.title }}</strong>
                    <span>{{ capability.summary }}</span>
                  </div>
                  <div v-for="kind in evidenceKinds" :key="`${capability.id}-${kind.id}`" class="coverage-cell" role="cell">
                    <details v-if="evidenceForCell(capability.id, kind.id).length">
                      <summary :data-status="evidenceCellStatus(evidenceForCell(capability.id, kind.id))">
                        <span>{{ evidenceStatusLabels[evidenceCellStatus(evidenceForCell(capability.id, kind.id))] }}</span>
                        <small>{{ evidenceForCell(capability.id, kind.id).length }} 条</small>
                      </summary>
                      <div>
                        <a
                          v-for="item in evidenceForCell(capability.id, kind.id)"
                          :key="item.slug"
                          :href="`#${item.slug}`"
                          @click.prevent="revealEvidence(item.slug)"
                        >
                          {{ item.title }}
                        </a>
                      </div>
                    </details>
                    <span v-else class="coverage-none" data-status="none">暂无证据</span>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <div class="coverage-mobile">
            <article v-for="capability in evidenceCapabilities" :key="capability.id">
              <header>
                <h3>{{ capability.title }}</h3>
                <p>{{ capability.summary }}</p>
              </header>
              <details v-for="kind in evidenceKinds" :key="kind.id">
                <summary>
                  <span>{{ kind.title }}</span>
                  <strong :data-status="evidenceCellStatus(evidenceForCell(capability.id, kind.id))">
                    {{ evidenceStatusLabels[evidenceCellStatus(evidenceForCell(capability.id, kind.id))] }}
                  </strong>
                </summary>
                <div v-if="evidenceForCell(capability.id, kind.id).length">
                  <a
                    v-for="item in evidenceForCell(capability.id, kind.id)"
                    :key="item.slug"
                    :href="`#${item.slug}`"
                    @click.prevent="revealEvidence(item.slug)"
                  >
                    {{ item.title }}
                  </a>
                </div>
                <p v-else>当前没有足够事实支撑这一项。</p>
              </details>
            </article>
          </div>
        </section>

        <footer class="verification-truth-boundary">
          <div class="verification-truth-heading">
            <p class="verification-index">Truth boundary</p>
            <h2>证据状态不是生产承诺。</h2>
          </div>
          <div class="verification-truth-grid">
            <section>
              <strong>Verified ≠ Production</strong>
              <p>“已验证”只表示当前链接、测试或运行记录能够支撑对应事实；它不自动等于生产可用、经过审计或处理过真实资金。</p>
            </section>
            <section>
              <strong>Private summary</strong>
              <p>私有项目只公开去敏后的边界、命令和结论，不生成仓库入口，也不把摘要包装成公开源码。</p>
            </section>
            <section>
              <strong>Different states</strong>
              <p>Evidence、Delivery 与 Failure 使用各自的状态语义；“已交付”“当前已实现”和“已验证”不会互相替代。</p>
            </section>
          </div>
          <nav aria-label="继续检查工程证据">
            <router-link to="/engineering">返回 Proof Index</router-link>
            <router-link to="/engineering/failures">检查 Failure Playbook</router-link>
            <router-link to="/ai/deliveries">查看 Delivery Ledger</router-link>
          </nav>
        </footer>
      </div>
    </div>
  </section>
</template>

<style scoped src="../styles/evidence-ledger.css"></style>
