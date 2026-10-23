import { createRouter, createWebHistory } from 'vue-router'
import { readingHashId, waitForReadingElement } from '../utils/readingScroll'

let scrolling: AbortController | undefined

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../features/intel/pages/IntelHomePage.vue'),
      meta: { visual: 'narrative', navGroup: 'home' },
    },
    {
      path: '/research',
      name: 'research-detail',
      component: () => import('../features/intel/pages/ResearchDetailPage.vue'),
      meta: { visual: 'narrative', navGroup: 'home' },
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../features/about/pages/HomePage.vue'),
      meta: { visual: 'narrative', navGroup: 'about' },
    },
    {
      path: '/topics/:topic',
      name: 'topic',
      component: () => import('../features/intel/pages/IntelTopicPage.vue'),
      meta: { visual: 'narrative', navGroup: 'home' },
    },
    {
      path: '/articles',
      name: 'articles',
      component: () => import('../features/articles/pages/ArticlesPage.vue'),
      meta: { visual: 'editorial', navGroup: 'notes' },
    },
    {
      path: '/now',
      name: 'now',
      component: () => import('../features/about/pages/NowPage.vue'),
      meta: { visual: 'editorial', navGroup: 'about' },
    },
    {
      path: '/engineering',
      name: 'engineering',
      component: () => import('../features/proof/pages/EngineeringPage.vue'),
      meta: { visual: 'editorial', navGroup: 'evidence' },
    },
    {
      path: '/projects',
      name: 'projects',
      component: () => import('../features/projects/pages/ProjectAtlasPage.vue'),
      meta: { visual: 'lab', navGroup: 'projects' },
    },
    {
      path: '/engineering/failures',
      name: 'engineering-failures',
      component: () => import('../features/proof/pages/FailurePlaybookPage.vue'),
      meta: { visual: 'editorial', navGroup: 'evidence' },
    },
    {
      path: '/engineering/evidence',
      name: 'engineering-evidence',
      component: () => import('../features/proof/pages/EngineeringEvidencePage.vue'),
      meta: { visual: 'lab', navGroup: 'evidence' },
    },
    {
      path: '/learning',
      name: 'learning',
      component: () => import('../features/about/pages/LearningPage.vue'),
      meta: { visual: 'editorial', navGroup: 'about' },
    },
    {
      path: '/ai',
      name: 'ai',
      component: () => import('../features/ai/pages/AiCollaborationPage.vue'),
      meta: { visual: 'lab', navGroup: 'ai' },
    },
    {
      path: '/ai/deliveries',
      name: 'ai-deliveries',
      component: () => import('../features/proof/pages/DeliveryListPage.vue'),
      meta: { visual: 'lab', navGroup: 'ai' },
    },
    {
      path: '/ai/social-research',
      name: 'social-research',
      component: () => import('../features/ai/pages/SocialResearchPage.vue'),
      meta: { visual: 'editorial', navGroup: 'ai' },
    },
    {
      path: '/ai/deliveries/:slug',
      name: 'ai-delivery-detail',
      component: () => import('../features/proof/pages/DeliveryDetailPage.vue'),
      meta: { visual: 'lab', navGroup: 'ai' },
    },
    {
      path: '/radar',
      name: 'radar',
      component: () => import('../features/intel/pages/RadarPage.vue'),
      meta: { visual: 'narrative', navGroup: 'radar' },
    },
    {
      path: '/market-radar',
      name: 'market-radar',
      component: () => import('../features/market-radar/pages/MarketRadarPage.vue'),
      meta: { visual: 'narrative', navGroup: 'market-radar' },
    },
    {
      path: '/market-radar/events/:id',
      name: 'market-radar-event',
      component: () => import('../features/market-radar/pages/MarketRadarEventPage.vue'),
      meta: { visual: 'narrative', navGroup: 'market-radar' },
    },
    {
      path: '/market-radar/:date',
      name: 'market-radar-detail',
      component: () => import('../features/market-radar/pages/MarketRadarDetailPage.vue'),
      meta: { visual: 'narrative', navGroup: 'market-radar' },
    },
    {
      path: '/radar/review/:period',
      name: 'radar-review-detail',
      component: () => import('../features/intel/pages/RadarReviewPage.vue'),
      meta: { visual: 'narrative', navGroup: 'radar' },
    },
    {
      path: '/radar/week/:week',
      name: 'radar-weekly-detail',
      component: () => import('../features/intel/pages/RadarWeeklyPage.vue'),
      meta: { visual: 'narrative', navGroup: 'radar' },
    },
    {
      path: '/radar/:date',
      name: 'radar-detail',
      component: () => import('../features/intel/pages/RadarDetailPage.vue'),
      meta: { visual: 'narrative', navGroup: 'radar' },
    },
    {
      path: '/articles/:slug',
      name: 'article-detail',
      component: () => import('../features/articles/pages/ArticleDetailPage.vue'),
      meta: { visual: 'editorial', navGroup: 'notes' },
    },
    {
      path: '/projects/:project',
      name: 'project-detail',
      component: () => import('../features/projects/pages/ProjectDetailPage.vue'),
      meta: { visual: 'editorial', navGroup: 'projects' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../features/about/pages/NotFoundPage.vue'),
      meta: { visual: 'editorial' },
    },
  ],
  async scrollBehavior(to, from, savedPosition) {
    scrolling?.abort()
    const controller = new AbortController()
    scrolling = controller
    const signal = controller.signal
    if (to.hash) {
      // Market Radar date snapshots load asynchronously and restore their own
      // hash after the event headings exist, including in-page hash changes.
      if (to.name === 'market-radar-detail') return false
      const id = readingHashId(to.hash)
      if (!id) return { top: 0 }
      if (to.name === 'home' || to.name === 'topic') {
        await waitForReadingElement(() => document.querySelector<HTMLElement>('[data-reading-ready="true"]'), signal)
      }
      const target = await waitForReadingElement(() => document.getElementById(id), signal)
      if (signal.aborted) return false
      if (!target) return { top: 0 }
      target.focus({ preventScroll: true })
      return { el: target, top: parseFloat(getComputedStyle(target).scrollMarginTop) || 80, behavior: 'auto' }
    }
    if (savedPosition) {
      if (to.name === 'home' || to.name === 'topic') {
        await waitForReadingElement(() => document.querySelector<HTMLElement>('[data-reading-ready="true"]'), signal)
      }
      return signal.aborted ? false : savedPosition
    }
    if (to.path === from.path) return false
    return { top: 0 }
  },
})

export default router
