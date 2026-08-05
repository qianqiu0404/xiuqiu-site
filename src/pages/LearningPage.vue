<script setup lang="ts">
import { onMounted } from 'vue'
import { learningRecords } from '../data/generatedLearningRecords'
import { siteArticlesByNewest } from '../data/siteKnowledge'
import { setSeoMeta } from '../utils/seo'

const latestRecord = learningRecords[0]
const archiveRecords = learningRecords.slice(1)
const learningArticles = siteArticlesByNewest
  .filter(article => article.kind === 'learning-log')
  .slice(0, 4)

onMounted(() => {
  setSeoMeta({
    title: '学习复盘｜xiuqiu',
    description: '按阶段归档的 Web3 钱包工程学习结论、验证证据与下一步。',
    path: '/learning',
  })
})
</script>

<template>
  <section class="section page-top learning-page learning-archive-page">
    <div class="container learning-archive-container">
      <header class="learning-archive-hero">
        <p class="section-label">Learning archive / reviewed only</p>
        <h1>只保留已经改变工程判断的学习。</h1>
        <p>原始日记、私人计划和自动化输入留在 Obsidian；这里仅归档人工整理后的结论、证据与下一步。</p>
      </header>

      <section v-if="latestRecord" class="learning-latest" aria-labelledby="learning-latest-title">
        <header>
          <div><p class="section-label">Latest review</p><h2 id="learning-latest-title">{{ latestRecord.title }}</h2></div>
          <time :datetime="latestRecord.date">{{ latestRecord.date }}</time>
        </header>
        <p class="learning-latest-summary">{{ latestRecord.summary }}</p>
        <div class="learning-latest-grid">
          <div><small>CHANGED</small><ul><li v-for="item in latestRecord.reflection.slice(0, 3)" :key="item">{{ item }}</li></ul></div>
          <div><small>EVIDENCE</small><ul><li v-for="item in latestRecord.evidence.slice(0, 3)" :key="item">{{ item }}</li></ul></div>
          <div><small>NEXT</small><ul><li v-for="item in latestRecord.nextSteps.slice(0, 3)" :key="item">{{ item }}</li></ul></div>
        </div>
      </section>

      <section v-if="archiveRecords.length" class="learning-archive-list" aria-labelledby="learning-archive-title">
        <header><p class="section-label">Archive</p><h2 id="learning-archive-title">更早的阶段复盘</h2></header>
        <article v-for="record in archiveRecords" :key="record.slug">
          <time :datetime="record.date">{{ record.date }}</time>
          <div><h3>{{ record.title }}</h3><p>{{ record.summary }}</p></div>
        </article>
      </section>

      <section v-if="learningArticles.length" class="learning-reading" aria-labelledby="learning-reading-title">
        <header><p class="section-label">Continue reading</p><h2 id="learning-reading-title">完整方法与案例</h2></header>
        <div>
          <router-link v-for="article in learningArticles" :key="article.slug" :to="`/articles/${article.slug}`">
            <time :datetime="article.date">{{ article.date }}</time><span>{{ article.title }}</span><b>阅读 →</b>
          </router-link>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.learning-archive-page { background: #f4f4f1; }
.learning-archive-container { max-width: 1120px; }
.learning-archive-hero { max-width: 860px; padding: 3.2rem 0 5rem; }
.learning-archive-hero h1 { margin: 0.75rem 0 1.4rem; font-size: clamp(3rem, 6vw, 5.8rem); letter-spacing: -0.06em; line-height: 1; text-wrap: balance; }
.learning-archive-hero > p:last-child { max-width: 700px; color: var(--text-muted); font-size: 1.02rem; line-height: 1.8; }
.learning-latest { border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 2.5rem 0; }
.learning-latest > header, .learning-archive-list > header, .learning-reading > header { display: flex; align-items: flex-end; justify-content: space-between; gap: 2rem; }
.learning-latest h2, .learning-archive-list h2, .learning-reading h2 { margin: 0.45rem 0 0; font-size: clamp(1.8rem, 3.5vw, 3rem); letter-spacing: -0.04em; }
.learning-latest > header time { color: var(--text-light); font-family: var(--mono); font-size: 0.75rem; }
.learning-latest-summary { max-width: 820px; margin: 2rem 0; color: var(--text-secondary); font-size: 1.05rem; line-height: 1.8; }
.learning-latest-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid var(--border-light); }
.learning-latest-grid > div { padding: 1.6rem 1.5rem 0 0; }
.learning-latest-grid > div + div { border-left: 1px solid var(--border-light); padding-left: 1.5rem; }
.learning-latest-grid small { color: var(--text-light); font: 650 0.66rem/1 var(--mono); letter-spacing: 0.08em; }
.learning-latest-grid ul { margin: 1rem 0 0; padding-left: 1.1rem; }
.learning-latest-grid li { margin-top: 0.7rem; color: var(--text-muted); font-size: 0.84rem; line-height: 1.7; }
.learning-archive-list, .learning-reading { padding-top: 5rem; }
.learning-archive-list article { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 2rem; border-top: 1px solid var(--border); padding: 1.8rem 0; }
.learning-archive-list article:last-child { border-bottom: 1px solid var(--border); }
.learning-archive-list time, .learning-reading time { color: var(--text-light); font: 600 0.72rem/1.5 var(--mono); }
.learning-archive-list h3 { margin: 0; font-size: 1.2rem; }
.learning-archive-list article p { margin: 0.7rem 0 0; color: var(--text-muted); line-height: 1.75; }
.learning-reading > div { margin-top: 2rem; border-top: 1px solid var(--border); }
.learning-reading a { display: grid; grid-template-columns: 120px minmax(0, 1fr) auto; gap: 2rem; border-bottom: 1px solid var(--border); padding: 1.35rem 0; }
.learning-reading a:hover span { color: var(--accent); }
.learning-reading b { font-size: 0.76rem; font-weight: 620; }
@media (max-width: 720px) {
  .learning-archive-hero { padding: 2.2rem 0 3.5rem; }
  .learning-latest-grid { grid-template-columns: 1fr; }
  .learning-latest-grid > div, .learning-latest-grid > div + div { border-top: 1px solid var(--border-light); border-left: 0; padding: 1.5rem 0; }
  .learning-archive-list article, .learning-reading a { grid-template-columns: 1fr; gap: 0.7rem; }
  .learning-reading b { justify-self: start; }
}
</style>
