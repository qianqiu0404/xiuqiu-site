<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const navOpen = ref(false)
const navToggle = ref<HTMLButtonElement | null>(null)
const router = useRouter()
const aiAssistantEnabled = import.meta.env.VITE_AI_ASSISTANT_ENABLED === 'true'
const AiChatWidget = defineAsyncComponent(() => import('./components/AiChatWidget.vue'))

function closeNav() {
  navOpen.value = false
}

function goHome() {
  closeNav()
  router.push('/')
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
  <header class="site-header">
    <nav class="nav container">
      <a class="brand" href="#" @click.prevent="goHome">xiuqiu</a>

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
        <router-link to="/#capabilities" @click="navOpen = false">能力</router-link>
        <router-link to="/projects" @click="navOpen = false">项目</router-link>
        <router-link to="/engineering/evidence" @click="navOpen = false">证据</router-link>
        <router-link to="/radar" @click="navOpen = false">研究</router-link>
        <router-link to="/now" @click="navOpen = false">关于</router-link>
      </div>
    </nav>
  </header>

  <main>
    <router-view />
  </main>

  <footer class="footer">
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

  <AiChatWidget v-if="aiAssistantEnabled" />
</template>
