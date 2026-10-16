<script setup lang="ts">
// One intel item: domain tag, topic, flags, title, summary, source.
defineProps<{
  to: string
  domain: 'ai' | 'web3' | 'market' | 'review'
  domainLabel?: string
  topicLabel: string
  title: string
  summary: string
  sourceLabel?: string
  continuing?: boolean
  deepDive?: boolean
  badge?: string
}>()
</script>

<template>
  <router-link :to="to" class="brief-card">
    <span class="brief-card-meta">
      <b :class="`brief-tag brief-tag--${domain}`">{{ domainLabel ?? domain.toUpperCase() }}</b>
      <b v-if="badge" class="brief-tag brief-tag--p0">{{ badge }}</b>
      <span>{{ topicLabel }}</span>
      <em v-if="continuing" class="brief-flag brief-flag--continuing">持续追踪</em>
      <em v-if="deepDive" class="brief-flag brief-flag--deep">专题</em>
    </span>
    <strong class="brief-card-title">{{ title }}</strong>
    <span class="brief-card-summary">{{ summary }}</span>
    <small v-if="sourceLabel" class="brief-card-source">{{ sourceLabel }}</small>
  </router-link>
</template>
