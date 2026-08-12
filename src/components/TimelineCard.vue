<script setup lang="ts">
import type { TimelineCardViewModel } from '../learning-radar/timeline-presentation'

defineProps<{ item: TimelineCardViewModel }>()

function formatRailTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
}
</script>

<template>
  <article class="timeline-card">
    <div class="timeline-card__rail">
      <time :datetime="item.occurredAt">{{ formatRailTime(item.occurredAt) }}</time>
      <span aria-hidden="true"></span>
    </div>
    <div class="timeline-card__body">
      <header class="timeline-card__meta">
        <span>{{ item.sourceName }}</span>
        <span>{{ item.categoryLabel }}</span>
        <strong>{{ item.importanceLabel }}</strong>
      </header>
      <h3><router-link :to="item.detailHref">{{ item.title }}</router-link></h3>
      <p class="timeline-card__summary">{{ item.summary }}</p>
      <p class="timeline-card__why"><strong>为什么入选</strong>{{ item.whySelected }}</p>
      <footer>
        <div><span>{{ item.sourceCount }} 个公开来源</span><span>{{ item.occurredLabel }} CST</span></div>
        <a v-if="item.sourceUrl" :href="item.sourceUrl" target="_blank" rel="noopener noreferrer">阅读原文 <span aria-hidden="true">↗</span></a>
        <span v-else>原文链接未包含在快照中</span>
      </footer>
    </div>
  </article>
</template>
