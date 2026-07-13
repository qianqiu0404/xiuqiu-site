<script setup lang="ts">
import { onMounted } from 'vue'
import { dailyRadars } from '../data/generatedRadars'
import { setSeoMeta } from '../utils/seo'

onMounted(() => setSeoMeta({ title: '每日研究雷达｜xiuqiu', description: '从 Obsidian 研究输入自动汇总的市场信号、AI 技巧、Web3 设计、Vibe 项目与精选阅读。', path: '/radar' }))
</script>

<template>
  <section class="section page-top radar-page">
    <div class="container">
      <header class="radar-hero">
        <div><p class="section-label">Daily Research Radar</p><h1>每日研究雷达</h1><p>从允许公开的 Obsidian 区块汇总。AI 负责筛选与结构化，来源、发布范围和构建门禁保持可复核。</p></div>
        <div class="radar-disclaimer"><strong>试运行 · AI 自动汇总</strong><span>连续七天自动合并验收后再升级状态 · 非投资建议</span></div>
      </header>

      <div v-if="dailyRadars.length" class="radar-history">
        <router-link v-for="radar in dailyRadars" :key="radar.slug" :to="`/radar/${radar.slug}`" class="radar-history-card">
          <div class="card-status-row"><time>{{ radar.date }}</time><strong>{{ radar.sourceSections.length }}/4 来源成功</strong></div>
          <h2>{{ radar.title }}</h2><p>{{ radar.summary }}</p>
          <div class="radar-card-tags"><span v-for="source in radar.sourceSections" :key="source">{{ source }}</span><span v-for="source in radar.missingSections" :key="source" class="missing">{{ source }} 缺失</span></div>
          <strong class="project-link">查看本期雷达 &rarr;</strong>
        </router-link>
      </div>
      <p v-else class="verification-note">还没有可发布的研究雷达。</p>
    </div>
  </section>
</template>
