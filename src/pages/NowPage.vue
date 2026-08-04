<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { deliveryRecords } from '../data/generatedDeliveries'
import { learningRecords } from '../data/generatedLearningRecords'
import { nowSnapshot } from '../data/generatedNow'
import { dailyRadars } from '../data/generatedRadars'
import { getProjectByKey, projectStageLabels, siteArticlesByNewest } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const currentProjects = nowSnapshot.developmentProjectSlugs.map(getProjectByKey).filter(Boolean)
const featuredDeliveries = [...deliveryRecords].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
const latestRadar = dailyRadars[0]
const latestEngineeringNotes = siteArticlesByNewest.filter(item => item.kind === 'engineering-note').slice(0, 2)
const researchItems = [
  latestRadar
    ? { type: '每日雷达', title: latestRadar.title, summary: latestRadar.summary, date: latestRadar.date, to: `/radar/${latestRadar.slug}` }
    : undefined,
  ...latestEngineeringNotes.map(item => ({
    type: '工程文章',
    title: item.title,
    summary: item.summary,
    date: item.date,
    to: `/articles/${item.slug}`,
  })),
].filter(Boolean)

type RecentOutput = {
  date: string
  type: '工程交付' | '工程文章' | '学习复盘' | '每日雷达'
  title: string
  summary: string
  to: string
}

const recentTypePriority: Record<RecentOutput['type'], number> = {
  工程交付: 0,
  工程文章: 1,
  学习复盘: 2,
  每日雷达: 3,
}

const recentOutputs = computed<RecentOutput[]>(() => {
  const deliveries: RecentOutput[] = deliveryRecords.map(item => ({
    date: item.date,
    type: '工程交付',
    title: item.title,
    summary: item.summary,
    to: `/ai/deliveries/${item.slug}`,
  }))
  const articles: RecentOutput[] = siteArticlesByNewest.map(item => ({
    date: item.date,
    type: '工程文章',
    title: item.title,
    summary: item.summary,
    to: `/articles/${item.slug}`,
  }))
  const learning: RecentOutput[] = learningRecords.map(item => ({
    date: item.date,
    type: '学习复盘',
    title: item.title,
    summary: item.summary,
    to: '/learning',
  }))
  const radars: RecentOutput[] = dailyRadars.map(item => ({
    date: item.date,
    type: '每日雷达',
    title: item.title,
    summary: item.summary,
    to: `/radar/${item.slug}`,
  }))

  return [
    ...deliveries.slice(0, 2),
    ...articles.slice(0, 3),
    ...learning.slice(0, 2),
    ...radars.slice(0, 3),
  ].sort((a, b) => b.date.localeCompare(a.date) || recentTypePriority[a.type] - recentTypePriority[b.type])
})

const collaborationDirections = [
  '交易所钱包充值、提现、资金状态与异常恢复',
  '多链交易模型、签名服务边界与安全约束',
  '以测试、审查和知识治理收口的 AI 工程协作',
]

const stale = computed(() => (Date.now() - new Date(`${nowSnapshot.updatedAt}T00:00:00+08:00`).getTime()) / 86_400_000 > 14)

onMounted(() => setSeoMeta({ title: '关于我与当前动态｜xiuqiu', description: nowSnapshot.summary, path: '/now' }))
</script>

<template>
  <section class="section page-top now-page">
    <div class="container">
      <header class="now-hero">
        <div>
          <p class="section-label">About · Now · {{ nowSnapshot.updatedAt }}</p>
          <h1>{{ nowSnapshot.headline }}</h1>
          <p>{{ nowSnapshot.summary }}</p>
          <dl class="about-positioning">
            <div><dt>当前定位</dt><dd>Web3 钱包后端工程师 × AI 协作工程实践者</dd></div>
            <div><dt>可合作方向</dt><dd>{{ collaborationDirections.join('；') }}</dd></div>
          </dl>
        </div>
        <aside :class="{ stale }">
          <span>{{ stale ? '近期未更新' : '公开边界' }}</span>
          <strong>只公开可复核的工程事实</strong>
          <p>区分设计、实现、本地验证与生产验收；私人记录、配置和凭据不进入网站。</p>
        </aside>
      </header>

      <section class="about-overview" aria-labelledby="about-focus-title">
        <div>
          <p class="section-label">当前关注</p>
          <h2 id="about-focus-title">接下来准备验证的三件事</h2>
        </div>
        <ol><li v-for="item in nowSnapshot.nextFocus" :key="item">{{ item }}</li></ol>
      </section>

      <section class="now-section"><div class="section-heading section-heading-left"><p class="section-label">01 · 开发中</p><h2 class="section-title">当前工程主线</h2></div><div class="now-project-grid"><router-link v-for="project in currentProjects" :key="project!.slug" :to="`/projects/${project!.slug}`"><div class="card-status-row"><span>{{ project!.category }}</span><strong>{{ projectStageLabels[project!.stage] }}</strong></div><h3>{{ project!.name }}</h3><p>{{ project!.currentFocus }}</p><small>下一里程碑：{{ project!.nextMilestone }}</small></router-link></div></section>

      <section class="now-section"><div class="section-heading section-heading-left"><p class="section-label">02 · 研究中</p><h2 class="section-title">正在形成判断的主题</h2></div><div class="now-research-list"><router-link v-for="item in researchItems" :key="item!.to" :to="item!.to"><time>{{ item!.date }}</time><div><span>{{ item!.type }}</span><h3>{{ item!.title }}</h3><p>{{ item!.summary }}</p></div></router-link></div></section>

      <section class="now-section"><div class="section-heading section-heading-left"><p class="section-label">03 · 最近交付</p><h2 class="section-title">结果、判断与验证放在一起</h2></div><div class="now-delivery-grid"><router-link v-for="item in featuredDeliveries" :key="item!.slug" :to="`/ai/deliveries/${item!.slug}`"><div class="card-status-row"><time>{{ item!.date }}</time><strong>{{ item!.status === 'delivered' ? '已交付' : item!.status === 'partial' ? '部分完成' : '进行中' }}</strong></div><h3>{{ item!.title }}</h3><p>{{ item!.summary }}</p><small>{{ item!.evidenceSlugs.length }} 项证据 · {{ item!.publicLinks.length }} 个公开链接</small></router-link></div></section>

      <section class="now-section"><div class="section-heading section-heading-left"><p class="section-label">04 · Recent Activity</p><h2 class="section-title">按类型平衡的最近公开产出</h2><p class="section-desc">工程交付、工程文章、学习复盘与每日雷达分别取近期记录，避免单一自动化内容淹没人工工程进展。</p></div><div class="now-timeline"><router-link v-for="item in recentOutputs" :key="`${item.type}-${item.to}-${item.title}`" :to="item.to"><time>{{ item.date }}</time><span>{{ item.type }}</span><div><h3>{{ item.title }}</h3><p>{{ item.summary }}</p></div></router-link></div></section>
    </div>
  </section>
</template>

<style scoped>
.about-positioning {
  display: grid;
  gap: 0.8rem;
  margin: 1.5rem 0 0;
}

.about-positioning div {
  display: grid;
  grid-template-columns: 6rem minmax(0, 1fr);
  gap: 1rem;
  padding-top: 0.8rem;
  border-top: 1px solid var(--border);
}

.about-positioning dt {
  color: var(--text-muted);
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.about-positioning dd {
  min-width: 0;
  margin: 0;
  color: var(--text);
  line-height: 1.65;
}

.about-overview {
  display: grid;
  grid-template-columns: minmax(220px, 0.65fr) minmax(0, 1.35fr);
  gap: 2rem;
  align-items: start;
  margin-top: 2rem;
  padding: 1.75rem 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.about-overview h2 {
  margin: 0.45rem 0 0;
  font-size: clamp(1.35rem, 2.6vw, 2rem);
}

.about-overview ol {
  display: grid;
  gap: 0.75rem;
  min-width: 0;
  margin: 0;
  padding-left: 1.4rem;
}

.about-overview li {
  padding-left: 0.35rem;
  line-height: 1.65;
}

@media (max-width: 768px) {
  .about-overview {
    grid-template-columns: minmax(0, 1fr);
    gap: 1.25rem;
  }
}

@media (max-width: 520px) {
  .about-positioning div {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.3rem;
  }
}
</style>
