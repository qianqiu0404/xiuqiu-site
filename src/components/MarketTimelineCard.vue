<script setup lang="ts">
import { formatTradeTimelineTime, type TradeTimelineCardViewModel } from '../market-radar/timeline-presentation'

defineProps<{ item: TradeTimelineCardViewModel; index: number }>()
</script>

<template>
  <article class="trade-event-card" :class="`priority-${item.priority.toLowerCase()}`">
    <div class="trade-event-signal" aria-hidden="true"><span>{{ String(index + 1).padStart(2, '0') }}</span></div>
    <div class="trade-event-content">
      <header class="trade-event-header">
        <div class="trade-event-classification">
          <strong>{{ item.priority }}</strong><span>{{ item.categoryLabel }}</span><span>{{ item.statusLabel }}</span>
          <span v-if="item.origin === 'static'">静态快照</span>
        </div>
        <time :datetime="item.occurredAt">{{ formatTradeTimelineTime(item.occurredAt) }} CST</time>
      </header>

      <h3><router-link :to="item.detailHref">{{ item.title }}</router-link></h3>
      <p class="trade-event-fact">{{ item.summary }}</p>
      <p class="trade-event-why"><strong>为什么关注</strong>{{ item.whyItMatters }}</p>
      <div class="trade-event-context">
        <div class="trade-event-assets" aria-label="影响资产"><span v-for="asset in item.assets" :key="asset">{{ asset }}</span></div>
        <span class="trade-event-source-date">{{ item.sourceCount }} 个公开来源</span>
      </div>

      <div v-if="item.priority !== 'P2'" class="trade-event-analysis trade-event-analysis--static">
        <dl>
          <div><dt>原始来源</dt><dd><a v-if="item.sourceUrl" :href="item.sourceUrl" target="_blank" rel="noopener noreferrer">{{ item.sourceName }} ↗</a><span v-else>无安全公开链接</span></dd></div>
          <div><dt>接下来观察</dt><dd>{{ item.watchFor }}</dd></div>
          <div><dt>何时失效</dt><dd>{{ item.invalidation }}</dd></div>
        </dl>
      </div>
      <details v-else class="trade-event-analysis">
        <summary>展开来源与判断边界 <span aria-hidden="true">＋</span></summary>
        <dl>
          <div><dt>原始来源</dt><dd><a v-if="item.sourceUrl" :href="item.sourceUrl" target="_blank" rel="noopener noreferrer">{{ item.sourceName }} ↗</a><span v-else>无安全公开链接</span></dd></div>
          <div><dt>接下来观察</dt><dd>{{ item.watchFor }}</dd></div>
          <div><dt>何时失效</dt><dd>{{ item.invalidation }}</dd></div>
        </dl>
      </details>

      <footer class="trade-event-footer">
        <span>来源发布 / 记录 {{ formatTradeTimelineTime(item.publishedAt) }} CST</span>
        <router-link :to="item.detailHref">进入事件记录 <span aria-hidden="true">→</span></router-link>
      </footer>
    </div>
  </article>
</template>
