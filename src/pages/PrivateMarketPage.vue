<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { setSeoMeta } from '../utils/seo'
import '../styles/private-market.css'

interface PrivateSnapshot {
  snapshotId: string
  asOf: string
  generatedAt: string
  mode: string
  quotes: Array<{ assetId: string; role: string; price: string; currency: string; observedAt: string; delaySeconds: number; provider: string; mode: string }>
  coverage: Array<{ assetId: string; status: string; marketState: string; reason?: string }>
}

const snapshot = ref<PrivateSnapshot | null>(null)
const loading = ref(true)
const authRequired = ref(false)
const error = ref('')

const groups = [
  { id: 'crypto', title: '加密资产', assets: ['BTC-USDT', 'ETH-USDT', 'SOL-USDT'] },
  { id: 'us', title: '美股与 ETF', assets: ['SPY', 'QQQ', 'NVDA', 'MSFT', 'AAPL', 'TSLA', 'COIN', 'GLD'] },
  { id: 'cn', title: 'A股与指数', assets: ['000300', '000016', '399006', '000688', '600519', '300750', '002594', '688981', '601318'] },
  { id: 'gold', title: '黄金', assets: ['XAU-USD'] },
]

const quoteByAsset = computed(() => new Map(snapshot.value?.quotes.map(quote => [quote.assetId, quote]) || []))
const coverageByAsset = computed(() => new Map(snapshot.value?.coverage.map(item => [item.assetId, item]) || []))

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value))
}

function formatDelay(seconds: number) {
  if (seconds < 60) return `${seconds} 秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟`
  return `${Math.floor(seconds / 3600)} 小时`
}

async function loadSnapshot() {
  loading.value = true
  authRequired.value = false
  error.value = ''
  try {
    const response = await fetch('/api/private-market/snapshot', { credentials: 'same-origin', cache: 'no-store' })
    if (response.status === 401) {
      authRequired.value = true
      return
    }
    if (!response.ok) throw new Error('snapshot unavailable')
    snapshot.value = await response.json() as PrivateSnapshot
  } catch {
    error.value = '私人行情暂时不可用；不会用旧缓存伪装当前快照。'
  } finally {
    loading.value = false
  }
}

async function logout() {
  await fetch('/api/private-market/logout', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } })
  snapshot.value = null
  authRequired.value = true
}

onMounted(() => {
  setSeoMeta({ title: '私人行情｜xiuqiu', description: '登录后查看许可允许展示的个人研究行情快照。', path: '/private/market', indexable: false })
  void loadSnapshot()
})
</script>

<template>
  <main class="private-market-page" lang="zh-CN" :data-snapshot-id="snapshot?.snapshotId" :data-snapshot-as-of="snapshot?.asOf">
    <header class="private-market-header">
      <div>
        <p>Private market / research only</p>
        <h1>市场快照</h1>
        <span>许可允许展示的个人研究报价；不接账户、不下单。</span>
      </div>
      <button v-if="snapshot" type="button" @click="logout">退出</button>
    </header>

    <section v-if="loading" class="private-market-state" aria-live="polite">正在验证私人会话…</section>
    <section v-else-if="authRequired" class="private-market-state">
      <strong>先用 GitHub 验证身份</strong>
      <p>只允许已登记的 GitHub 数字账号进入；不会申请仓库或组织权限。</p>
      <a href="/api/private-market/auth/github/login">使用 GitHub 登录</a>
    </section>
    <section v-else-if="error" class="private-market-state" role="alert"><strong>当前不可用</strong><p>{{ error }}</p><button type="button" @click="loadSnapshot">重新检查</button></section>

    <template v-else-if="snapshot">
      <section class="private-market-meta" aria-label="快照身份">
        <div><span>Snapshot</span><strong>{{ snapshot.snapshotId }}</strong></div>
        <div><span>As of</span><strong>{{ formatTime(snapshot.asOf) }} CST</strong></div>
        <div><span>Mode</span><strong>{{ snapshot.mode }}</strong></div>
        <div><span>Coverage</span><strong>{{ snapshot.quotes.length }} / 21 可展示</strong></div>
      </section>

      <section v-for="group in groups" :key="group.id" class="private-market-group">
        <header><h2>{{ group.title }}</h2><span>{{ group.assets.length }} 项</span></header>
        <div class="private-market-assets">
          <article v-for="assetId in group.assets" :key="assetId" :data-market-status="coverageByAsset.get(assetId)?.status || 'unavailable'">
            <div><h3>{{ assetId }}</h3><span>{{ coverageByAsset.get(assetId)?.marketState || 'unknown' }}</span></div>
            <template v-if="quoteByAsset.get(assetId)">
              <p>{{ quoteByAsset.get(assetId)?.price }} <small>{{ quoteByAsset.get(assetId)?.currency }}</small></p>
              <dl>
                <div><dt>来源</dt><dd>{{ quoteByAsset.get(assetId)?.provider }}</dd></div>
                <div><dt>模式</dt><dd>{{ quoteByAsset.get(assetId)?.mode }}</dd></div>
                <div><dt>观察时间</dt><dd>{{ formatTime(quoteByAsset.get(assetId)!.observedAt) }}</dd></div>
                <div><dt>延迟</dt><dd>{{ formatDelay(quoteByAsset.get(assetId)!.delaySeconds) }}</dd></div>
              </dl>
            </template>
            <template v-else>
              <p class="is-unavailable">不可用</p>
              <small>{{ coverageByAsset.get(assetId)?.reason || 'no_display_quote' }}</small>
            </template>
          </article>
        </div>
      </section>
    </template>
  </main>
</template>
