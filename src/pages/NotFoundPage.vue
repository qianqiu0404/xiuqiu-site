<script setup lang="ts">
import { onBeforeUnmount, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { setSeoMeta } from '../utils/seo'

const route = useRoute()
let robotsMeta: HTMLMetaElement | null = null

function markAsNotFound() {
  robotsMeta = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')

  if (!robotsMeta) {
    robotsMeta = document.createElement('meta')
    robotsMeta.setAttribute('name', 'robots')
    document.head.appendChild(robotsMeta)
  }

  robotsMeta.setAttribute('content', 'noindex, nofollow')
  robotsMeta.dataset.routeMeta = 'not-found'
}

watchEffect(() => {
  // Track unknown-route navigation even when Vue reuses this component.
  route.fullPath
  setSeoMeta({
    title: '页面没有找到｜xiuqiu',
    description: '这个页面不存在、已移动或尚未公开。请返回项目图谱、工程证据或网站首页继续浏览。',
    path: '/404',
  })
  markAsNotFound()
})

onBeforeUnmount(() => {
  if (robotsMeta?.dataset.routeMeta === 'not-found') {
    robotsMeta.remove()
  }
})
</script>

<template>
  <section class="page-top route-not-found" aria-labelledby="not-found-heading">
    <div class="container route-not-found-inner">
      <p class="route-not-found-code" aria-hidden="true">404</p>
      <p class="section-label">Route Not Found</p>
      <h1 id="not-found-heading">页面没有找到</h1>
      <p>这个页面不存在、已移动或尚未公开。你可以从项目图谱与工程证据继续查看当前能力和验证边界。</p>
      <div class="route-not-found-actions">
        <router-link class="btn btn-primary" to="/projects">查看项目图谱</router-link>
        <router-link class="btn btn-secondary" to="/engineering/evidence">查看工程证据</router-link>
        <router-link class="route-not-found-home" to="/">返回首页</router-link>
      </div>
    </div>
  </section>
</template>

<style scoped src="../styles/not-found.css"></style>
