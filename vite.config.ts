import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import type { Plugin } from 'vite'
import { buildExternalSnapshotFiles } from './shared/externalSources.ts'
import { parseGrokIndex, parseNewsIndex } from './shared/grokNews.ts'
import { parseResearchIndex } from './src/data/sharedResearch.ts'

// Copies the two rewritten feeds into dist/ at build time so the page has a
// read-only fallback when a rewrite target is down. A failed fetch only skips
// that snapshot; it never fails the build. EXTERNAL_SNAPSHOTS=off skips both.
function externalSnapshots(): Plugin {
  return {
    name: 'external-source-snapshots',
    apply: 'build',
    async generateBundle() {
      if (process.env.EXTERNAL_SNAPSHOTS === 'off') return
      const files = await buildExternalSnapshotFiles({ grok: parseGrokIndex, research: parseResearchIndex, chatgpt: value => parseNewsIndex(value, 'chatgpt') })
      for (const file of files) {
        if (file.fileName && file.json) this.emitFile({ type: 'asset', fileName: file.fileName, source: file.json })
        else this.warn(`external snapshot ${file.source} skipped: ${file.error}`)
      }
    },
  }
}

export default defineConfig({
  plugins: [vue(), externalSnapshots()],
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
      '/chatgpt-news-data': {
        target: process.env.CHATGPT_NEWS_PREVIEW_ORIGIN || 'https://raw.githubusercontent.com',
        changeOrigin: true,
        rewrite: path => process.env.CHATGPT_NEWS_PREVIEW_ORIGIN
          ? path.replace(/^\/chatgpt-news-data/, '/feed/v1')
          : path.replace(/^\/chatgpt-news-data/, '/qianqiu0404/xiuqiu-site/refs/heads/news/chatgpt-daily/feed/v1'),
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
