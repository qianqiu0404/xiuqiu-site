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
