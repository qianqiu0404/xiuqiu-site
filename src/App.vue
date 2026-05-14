<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

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
        <a href="#" @click.prevent="goHome">首页</a>
        <a href="#" @click.prevent="goHomeSection('capabilities')">能力</a>
        <a href="#" @click.prevent="goHomeSection('projects')">项目</a>
        <router-link to="/articles" @click="navOpen = false">文章</router-link>
        <a href="#" @click.prevent="goHomeSection('about')">关于</a>
      </div>
    </nav>
  </header>

  <main>
    <router-view />
  </main>

  <footer class="footer">
    <div class="container footer-inner">
      <p>© {{ new Date().getFullYear() }} xiuqiu</p>
      <p>Built with Vue · Deployed on Vercel</p>
    </div>
  </footer>
</template>
