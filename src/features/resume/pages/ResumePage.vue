<script setup lang="ts">
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
<router-link to="/intel">雷达与文章 ↗</router-link>
</nav>
<button id="theme-toggle" type="button" :aria-label="dark ? '切换为浅色外观' : '切换为深色外观'" @click="toggleTheme">{{ dark ? '浅色' : '深色' }}</button>
</div>
</header>
<main id="resume-main" tabindex="-1">
<section class="wrap hero">
<div class="hero-copy">
<p class="eyebrow">HELLO, I’M</p>
<h1>xiuqiu<span>/ Qiu</span>
</h1>
<p class="role">后端与全栈 · AI 应用 · Web3 工程</p>
<h2>写系统，也做工具。<br>把好奇心，变成可以体验的作品。</h2>
<p class="intro">从 AI 客服、交易与钱包工程，<br class="desktop-br">到本机工具、知识系统和代码影像。</p>
<dl class="hero-facts">
<div>
<dt>教育</dt>
<dd>大连科技学院 · 软件工程本科 · 2021—2025</dd>
</div>
<div>
<dt>常用</dt>
<dd>Go · Python · TypeScript · PostgreSQL</dd>
</div>
<div>
<dt>作品</dt>
<dd>29 条记录 · 8 个精选 · 按真实归属标注</dd>
</div>
</dl>
<div class="hero-actions">
<a class="button primary" href="#selected">从精选作品开始 ↓</a>
<a class="button secondary" href="#catalog">浏览完整目录 · 29 项 ↗</a>
</div>
<div class="social-links">
<a href="mailto:qianqiuquq@gmail.com">邮箱 ↗</a>
<a href="https://github.com/xoqiu09" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
<a href="https://x.com/Xiuqiu2211" target="_blank" rel="noopener noreferrer">X ↗</a>
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
<p class="eyebrow" id="tracks-title">三条阅读路线 / READ BY FOCUS</p>
<p>按你关心的方向，直接打开对应作品。</p>
</div>
<div class="track-grid">
<article class="track">
<p class="track-head">
<b>A</b>
<span>AI 应用 · 全栈</span>
</p>
<p class="track-desc">模型接入、检索与引用、Agent 工具，以及从后端到界面的完整产品。</p>
<ul class="track-chips">
<li>
<button type="button" data-open="saas" @click="openProject('saas', $event)">Agent SaaS · 智能客服<em>团队参与</em>
</button>
</li>
<li>
<button type="button" data-open="xiaomao" @click="openProject('xiaomao', $event)">小猫 Agent / xiaomao-agent</button>
</li>
<li>
<button type="button" data-open="qai" @click="openProject('qai', $event)">QAI</button>
</li>
<li>
<button type="button" data-open="wildheart" @click="openProject('wildheart', $event)">知识地图</button>
</li>
</ul>
</article>
<article class="track">
<p class="track-head">
<b>B</b>
<span>后端 · Web3 工程</span>
</p>
<p class="track-desc">撮合与账本、日志恢复与回放、钱包链路和合约实验。</p>
<ul class="track-chips">
<li>
<button type="button" data-open="miniexchange" @click="openProject('miniexchange', $event)">mini-exchange</button>
</li>
<li>
<button type="button" data-open="qiumarket" @click="openProject('qiumarket', $event)">Qiu Market</button>
</li>
<li>
<button type="button" data-open="reliability" @click="openProject('reliability', $event)">Wallet Reliability Lab</button>
</li>
<li>
<button type="button" data-open="stableflow" @click="openProject('stableflow', $event)">StableFlow</button>
</li>
</ul>
</article>
<article class="track">
<p class="track-head">
<b>C</b>
<span>项目合作</span>
</p>
<p class="track-desc">本机工具、信息产品、知识系统与代码影像，可以从一个具体问题开始。</p>
<ul class="track-chips">
<li>
<button type="button" data-open="steward" @click="openProject('steward', $event)">Session Steward · 小镇</button>
</li>
<li>
<button type="button" data-open="radar" @click="openProject('radar', $event)">Learning Radar</button>
</li>
<li>
<button type="button" data-open="studio" @click="openProject('studio', $event)">Qiu Studio / 代码短视频工作室</button>
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
<p class="eyebrow">01 / SELECTED WORK</p>
<h2>先从这些作品认识我。</h2>
</div>
<a href="#catalog">全部项目与经历 <span>29</span> ↓</a>
</div>
<div class="selected-grid">
<article class="selected-card">
<button class="project-image visual-steward" data-open="steward" @click="openProject('steward', $event)" aria-label="查看Session Steward · 小镇详情">
<img src="/resume/steward-final-daily.jpg" alt="小镇终版体验设计，使用演示数据" loading="lazy" decoding="async">
<span>终版体验设计 · 演示数据</span>
<i aria-hidden="true">↗</i>
</button>
<div class="card-meta">
<div>
<span class="kind kind-personal">个人作品</span>
<span>工具与产品</span>
</div>
<span>01 / 08</span>
</div>
<h3>
<button data-open="steward" @click="openProject('steward', $event)">Session Steward · 小镇<span aria-hidden="true">↗</span>
</button>
</h3>
<p>给 Claude Code 和 Codex 用户的本机项目进展台。看进展、找卡点，也知道下一步由谁处理。</p>
<p class="card-status">公开 App 与设计原型分开展示</p>
</article>
<article class="selected-card">
<button class="project-image visual-xiaomao" data-open="xiaomao" @click="openProject('xiaomao', $event)" aria-label="查看小猫 Agent / xiaomao-agent详情">
<img src="/resume/xiaomao.svg" alt="小猫进度秘书流程示意" loading="lazy" decoding="async">
<span>流程示意</span>
<i aria-hidden="true">↗</i>
</button>
<div class="card-meta">
<div>
<span class="kind kind-personal">个人作品</span>
<span>工具与产品</span>
</div>
<span>02 / 08</span>
</div>
<h3>
<button data-open="xiaomao" @click="openProject('xiaomao', $event)">小猫 Agent / xiaomao-agent<span aria-hidden="true">↗</span>
</button>
</h3>
<p>把每天的代码变化与项目进展，写成看得懂的白话晚报。</p>
<p class="card-status">本机已部署 · 有近期产物</p>
</article>
<article class="selected-card">
<button class="project-image visual-saas" data-open="saas" @click="openProject('saas', $event)" aria-label="查看Agent SaaS · 智能客服详情">
<div class="project-diagram">
<small>AGENT SAAS / 业务应用</small>
<strong>知识，进入对话。</strong>
<ol>
<li>
<b>01</b>资料与检索</li>
<li>
<b>02</b>模型与引用</li>
<li>
<b>03</b>业务与回复</li>
</ol>
<p>团队项目 · 本人参与模块</p>
</div>
<i aria-hidden="true">↗</i>
</button>
<div class="card-meta">
<div>
<span class="kind kind-team">团队业务 · 本人参与</span>
<span>业务经历</span>
</div>
<span>03 / 08</span>
</div>
<h3>
<button data-open="saas" @click="openProject('saas', $event)">Agent SaaS · 智能客服<span aria-hidden="true">↗</span>
</button>
</h3>
<p>把模型、知识检索与微信回复连接到多租户业务。</p>
<p class="card-status">团队业务项目 · 本人参与模块</p>
</article>
<article class="selected-card">
<button class="project-image visual-qiumarket" data-open="qiumarket" @click="openProject('qiumarket', $event)" aria-label="查看Qiu Market详情">
<div class="project-diagram">
<small>QIU MARKET / 数据与产品</small>
<strong>从行情，走向系统。</strong>
<ol>
<li>
<b>01</b>来源与新鲜度</li>
<li>
<b>02</b>订单与撮合</li>
<li>
<b>03</b>账本与恢复</li>
</ol>
<p>虚拟资金 · 不连接真实账户</p>
</div>
<i aria-hidden="true">↗</i>
</button>
<div class="card-meta">
<div>
<span class="kind kind-personal">个人作品</span>
<span>系统与 Web3</span>
</div>
<span>04 / 08</span>
</div>
<h3>
<button data-open="qiumarket" @click="openProject('qiumarket', $event)">Qiu Market<span aria-hidden="true">↗</span>
</button>
</h3>
<p>聚合市场信息，用虚拟资金体验交易与资产变化。</p>
<p class="card-status">有部署入口 · 数据待核对</p>
</article>
<article class="selected-card">
<button class="project-image visual-miniexchange" data-open="miniexchange" @click="openProject('miniexchange', $event)" aria-label="查看mini-exchange详情">
<div class="project-diagram">
<small>MINI EXCHANGE / 系统工程</small>
<strong>确定性，也要可恢复。</strong>
<ol>
<li>
<b>01</b>撮合与账本</li>
<li>
<b>02</b>日志与重放</li>
<li>
<b>03</b>只读诊断</li>
</ol>
<p>个人工程 · 非生产交易系统</p>
</div>
<i aria-hidden="true">↗</i>
</button>
<div class="card-meta">
<div>
<span class="kind kind-personal">个人作品</span>
<span>系统与 Web3</span>
</div>
<span>05 / 08</span>
</div>
<h3>
<button data-open="miniexchange" @click="openProject('miniexchange', $event)">mini-exchange<span aria-hidden="true">↗</span>
</button>
</h3>
<p>从撮合与账本，到日志恢复和只读诊断，把正确性做成可检查的证据。</p>
<p class="card-status">核心阶段实现 · 诊断待改进</p>
</article>
<article class="selected-card">
<button class="project-image visual-qai" data-open="qai" @click="openProject('qai', $event)" aria-label="查看QAI详情">
<div class="project-diagram">
<small>QAI / 开发者工具</small>
<strong>让每次调用，有账可查。</strong>
<ol>
<li>
<b>01</b>准入与配额</li>
<li>
<b>02</b>请求与用量</li>
<li>
<b>03</b>审计与恢复</li>
</ol>
<p>v0.1 · 限定阶段验证</p>
</div>
<i aria-hidden="true">↗</i>
</button>
<div class="card-meta">
<div>
<span class="kind kind-personal">个人作品</span>
<span>工具与产品</span>
</div>
<span>06 / 08</span>
</div>
<h3>
<button data-open="qai" @click="openProject('qai', $event)">QAI<span aria-hidden="true">↗</span>
</button>
</h3>
<p>为独立 Key 管理 Token 配额、用量账本、并发与异常恢复。</p>
<p class="card-status">v0.1 限定阶段验证</p>
</article>
<article class="selected-card">
<button class="project-image visual-wildheart" data-open="wildheart" @click="openProject('wildheart', $event)" aria-label="查看知识地图详情">
<img src="/resume/knowledge-map.svg" alt="知识地图的虚构结构示意：示例资料、概念、阅读笔记与时间线，不包含真实资料" loading="lazy" decoding="async">
<i aria-hidden="true">↗</i>
</button>
<div class="card-meta">
<div>
<span class="kind kind-private">个人作品 · 私有</span>
<span>知识与数据</span>
</div>
<span>07 / 08</span>
</div>
<h3>
<button data-open="wildheart" @click="openProject('wildheart', $event)">知识地图<span aria-hidden="true">↗</span>
</button>
</h3>
<p>把零散资料、概念与笔记，连成可以回看的知识结构。</p>
<p class="card-status">私有项目 · 仅展示方法与示意</p>
</article>
<article class="selected-card">
<button class="project-image visual-qiwu" data-open="qiwu" @click="openProject('qiwu', $event)" aria-label="查看庄子 · 代码影像详情">
<img class="portrait-cover" src="/resume/qiwu-cover.png" alt="既有齐物论作品封面" loading="lazy" decoding="async">
<span>代码影像 · 封面</span>
<i aria-hidden="true">↗</i>
</button>
<div class="card-meta">
<div>
<span class="kind kind-personal">个人作品</span>
<span>影像与交互</span>
</div>
<span>08 / 08</span>
</div>
<h3>
<button data-open="qiwu" @click="openProject('qiwu', $event)">庄子 · 代码影像<span aria-hidden="true">↗</span>
</button>
</h3>
<p>从原文、脚本到镜头，用程序构建一段可观看的思考。</p>
<p class="card-status">已有作品片段</p>
</article>
</div>
</section>
<section class="catalog-section" id="catalog">
<div class="wrap">
<div class="section-heading">
<div>
<p class="eyebrow">02 / THE FULL COLLECTION</p>
<h2>完整项目目录 <sup>29</sup>
</h2>
</div>
<p>原作品集 25 项记录 + 4 项补充案例。<br>个人作品、团队业务、学习实验与历史资料分别标注。</p>
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
<button type="button" data-category-filter="all" :aria-pressed="category === 'all'" @click="setCategory('all')">全部 <span>29</span>
</button>
<button type="button" data-category-filter="product" :aria-pressed="category === 'product'" @click="setCategory('product')">工具与产品 <span>6</span>
</button>
<button type="button" data-category-filter="business" :aria-pressed="category === 'business'" @click="setCategory('business')">业务经历 <span>2</span>
</button>
<button type="button" data-category-filter="engineering" :aria-pressed="category === 'engineering'" @click="setCategory('engineering')">系统与 Web3 <span>7</span>
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
<p class="eyebrow">03 / EXPERIENCE & EDUCATION</p>
<h2>业务里的实践，作品背后的基础。</h2>
</div>
</div>
<div class="experience-grid">
<div class="experience-list">
<article class="experience-row">
<div class="experience-head">
<span class="kind kind-team">团队业务 · 本人参与</span>
<span class="experience-when">公司与任职时间待补充</span>
</div>
<h3>Agent SaaS · 智能客服与知识库</h3>
<p class="experience-lead">面向企业租户的智能客服与微信回复场景。</p>
<ul>
<li>参与资料上传、知识库关联、会话试聊、知识检索与答案引用链路，复用现有模型授权与知识服务。</li>
<li>围绕租户、用户、客服与知识库约束数据访问，处理权限变化、资料删除、无命中与引用校验。</li>
<li>参与微信自动回复任务执行：租约领取、幂等、额度预占与发送前检查。</li>
</ul>
<p class="experience-tags">Go · PostgreSQL · 检索增强 · 多租户权限</p>
<p class="experience-scope">验证以本地交付链路与模拟微信为界，不含真实微信发送或线上规模数据。</p>
<button class="text-button" type="button" data-open="saas" @click="openProject('saas', $event)">查看参与模块与验证记录 →</button>
</article>
<article class="experience-row">
<div class="experience-head">
<span class="kind kind-team">团队业务 · 本人参与</span>
<span class="experience-when">公司与任职时间待补充</span>
</div>
<h3>The AI · 后端与管理后台</h3>
<p class="experience-lead">围绕内容与学习的产品，关注数据、权限与运营体验。</p>
<ul>
<li>课程与小册的内容访问管理，以及相关 API 契约。</li>
<li>管理后台的编辑与配置体验，包括富文本编辑器选择范围与中文输入问题。</li>
<li>整理运营说明与发布交接，让配置、保存和结果检查更清楚。</li>
</ul>
<p class="experience-tags">后端 · 管理后台 · 接口契约</p>
<p class="experience-scope">团队产品；各项变更的线上状态以实际发布为准。</p>
<button class="text-button" type="button" data-open="theai" @click="openProject('theai', $event)">查看本人参与范围 →</button>
</article>
<p class="resume-note">正式任职公司、岗位与起止时间待本人确认后补入；当前按业务项目与本人参与模块展示。</p>
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
<dt>后端与数据</dt>
<dd>Go · PostgreSQL · SQLite · Python</dd>
</div>
<div>
<dt>AI 应用</dt>
<dd>检索增强与引用 · 模型接入 · Agent 工具调用 · 评测用例</dd>
</div>
<div>
<dt>Web3</dt>
<dd>Solidity · Foundry · EIP-712 · 测试网钱包链路</dd>
</div>
<div>
<dt>前端与交互</dt>
<dd>Vue · React · TypeScript · Three.js · Swift</dd>
</div>
</dl>
<p class="skills-note">按作品与业务记录整理，具体深度见各项目详情。</p>
</section>
</aside>
</div>
</section>
<section class="about-band">
<div class="wrap about-grid">
<div>
<p class="eyebrow">A LITTLE ABOUT ME</p>
<h2>把问题讲清楚，<br>再把它做成东西。</h2>
</div>
<div>
<p>我是 xiuqiu。我的实践分布在后端系统、AI 工具、知识整理与代码创作之间。既关心功能如何落地，也关心别人怎样理解和使用它。</p>
<p>这个网站同时是一份简历和一座作品档案：你可以快速查看业务与工程案例，也可以走进那些来自兴趣的长期探索。每个项目都写明归属与验证范围。</p>
</div>
</div>
</section>
<section class="wrap contact-section" id="contact">
<p class="eyebrow">LET’S CONNECT</p>
<div class="contact-main">
<h2>从一个具体的问题，<br>开始下一次交流。</h2>
<a class="contact-arrow" href="mailto:qianqiuquq@gmail.com" aria-label="发邮件给 xiuqiu">↗</a>
</div>
<ul class="contact-topics">
<li>
<b>岗位</b>AI 应用 / 全栈</li>
<li>
<b>岗位</b>后端 / Web3 工程</li>
<li>
<b>合作</b>工具、知识系统与交互作品</li>
</ul>
<div class="contact-links">
<a href="mailto:qianqiuquq@gmail.com">qianqiuquq@gmail.com ↗</a>
<a href="https://github.com/xoqiu09" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
<a href="https://x.com/Xiuqiu2211" target="_blank" rel="noopener noreferrer">X ↗</a>
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
