import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../pages/HomePage.vue'),
    },
    {
      path: '/articles',
      name: 'articles',
      component: () => import('../pages/ArticlesPage.vue'),
    },
    {
      path: '/now',
      name: 'now',
      component: () => import('../pages/NowPage.vue'),
    },
    {
      path: '/engineering',
      name: 'engineering',
      component: () => import('../pages/EngineeringPage.vue'),
    },
    {
      path: '/engineering/failures',
      name: 'engineering-failures',
      component: () => import('../pages/FailurePlaybookPage.vue'),
    },
    {
      path: '/engineering/evidence',
      name: 'engineering-evidence',
      component: () => import('../pages/EngineeringEvidencePage.vue'),
    },
    {
      path: '/learning',
      name: 'learning',
      component: () => import('../pages/LearningPage.vue'),
    },
    {
      path: '/ai',
      name: 'ai',
      component: () => import('../pages/AiCollaborationPage.vue'),
    },
    {
      path: '/ai/deliveries',
      name: 'ai-deliveries',
      component: () => import('../pages/DeliveryListPage.vue'),
    },
    {
      path: '/ai/deliveries/:slug',
      name: 'ai-delivery-detail',
      component: () => import('../pages/DeliveryDetailPage.vue'),
    },
    {
      path: '/radar',
      name: 'radar',
      component: () => import('../pages/RadarPage.vue'),
    },
    {
      path: '/radar/:date',
      name: 'radar-detail',
      component: () => import('../pages/RadarDetailPage.vue'),
    },
    {
      path: '/articles/:slug',
      name: 'article-detail',
      component: () => import('../pages/ArticleDetailPage.vue'),
    },
    {
      path: '/projects/:project',
      name: 'project-detail',
      component: () => import('../pages/ProjectDetailPage.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
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
