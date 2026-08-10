<script setup lang="ts">
import type { TimelineCardViewModel } from '../learning-radar/timeline-presentation'

defineProps<{ item: TimelineCardViewModel; featured?: boolean }>()
</script>

<template>
  <article class="timeline-card" :class="{ 'timeline-card--featured': featured }">
    <header class="timeline-card__meta">
      <span>{{ item.categoryLabel }}</span>
      <strong>{{ item.importanceLabel }}</strong>
      <time :datetime="item.occurredAt">{{ item.occurredLabel }} CST</time>
    </header>
    <h3><router-link :to="item.detailHref">{{ item.title }}</router-link></h3>
    <p class="timeline-card__summary">{{ item.summary }}</p>
    <details class="timeline-card__details">
      <summary>展开完整摘要与入选理由 <span aria-hidden="true">＋</span></summary>
      <div>
        <section><h4>完整摘要</h4><p>{{ item.summary }}</p></section>
        <section><h4>为什么入选</h4><p>{{ item.whySelected }}</p></section>
      </div>
    </details>
    <footer>
      <div><span>{{ item.sourceName }}</span><span>{{ item.sourceCount }} 个来源</span></div>
      <a v-if="item.sourceUrl" :href="item.sourceUrl" target="_blank" rel="noopener noreferrer">阅读原文 <span aria-hidden="true">↗</span></a>
      <span v-else>原文链接未包含在快照中</span>
    </footer>
  </article>
</template>
