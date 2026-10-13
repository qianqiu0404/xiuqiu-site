import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
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
