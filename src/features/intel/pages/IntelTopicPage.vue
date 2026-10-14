<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import {
  groupIntelByDate,
  intelDomainLabel,
  intelSourceLabel,
  intelTopicLabel,
  intelTopics,
  loadIntelItems,
} from '../data'
import type { IntelItem } from '../data'
import { setSeoMeta } from '../../../utils/seo'
import '../../../styles/radar.css'
import '../../../styles/intel-home.css'
import IntelCard from '../../../design/components/IntelCard.vue'
import LoadState from '../../../design/components/LoadState.vue'

const route = useRoute()
const topicKey = computed(() => String(route.params.topic || ''))
const topic = computed(() => intelTopics.find(entry => entry.topic === topicKey.value))
const items = ref<IntelItem[]>([])
const state = ref<'loading' | 'ready' | 'error'>('loading')

async function load() {
  state.value = 'loading'
  try {
    const all = await loadIntelItems()
    items.value = all.filter(item => item.topic === topicKey.value)
    state.value = 'ready'
  } catch {
    state.value = 'error'
  }
}

watch(topicKey, load, { immediate: true })
const days = computed(() => groupIntelByDate(items.value))

watchEffect(() =>
  setSeoMeta(
    topic.value
      ? {
          title: `${intelTopicLabel(topic.value.topic)}｜主题｜xiuqiu`,
          description: `${intelTopicLabel(topic.value.topic)}：${topic.value.firstSeen} 至 ${topic.value.lastSeen} 的 ${topic.value.count} 条工程情报，按日期回看。`,
          path: `/topics/${topic.value.topic}`,
        }
      : { title: 'Topic not found｜xiuqiu', path: route.fullPath, indexable: false },
  ),
)
</script>

<template>
  <div v-if="topic" class="radar-intelligence-page intel-home intel-topic-page" lang="zh-CN">
    <header class="intel-home-hero">
      <div class="container intel-home-shell">
        <router-link to="/" class="radar-reader-back">← 情报流</router-link>
        <p class="radar-kicker">Topic · {{ intelDomainLabel(topic.domain) }}</p>
        <h1>{{ intelTopicLabel(topic.topic) }}</h1>
        <p class="intel-home-lede">共 {{ topic.count }} 条 · {{ topic.firstSeen }} 至 {{ topic.lastSeen }}</p>
      </div>
    </header>

    <div class="container intel-home-shell">
      <LoadState v-if="state === 'loading'" state="loading" message="正在载入这个主题的历史条目…" />
      <LoadState v-else-if="state === 'error'" state="error" message="载入失败。" action-label="重试" @action="load" />
      <div v-else class="radar-archive-ledger radar-feed">
        <section v-for="day in days" :key="day.date" :aria-labelledby="`topic-day-${day.date}`">
          <header>
            <h2 :id="`topic-day-${day.date}`" class="intel-topic-day"><time :datetime="day.date">{{ day.date }}</time></h2>
          </header>
          <ul class="radar-feed-cards">
            <li v-for="item in day.items" :key="item.id">
              <IntelCard
                :to="item.href"
                :domain="item.domain"
                :domain-label="intelDomainLabel(item.domain)"
                :topic-label="intelTopicLabel(item.topic)"
                :title="item.title"
                :summary="item.summary"
                :source-label="intelSourceLabel(item)"
                :deep-dive="item.flags?.deepDive"
                :badge="item.flags?.priority === 'P0' ? 'P0' : undefined"
              />
            </li>
          </ul>
        </section>
      </div>
    </div>
  </div>

  <section v-else class="radar-reader-not-found" aria-labelledby="topic-not-found-title">
    <div class="container radar-reader-shell">
      <p class="radar-kicker">Topic</p>
      <h1 id="topic-not-found-title">没有找到这个主题</h1>
      <router-link to="/" class="radar-reader-back">← 返回情报流</router-link>
    </div>
  </section>
</template>
