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
        aria-label="Toggle menu"
        @click="navOpen = !navOpen"
      >
        <span></span><span></span><span></span>
      </button>

      <div class="nav-links" :class="{ open: navOpen }">
        <router-link to="/" @click="navOpen = false">首页</router-link>
        <router-link to="/now" @click="navOpen = false">当前动态</router-link>
        <router-link to="/engineering" @click="navOpen = false">工程档案</router-link>
        <router-link to="/ai" @click="navOpen = false">AI 协作</router-link>
        <router-link to="/radar" @click="navOpen = false">每日雷达</router-link>
        <router-link to="/learning" @click="navOpen = false">学习复盘</router-link>
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
      <span>持续记录，持续验证</span>
    </div>
  </footer>
</template>
