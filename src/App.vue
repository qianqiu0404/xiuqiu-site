<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const navOpen = ref(false)
const router = useRouter()

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
        :aria-label="navOpen ? '关闭导航' : '打开导航'"
        :aria-expanded="navOpen"
        aria-controls="primary-navigation"
        @click="navOpen = !navOpen"
      >
        <span></span><span></span><span></span>
      </button>

      <div id="primary-navigation" class="nav-links" :class="{ open: navOpen }">
        <router-link to="/engineering" @click="navOpen = false">工程档案</router-link>
        <a href="https://wallet-reliability-lab.vercel.app" target="_blank" rel="noopener" @click="navOpen = false">项目实验</a>
        <router-link to="/ai" @click="navOpen = false">AI 协作</router-link>
        <router-link to="/radar" @click="navOpen = false">每日雷达</router-link>
        <router-link to="/articles" @click="navOpen = false">工程笔记</router-link>
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
        <router-link to="/now">当前动态</router-link>
        <router-link to="/learning">学习复盘</router-link>
        <a href="https://github.com/qianqiu0404" target="_blank" rel="noopener">GitHub</a>
      </nav>
    </div>
  </footer>
</template>
