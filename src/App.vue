<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const navOpen = ref(false)
const navToggle = ref<HTMLButtonElement | null>(null)
const primaryNavigation = ref<HTMLElement | null>(null)
const mainContent = ref<HTMLElement | null>(null)
const router = useRouter()
const isCinematicHome = computed(() => router.currentRoute.value.name === 'home')
const showAiChat = computed(() => !String(router.currentRoute.value.name || '').startsWith('market-radar'))
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
const currentNavSection = computed(() => {
  const currentRoute = router.currentRoute.value
  const project = String(currentRoute.params.project || '')

  if (currentRoute.name === 'project-detail') {
    if (project === 'wallet-launchpad') return 'wallet'
    if (project === 's78-market-services') return 'qiu-market'
  }
  if (currentRoute.name === 'learning') return 'learn-radar'

  const navGroup = String(currentRoute.meta.navGroup || '')
  const sectionByGroup: Record<string, string> = {
    ai: 'ai',
    evidence: 'proof',
    radar: 'learn-radar',
    'market-radar': 'trade-radar',
    projects: 'projects',
    notes: 'notes',
    about: 'about',
  }

  return sectionByGroup[navGroup] || ''
})
const currentContextLabel = computed(() => {
  const labels: Record<string, string> = {
    projects: '项目图谱',
    notes: '工程笔记',
    about: 'About',
  }
  return labels[currentNavSection.value] || ''
})
const currentMobileContextLabel = computed(() => {
  const labels: Record<string, string> = {
    wallet: 'Wallet',
    'qiu-market': 'Qiu Market',
    ai: 'AI',
    proof: 'Proof',
    'learn-radar': 'Learn Radar',
    'trade-radar': 'Trade Radar',
    projects: '项目图谱',
    notes: '工程笔记',
    about: 'About',
  }
  return labels[currentNavSection.value] || ''
})

function isCurrentNavSection(section: string) {
  return currentNavSection.value === section
}

function currentNavAria(section: string, targetPath: string) {
  if (!isCurrentNavSection(section)) return undefined
  return router.currentRoute.value.path === targetPath ? 'page' : 'location'
}

function closeNav() {
  navOpen.value = false
}

async function toggleNav() {
  if (navOpen.value) {
    closeNav()
    return
  }

  navOpen.value = true
  await nextTick()
  primaryNavigation.value?.querySelector<HTMLElement>('.nav-link')?.focus()
}

function activateLinkOnSpace(event: KeyboardEvent) {
  const link = event.currentTarget as HTMLElement | null
  link?.click()
}

async function handleNavLinkActivation() {
  const shouldMoveFocus = navOpen.value
  closeNav()
  if (!shouldMoveFocus) return
  await nextTick()
  mainContent.value?.focus({ preventScroll: true })
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
    <nav class="nav container" aria-label="主导航">
      <router-link
        class="brand"
        :class="{ 'is-current': isCinematicHome }"
        :aria-current="isCinematicHome ? 'page' : undefined"
        to="/"
      >xiuqiu</router-link>
      <span
        v-if="currentContextLabel"
        class="nav-context"
        aria-current="location"
        :aria-label="`当前栏目：${currentContextLabel}`"
      >{{ currentContextLabel }}</span>
      <span
        v-if="currentMobileContextLabel"
        class="nav-mobile-context"
        aria-current="location"
        :aria-label="`当前栏目：${currentMobileContextLabel}`"
      >{{ currentMobileContextLabel }}</span>

      <button
        ref="navToggle"
        class="nav-toggle"
        :class="{ open: navOpen }"
        type="button"
        :aria-label="navOpen ? '关闭导航' : '打开导航'"
        :aria-expanded="navOpen"
        aria-controls="primary-navigation"
        @click="toggleNav"
      >
        <span></span><span></span><span></span>
      </button>

      <div
        id="primary-navigation"
        ref="primaryNavigation"
        class="nav-links"
        :class="{ open: navOpen }"
      >
        <div class="nav-primary-links" role="group" aria-label="核心入口">
          <router-link
            class="nav-link"
            :class="{ 'is-current': isCurrentNavSection('wallet') }"
            :aria-current="currentNavAria('wallet', '/projects/wallet-launchpad')"
            to="/projects/wallet-launchpad"
            @click="handleNavLinkActivation"
            @keydown.space.prevent="activateLinkOnSpace"
          >Wallet</router-link>
          <router-link
            class="nav-link"
            :class="{ 'is-current': isCurrentNavSection('qiu-market') }"
            :aria-current="currentNavAria('qiu-market', '/projects/s78-market-services')"
            to="/projects/s78-market-services"
            @click="handleNavLinkActivation"
            @keydown.space.prevent="activateLinkOnSpace"
          >Qiu Market</router-link>
          <router-link
            class="nav-link"
            :class="{ 'is-current': isCurrentNavSection('ai') }"
            :aria-current="currentNavAria('ai', '/ai')"
            to="/ai"
            @click="handleNavLinkActivation"
            @keydown.space.prevent="activateLinkOnSpace"
          >AI</router-link>
          <router-link
            class="nav-link"
            :class="{ 'is-current': isCurrentNavSection('proof') }"
            :aria-current="currentNavAria('proof', '/engineering/evidence')"
            to="/engineering/evidence"
            @click="handleNavLinkActivation"
            @keydown.space.prevent="activateLinkOnSpace"
          >Proof</router-link>
          <router-link
            class="nav-link"
            :class="{ 'is-current': isCurrentNavSection('learn-radar') }"
            :aria-current="currentNavAria('learn-radar', '/radar')"
            to="/radar"
            @click="handleNavLinkActivation"
            @keydown.space.prevent="activateLinkOnSpace"
          >Learn Radar</router-link>
          <router-link
            class="nav-link"
            :class="{ 'is-current': isCurrentNavSection('trade-radar') }"
            :aria-current="currentNavAria('trade-radar', '/market-radar')"
            to="/market-radar"
            @click="handleNavLinkActivation"
            @keydown.space.prevent="activateLinkOnSpace"
          >Trade Radar</router-link>
        </div>

        <div class="nav-secondary-links" role="group" aria-label="更多入口">
          <router-link
            class="nav-link"
            :class="{ 'is-current': isCurrentNavSection('projects') }"
            :aria-current="currentNavAria('projects', '/projects')"
            to="/projects"
            @click="handleNavLinkActivation"
            @keydown.space.prevent="activateLinkOnSpace"
          >项目图谱</router-link>
          <router-link
            class="nav-link"
            :class="{ 'is-current': isCurrentNavSection('notes') }"
            :aria-current="currentNavAria('notes', '/articles')"
            to="/articles"
            @click="handleNavLinkActivation"
            @keydown.space.prevent="activateLinkOnSpace"
          >工程笔记</router-link>
          <router-link
            class="nav-link"
            :class="{ 'is-current': isCurrentNavSection('about') }"
            :aria-current="currentNavAria('about', '/now')"
            to="/now"
            @click="handleNavLinkActivation"
            @keydown.space.prevent="activateLinkOnSpace"
          >About</router-link>
        </div>
      </div>
    </nav>
  </header>

  <main id="main-content" ref="mainContent" tabindex="-1">
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

  <AiChatWidget v-if="showAiChat" :cinematic="usesCinematicChrome" :hide-desktop-toggle="isCinematicHome" />
</template>
