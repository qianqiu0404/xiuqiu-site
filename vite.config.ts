import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // The same public, read-only origin used by vercel.json. An explicit local
  // override lets both repositories be verified together before either ships.
  server: {
    proxy: {
      '/grok-news-data': {
        target: process.env.GROK_NEWS_PREVIEW_ORIGIN || 'https://raw.githubusercontent.com',
        changeOrigin: true,
        rewrite: path => process.env.GROK_NEWS_PREVIEW_ORIGIN
          ? path.replace(/^\/grok-news-data/, '/feed/v1')
          : path.replace(/^\/grok-news-data/, '/qianqiu0404/xiuqiu-site/refs/heads/news/x-ai-digest/feed/v1'),
      },
      '/research-data': {
        target: process.env.RESEARCH_PREVIEW_ORIGIN || 'https://shared-research.vercel.app',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/research-data/, '/feed/v1'),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/vue/') || id.includes('/node_modules/@vue/') || id.includes('/node_modules/vue-router/')) {
            return 'vue-vendor'
          }
          // Keep each generated dataset in its own shared chunk. Feature data.ts
          // barrels otherwise let Rollup merge unrelated datasets into one
          // oversized chunk that every feature then downloads.
          const generated = id.match(/\/src\/data\/(generated[A-Za-z]+)\.ts$/)
          if (generated) return generated[1]
          return undefined
        },
      },
    },
  },
})
