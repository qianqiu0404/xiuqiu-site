import { execFileSync } from 'node:child_process'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

function gitValue(args: string[], fallback: string) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim() || fallback
  } catch {
    return fallback
  }
}

const fallbackCommit = process.env.VERCEL_GIT_COMMIT_SHA
  || gitValue(['rev-parse', 'HEAD'], '0'.repeat(40))
const fallbackPublishedAt = gitValue(
  ['show', '-s', '--format=%cI', fallbackCommit],
  '1970-01-01T00:00:00.000Z',
)

export default defineConfig({
  plugins: [vue()],
  define: {
    __CONTENT_CATALOG_FALLBACK_COMMIT__: JSON.stringify(fallbackCommit),
    __CONTENT_CATALOG_FALLBACK_PUBLISHED_AT__: JSON.stringify(fallbackPublishedAt),
  },
})
