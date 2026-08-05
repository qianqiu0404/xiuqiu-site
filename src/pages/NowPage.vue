<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { deliveryRecords } from '../data/generatedDeliveries'
import { nowSnapshot } from '../data/generatedNow'
import { setSeoMeta } from '../utils/seo'

const latestDelivery = [...deliveryRecords]
  .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'zh-CN'))[0]

const deliveryStatusLabels = {
  'in-progress': '进行中',
  partial: '部分完成',
  delivered: '已交付',
} as const

const stale = computed(() => (
  Date.now() - new Date(`${nowSnapshot.updatedAt}T00:00:00+08:00`).getTime()
) / 86_400_000 > 14)

onMounted(() => setSeoMeta({
  title: '关于我与当前方向｜xiuqiu',
  description: nowSnapshot.summary,
  path: '/now',
}))
</script>

<template>
  <section class="about-now page-top">
    <div class="container about-now-inner">
      <header class="about-now-hero">
        <div class="about-now-copy">
          <p class="about-now-kicker">About / Now · {{ nowSnapshot.updatedAt }}</p>
          <h1>{{ nowSnapshot.headline }}</h1>
          <p class="about-now-summary">{{ nowSnapshot.summary }}</p>

          <dl class="about-now-role">
            <div>
              <dt>Current role</dt>
              <dd>Web3 钱包后端工程师 × AI 协作工程实践者</dd>
            </div>
            <div>
              <dt>Build axis</dt>
              <dd>Wallet Platform · Market Server · Human-verified AI Engineering</dd>
            </div>
          </dl>
        </div>

        <aside class="about-now-boundary" :data-stale="stale || undefined">
          <span>{{ stale ? 'Snapshot aging' : 'Public boundary' }}</span>
          <strong>{{ stale ? '这份公开快照近期未更新' : '只公开可复核的工程事实' }}</strong>
          <p>设计、实现、本地验证、测试网验收与生产状态分别表达；私人记录、配置、凭据和完整工作对话不会进入网站。</p>
        </aside>
      </header>

      <section class="about-now-focus" aria-labelledby="about-now-focus-title">
        <header>
          <p class="about-now-kicker">Current focus</p>
          <h2 id="about-now-focus-title">现在只推进三件事</h2>
          <p>每一项都以完成门和可复核证据收口，不用模糊进度百分比代替结果。</p>
        </header>

        <ol>
          <li v-for="(item, index) in nowSnapshot.nextFocus" :key="item">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <p>{{ item }}</p>
          </li>
        </ol>
      </section>

      <section v-if="latestDelivery" class="about-now-delivery" aria-labelledby="latest-delivery-title">
        <div>
          <p class="about-now-kicker">Latest shipped trace</p>
          <time :datetime="latestDelivery.date">{{ latestDelivery.date }}</time>
        </div>
        <div>
          <span class="about-now-delivery-status">{{ deliveryStatusLabels[latestDelivery.status] }}</span>
          <h2 id="latest-delivery-title">{{ latestDelivery.title }}</h2>
          <p>{{ latestDelivery.summary }}</p>
          <small>{{ latestDelivery.evidenceSlugs.length }} 项关联证据 · {{ latestDelivery.publicLinks.length }} 个公开链接</small>
        </div>
        <router-link :to="`/ai/deliveries/${latestDelivery.slug}`">
          查看交付记录 <span aria-hidden="true">↗</span>
        </router-link>
      </section>
    </div>
  </section>
</template>

<style scoped>
.about-now {
  min-height: calc(100vh - 6rem);
  overflow: hidden;
  padding-top: 48px;
  background:
    linear-gradient(90deg, transparent 0, transparent calc(100% - 1px), rgba(25, 50, 87, 0.04) calc(100% - 1px)),
    #fbfcfe;
  background-size: min(25vw, 22rem) 100%;
  color: #101b2f;
}

.about-now-inner {
  padding-bottom: clamp(3.5rem, 7vw, 6.5rem);
}

.about-now-kicker {
  margin: 0;
  color: #426cae;
  font: 650 0.68rem/1.4 var(--mono);
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.about-now-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(17rem, 0.65fr);
  gap: clamp(3rem, 9vw, 9rem);
  align-items: end;
  padding: clamp(3rem, 5vw, 5rem) 0 clamp(3.25rem, 6vw, 5.75rem);
  border-bottom: 1px solid #d9e0e9;
}

.about-now-copy h1 {
  max-width: 15ch;
  margin: 1rem 0 1.45rem;
  font-size: clamp(2.9rem, 6.4vw, 6.2rem);
  font-weight: 660;
  letter-spacing: -0.068em;
  line-height: 0.98;
  text-wrap: balance;
}

.about-now-summary {
  max-width: 49rem;
  margin: 0;
  color: #5b6779;
  font-size: clamp(1rem, 1.45vw, 1.16rem);
  line-height: 1.8;
}

.about-now-role {
  display: grid;
  gap: 0;
  max-width: 50rem;
  margin: 2rem 0 0;
  border-top: 1px solid #d9e0e9;
}

.about-now-role div {
  display: grid;
  grid-template-columns: 8.2rem minmax(0, 1fr);
  gap: 1.25rem;
  padding: 0.9rem 0;
  border-bottom: 1px solid #e2e7ee;
}

.about-now-role dt {
  color: #8390a0;
  font: 650 0.63rem/1.55 var(--mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.about-now-role dd {
  min-width: 0;
  margin: 0;
  color: #2c3c53;
  line-height: 1.55;
}

.about-now-boundary {
  position: relative;
  display: grid;
  gap: 0.9rem;
  padding: 2rem 0 0;
  border-top: 2px solid #315f9f;
}

.about-now-boundary::before {
  position: absolute;
  top: -0.38rem;
  left: 0;
  width: 0.62rem;
  height: 0.62rem;
  border-radius: 50%;
  background: #315f9f;
  box-shadow: 0 0 0 0.35rem #dce7f6;
  content: '';
}

.about-now-boundary[data-stale='true'] {
  border-color: #9a6930;
}

.about-now-boundary[data-stale='true']::before {
  background: #9a6930;
  box-shadow: 0 0 0 0.35rem #f3e7d8;
}

.about-now-boundary span {
  color: #667790;
  font: 650 0.64rem/1.4 var(--mono);
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.about-now-boundary strong {
  max-width: 16ch;
  font-size: clamp(1.35rem, 2.4vw, 2rem);
  letter-spacing: -0.035em;
  line-height: 1.2;
}

.about-now-boundary p {
  margin: 0;
  color: #687486;
  font-size: 0.88rem;
  line-height: 1.75;
}

.about-now-focus {
  display: grid;
  grid-template-columns: minmax(15rem, 0.62fr) minmax(0, 1.38fr);
  gap: clamp(2.5rem, 8vw, 8rem);
  padding: clamp(3.5rem, 7vw, 6.5rem) 0;
  border-bottom: 1px solid #d9e0e9;
}

.about-now-focus header h2 {
  max-width: 9ch;
  margin: 0.85rem 0 1rem;
  font-size: clamp(2rem, 4vw, 3.8rem);
  letter-spacing: -0.055em;
  line-height: 1.04;
}

.about-now-focus header > p:last-child {
  max-width: 22rem;
  margin: 0;
  color: #758093;
  font-size: 0.86rem;
  line-height: 1.7;
}

.about-now-focus ol {
  min-width: 0;
  margin: 0;
  padding: 0;
  border-top: 1px solid #cfd7e2;
  list-style: none;
}

.about-now-focus li {
  display: grid;
  grid-template-columns: 3.4rem minmax(0, 1fr);
  gap: 1.2rem;
  padding: clamp(1.35rem, 2.5vw, 2rem) 0;
  border-bottom: 1px solid #d9e0e9;
}

.about-now-focus li span {
  color: #426cae;
  font: 650 0.7rem/1.7 var(--mono);
}

.about-now-focus li p {
  margin: 0;
  color: #2d3c51;
  line-height: 1.75;
}

.about-now-delivery {
  display: grid;
  grid-template-columns: minmax(9rem, 0.36fr) minmax(0, 1fr) auto;
  gap: clamp(1.5rem, 5vw, 5rem);
  align-items: center;
  padding: clamp(2.5rem, 5vw, 4.5rem) 0 0;
}

.about-now-delivery time {
  display: block;
  margin-top: 0.75rem;
  color: #7a8798;
  font: 550 0.72rem/1.4 var(--mono);
}

.about-now-delivery-status {
  color: #426cae;
  font: 650 0.64rem/1.4 var(--mono);
  letter-spacing: 0.08em;
}

.about-now-delivery h2 {
  margin: 0.45rem 0 0.6rem;
  font-size: clamp(1.45rem, 2.8vw, 2.4rem);
  letter-spacing: -0.04em;
}

.about-now-delivery p {
  max-width: 43rem;
  margin: 0;
  color: #687486;
  line-height: 1.7;
}

.about-now-delivery small {
  display: block;
  margin-top: 0.75rem;
  color: #8994a3;
  font: 550 0.68rem/1.5 var(--mono);
}

.about-now-delivery > a {
  white-space: nowrap;
  color: #285da9;
  font-size: 0.82rem;
  font-weight: 700;
}

.about-now-delivery > a:hover,
.about-now-delivery > a:focus-visible {
  text-decoration: underline;
}

.about-now-delivery > a:focus-visible {
  outline: 2px solid #3970c7;
  outline-offset: 6px;
}

@media (max-width: 800px) {
  .about-now-hero,
  .about-now-focus {
    grid-template-columns: minmax(0, 1fr);
  }

  .about-now-hero,
  .about-now-focus {
    gap: 2.5rem;
  }

  .about-now-boundary {
    max-width: 34rem;
  }

  .about-now-delivery {
    grid-template-columns: minmax(8rem, 0.34fr) minmax(0, 1fr);
  }

  .about-now-delivery > a {
    grid-column: 2;
    justify-self: start;
  }
}

@media (max-width: 520px) {
  .about-now-copy h1 {
    font-size: clamp(2.55rem, 13vw, 4.2rem);
  }

  .about-now-role div,
  .about-now-delivery {
    grid-template-columns: minmax(0, 1fr);
  }

  .about-now-role div {
    gap: 0.35rem;
  }

  .about-now-focus li {
    grid-template-columns: 2.25rem minmax(0, 1fr);
  }

  .about-now-delivery > a {
    grid-column: 1;
  }
}
</style>
