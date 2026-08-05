<script setup lang="ts">
import { onMounted } from 'vue'
import { failureCases } from '../data/generatedFailureCases'
import { evidenceRecords } from '../data/generatedEvidence'
import { siteProjects } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const proofPaths = [
  {
    index: '01',
    eyebrow: 'Verification matrix',
    title: '证据矩阵',
    description: '按工程实现、自动化测试、可运行演示与公开说明逐项复核，不用完成百分比替代事实。',
    meta: `${evidenceRecords.length} 条结构化证据`,
    to: '/engineering/evidence',
    action: '进入证据矩阵',
  },
  {
    index: '02',
    eyebrow: 'Failure playbook',
    title: '失败恢复手册',
    description: '从链上与账务事实出发，判断重试、补偿、暂停或人工复核，并保留每一步恢复依据。',
    meta: `${failureCases.length} 个异常场景`,
    to: '/engineering/failures',
    action: '检查失败路径',
  },
  {
    index: '03',
    eyebrow: 'Project dossiers',
    title: '项目档案',
    description: '按项目查看目标形态、当前阶段、已验证事实、已知限制与下一道完成门。',
    meta: `${siteProjects.length} 个公开项目`,
    to: '/projects',
    action: '浏览项目图谱',
  },
] as const

const verifiedEvidenceCount = evidenceRecords.filter(item => item.status === 'verified').length
const publicEvidenceCount = evidenceRecords.filter(item => item.visibility === 'public' && item.url).length

onMounted(() => setSeoMeta({
  title: '工程证据索引｜xiuqiu',
  description: '从证据矩阵、失败恢复手册和项目档案复核 xiuqiu 的 Web3 钱包与工程实践边界。',
  path: '/engineering',
}))
</script>

<template>
  <section class="proof-index page-top">
    <div class="container proof-index-inner">
      <header class="proof-index-hero">
        <div>
          <p class="proof-index-kicker">Engineering Proof Index</p>
          <h1>叙事负责说明价值。<br><span>证据负责决定可信。</span></h1>
          <p>
            这里只保留三条验证路径。产品完成形态回到项目页，工程结论则继续追到测试、运行记录、失败场景与公开链接。
          </p>
        </div>

        <dl class="proof-index-summary" aria-label="公开证据概览">
          <div>
            <dt>Verified</dt>
            <dd>{{ verifiedEvidenceCount }}</dd>
            <span>条已验证证据</span>
          </div>
          <div>
            <dt>Public</dt>
            <dd>{{ publicEvidenceCount }}</dd>
            <span>条可直接打开</span>
          </div>
        </dl>
      </header>

      <section class="proof-index-paths" aria-labelledby="proof-paths-title">
        <div class="proof-index-heading">
          <p class="proof-index-kicker">Choose a proof path</p>
          <h2 id="proof-paths-title">从你想验证的问题进入</h2>
        </div>

        <nav aria-label="工程证据入口">
          <router-link v-for="path in proofPaths" :key="path.index" :to="path.to" class="proof-index-path">
            <span class="proof-index-path-number">{{ path.index }}</span>
            <div>
              <small>{{ path.eyebrow }}</small>
              <h3>{{ path.title }}</h3>
              <p>{{ path.description }}</p>
            </div>
            <div class="proof-index-path-action">
              <span>{{ path.meta }}</span>
              <strong>{{ path.action }} <i aria-hidden="true">↗</i></strong>
            </div>
          </router-link>
        </nav>
      </section>

      <footer class="proof-index-boundary">
        <strong>Public boundary</strong>
        <p>“已验证”只表示当前测试、链接或运行记录能够支撑对应事实；它不自动等于生产可用、经过安全审计或处理过真实资金。</p>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.proof-index {
  min-height: calc(100vh - 6rem);
  overflow: hidden;
  padding-top: 48px;
  background:
    radial-gradient(circle at 86% 6%, rgba(44, 96, 181, 0.08), transparent 27rem),
    #f7f9fc;
  color: #101b2f;
}

.proof-index-inner {
  padding-bottom: clamp(3.5rem, 7vw, 6.5rem);
}

.proof-index-kicker {
  margin: 0;
  color: #4671b6;
  font: 650 0.68rem/1.4 var(--mono);
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.proof-index-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(15rem, 0.65fr);
  gap: clamp(2.5rem, 8vw, 8rem);
  align-items: end;
  padding: clamp(3rem, 5vw, 5rem) 0 clamp(3rem, 6vw, 5.5rem);
  border-bottom: 1px solid #d7dee9;
}

.proof-index-hero h1 {
  max-width: 14ch;
  margin: 1rem 0 1.35rem;
  font-size: clamp(2.75rem, 6vw, 5.6rem);
  font-weight: 660;
  letter-spacing: -0.065em;
  line-height: 0.98;
  text-wrap: balance;
}

.proof-index-hero h1 span {
  color: #315b9f;
}

.proof-index-hero > div > p:last-child {
  max-width: 43rem;
  margin: 0;
  color: #5d6879;
  font-size: clamp(1rem, 1.45vw, 1.15rem);
  line-height: 1.8;
}

.proof-index-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  border-top: 1px solid #cfd7e3;
  border-bottom: 1px solid #cfd7e3;
}

.proof-index-summary div {
  display: grid;
  align-content: start;
  min-width: 0;
  padding: 1.4rem 0;
}

.proof-index-summary div + div {
  padding-left: 1.4rem;
  border-left: 1px solid #cfd7e3;
}

.proof-index-summary dt {
  color: #7a8798;
  font: 650 0.62rem/1.4 var(--mono);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.proof-index-summary dd {
  margin: 0.55rem 0 0;
  font: 620 clamp(2.4rem, 5vw, 4.4rem)/0.9 var(--mono);
  letter-spacing: -0.07em;
}

.proof-index-summary span {
  margin-top: 0.7rem;
  color: #687486;
  font-size: 0.78rem;
}

.proof-index-paths {
  padding: clamp(3rem, 6vw, 5.5rem) 0 0;
}

.proof-index-heading {
  display: grid;
  grid-template-columns: minmax(0, 0.62fr) minmax(0, 1.38fr);
  gap: 2rem;
  align-items: baseline;
  padding-bottom: 1.6rem;
}

.proof-index-heading h2 {
  margin: 0;
  font-size: clamp(1.7rem, 3.5vw, 3rem);
  letter-spacing: -0.045em;
}

.proof-index-paths nav {
  border-top: 1px solid #cfd7e3;
}

.proof-index-path {
  display: grid;
  grid-template-columns: 4rem minmax(0, 1fr) minmax(13rem, 0.48fr);
  gap: clamp(1.2rem, 3vw, 3rem);
  align-items: center;
  min-width: 0;
  padding: clamp(1.5rem, 3vw, 2.3rem) 0;
  border-bottom: 1px solid #d7dee9;
  color: inherit;
  transition: color 180ms ease, padding 180ms ease;
}

.proof-index-path:hover,
.proof-index-path:focus-visible {
  color: #255aa9;
}

.proof-index-path:focus-visible {
  outline: 2px solid #3970c7;
  outline-offset: 7px;
}

.proof-index-path-number {
  align-self: start;
  color: #8b96a6;
  font: 600 0.75rem/1.4 var(--mono);
}

.proof-index-path small {
  color: #7c8797;
  font: 650 0.62rem/1.4 var(--mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.proof-index-path h3 {
  margin: 0.35rem 0 0.6rem;
  font-size: clamp(1.35rem, 2.3vw, 2rem);
  letter-spacing: -0.035em;
}

.proof-index-path p {
  max-width: 43rem;
  margin: 0;
  color: #687486;
  line-height: 1.7;
}

.proof-index-path-action {
  display: grid;
  justify-items: end;
  gap: 0.65rem;
  text-align: right;
}

.proof-index-path-action span {
  color: #7a8798;
  font: 550 0.7rem/1.4 var(--mono);
}

.proof-index-path-action strong {
  font-size: 0.82rem;
}

.proof-index-path-action i {
  font-style: normal;
}

.proof-index-boundary {
  display: grid;
  grid-template-columns: minmax(10rem, 0.42fr) minmax(0, 1.58fr);
  gap: 2rem;
  margin-top: clamp(2rem, 4vw, 3.5rem);
  padding-top: 1.3rem;
  border-top: 1px solid #d7dee9;
}

.proof-index-boundary strong {
  color: #48617f;
  font: 650 0.68rem/1.4 var(--mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.proof-index-boundary p {
  max-width: 51rem;
  margin: 0;
  color: #697587;
  font-size: 0.84rem;
  line-height: 1.75;
}

@media (max-width: 780px) {
  .proof-index-hero,
  .proof-index-heading,
  .proof-index-boundary {
    grid-template-columns: minmax(0, 1fr);
  }

  .proof-index-hero {
    gap: 2.5rem;
  }

  .proof-index-summary {
    max-width: 31rem;
  }

  .proof-index-path {
    grid-template-columns: 2.5rem minmax(0, 1fr);
  }

  .proof-index-path-action {
    grid-column: 2;
    justify-items: start;
    text-align: left;
  }
}

@media (max-width: 480px) {
  .proof-index-hero h1 {
    font-size: clamp(2.55rem, 13vw, 4rem);
  }

  .proof-index-summary div {
    padding: 1.1rem 0;
  }

  .proof-index-summary div + div {
    padding-left: 1rem;
  }

  .proof-index-path {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
  }

  .proof-index-path-action {
    grid-column: 1;
  }
}
</style>
