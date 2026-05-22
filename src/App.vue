<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AiChatWidget from './components/AiChatWidget.vue'

const navOpen = ref(false)
const router = useRouter()
const route = useRoute()

function goHomeSection(section: string) {
  navOpen.value = false
  if (route.path !== '/') {
    router.push('/#' + section)
  } else {
    const el = document.getElementById(section)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }
}

function goHome() {
  navOpen.value = false
  router.push('/')
}
</script>

<template>
  <header class="site-header">
    <nav class="nav container">
      <a class="brand" href="#" @click.prevent="goHome">xiuqiu</a>

      <button
        class="nav-toggle"
        :class="{ open: navOpen }"
        type="button"
        aria-label="Toggle menu"
        @click="navOpen = !navOpen"
      >
        <span></span><span></span><span></span>
      </button>

      <div class="nav-links" :class="{ open: navOpen }">
        <a href="#" @click.prevent="goHomeSection('highlights')">Highlights</a>
        <a href="#" @click.prevent="goHomeSection('projects')">Projects</a>
        <router-link to="/articles" @click="navOpen = false">Writing</router-link>
        <a href="#" @click.prevent="goHomeSection('about')">About</a>
      </div>
    </nav>
  </header>

  <main>
    <router-view />
  </main>

  <footer class="footer">
    <div class="container footer-inner">
      <span>© {{ new Date().getFullYear() }} xiuqiu</span>
      <span>Built with Vue · Deployed on Vercel</span>
    </div>
  </footer>

  <AiChatWidget />
</template>
