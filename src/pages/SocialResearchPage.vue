<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { setSeoMeta } from '../utils/seo'

type DemoPanel = 'config' | 'logs' | 'data'

const activePanel = ref<DemoPanel>('config')

const platforms = ['小红书', '抖音', 'Bilibili', '微博', '知乎', 'TikTok', 'Instagram', 'YouTube', 'X', '微信', 'Reddit', 'LinkedIn']
const pipeline = [
  { index: '01', title: '理解任务', text: '识别平台、关键词或链接，以及内容与评论上限。' },
  { index: '02', title: '本地优先', text: '支持的平台先使用 MediaCrawler 与已有浏览器登录态。' },
  { index: '03', title: '失败分类', text: '登录问题暂停人工处理；接口失效才进入付费备用。' },
  { index: '04', title: '费用确认', text: '展示端点、调用次数和最高费用，确认后才调用 TikHub。' },
  { index: '05', title: '统一数据', text: '原始响应与统一 JSONL 同时保留，可追踪来源。' },
  { index: '06', title: 'Codex 分析', text: '围绕用户问题提取主题、痛点、趋势与证据。' },
]

const demoLogs = [
  ['10:24:08', 'route', '小红书属于本地支持平台，选择 MediaCrawler'],
  ['10:24:09', 'limit', '30 篇 · 每篇最多 20 条一级评论'],
  ['10:24:11', 'browser', '复用本机 Chrome 登录态'],
  ['10:24:16', 'fallback', '接口返回异常，已停止免费链路'],
  ['10:24:16', 'cost', 'TikHub 备用：预计 3 次请求，最高 $0.03'],
  ['10:24:16', 'pause', '等待本人确认，不会自动扣费'],
]

const demoRows = [
  { source: 'MediaCrawler', type: '笔记', title: 'AI 编程副业的真实门槛', signal: '讨论集中在获客与交付' },
  { source: 'TikHub', type: '评论', title: '有技术但不知道怎么找到客户', signal: '高频痛点：渠道' },
  { source: 'TikHub', type: '评论', title: '最担心需求不断变更', signal: '高频痛点：范围管理' },
]

onMounted(() => setSeoMeta({
  title: 'Social Media Research Skill｜xiuqiu',
  description: 'MediaCrawler 本地采集与 TikHub 付费确认回退组成的双后端社交媒体研究工作流。',
  path: '/ai/social-research',
}))
</script>

<template>
  <div class="social-research-page">
    <section class="social-hero">
      <div class="container social-hero-grid">
        <div class="social-hero-copy">
          <p class="social-kicker"><span></span> Codex Skill · Verified locally</p>
          <h1>让 Codex 看见<br><em>真实的社交内容</em></h1>
          <p class="social-hero-desc">免费本地采集优先，付费 API 只做确认后的备用。帖子、评论与创作者数据统一进入可追踪的研究流程。</p>
          <div class="social-hero-actions">
            <a class="social-primary-action" href="#research-console">查看运行方式</a>
            <router-link class="social-secondary-action" to="/ai#social-media-research">查看工程边界</router-link>
          </div>
          <div class="social-command"><span>$</span><code>抓取小红书“AI 编程副业”，分析评论痛点</code><i>↵</i></div>
        </div>

        <aside class="social-signal-card" aria-label="双后端状态概览">
          <div class="signal-card-top"><span class="signal-live"><i></i> Ready</span><small>local-first</small></div>
          <h2>Research Router</h2>
          <div class="signal-route local"><span>01</span><div><strong>MediaCrawler</strong><small>Free · browser session</small></div><b>Primary</b></div>
          <div class="signal-connector"><i></i><i></i><i></i></div>
          <div class="signal-route paid"><span>02</span><div><strong>TikHub MCP</strong><small>Paid · explicit approval</small></div><b>Fallback</b></div>
          <div class="signal-guard"><span>Cost guard</span><strong>≤ $1.00 / task</strong><small>每次付费前展示最高费用</small></div>
        </aside>
      </div>
      <div class="social-grid-glow" aria-hidden="true"></div>
    </section>

    <section class="social-metrics">
      <div class="container social-metric-grid">
        <div><strong>7</strong><span>本地支持平台</span></div>
        <div><strong>16</strong><span>TikHub 平台覆盖</span></div>
        <div><strong>2</strong><span>独立数据后端</span></div>
        <div><strong>0</strong><span>静默付费调用</span></div>
      </div>
    </section>

    <section class="social-platforms section">
      <div class="container">
        <div class="social-section-heading"><p>One research interface</p><h2>从中文内容社区到全球社交平台</h2><span>重叠平台走本地免费链路；额外平台在确认费用后走 TikHub。</span></div>
        <div class="platform-cloud"><span v-for="platform in platforms" :key="platform">{{ platform }}</span></div>

        <div class="engine-comparison">
          <article class="engine-card local-engine">
            <div class="engine-card-title"><span>LOCAL</span><small>默认引擎</small></div>
            <h3>MediaCrawler</h3>
            <p>连接真实 Chrome 登录态，采集公开内容、创作者与评论。适合个人学习和小规模研究。</p>
            <ul><li>无需按请求付费</li><li>原始数据留在本机</li><li>登录或验证码由本人接管</li></ul>
          </article>
          <article class="engine-card paid-engine">
            <div class="engine-card-title"><span>REMOTE MCP</span><small>受控备用</small></div>
            <h3>TikHub</h3>
            <p>当平台不受本地支持或接口持续失效时，通过远程 MCP 补足数据能力。</p>
            <ul><li>调用前展示端点和次数</li><li>调用前确认最高费用</li><li>超出预算立即停止并重新确认</li></ul>
          </article>
        </div>
      </div>
    </section>

    <section class="social-flow-section section">
      <div class="container">
        <div class="social-section-heading light"><p>Guarded pipeline</p><h2>失败不是直接切换，而是先分类</h2><span>认证问题等待本人处理；只有免费链路确实不可用，才准备付费备用。</span></div>
        <div class="social-pipeline"><article v-for="item in pipeline" :key="item.index"><span>{{ item.index }}</span><h3>{{ item.title }}</h3><p>{{ item.text }}</p></article></div>
      </div>
    </section>

    <section id="research-console" class="research-console-section section">
      <div class="container">
        <div class="social-section-heading"><p>Static workflow demo</p><h2>一次采集任务如何被控制</h2><span>下面是公开的静态演示，不连接真实平台，也不会使用任何付费额度。</span></div>

        <div class="research-console">
          <header class="console-header"><div><i></i><i></i><i></i></div><strong>social-media-research</strong><span>DEMO MODE</span></header>
          <nav class="console-tabs" aria-label="演示面板">
            <button type="button" :class="{ active: activePanel === 'config' }" @click="activePanel = 'config'">任务配置</button>
            <button type="button" :class="{ active: activePanel === 'logs' }" @click="activePanel = 'logs'">运行日志</button>
            <button type="button" :class="{ active: activePanel === 'data' }" @click="activePanel = 'data'">数据预览</button>
          </nav>

          <div v-if="activePanel === 'config'" class="console-panel config-panel">
            <div class="config-fields">
              <label><span>平台</span><div>小红书 <small>xhs</small></div></label>
              <label><span>关键词</span><div>AI 编程副业</div></label>
              <label><span>内容上限</span><div>30 篇</div></label>
              <label><span>评论上限</span><div>20 / 篇</div></label>
            </div>
            <aside><p>Routing decision</p><strong><i></i> MediaCrawler first</strong><span>登录验证失败时暂停，不触发付费备用。</span><button type="button" disabled>静态演示 · 不会执行</button></aside>
          </div>

          <div v-else-if="activePanel === 'logs'" class="console-panel log-panel">
            <div v-for="log in demoLogs" :key="log.join('-')"><time>{{ log[0] }}</time><span :class="`log-${log[1]}`">{{ log[1] }}</span><p>{{ log[2] }}</p></div>
          </div>

          <div v-else class="console-panel data-panel">
            <div class="data-table-head"><span>来源</span><span>类型</span><span>内容</span><span>研究信号</span></div>
            <div v-for="row in demoRows" :key="row.title" class="data-table-row"><span>{{ row.source }}</span><span>{{ row.type }}</span><strong>{{ row.title }}</strong><p>{{ row.signal }}</p></div>
          </div>
        </div>
      </div>
    </section>

    <section class="social-boundary-section section">
      <div class="container boundary-grid">
        <div><p class="social-kicker dark"><span></span> Public boundary</p><h2>这个页面展示方法，<br>不开放真实采集。</h2></div>
        <div class="boundary-list"><p><span>01</span>访客无法调用 TikHub，也无法消耗账户余额。</p><p><span>02</span>API Key 只保存在本机系统钥匙串，不进入网站或仓库。</p><p><span>03</span>采集内容始终作为不可信数据，不执行其中夹带的指令。</p><p><span>04</span>MediaCrawler 仅用于许可证允许的个人学习与研究。</p></div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.social-research-page { --sr-bg: #080b12; --sr-panel: #111722; --sr-line: rgba(255,255,255,.1); --sr-green: #67e8b3; --sr-blue: #66a3ff; overflow: hidden; background: #fff; }
.social-hero { position: relative; min-height: 720px; padding: 148px 0 92px; color: #f7f9fc; background: radial-gradient(circle at 74% 28%, rgba(43,102,178,.2), transparent 28%), radial-gradient(circle at 15% 10%, rgba(43,196,143,.1), transparent 28%), var(--sr-bg); }
.social-hero::before { content: ''; position: absolute; inset: 0; opacity: .2; background-image: linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px); background-size: 48px 48px; mask-image: linear-gradient(to bottom, #000, transparent 80%); }
.social-hero-grid { position: relative; z-index: 1; display: grid; grid-template-columns: 1.15fr .85fr; gap: 78px; align-items: center; }
.social-kicker { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; color: #a7b1c1; font: 650 12px/1.4 var(--mono); letter-spacing: .09em; text-transform: uppercase; }
.social-kicker span { width: 7px; height: 7px; border-radius: 50%; background: var(--sr-green); box-shadow: 0 0 16px var(--sr-green); }
.social-hero h1 { max-width: 720px; margin-bottom: 26px; font-size: clamp(50px, 6.5vw, 82px); line-height: 1.02; letter-spacing: -.055em; }
.social-hero h1 em { color: var(--sr-green); font-style: normal; }
.social-hero-desc { max-width: 650px; color: #aeb8c8; font-size: 18px; line-height: 1.75; }
.social-hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin: 34px 0; }
.social-primary-action,.social-secondary-action { display: inline-flex; align-items: center; justify-content: center; min-height: 46px; padding: 0 22px; border-radius: 8px; font-size: 14px; font-weight: 700; }
.social-primary-action { background: var(--sr-green); color: #07110d; }
.social-secondary-action { border: 1px solid var(--sr-line); color: #e7ebf1; background: rgba(255,255,255,.03); }
.social-command { display: flex; align-items: center; gap: 12px; max-width: 590px; padding: 14px 16px; border: 1px solid var(--sr-line); border-radius: 10px; background: rgba(255,255,255,.035); color: #b8c3d2; }
.social-command span { color: var(--sr-green); }.social-command code { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }.social-command i { margin-left: auto; color: #687487; font-style: normal; }
.social-signal-card { position: relative; padding: 26px; border: 1px solid rgba(255,255,255,.13); border-radius: 18px; background: linear-gradient(160deg, rgba(24,33,48,.94), rgba(12,17,26,.96)); box-shadow: 0 34px 80px rgba(0,0,0,.42); }
.signal-card-top { display: flex; align-items: center; justify-content: space-between; padding-bottom: 20px; border-bottom: 1px solid var(--sr-line); color: #7f8a9c; font: 600 11px var(--mono); text-transform: uppercase; }.signal-live { color: var(--sr-green); }.signal-live i { display: inline-block; width: 6px; height: 6px; margin-right: 7px; border-radius: 50%; background: currentColor; }
.social-signal-card h2 { margin: 24px 0 18px; font: 700 18px var(--mono); }
.signal-route { display: grid; grid-template-columns: 38px 1fr auto; gap: 14px; align-items: center; padding: 17px; border: 1px solid var(--sr-line); border-radius: 12px; background: rgba(255,255,255,.025); }.signal-route>span { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 9px; background: rgba(103,232,179,.1); color: var(--sr-green); font: 700 11px var(--mono); }.signal-route div { display: grid; gap: 3px; }.signal-route strong { font-size: 14px; }.signal-route small { color: #798598; font: 11px var(--mono); }.signal-route b { padding: 5px 7px; border-radius: 5px; background: rgba(103,232,179,.1); color: var(--sr-green); font: 700 9px var(--mono); text-transform: uppercase; }.signal-route.paid>span { color: var(--sr-blue); background: rgba(102,163,255,.1); }.signal-route.paid b { color: var(--sr-blue); background: rgba(102,163,255,.1); }
.signal-connector { display: flex; flex-direction: column; gap: 4px; padding: 8px 0 8px 34px; }.signal-connector i { width: 2px; height: 3px; border-radius: 2px; background: #465164; }
.signal-guard { display: grid; grid-template-columns: 1fr auto; gap: 5px; margin-top: 20px; padding: 15px 17px; border-radius: 10px; background: rgba(255,255,255,.035); }.signal-guard span { color: #7f8a9c; font: 11px var(--mono); text-transform: uppercase; }.signal-guard strong { color: #f8c765; font: 700 12px var(--mono); }.signal-guard small { grid-column: 1 / -1; color: #8792a3; }
.social-grid-glow { position: absolute; width: 420px; height: 200px; right: 10%; bottom: -160px; border-radius: 50%; background: rgba(103,232,179,.2); filter: blur(90px); }
.social-metrics { color: #fff; background: #0d121b; border-top: 1px solid var(--sr-line); border-bottom: 1px solid var(--sr-line); }.social-metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); }.social-metric-grid div { display: flex; align-items: baseline; gap: 12px; padding: 28px 24px; border-right: 1px solid var(--sr-line); }.social-metric-grid div:first-child { border-left: 1px solid var(--sr-line); }.social-metric-grid strong { color: var(--sr-green); font: 700 28px var(--mono); }.social-metric-grid span { color: #8994a5; font-size: 12px; }
.social-section-heading { max-width: 700px; margin-bottom: 46px; }.social-section-heading p { margin-bottom: 10px; color: #377962; font: 700 11px var(--mono); letter-spacing: .1em; text-transform: uppercase; }.social-section-heading h2 { margin-bottom: 13px; font-size: clamp(34px, 4.8vw, 52px); line-height: 1.1; letter-spacing: -.045em; }.social-section-heading span { color: var(--text-muted); font-size: 16px; line-height: 1.7; }.social-section-heading.light h2 { color: #f5f7fa; }.social-section-heading.light span { color: #8f9bad; }.social-section-heading.light p { color: var(--sr-green); }
.platform-cloud { display: flex; flex-wrap: wrap; gap: 10px; }.platform-cloud span { padding: 9px 14px; border: 1px solid #e3e7e5; border-radius: 999px; color: #4f5a57; background: #fafcfb; font: 600 12px var(--mono); }
.engine-comparison { display: grid; grid-template-columns: repeat(2, 1fr); gap: 22px; margin-top: 52px; }.engine-card { padding: 34px; border: 1px solid #e5e9e7; border-radius: 18px; background: #fff; }.engine-card-title { display: flex; justify-content: space-between; margin-bottom: 38px; }.engine-card-title span { color: #377962; font: 700 11px var(--mono); letter-spacing: .08em; }.engine-card-title small { color: #8c9591; }.engine-card h3 { margin-bottom: 12px; font-size: 28px; }.engine-card>p { color: var(--text-secondary); line-height: 1.7; }.engine-card ul { display: grid; gap: 10px; margin-top: 24px; list-style: none; }.engine-card li { color: #4e5855; font-size: 14px; }.engine-card li::before { content: '✓'; margin-right: 10px; color: #2d956e; font-weight: 800; }.paid-engine { background: #f8faff; }.paid-engine .engine-card-title span { color: #3f70bb; }
.social-flow-section { color: #fff; background: var(--sr-bg); }.social-pipeline { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid var(--sr-line); border-left: 1px solid var(--sr-line); }.social-pipeline article { min-height: 230px; padding: 26px; border-right: 1px solid var(--sr-line); border-bottom: 1px solid var(--sr-line); }.social-pipeline span { color: var(--sr-green); font: 700 11px var(--mono); }.social-pipeline h3 { margin: 58px 0 10px; font-size: 19px; }.social-pipeline p { color: #8490a1; font-size: 14px; line-height: 1.65; }
.research-console-section { background: #f4f6f5; }.research-console { overflow: hidden; border: 1px solid #dfe4e1; border-radius: 16px; background: #fff; box-shadow: 0 26px 70px rgba(20,31,27,.09); }.console-header { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; height: 52px; padding: 0 18px; color: #a8b0bc; background: #111722; }.console-header>div { display: flex; gap: 7px; }.console-header i { width: 8px; height: 8px; border-radius: 50%; background: #364052; }.console-header strong { color: #dce2ea; font: 600 12px var(--mono); }.console-header>span { justify-self: end; color: var(--sr-green); font: 700 9px var(--mono); }
.console-tabs { display: flex; gap: 6px; padding: 12px 14px 0; border-bottom: 1px solid #e7eae8; background: #fafbfa; }.console-tabs button { padding: 10px 16px 12px; border: 0; border-bottom: 2px solid transparent; color: #7b8581; background: transparent; cursor: pointer; font: 600 12px var(--font); }.console-tabs button.active { color: #1e302a; border-color: #3faa80; }
.console-panel { min-height: 320px; }.config-panel { display: grid; grid-template-columns: 1.5fr .75fr; }.config-fields { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; padding: 28px; }.config-fields label>span { display: block; margin-bottom: 7px; color: #7b8581; font-size: 11px; }.config-fields label>div { display: flex; justify-content: space-between; padding: 13px 14px; border: 1px solid #dfe4e1; border-radius: 8px; color: #2a3531; font-size: 13px; }.config-fields small { color: #9ca4a1; font: 11px var(--mono); }.config-panel aside { display: flex; flex-direction: column; margin: 28px 28px 28px 0; padding: 22px; border-radius: 12px; background: #f3f8f6; }.config-panel aside p { color: #75817d; font: 700 10px var(--mono); text-transform: uppercase; }.config-panel aside strong { margin: 18px 0 8px; font-size: 15px; }.config-panel aside strong i { display: inline-block; width: 7px; height: 7px; margin-right: 8px; border-radius: 50%; background: #36a97b; }.config-panel aside span { color: #77817d; font-size: 12px; line-height: 1.6; }.config-panel button { margin-top: auto; padding: 11px; border: 0; border-radius: 7px; color: #91a09a; background: #dfeae6; font-weight: 700; }
.log-panel { padding: 22px 28px; color: #c6ced9; background: #0c1119; font: 12px/1.7 var(--mono); }.log-panel>div { display: grid; grid-template-columns: 76px 78px 1fr; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,.04); }.log-panel time { color: #596577; }.log-panel span { color: var(--sr-blue); }.log-panel .log-cost { color: #f5c76b; }.log-panel .log-pause { color: var(--sr-green); }.log-panel p { color: #aab4c2; }
.data-panel { padding: 20px 24px; }.data-table-head,.data-table-row { display: grid; grid-template-columns: 130px 80px 1.2fr 1fr; gap: 14px; align-items: center; }.data-table-head { padding: 0 12px 10px; color: #89928e; font: 700 10px var(--mono); text-transform: uppercase; }.data-table-row { padding: 16px 12px; border-top: 1px solid #e7eae8; font-size: 12px; }.data-table-row>span:first-child { color: #31775d; font: 600 11px var(--mono); }.data-table-row p { color: #6c7572; }
.social-boundary-section { background: #eef4f1; }.boundary-grid { display: grid; grid-template-columns: .9fr 1.1fr; gap: 90px; }.social-kicker.dark { color: #65736e; }.boundary-grid h2 { font-size: clamp(34px, 4.6vw, 52px); line-height: 1.12; letter-spacing: -.045em; }.boundary-list { display: grid; }.boundary-list p { display: grid; grid-template-columns: 40px 1fr; gap: 12px; padding: 18px 0; border-bottom: 1px solid #d5dfda; color: #46534e; }.boundary-list span { color: #388166; font: 700 11px var(--mono); }
@media (max-width: 860px) { .social-hero-grid,.boundary-grid { grid-template-columns: 1fr; }.social-hero { padding-top: 120px; }.social-signal-card { max-width: 560px; }.social-metric-grid { grid-template-columns: repeat(2, 1fr); }.engine-comparison { grid-template-columns: 1fr; }.social-pipeline { grid-template-columns: repeat(2, 1fr); }.config-panel { grid-template-columns: 1fr; }.config-panel aside { margin: 0 28px 28px; }.data-table-head { display: none; }.data-table-row { grid-template-columns: 110px 60px 1fr; }.data-table-row p { grid-column: 1 / -1; }.boundary-grid { gap: 40px; } }
@media (max-width: 560px) { .social-hero { min-height: auto; padding-bottom: 64px; }.social-hero h1 { font-size: 45px; }.social-metric-grid { grid-template-columns: 1fr 1fr; }.social-metric-grid div { display: grid; gap: 4px; padding: 20px 16px; }.social-pipeline { grid-template-columns: 1fr; }.social-pipeline article { min-height: 190px; }.social-pipeline h3 { margin-top: 38px; }.config-fields { grid-template-columns: 1fr; padding: 20px; }.config-panel aside { margin: 0 20px 20px; }.console-tabs button { flex: 1; padding-inline: 6px; }.log-panel { padding: 16px; overflow-x: auto; }.log-panel>div { min-width: 580px; }.data-panel { padding: 15px; }.data-table-row { grid-template-columns: 1fr 70px; }.data-table-row strong,.data-table-row p { grid-column: 1 / -1; }.social-hero-actions>a { flex: 1; }.social-command { font-size: 11px; } }
</style>
