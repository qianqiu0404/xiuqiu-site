<script setup lang="ts">
import { onMounted } from 'vue'
import { aiStageLabels, getArticlesBySlugs, siteAiCases } from '../data/siteKnowledge'
import { deliveryRecords } from '../data/generatedDeliveries'
import { setSeoMeta } from '../utils/seo'

const aiMethod = [
  {
    step: '01',
    title: '定义问题与边界',
    description: '先明确目标、允许使用的来源、权限边界和完成标准，避免把生成内容当作结论。',
  },
  {
    step: '02',
    title: '实现并记录假设',
    description: '让 AI 加速检索、拆解、代码和文档工作，同时保留关键假设与待验证项。',
  },
  {
    step: '03',
    title: '审查与运行验证',
    description: '人工检查差异、代码和来源，再用测试、构建、浏览器或链接检查验证实际结果。',
  },
  {
    step: '04',
    title: '沉淀证据并回流',
    description: '记录结果、限制、失败和下一步，让交付证据回到项目与知识系统。',
  },
] as const

const recentAuditableResults = [...deliveryRecords]
  .sort((a, b) => b.date.localeCompare(a.date))
  .slice(0, 3)

function loopNumber(order: number) {
  return String(order).padStart(2, '0')
}

onMounted(() => setSeoMeta({
  title: 'AI 工程协作｜xiuqiu',
  description: 'AI 加速需求拆解、实现与知识治理，但不替代人工审查、测试验证和证据收口。',
  path: '/ai',
}))
</script>

<template>
  <section class="section page-top ai-collaboration-page">
    <div class="container">
      <header class="ai-page-hero">
        <p class="section-label">AI Engineering</p>
        <h1>AI 加速工程，但不代替验证</h1>
        <p>AI 参与需求拆解、实现、审查辅助、测试准备、文档和知识治理；我负责目标、来源边界、关键判断与最终验收，外部模型、工具与第三方 Skill 保留各自归属。</p>
        <div class="ai-principle-strip"><span>目标由我定义</span><span>来源明确</span><span>证据可复核</span><span>失败可回流</span></div>
      </header>

      <section class="ai-method" aria-labelledby="ai-method-title">
        <header>
          <p class="section-label">Verification First</p>
          <h2 id="ai-method-title">从问题到证据的四步方法</h2>
        </header>
        <ol class="ai-method-grid">
          <li v-for="item in aiMethod" :key="item.step">
            <span>{{ item.step }}</span>
            <h3>{{ item.title }}</h3>
            <p>{{ item.description }}</p>
          </li>
        </ol>
      </section>

      <section class="ai-delivery-preview">
        <header><div><p class="section-label">Recent Auditable Results</p><h2>近期可审计结果</h2><p>最多展示三条真实交付，记录 AI 参与、人工判断、审查发现、纠正动作和公开证据。</p></div><router-link to="/ai/deliveries">查看全部交付 &rarr;</router-link></header>
        <div><router-link v-for="item in recentAuditableResults" :key="item.slug" :to="`/ai/deliveries/${item.slug}`"><div class="card-status-row"><time>{{ item.date }}</time><strong>{{ item.status === 'delivered' ? '已交付' : item.status === 'partial' ? '部分完成' : '进行中' }}</strong></div><h3>{{ item.title }}</h3><p>{{ item.summary }}</p><small>{{ item.evidenceSlugs.length }} 项证据 · {{ item.publicLinks.length }} 个公开链接</small></router-link></div>
      </section>

      <nav class="ai-case-nav" aria-label="AI workflow loops">
        <a v-for="item in siteAiCases" :key="item.id" :href="`#${item.slug}`"><span>{{ loopNumber(item.displayOrder) }}</span><strong>{{ item.title }}</strong></a>
      </nav>

      <section class="ai-case-collection" aria-labelledby="ai-cases-title">
        <header>
          <p class="section-label">Case Library</p>
          <h2 id="ai-cases-title">五个真实协作 Loop</h2>
          <p>默认收起长案例；展开后查看职责、流程、证据、失败处理与当前限制。</p>
        </header>
        <details v-for="item in siteAiCases" :id="item.slug" :key="item.id" class="ai-case-detail ai-case-compact">
          <summary>
            <span class="ai-case-number">Loop {{ loopNumber(item.displayOrder) }}</span>
            <div>
              <p>{{ aiStageLabels[item.stage] }}</p>
              <h3>{{ item.title }}<small v-if="item.slug === 'cross-device-skill-toolchain'">SkillOps Loop</small></h3>
              <span>{{ item.summary }}</span>
            </div>
            <b aria-hidden="true">展开</b>
          </summary>
          <div class="ai-case-expanded">
            <router-link v-if="item.slug === 'social-media-research'" class="btn btn-secondary ai-case-action" to="/ai/social-research">查看交互展示</router-link>
            <div class="ai-ownership-note"><span>来源与归属</span><p>{{ item.ownershipNote }}</p></div>
            <div class="ai-case-current"><span>当前重点</span><p>{{ item.currentFocus }}</p></div>
            <div class="ai-flow" aria-label="Workflow"><template v-for="(step, index) in item.flow" :key="step"><div><span>{{ index + 1 }}</span><p>{{ step }}</p></div><b v-if="index < item.flow.length - 1">&rarr;</b></template></div>
            <div class="ai-loop-core-grid">
              <section><p class="project-abilities-title">我的职责</p><ul class="learning-list"><li v-for="value in item.responsibilities" :key="value">{{ value }}</li></ul></section>
              <section><p class="project-abilities-title">已有证据</p><ul class="learning-list"><li v-for="value in item.evidence" :key="value">{{ value }}</li></ul></section>
              <section><p class="project-abilities-title">下一里程碑</p><p>{{ item.nextMilestone }}</p></section>
            </div>
            <div class="ai-loop-details-grid">
              <section><p class="project-abilities-title">目标完成形态</p><p>{{ item.targetOutcome }}</p></section>
              <section><p class="project-abilities-title">失败处理</p><ul class="learning-list"><li v-for="value in item.failureHandling" :key="value">{{ value }}</li></ul></section>
              <section><p class="project-abilities-title">当前限制</p><ul class="learning-list"><li v-for="value in item.knownLimits" :key="value">{{ value }}</li></ul></section>
            </div>
            <div class="ai-related-links"><p class="project-abilities-title">相关公开复盘</p><router-link v-for="article in getArticlesBySlugs(item.relatedArticleSlugs)" :key="article.slug" :to="`/articles/${article.slug}`">{{ article.title }} &rarr;</router-link></div>
          </div>
        </details>
      </section>
    </div>
  </section>
</template>

<style scoped>
.ai-method {
  margin-top: 3rem;
  padding: 2.25rem 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.ai-method > header h2,
.ai-case-collection > header h2 {
  margin: 0.45rem 0 0;
  font-size: clamp(1.55rem, 3vw, 2.35rem);
}

.ai-method-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  margin: 2rem 0 0;
  padding: 0;
  list-style: none;
}

.ai-method-grid li {
  min-width: 0;
  padding: 0 1.25rem;
  border-left: 1px solid var(--border);
}

.ai-method-grid li:first-child {
  padding-left: 0;
  border-left: 0;
}

.ai-method-grid li:last-child {
  padding-right: 0;
}

.ai-method-grid span,
.ai-case-number {
  color: var(--accent);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.ai-method-grid h3 {
  margin: 0.75rem 0 0.55rem;
  font-size: 1.02rem;
}

.ai-method-grid p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
  line-height: 1.7;
}

.ai-case-collection {
  margin-top: 4rem;
}

.ai-case-collection > header {
  margin-bottom: 1.5rem;
}

.ai-case-collection > header > p:last-child {
  max-width: 46rem;
  margin: 0.8rem 0 0;
  color: var(--text-muted);
}

.ai-case-detail.ai-case-compact {
  margin: 0;
  padding: 0;
  border: 0;
  border-top: 1px solid var(--border);
  border-radius: 0;
  box-shadow: none;
}

.ai-case-detail.ai-case-compact:last-child {
  border-bottom: 1px solid var(--border);
}

.ai-case-compact > summary {
  display: grid;
  grid-template-columns: 6.5rem minmax(0, 1fr) auto;
  gap: 1.25rem;
  align-items: start;
  min-width: 0;
  padding: 1.4rem 0;
  cursor: pointer;
  list-style: none;
}

.ai-case-compact > summary::-webkit-details-marker {
  display: none;
}

.ai-case-compact > summary > div {
  min-width: 0;
}

.ai-case-compact > summary p {
  margin: 0 0 0.3rem;
  color: var(--accent);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.ai-case-compact > summary h3 {
  margin: 0;
  font-size: clamp(1.05rem, 2vw, 1.35rem);
}

.ai-case-compact > summary h3 small {
  display: inline-block;
  margin-left: 0.6rem;
  color: var(--text-muted);
  font-size: 0.7rem;
  font-weight: 600;
}

.ai-case-compact > summary div > span {
  display: block;
  margin-top: 0.55rem;
  color: var(--text-muted);
  line-height: 1.6;
}

.ai-case-compact > summary > b {
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 600;
}

.ai-case-compact[open] > summary > b {
  color: var(--accent);
}

.ai-case-expanded {
  position: relative;
  padding: 0.4rem 0 2.5rem 7.75rem;
}

.ai-case-action {
  margin-bottom: 1.25rem;
}

.ai-case-expanded .ai-loop-details-grid {
  margin-top: 1rem;
}

@media (max-width: 900px) {
  .ai-method-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 1.5rem;
  }

  .ai-method-grid li:nth-child(3) {
    padding-left: 0;
    border-left: 0;
  }

  .ai-method-grid li:nth-child(2) {
    padding-right: 0;
  }
}

@media (max-width: 768px) {
  .ai-case-compact > summary {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.8rem;
  }

  .ai-case-number {
    grid-column: 1 / -1;
  }

  .ai-case-expanded {
    padding-left: 0;
  }
}

@media (max-width: 560px) {
  .ai-method-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 1.25rem;
  }

  .ai-method-grid li,
  .ai-method-grid li:first-child,
  .ai-method-grid li:nth-child(3) {
    padding: 0 0 1.25rem;
    border-left: 0;
    border-bottom: 1px solid var(--border);
  }

  .ai-method-grid li:last-child {
    padding-bottom: 0;
    border-bottom: 0;
  }

  .ai-case-compact > summary {
    padding: 1.2rem 0;
  }
}
</style>
