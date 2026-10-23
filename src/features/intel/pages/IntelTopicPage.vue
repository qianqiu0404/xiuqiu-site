<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import {
  groupIntelByDate,
  intelDayLabel,
  intelDomainLabel,
  intelKindLabel,
  intelSourceLabel,
  intelTopicLabel,
  intelTopics,
  loadIntelItems,
  loadResearchIndex,
  mergeReadingItems,
  readingTopics,
} from '../data'
import type { IntelItem } from '../data'
import { setSeoMeta } from '../../../utils/seo'
import '../../../design/brief.css'
import IntelCard from '../../../design/components/IntelCard.vue'
import LoadState from '../../../design/components/LoadState.vue'

const route = useRoute()
const topicKey = computed(() => String(route.params.topic || ''))
const topic = computed(() => readingTopics(items.value).find(entry => entry.topic === topicKey.value) || intelTopics.find(entry => entry.topic === topicKey.value))
const items = ref<IntelItem[]>([])
const state = ref<'loading' | 'ready' | 'error'>('loading')
let version = 0

async function load() {
  state.value = 'loading'
  const request = ++version
  try {
    const all = topicKey.value.startsWith('research-')
      ? mergeReadingItems([], await loadResearchIndex())
      : await loadIntelItems()
    if (request !== version) return
    items.value = all.filter(item => item.topic === topicKey.value)
    state.value = 'ready'
  } catch {
    if (request !== version) return
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
          indexable: !topic.value.topic.startsWith('research-'),
        }
      : { title: 'Topic not found｜xiuqiu', path: route.fullPath, indexable: false },
  ),
)
</script>

<template>
  <div v-if="topic || state !== 'ready'" class="brief" lang="zh-CN">
    <header class="brief-masthead">
      <div class="brief-shell">
        <router-link to="/" class="brief-back">← 情报流</router-link>
        <p class="brief-dateline">
          <span>主题</span>
          <span v-if="topic">{{ intelDomainLabel(topic.domain) }}</span>
        </p>
        <div class="brief-masthead-row">
          <h1>{{ intelTopicLabel(topicKey) }}</h1>
          <dl v-if="topic" class="brief-stats">
            <div><dt>条目</dt><dd>{{ topic.count }}</dd></div>
            <div><dt>首次</dt><dd>{{ topic.firstSeen.slice(5) }}</dd></div>
            <div><dt>最近</dt><dd>{{ topic.lastSeen.slice(5) }}</dd></div>
          </dl>
        </div>
      </div>
    </header>

    <div class="brief-shell brief-reading">
      <LoadState v-if="state === 'loading'" state="loading" message="正在载入这个主题的历史条目…" />
      <LoadState v-else-if="state === 'error'" state="error" message="载入失败。" action-label="重试" @action="load" />
      <template v-else>
        <section v-for="day in days" :key="day.date" class="brief-day" :aria-labelledby="`topic-day-${day.date}`">
          <header class="brief-day-header">
            <h2 :id="`topic-day-${day.date}`"><time :datetime="day.date">{{ intelDayLabel(day.date) }}</time></h2>
          </header>
          <ol class="brief-timeline">
            <li v-for="item in day.items" :key="item.id" :data-domain="item.domain">
              <IntelCard
                :to="item.href"
                :domain="item.domain"
                :domain-label="intelDomainLabel(item.domain)"
                :topic-label="intelKindLabel(item.kind)"
                :title="item.title"
                :summary="item.summary"
                :source-label="intelSourceLabel(item)"
                :deep-dive="item.flags?.deepDive"
                :badge="item.flags?.priority === 'P0' ? 'P0' : undefined"
              />
            </li>
          </ol>
        </section>
      </template>
    </div>
  </div>

  <section v-else class="brief" aria-labelledby="topic-not-found-title">
    <div class="brief-masthead">
      <div class="brief-shell">
        <p class="brief-dateline"><span>主题</span></p>
        <h1 id="topic-not-found-title">没有找到这个主题</h1>
        <router-link to="/" class="brief-back">← 返回情报流</router-link>
      </div>
    </div>
  </section>
</template>
