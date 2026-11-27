<script setup lang="ts">
import { actionsDemo, answerCheckDemo, featuredProjects, githubProfileUrl, memoryDemo, miniExchangeDemo, resumeExperience, watchDemo } from '../data'
import { useResume } from '../useResume'
const { projects, query, includeHistory, category, visibleProjects, activeProject, activeIndex, dialog, dialogBody, closeButton, searchInput, detailState, noteHtml, copyLabel, copied, dark, toggleTheme, setCategory, resetSearch, openProject, closeProject, onDialogClose, loadDetail, stepProject, onDialogKey, onBackdropClick, copyLink } = useResume()
</script>

<template>
<div class="resume-page">
<a class="skip-link" href="#resume-main">跳到主要内容</a>
<header class="header">
<div class="wrap header-inner">
<a class="brand" href="#resume-main">
<span>x.</span>xiuqiu</a>
<nav aria-label="主导航">
<a href="#selected">精选作品</a>
<a href="#catalog">全部项目</a>
<a href="#experience">经历</a>
<a href="#contact">联系</a>
<router-link to="/intel">雷达与文章 <span aria-hidden="true">↗</span></router-link>
</nav>
<button id="theme-toggle" type="button" :aria-label="dark ? '切换为浅色外观' : '切换为深色外观'" @click="toggleTheme">{{ dark ? '浅色' : '深色' }}</button>
</div>
</header>
<main id="resume-main" tabindex="-1">
<section class="wrap hero">
<div class="hero-copy">
<p class="eyebrow">你好，我是</p>
<h1>xiuqiu<span aria-hidden="true">/ Qiu</span>
</h1>
<p class="role">AI 应用工程师 · Agent / AI 自动化</p>
<h2>让 AI Agent 在真实业务里靠得住。</h2>
<p class="intro">回答有依据，出了问题查得出，用量管得住，进展看得见。</p>
<dl class="hero-facts">
<div>
<dt>经历</dt>
<dd>{{ resumeExperience.company }} · {{ resumeExperience.role }} · {{ resumeExperience.start }}—{{ resumeExperience.end }}</dd>
</div>
<div>
<dt>状态</dt>
<dd>已离职 · 随时到岗</dd>
</div>
<div>
<dt>教育</dt>
<dd>大连科技学院 · 软件工程本科 · 2021—2025</dd>
</div>
<div>
<dt>作品</dt>
<dd>{{ projects.length }} 条记录 · 8 个精选 · 按真实归属标注</dd>
</div>
</dl>
<div class="hero-actions">
<a class="button primary" href="#selected">从精选作品开始 ↓</a>
<a class="button secondary" href="#catalog">浏览完整目录 · {{ projects.length }} 项 <span aria-hidden="true">↗</span></a>
</div>
<div class="social-links">
<a href="mailto:qianqiuquq@gmail.com">邮箱 <span aria-hidden="true">↗</span></a>
<a :href="githubProfileUrl" target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a>
<a href="https://x.com/Xiuqiu2211" target="_blank" rel="noopener noreferrer">X <span aria-hidden="true">↗</span></a>
</div>
</div>
<figure class="hero-feature">
<button data-open="steward" @click="openProject('steward', $event)" aria-label="查看 Session Steward 小镇详情">
<img src="/resume/steward-final-daily.jpg" alt="Session Steward 小镇终版设计，使用演示数据" fetchpriority="high" width="1440" height="960">
</button>
<figcaption>
<div>
<span>最近的代表作品 · 个人作品</span>
<strong>Session Steward · 小镇</strong>
</div>
<span>终版体验设计<br>演示数据</span>
</figcaption>
</figure>
</section>
<section class="wrap tracks" aria-labelledby="tracks-title">
<div class="tracks-heading">
<h2 class="eyebrow" id="tracks-title">一条主线</h2>
<p>我做的事，是让 AI Agent 在真实业务里靠得住。下面四件作品各管一环。</p>
</div>
<div class="track-grid mainline-grid">
<article class="track">
<h3 class="track-head">
<b>1</b>
<span>回答有依据</span>
</h3>
<p class="track-desc">按租户和知识库限定检索范围，校验引用来自已绑定的资料，发送前检查泄露风险。</p>
<ul class="track-chips">
<li>
<button type="button" data-open="saas" @click="openProject('saas', $event)">Agent SaaS · 企业客服 Agent<em>团队参与</em></button>
</li>
<li>
<a :href="answerCheckDemo.href">{{ answerCheckDemo.label }}<em>个人项目</em></a>
</li>
<li>
<a :href="memoryDemo.href">{{ memoryDemo.label }}<em>个人项目</em></a>
</li>
</ul>
</article>
<article class="track">
<h3 class="track-head">
<b>2</b>
<span>出了问题查得出</span>
</h3>
<p class="track-desc">只读诊断 Agent 引用事件编号解释“为什么没成交、钱为什么冻着”，再用重复评测检验它答得对不对。</p>
<ul class="track-chips">
<li>
<button type="button" data-open="miniexchange" @click="openProject('miniexchange', $event)">mini-exchange</button>
</li>
<li>
<a :href="actionsDemo.href">{{ actionsDemo.label }}<em>个人项目</em></a>
</li>
</ul>
</article>
<article class="track">
<h3 class="track-head">
<b>3</b>
<span>用量管得住</span>
</h3>
<p class="track-desc">每位同事一把独立 Key，按人限额、计量，每次调用都能追查。</p>
<ul class="track-chips">
<li>
<button type="button" data-open="qai" @click="openProject('qai', $event)">QAI</button>
</li>
<li>
<a :href="watchDemo.href">{{ watchDemo.label }}<em>个人项目</em></a>
</li>
</ul>
</article>
<article class="track">
<h3 class="track-head">
<b>4</b>
<span>进展看得见</span>
</h3>
<p class="track-desc">把多个 Agent 会话和每天的代码变化，整理成人一眼能看懂的进展和白话晚报。</p>
<ul class="track-chips">
<li>
<button type="button" data-open="steward" @click="openProject('steward', $event)">Session Steward</button>
</li>
<li>
<button type="button" data-open="xiaomao" @click="openProject('xiaomao', $event)">小猫 Agent</button>
</li>
</ul>
</article>
</div>
<div class="tracks-heading other-heading">
<h2 class="eyebrow" id="other-tracks-title">另外两个方向</h2>
</div>
<div class="track-grid other-grid">
<article class="track">
<h3 class="track-head">
<b aria-hidden="true">A</b>
<span>交易与资金链路</span>
</h3>
<p class="track-desc">多源行情、钱包充提、账本一致性和异常恢复。</p>
<ul class="track-chips">
<li>
<button type="button" data-open="qiumarket" @click="openProject('qiumarket', $event)">Qiu Market</button>
</li>
<li>
<button type="button" data-open="reliability" @click="openProject('reliability', $event)">Wallet Reliability Lab</button>
</li>
<li>
<button type="button" data-open="stableflow" @click="openProject('stableflow', $event)">StableFlow</button>
</li>
<li>
<button type="button" data-open="wallet" @click="openProject('wallet', $event)">Wallet Infrastructure</button>
</li>
</ul>
</article>
<article class="track">
<h3 class="track-head">
<b aria-hidden="true">B</b>
<span>工具与创作</span>
</h3>
<p class="track-desc">研究情报、内容制作、知识整理与互动影像。</p>
<ul class="track-chips">
<li>
<button type="button" data-open="radar" @click="openProject('radar', $event)">Learning Radar</button>
</li>
<li>
<button type="button" data-open="studio" @click="openProject('studio', $event)">Qiu Studio / 代码短视频工作室</button>
</li>
<li>
<button type="button" data-open="wildheart" @click="openProject('wildheart', $event)">知识地图</button>
</li>
<li>
<button type="button" data-open="zhuangzi" @click="openProject('zhuangzi', $event)">庄子 · 梦游天地</button>
</li>
</ul>
</article>
</div>
</section>
<section class="wrap selected-section" id="selected">
<div class="section-heading">
<div>
<p class="eyebrow">01 / 精选作品</p>
<h2>先从这些作品认识我。</h2>
</div>
<a href="#catalog">全部项目与经历 <span>{{ projects.length }}</span> ↓</a>
</div>
<div class="selected-grid">
  <article v-for="{ project, visual, position } in featuredProjects" :key="project.id" class="selected-card">
    <div class="project-image" :class="`visual-${project.id}`">
      <template v-if="'src' in visual">
        <img :src="visual.src" :alt="visual.alt" loading="lazy" decoding="async">
        <span v-if="visual.caption">{{ visual.caption }}</span>
      </template>
      <div v-else class="project-diagram">
        <small>{{ visual.label }}</small>
        <strong>{{ visual.headline }}</strong>
        <ol>
          <li v-for="(step, index) in visual.steps" :key="step">
            <b aria-hidden="true">0{{ index + 1 }}</b>{{ step }}
          </li>
        </ol>
        <p>{{ visual.caption }}</p>
      </div>
      <i aria-hidden="true">↗</i>
    </div>
    <div class="card-meta">
      <div>
        <span class="kind" :class="`kind-${project.kind}`">{{ project.kindLabel }}</span>
        <span>{{ project.label }}</span>
      </div>
      <span>{{ position }}</span>
    </div>
    <h3>
      <button type="button" :data-open="project.id" @click="openProject(project.id, $event)">
        {{ project.title }}<span aria-hidden="true">↗</span>
      </button>
    </h3>
    <p>{{ project.intro }}</p>
    <p class="card-status">{{ project.status }}</p>
    <a v-if="project.id === 'miniexchange'" class="demo-link" :href="miniExchangeDemo.href">{{ miniExchangeDemo.label }} <span aria-hidden="true">↗</span></a>
  </article>
</div>
</section>
<section class="catalog-section" id="catalog">
<div class="wrap">
<div class="section-heading">
<div>
<p class="eyebrow">02 / 全部项目</p>
<h2>完整项目目录 <sup>{{ projects.length }}</sup>
</h2>
</div>
<p>个人作品、团队业务、学习实验与历史资料分别标注。</p>
</div>
<div class="catalog-toolbar">
<label class="search-label">
<span>搜索项目 <kbd>/</kbd>
</span>
<input id="project-search" ref="searchInput" v-model="query" type="search" placeholder="项目名、技术或关键词" autocomplete="off" aria-describedby="filter-status">
</label>
<label class="history-toggle">
<input id="include-history" type="checkbox" v-model="includeHistory">
<span>包含历史与暂停记录</span>
</label>
</div>
<div class="category-filters" role="group" aria-label="项目分类">
<button type="button" data-category-filter="all" :aria-pressed="category === 'all'" @click="setCategory('all')">全部 <span>{{ projects.length }}</span>
</button>
<button type="button" data-category-filter="product" :aria-pressed="category === 'product'" @click="setCategory('product')">工具与产品 <span>10</span>
</button>
<button type="button" data-category-filter="business" :aria-pressed="category === 'business'" @click="setCategory('business')">业务经历 <span>2</span>
</button>
<button type="button" data-category-filter="engineering" :aria-pressed="category === 'engineering'" @click="setCategory('engineering')">交易与系统 <span>7</span>
</button>
<button type="button" data-category-filter="knowledge" :aria-pressed="category === 'knowledge'" @click="setCategory('knowledge')">知识与数据 <span>7</span>
</button>
<button type="button" data-category-filter="creative" :aria-pressed="category === 'creative'" @click="setCategory('creative')">影像与交互 <span>5</span>
</button>
<button type="button" data-category-filter="history" :aria-pressed="category === 'history'" @click="setCategory('history')">历史探索 <span>2</span>
</button>
</div>
<div class="kind-legend" aria-label="归属说明">
<span class="kind kind-personal">个人作品</span>
<span class="kind kind-private">个人作品 · 私有</span>
<span class="kind kind-team">团队业务 · 本人参与</span>
<span class="kind kind-lab">学习与实验</span>
<span class="kind kind-archive">历史资料</span>
</div>
<p id="filter-status" class="filter-status" aria-live="polite">显示 {{ visibleProjects.length }} / {{ projects.length }} 项记录</p>
<div class="catalog-grid">
  <article v-for="project in visibleProjects" :key="project.id" class="catalog-card" :data-category="project.category" :data-history="project.history">
    <div class="catalog-meta">
<span class="kind" :class="`kind-${project.kind}`">{{ project.kindLabel }}</span>
<span>{{ projects.indexOf(project) + 1 }}</span>
</div>
    <h3>
<button :data-open="project.id" @click="openProject(project.id, $event)">{{ project.title }}<span aria-hidden="true">↗</span>
</button>
</h3>
    <p>{{ project.intro }}</p>
<p class="catalog-status">{{ project.status }}</p>
<p v-if="project.tech" class="catalog-tech">{{ project.tech }}</p>
  </article>
</div>
<div id="empty-state" class="empty-state" v-if="!visibleProjects.length">
<h3>暂时没有匹配的项目。</h3>
<p>可以换个关键词，或回到完整目录。</p>
<button id="reset-search" @click="resetSearch" class="button secondary" type="button">查看全部项目</button>
</div>
<p class="catalog-footnote">目录记录不等于独立上市产品数量。同一项目的版本和工作树合并整理；团队业务只写本人参与的模块，模拟测试、离线回放与历史验证不写成生产运营经验。</p>
</div>
</section>
<section class="wrap experience-section" id="experience">
<div class="section-heading">
<div>
<p class="eyebrow">03 / 经历与教育</p>
<h2>业务里的实践，作品背后的基础。</h2>
</div>
</div>
<div class="experience-grid">
<div class="experience-list">
  <header class="experience-company">
    <h3>{{ resumeExperience.company }} · {{ resumeExperience.role }}</h3>
    <p class="experience-when">{{ resumeExperience.start }} — {{ resumeExperience.end }}</p>
    <p class="experience-lead">{{ resumeExperience.description }}</p>
  </header>
  <article v-for="entry in resumeExperience.entries" :key="entry.id" class="experience-row">
    <h4>{{ entry.title }}</h4>
    <p class="experience-role">{{ entry.responsibility }}</p>
    <ul>
      <li v-for="bullet in entry.bullets" :key="bullet">{{ bullet }}</li>
    </ul>
    <p class="experience-result"><strong>结果</strong> {{ entry.result }}</p>
    <button v-if="entry.id === 'saas'" class="text-button" type="button" data-open="saas" @click="openProject('saas', $event)">查看参与模块与验证记录 →</button>
  </article>
</div>
<aside class="side-column">
<section class="education">
<p class="eyebrow">教育经历</p>
<h3>大连科技学院</h3>
<p class="degree">软件工程 · 本科（全日制）</p>
<p class="education-time">2021 — 2025</p>
<div class="education-courses">
<span>相关课程</span>
<p>Web、软件项目管理、人工智能</p>
</div>
</section>
<section class="skills">
<p class="eyebrow">常用技术</p>
<dl>
<div>
<dt>AI 应用</dt>
<dd>Agent 工具调用与评测 · RAG 检索和引用校验 · MCP · 提示注入防护 · 模型额度和用量计量</dd>
</div>
<div>
<dt>AI 开发</dt>
<dd>Claude Code · Codex · Claude Code hooks</dd>
</div>
<div>
<dt>后端与数据</dt>
<dd>Go · Python · TypeScript · PostgreSQL · Redis · SQLite · Kafka · HTTP API · gRPC · SSE · WebSocket</dd>
</div>
<div>
<dt>前端</dt>
<dd>React · Vue · Remotion</dd>
</div>
<div>
<dt>部署与运维</dt>
<dd>Vercel · Cloudflare · 腾讯云 · 阿里云 · Docker · Tailscale · GitHub Actions</dd>
</div>
</dl>
</section>
</aside>
</div>
</section>
<section class="about-band">
<div class="wrap about-grid">
<div>
<p class="eyebrow">关于我</p>
<h2>把问题讲清楚，<br>再把它做成东西。</h2>
</div>
<div>
<p>我是 xiuqiu。我的实践分布在后端系统、AI 工具、知识整理与代码创作之间。既关心功能如何落地，也关心别人怎样理解和使用它。</p>
<p>这个网站同时是一份简历和一座作品档案：你可以快速查看业务与工程案例，也可以走进那些来自兴趣的长期探索。每个项目都写明归属与验证范围。</p>
<p>我的个人项目用 Claude Code 和 Codex 辅助开发，由我负责需求、设计决策、验收和评测。</p>
</div>
</div>
</section>
<section class="wrap contact-section" id="contact">
<p class="eyebrow">联系我</p>
<div class="contact-main">
<h2>从一个具体的问题，<br>开始下一次交流。</h2>
<a class="contact-arrow" href="mailto:qianqiuquq@gmail.com" aria-label="发邮件给 xiuqiu"><span aria-hidden="true">↗</span></a>
</div>
<ul class="contact-topics">
<li><b>岗位</b>AI 应用 / Agent</li>
<li><b>岗位</b>AI 自动化 / 效能</li>
<li><b>岗位</b>AI 全栈</li>
<li><b>合作</b>工具、知识系统与交互作品</li>
</ul>
<div class="contact-links">
<a href="mailto:qianqiuquq@gmail.com">qianqiuquq@gmail.com <span aria-hidden="true">↗</span></a>
<a :href="githubProfileUrl" target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a>
<a href="https://x.com/Xiuqiu2211" target="_blank" rel="noopener noreferrer">X <span aria-hidden="true">↗</span></a>
</div>
</section>
</main>
<footer class="wrap footer">
<span>xiuqiu / Qiu</span>
<span>产品 · 工程 · 持续探索</span>
<router-link to="/radar">学习雷达</router-link>
<router-link to="/articles">工程笔记</router-link>
<a href="#resume-main">回到顶部 ↑</a>
</footer>

<dialog ref="dialog" id="project-dialog" aria-labelledby="project-dialog-title" @cancel.prevent="closeProject" @close="onDialogClose" @click="onBackdropClick" @keydown="onDialogKey">
  <div class="dialog-top">
<span id="dialog-kind">项目与作品 · {{ activeProject?.kindLabel }}</span>
<div class="dialog-actions">
    <button id="copy-link" type="button" :data-copied="copied || undefined" aria-label="复制本项目直达链接" @click="copyLink">{{ copyLabel }}</button>
    <button ref="closeButton" id="dialog-close" type="button" aria-label="关闭项目详情" @click="closeProject">关闭 ×</button>
  </div>
</div>
  <div id="dialog-body" ref="dialogBody">
    <div v-if="detailState === 'loading'" class="dialog-content" role="status" aria-busy="true">
<h2 id="project-dialog-title">正在打开项目…</h2>
</div>
    <div v-else-if="detailState === 'error'" class="dialog-content" role="alert">
<h2 id="project-dialog-title">项目详情暂时没能加载。</h2>
<p>请检查网络后重试。</p>
<button class="button secondary" @click="loadDetail">重新加载</button>
</div>
    <div v-else v-html="noteHtml">
</div>
  </div>
  <div class="dialog-bottom">
<button id="previous-project" type="button" @click="stepProject(-1)">← 上一项</button>
<span id="dialog-position">{{ activeIndex + 1 }} / {{ projects.length }}</span>
<button id="next-project" type="button" @click="stepProject(1)">下一项 →</button>
</div>
  <p class="dialog-keys" aria-hidden="true">← → 切换 · Esc 关闭</p>
</dialog>

</div>
</template>

<style src="../resume.css"></style>
