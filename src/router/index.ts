import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../pages/HomePage.vue'),
      meta: { visual: 'narrative', navGroup: 'home' },
    },
    {
      path: '/articles',
      name: 'articles',
      component: () => import('../pages/ArticlesPage.vue'),
      meta: { visual: 'editorial', navGroup: 'notes' },
    },
    {
      path: '/now',
      name: 'now',
      component: () => import('../pages/NowPage.vue'),
      meta: { visual: 'editorial', navGroup: 'about' },
    },
    {
      path: '/engineering',
      name: 'engineering',
      component: () => import('../pages/EngineeringPage.vue'),
      meta: { visual: 'editorial', navGroup: 'evidence' },
    },
    {
      path: '/projects',
      name: 'projects',
      component: () => import('../pages/ProjectAtlasPage.vue'),
      meta: { visual: 'lab', navGroup: 'projects' },
    },
    {
      path: '/engineering/failures',
      name: 'engineering-failures',
      component: () => import('../pages/FailurePlaybookPage.vue'),
      meta: { visual: 'editorial', navGroup: 'evidence' },
    },
    {
      path: '/engineering/evidence',
      name: 'engineering-evidence',
      component: () => import('../pages/EngineeringEvidencePage.vue'),
      meta: { visual: 'lab', navGroup: 'evidence' },
    },
    {
      path: '/learning',
      name: 'learning',
      component: () => import('../pages/LearningPage.vue'),
      meta: { visual: 'editorial', navGroup: 'about' },
    },
    {
      path: '/ai',
      name: 'ai',
      component: () => import('../pages/AiCollaborationPage.vue'),
      meta: { visual: 'lab', navGroup: 'ai' },
    },
    {
      path: '/ai/deliveries',
      name: 'ai-deliveries',
      component: () => import('../pages/DeliveryListPage.vue'),
      meta: { visual: 'lab', navGroup: 'ai' },
    },
    {
      path: '/ai/social-research',
      name: 'social-research',
      component: () => import('../pages/SocialResearchPage.vue'),
      meta: { visual: 'editorial', navGroup: 'ai' },
    },
    {
      path: '/ai/deliveries/:slug',
      name: 'ai-delivery-detail',
      component: () => import('../pages/DeliveryDetailPage.vue'),
      meta: { visual: 'lab', navGroup: 'ai' },
    },
    {
      path: '/radar',
      name: 'radar',
      component: () => import('../pages/RadarPage.vue'),
      meta: { visual: 'editorial', navGroup: 'radar' },
    },
    {
      path: '/radar/week/:week',
      name: 'radar-weekly-detail',
      component: () => import('../pages/RadarWeeklyPage.vue'),
      meta: { visual: 'editorial', navGroup: 'radar' },
    },
    {
      path: '/radar/:date',
      name: 'radar-detail',
      component: () => import('../pages/RadarDetailPage.vue'),
      meta: { visual: 'editorial', navGroup: 'radar' },
    },
    {
      path: '/articles/:slug',
      name: 'article-detail',
      component: () => import('../pages/ArticleDetailPage.vue'),
      meta: { visual: 'editorial', navGroup: 'notes' },
    },
    {
      path: '/projects/:project',
      name: 'project-detail',
      component: () => import('../pages/ProjectDetailPage.vue'),
      meta: { visual: 'editorial', navGroup: 'projects' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../pages/NotFoundPage.vue'),
      meta: { visual: 'editorial' },
    },
  ],
  scrollBehavior(to) {
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth' }
    }
    return { top: 0 }
  },
})

export default router
