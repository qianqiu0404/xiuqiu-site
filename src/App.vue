<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const navOpen = ref(false)
const navToggle = ref<HTMLButtonElement | null>(null)
const router = useRouter()
const isCinematicHome = computed(() => router.currentRoute.value.name === 'home')
const visualMode = computed(() => {
  const currentRoute = router.currentRoute.value
  if (
    currentRoute.name === 'project-detail'
    && ['wallet-launchpad', 's78-market-services'].includes(String(currentRoute.params.project || ''))
  ) {
    return 'narrative'
  }
  return String(currentRoute.meta.visual || 'editorial')
})
const usesCinematicChrome = computed(() => visualMode.value === 'narrative' || visualMode.value === 'lab')
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

  <header class="site-header" :class="{ 'site-header--cinematic': usesCinematicChrome }">
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
        <router-link to="/projects/wallet-launchpad" @click="navOpen = false">Wallet</router-link>
        <router-link to="/projects/s78-market-services" @click="navOpen = false">Market</router-link>
        <router-link to="/ai" @click="navOpen = false">AI</router-link>
        <router-link to="/engineering/evidence" @click="navOpen = false">Evidence</router-link>
        <router-link to="/radar" @click="navOpen = false">Radar</router-link>
        <router-link to="/market-radar" @click="navOpen = false">Trade Radar</router-link>
      </div>
    </nav>
  </header>

  <main id="main-content">
    <router-view />
  </main>

  <footer class="footer" :class="{ 'footer--cinematic': usesCinematicChrome }">
    <div class="container footer-inner">
      <span>© {{ new Date().getFullYear() }} xiuqiu</span>
      <nav class="footer-links" aria-label="页尾导航">
        <router-link to="/projects">全部项目</router-link>
        <router-link to="/articles">工程笔记</router-link>
        <router-link to="/engineering/failures">失败手册</router-link>
        <router-link to="/now">关于 / Now</router-link>
        <a href="https://github.com/qianqiu0404" target="_blank" rel="noopener">GitHub</a>
      </nav>
    </div>
  </footer>

  <AiChatWidget :cinematic="usesCinematicChrome" :hide-desktop-toggle="isCinematicHome" />
</template>
