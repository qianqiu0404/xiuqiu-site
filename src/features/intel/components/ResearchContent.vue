<script setup lang="ts">
import type { ResearchNode } from '../data'
import { useRoute } from 'vue-router'
import { researchHref, withReadingReturn } from '../data'
const route = useRoute()
defineProps<{ nodes: ResearchNode[] }>()
</script>

<template>
  <template v-for="(node, index) in nodes" :key="index">
    <template v-if="'text' in node">{{ node.text }}</template>
    <router-link v-else-if="node.tag === 'a' && node.record_id" :to="withReadingReturn(researchHref(node.record_id), route.query.from)">
      <ResearchContent :nodes="node.children" />
    </router-link>
    <component v-else :is="node.tag" :href="node.tag === 'a' ? node.href : undefined" :rel="node.tag === 'a' ? 'noopener noreferrer' : undefined">
      <ResearchContent :nodes="node.children" />
    </component>
  </template>
</template>
