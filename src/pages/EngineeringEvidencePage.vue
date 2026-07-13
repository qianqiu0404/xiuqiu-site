<script setup lang="ts">
import { onMounted } from 'vue'
import { evidenceCapabilities, evidenceCellStatus, evidenceForCell, evidenceKinds, evidenceStatusLabels } from '../data/evidence'
import { setSeoMeta } from '../utils/seo'

onMounted(() => setSeoMeta({
  title: '工程证据覆盖｜xiuqiu',
  description: '按工程实现、自动化测试、可运行演示和公开说明查看 Web3 钱包工程证据与当前边界。',
  path: '/engineering/evidence',
}))
</script>

<template>
  <section class="section page-top evidence-page">
    <div class="container">
      <header class="evidence-hero">
        <div><p class="section-label">Engineering Evidence</p><h1>工程证据覆盖</h1><p>这里不使用完成百分比。每项能力分别查看实现、测试、演示和公开说明，并明确哪些来自私有工程摘要、哪些可以直接打开复核。</p></div>
        <div class="evidence-legend"><span data-status="verified">已验证</span><span data-status="partial">部分验证</span><span data-status="design">工程设计</span><span data-status="none">暂无证据</span></div>
      </header>

      <div class="evidence-matrix evidence-desktop" role="table" aria-label="工程证据覆盖矩阵">
        <div class="matrix-head capability-head" role="columnheader">能力维度</div>
        <div v-for="kind in evidenceKinds" :key="kind.id" class="matrix-head" role="columnheader">{{ kind.title }}</div>
        <template v-for="capability in evidenceCapabilities" :key="capability.id">
          <div class="matrix-capability" role="rowheader"><strong>{{ capability.title }}</strong><span>{{ capability.summary }}</span></div>
          <div v-for="kind in evidenceKinds" :key="`${capability.id}-${kind.id}`" class="matrix-cell" role="cell">
            <details :id="`${capability.id}-${kind.id}`">
              <summary :data-status="evidenceCellStatus(evidenceForCell(capability.id, kind.id))">
                <span>{{ evidenceStatusLabels[evidenceCellStatus(evidenceForCell(capability.id, kind.id))] }}</span>
                <small>{{ evidenceForCell(capability.id, kind.id).length }} 条</small>
              </summary>
              <div v-if="evidenceForCell(capability.id, kind.id).length" class="matrix-cell-records">
                <article v-for="record in evidenceForCell(capability.id, kind.id)" :key="record.slug">
                  <strong>{{ record.title }}</strong><p>{{ record.summary }}</p><code v-if="record.command">{{ record.command }}</code>
                  <a v-if="record.visibility === 'public' && record.url" :href="record.url" target="_blank" rel="noopener">查看公开证据 &rarr;</a><small v-else>私有工程去敏摘要</small>
                </article>
              </div>
              <p v-else class="empty-evidence">当前没有足够事实支撑这一格。</p>
            </details>
          </div>
        </template>
      </div>

      <div class="evidence-mobile">
        <article v-for="capability in evidenceCapabilities" :key="capability.id" class="evidence-capability-card">
          <header><h2>{{ capability.title }}</h2><p>{{ capability.summary }}</p></header>
          <details v-for="kind in evidenceKinds" :key="kind.id">
            <summary><span>{{ kind.title }}</span><strong :data-status="evidenceCellStatus(evidenceForCell(capability.id, kind.id))">{{ evidenceStatusLabels[evidenceCellStatus(evidenceForCell(capability.id, kind.id))] }}</strong></summary>
            <div v-if="evidenceForCell(capability.id, kind.id).length" class="mobile-evidence-records"><article v-for="record in evidenceForCell(capability.id, kind.id)" :key="record.slug"><h3>{{ record.title }}</h3><p>{{ record.summary }}</p><code v-if="record.command">{{ record.command }}</code><a v-if="record.visibility === 'public' && record.url" :href="record.url" target="_blank" rel="noopener">查看公开证据 &rarr;</a><small v-else>私有工程去敏摘要</small></article></div>
            <p v-else class="empty-evidence">当前没有足够事实支撑这一项。</p>
          </details>
        </article>
      </div>

      <footer class="evidence-page-footer"><strong>证据状态如何理解</strong><p>“已验证”只表示当前链接、测试或运行记录能够支撑对应事实；它不自动等于生产可用、经过审计或处理过真实资金。</p><router-link to="/engineering">返回工程档案 &rarr;</router-link></footer>
    </div>
  </section>
</template>
