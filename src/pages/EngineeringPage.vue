<script setup lang="ts">
import { onMounted } from 'vue'
import { failureCases } from '../data/generatedFailureCases'
import { evidenceRecords, type EvidenceKind, type EvidenceStatus } from '../data/generatedEvidence'
import { siteProjects } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const serviceBoundaries = [
  {
    index: '01',
    name: 'wallet-service',
    responsibility: '资金状态与业务编排',
    boundary: '维护充值、提现、余额、幂等和 worker 状态，不直接持有链节点或密钥能力。',
  },
  {
    index: '02',
    name: 'risk-service',
    responsibility: '交易校验与风险放行',
    boundary: '绑定审批内容与交易事实；外部风险能力不可用时失败关闭，不能绕过审批。',
  },
  {
    index: '03',
    name: 'wallet-api',
    responsibility: '多链节点与交易构建',
    boundary: '封装链资源、查询、构建和广播差异，不承担资金账本或签名密钥职责。',
  },
  {
    index: '04',
    name: 'wallet-sign',
    responsibility: '密钥与签名边界',
    boundary: '统一 local、HSM、TSS 与 FROST 后端契约；后端故障不能静默切换托管身份。',
  },
]

const evidenceStatusLabels: Record<EvidenceStatus, string> = {
  verified: '已验证',
  partial: '部分验证',
  design: '工程设计',
}

const evidenceKindLabels: Record<EvidenceKind, string> = {
  implementation: '工程实现',
  test: '自动化测试',
  demo: '可运行演示',
  writeup: '公开说明',
}

const latestEvidence = [...evidenceRecords]
  .sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt) || a.title.localeCompare(b.title))
  .slice(0, 3)

const hubEntries = [
  {
    index: '01',
    title: '能力边界',
    description: '先理解资金编排、风险、链交互和签名分别由谁负责。',
    meta: `${serviceBoundaries.length} 个服务边界`,
    to: '/engineering#capability-boundaries',
  },
  {
    index: '02',
    title: '证据矩阵',
    description: '按实现、测试、演示和公开说明查看证据，不使用完成百分比。',
    meta: `${evidenceRecords.length} 条结构化证据`,
    to: '/engineering/evidence',
  },
  {
    index: '03',
    title: '失败恢复',
    description: '从资金事实出发，判断暂停、重试、补偿和人工复核。',
    meta: `${failureCases.length} 个异常场景`,
    to: '/engineering/failures',
  },
  {
    index: '04',
    title: '项目档案',
    description: '查看每个项目的真实阶段、已验证事实、限制和下一里程碑。',
    meta: `${siteProjects.length} 个公开项目档案`,
    to: '/projects',
  },
]

const verifiedEvidenceCount = evidenceRecords.filter(item => item.status === 'verified').length
const publicEvidenceCount = evidenceRecords.filter(item => item.visibility === 'public' && item.url).length
const activeProjectCount = siteProjects.filter(project => project.activityStatus === 'active').length

onMounted(() => setSeoMeta({
  title: '工程证据枢纽｜xiuqiu Web3 钱包后端',
  description: '从服务能力边界进入工程证据矩阵、钱包异常恢复和项目档案，区分实现、测试、演示与生产边界。',
  path: '/engineering',
}))
</script>

<template>
  <section class="section page-top engineering-hub">
    <div class="container">
      <header class="hub-hero">
        <div>
          <p class="section-label">Engineering Evidence Hub</p>
          <h1>从工程判断进入可复核证据</h1>
          <p class="hub-intro">
            这里不再重复项目图谱。先确认系统边界，再分别查看结构化证据、失败恢复手册和项目当前事实。
          </p>
        </div>
        <div class="hub-hero-actions">
          <router-link class="btn btn-primary" to="/engineering/evidence">查看证据矩阵</router-link>
          <router-link class="hub-text-link" to="/engineering/failures">进入失败恢复 →</router-link>
        </div>
      </header>

      <div class="hub-metrics" aria-label="工程证据概览">
        <div><strong>{{ verifiedEvidenceCount }}</strong><span>条已验证证据</span></div>
        <div><strong>{{ publicEvidenceCount }}</strong><span>条可直接打开</span></div>
        <div><strong>{{ activeProjectCount }}</strong><span>个活跃项目</span></div>
      </div>

      <section class="hub-section" aria-labelledby="hub-entry-title">
        <div class="hub-heading">
          <p class="section-label">Choose a path</p>
          <h2 id="hub-entry-title">四个入口，各自回答一个问题</h2>
        </div>
        <div class="hub-entry-grid">
          <router-link v-for="entry in hubEntries" :key="entry.index" :to="entry.to" class="hub-entry">
            <span>{{ entry.index }}</span>
            <h3>{{ entry.title }}</h3>
            <p>{{ entry.description }}</p>
            <small>{{ entry.meta }}</small>
            <strong>继续查看 →</strong>
          </router-link>
        </div>
      </section>

      <section id="capability-boundaries" class="hub-section boundary-section" aria-labelledby="boundary-title">
        <div class="hub-heading">
          <p class="section-label">Capability boundaries</p>
          <h2 id="boundary-title">四个服务，各守一类信任边界</h2>
          <p>能力通过责任边界表达；后端接入、局部测试或测试网通过，都不会自动升级为生产能力。</p>
        </div>
        <div class="boundary-list">
          <article v-for="item in serviceBoundaries" :key="item.name">
            <span>{{ item.index }}</span>
            <div>
              <h3>{{ item.name }}</h3>
              <strong>{{ item.responsibility }}</strong>
            </div>
            <p>{{ item.boundary }}</p>
          </article>
        </div>
      </section>

      <section v-if="latestEvidence.length" class="hub-section latest-section" aria-labelledby="latest-evidence-title">
        <div class="hub-heading-row">
          <div class="hub-heading">
            <p class="section-label">Latest evidence</p>
            <h2 id="latest-evidence-title">最近更新的证据</h2>
          </div>
          <router-link class="hub-text-link" to="/engineering/evidence">查看完整矩阵 →</router-link>
        </div>
        <div class="latest-evidence-list">
          <article v-for="item in latestEvidence" :key="item.slug">
            <div>
              <span>{{ evidenceKindLabels[item.kind] }}</span>
              <time :datetime="item.verifiedAt">{{ item.verifiedAt }}</time>
            </div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.summary }}</p>
            <small>{{ evidenceStatusLabels[item.status] }} · {{ item.visibility === 'public' ? '公开可复核' : '私有工程去敏摘要' }}</small>
          </article>
        </div>
      </section>

      <footer class="hub-footer">
        <p>需要按项目查看阶段和限制？进入项目图谱；需要验证具体失败判断？进入异常恢复手册。</p>
        <div>
          <router-link to="/projects">项目图谱 →</router-link>
          <router-link to="/engineering/failures">异常恢复 →</router-link>
        </div>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.engineering-hub {
  color: #14213d;
}

.hub-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(14rem, 0.55fr);
  gap: clamp(2rem, 7vw, 7rem);
  align-items: end;
  padding-bottom: clamp(2rem, 5vw, 4rem);
  border-bottom: 1px solid #dfe5ee;
}

.hub-hero h1 {
  max-width: 14ch;
  margin: 0.6rem 0 1rem;
  font-size: clamp(2.25rem, 5vw, 4.6rem);
  line-height: 1.04;
  letter-spacing: -0.055em;
}

.hub-intro {
  max-width: 42rem;
  margin: 0;
  color: #526075;
  font-size: clamp(1rem, 1.5vw, 1.15rem);
  line-height: 1.8;
}

.hub-hero-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1rem;
}

.hub-text-link {
  color: #1459d9;
  font-weight: 700;
  text-decoration: none;
}

.hub-text-link:hover {
  text-decoration: underline;
}

.hub-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-bottom: 1px solid #dfe5ee;
}

.hub-metrics div {
  display: flex;
  align-items: baseline;
  gap: 0.7rem;
  min-width: 0;
  padding: 1.35rem 0;
}

.hub-metrics div + div {
  padding-left: 1.5rem;
  border-left: 1px solid #dfe5ee;
}

.hub-metrics strong {
  font-size: 1.55rem;
}

.hub-metrics span {
  color: #657187;
  font-size: 0.86rem;
}

.hub-section {
  padding: clamp(3.25rem, 7vw, 6.5rem) 0;
  border-bottom: 1px solid #dfe5ee;
}

.hub-heading {
  max-width: 44rem;
}

.hub-heading h2 {
  margin: 0.5rem 0 0;
  font-size: clamp(1.75rem, 3vw, 2.7rem);
  line-height: 1.18;
  letter-spacing: -0.035em;
}

.hub-heading > p:last-child {
  margin: 0.9rem 0 0;
  color: #657187;
  line-height: 1.75;
}

.hub-entry-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 2.3rem;
  border-top: 1px solid #aeb9ca;
}

.hub-entry {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: 1rem;
  min-width: 0;
  padding: 1.75rem 1.5rem 1.75rem 0;
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid #dfe5ee;
}

.hub-entry:nth-child(even) {
  padding-left: 1.5rem;
  border-left: 1px solid #dfe5ee;
}

.hub-entry > span {
  grid-row: 1 / span 4;
  color: #1459d9;
  font: 700 0.75rem/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
}

.hub-entry h3 {
  margin: 0 0 0.65rem;
  font-size: 1.25rem;
}

.hub-entry p {
  margin: 0;
  color: #59667b;
  line-height: 1.65;
}

.hub-entry small {
  margin-top: 1rem;
  color: #788398;
}

.hub-entry > strong {
  margin-top: 0.75rem;
  color: #1459d9;
  font-size: 0.9rem;
}

.hub-entry:hover h3 {
  color: #1459d9;
}

.boundary-list {
  margin-top: 2.3rem;
  border-top: 1px solid #aeb9ca;
}

.boundary-list article {
  display: grid;
  grid-template-columns: 2.5rem minmax(12rem, 0.7fr) minmax(0, 1.3fr);
  gap: 1.25rem;
  align-items: start;
  padding: 1.45rem 0;
  border-bottom: 1px solid #dfe5ee;
}

.boundary-list article > span {
  color: #1459d9;
  font: 700 0.75rem/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
}

.boundary-list h3 {
  margin: 0 0 0.35rem;
  font-size: 1.05rem;
}

.boundary-list strong {
  color: #526075;
  font-size: 0.86rem;
}

.boundary-list p {
  margin: 0;
  color: #59667b;
  line-height: 1.7;
}

.hub-heading-row {
  display: flex;
  gap: 2rem;
  align-items: end;
  justify-content: space-between;
}

.latest-evidence-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.5rem;
  margin-top: 2.3rem;
}

.latest-evidence-list article {
  min-width: 0;
  padding-top: 1.25rem;
  border-top: 2px solid #14213d;
}

.latest-evidence-list article > div {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  color: #6c788c;
  font-size: 0.75rem;
}

.latest-evidence-list h3 {
  margin: 0.9rem 0 0.65rem;
  font-size: 1.08rem;
  line-height: 1.4;
}

.latest-evidence-list p {
  margin: 0 0 1rem;
  color: #59667b;
  font-size: 0.9rem;
  line-height: 1.7;
}

.latest-evidence-list small {
  color: #1459d9;
  font-weight: 700;
}

.hub-footer {
  display: flex;
  gap: 2rem;
  align-items: center;
  justify-content: space-between;
  padding-top: clamp(2rem, 5vw, 3.5rem);
}

.hub-footer p {
  max-width: 40rem;
  margin: 0;
  color: #59667b;
  line-height: 1.7;
}

.hub-footer div {
  display: flex;
  gap: 1.4rem;
}

.hub-footer a {
  color: #1459d9;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
}

.hub-entry:focus-visible,
.hub-text-link:focus-visible,
.hub-footer a:focus-visible {
  outline: 3px solid rgba(20, 89, 217, 0.32);
  outline-offset: 4px;
}

@media (max-width: 768px) {
  .hub-hero {
    grid-template-columns: minmax(0, 1fr);
    gap: 1.75rem;
  }

  .hub-hero-actions,
  .hub-hero-actions .btn {
    width: 100%;
  }

  .hub-metrics {
    grid-template-columns: minmax(0, 1fr);
    padding: 0.45rem 0;
  }

  .hub-metrics div,
  .hub-metrics div + div {
    justify-content: space-between;
    padding: 0.85rem 0;
    border-left: 0;
  }

  .hub-metrics div + div {
    border-top: 1px solid #e7ebf2;
  }

  .hub-entry-grid,
  .latest-evidence-list {
    grid-template-columns: minmax(0, 1fr);
  }

  .hub-entry,
  .hub-entry:nth-child(even) {
    padding: 1.4rem 0;
    border-left: 0;
  }

  .boundary-list article {
    grid-template-columns: 2rem minmax(0, 1fr);
  }

  .boundary-list article > p {
    grid-column: 2;
  }

  .hub-heading-row,
  .hub-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .hub-footer div {
    flex-wrap: wrap;
  }
}
</style>
