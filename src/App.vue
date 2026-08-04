<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const navOpen = ref(false)
const navToggle = ref<HTMLButtonElement | null>(null)
const router = useRouter()
const isCinematicHome = computed(() => router.currentRoute.value.name === 'home')
const AiChatWidget = defineAsyncComponent(() => import('./components/AiChatWidget.vue'))

function closeNav() {
  navOpen.value = false
}

function handleEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !navOpen.value) return
  closeNav()
  navToggle.value?.focus()
}

watch(() => router.currentRoute.value.fullPath, closeNav)
onMounted(() => window.addEventListener('keydown', handleEscape))
onBeforeUnmount(() => window.removeEventListener('keydown', handleEscape))
</script>

<template>
  <a class="skip-link" href="#main-content">跳到主要内容</a>

  <header class="site-header" :class="{ 'site-header--cinematic': isCinematicHome }">
    <nav class="nav container">
      <router-link class="brand" to="/">xiuqiu</router-link>

      <button
        ref="navToggle"
        class="nav-toggle"
        :class="{ open: navOpen }"
        type="button"
        :aria-label="navOpen ? '关闭导航' : '打开导航'"
        :aria-expanded="navOpen"
        aria-controls="primary-navigation"
        @click="navOpen = !navOpen"
      >
        <span></span><span></span><span></span>
      </button>

      <div id="primary-navigation" class="nav-links" :class="{ open: navOpen }">
        <router-link to="/#overview" @click="navOpen = false">概览</router-link>
        <router-link to="/#wallet" @click="navOpen = false">Wallet</router-link>
        <router-link to="/#market" @click="navOpen = false">Market</router-link>
        <router-link to="/#ai-engineering" @click="navOpen = false">AI</router-link>
        <router-link to="/engineering/evidence" @click="navOpen = false">证据</router-link>
      </div>
    </nav>
  </header>

  <main id="main-content">
    <router-view />
  </main>

  <footer class="footer" :class="{ 'footer--cinematic': isCinematicHome }">
    <div class="container footer-inner">
      <span>© {{ new Date().getFullYear() }} xiuqiu</span>
      <nav class="footer-links" aria-label="页尾导航">
        <router-link to="/ai">AI 工程</router-link>
        <router-link to="/articles">工程笔记</router-link>
        <router-link to="/learning">学习复盘</router-link>
        <a href="https://github.com/qianqiu0404" target="_blank" rel="noopener">GitHub</a>
      </nav>
    </div>
  </footer>

  <AiChatWidget :cinematic="isCinematicHome" />
</template>
