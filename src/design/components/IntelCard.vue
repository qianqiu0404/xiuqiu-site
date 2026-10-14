<script setup lang="ts">
// One intel item in a feed: domain badge, topic, flags, title, summary, source.
defineProps<{
  to: string
  domain: 'ai' | 'web3' | 'market' | 'review'
  domainLabel?: string
  badge?: string
  topicLabel: string
  title: string
  summary: string
  sourceLabel?: string
  continuing?: boolean
  deepDive?: boolean
}>()
</script>

<template>
  <router-link :to="to" class="radar-feed-card">
    <span class="radar-feed-meta">
      <b :class="`radar-feed-domain radar-feed-domain--${domain}`">{{ domainLabel ?? domain.toUpperCase() }}</b>
      <span>{{ topicLabel }}</span>
      <em v-if="continuing" class="radar-feed-badge">持续追踪</em>
      <em v-if="deepDive" class="radar-feed-badge radar-feed-badge--deep">专题</em>
      <em v-if="badge" class="radar-feed-badge radar-feed-badge--priority">{{ badge }}</em>
    </span>
    <strong>{{ title }}</strong>
    <p>{{ summary }}</p>
    <small v-if="sourceLabel">{{ sourceLabel }}</small>
  </router-link>
</template>
