# AGENTS.md — xiuqiu-site

这份文件面向在本仓库工作的 AI 代理（Codex、Claude Code 等）和人类协作者。回复与文档使用简体中文，代码、命令、路径保持原样。

## 项目是什么

xiuqiu-site 是一个个人站点，正在从「作品集 + 工程证据」转向以 **AI + Web3 Radar 情报流** 为主。技术栈是 Vue 3 + Vite + vue-router，部署在 Vercel。

- 内容写在 `content/**` 的 Markdown 里，构建时生成 `src/data/generated*.ts` 和 `public/**` 下的静态产物。
- `api/` 下有少量 serverless 接口：`/api/chat`、Market Radar 的读接口，以及 Hermes 用的 outbox 接口。
- Market Radar 的采集、评分和 digest 引擎在 `market-radar/`，通知经 Hermes（`ops/hermes/`）发到微信。
- 正在进行的重构计划：以 Radar 信息流为首页，统一设计系统，代码按 feature 分目录。阶段划分见下文「重构路线」。

## 冻结契约

下面这些东西被外部系统按路径或名字依赖，包括 Codex 每日推送、Hermes、GitHub Actions、Vercel。**没有人工明确批准，不得修改它们的行为、路径或名称。**

- **内容 schema 和校验器**：`content/**` 的 frontmatter 格式，以及 `scripts/` 下的 `public-data-contracts`、`learning-radar-v2`、`market-radar-contracts`、`radar-publication-boundary`、`radar-notification-contracts`、`frontmatter`、`check-public`、`validate-knowledge`（均为 `.mjs`）。
- **生成产物的路径和格式**：`src/data/generated*.ts` 及各 `*Months/` 目录、`public/radar/{rss.xml,feed.json}`、`public/llms.txt`、`public/sitemap.xml`、`public/data/**`。历史的 `public/data/market-radar-packs/*.json` 一旦入库就不能再改。生成器内部可以重写，但输出必须保持兼容。
- **工作流**：`.github/workflows/*.yml` 的文件名、job 名（`verify`、`secrets` 是 `main` 的必需检查）、PR 文件白名单、分支前缀 `automation/daily-radar-*` 和 `automation/market-radar-YYYY-MM-DD`，以及对应的 workflow 测试。
- **HTTP 接口**：`api/**` 的文件路径就是 URL，路径和请求/响应 JSON 都不能变。outbox 的 Bearer token（`RADAR_DISPATCH_TOKEN` / `MARKET_RADAR_DISPATCH_TOKEN`）、lease 协议和 kind 白名单也不能变。
- **数据库和 worker**：`market-radar/migrations/*` 不能改名，也不能删可空列；`market-radar/worker/*` 和 `ops/hermes/*` 同样冻结。
- **命令和配置**：`package.json` 里被自动化调用的 script 名，包括 `generate:*`、`test:radar`、`test:market-radar`、`test:notifications`、`prepare:researchops`、`validate:radar`、`radar:publish-snapshots`、`market-radar:*`、`notifications:enqueue`、`verify:market-radar-production` 和 `build`；配置文件 `config/researchops-learning-radar.json`。
- **公开 URL**：已经进入 sitemap 的 URL 只能新增，或者加 redirect，不能直接删掉。
- **项目分类比例**：`docs/public-evidence-contract.md` 规定，公开项目里有 1 个 `current-product`、1 个 `current-direction`，其余都是 `historical-evidence`。

如果某个改动必须碰到上面的内容，**先停下来**，说明影响面和回滚方式，等人工确认后再动手。

## 目录约定

### 现状（重构完成前以此为准）

- 页面在 `src/pages/`，只有两个组件在 `src/components/`，样式分散在 `src/style.css` 和 `src/styles/*.css`。
- 页面取数目前有三种方式：直接 import `generated*.ts`、经过 `src/data/siteKnowledge.ts`、经过 `src/data/*Presentation.ts`。新代码优先用 `*Presentation.ts`。
- 新增页面逻辑（筛选、分组、格式化）写成 `*Presentation.ts` 里的纯函数，配 `node:test` 测试，不要直接写在 `.vue` 里。
- 不要再新增一份 `SITE_URL`、`escapeHtml` 或新的深色 token。确实需要时，先复用已有的定义。

### 目标（对应阶段落地后生效，届时更新本节）

- 目录分工：
  - `src/app/` 放外壳、路由和布局。
  - `src/design/` 放 `tokens.css`、`base.css` 和基础组件。
  - `src/features/<name>/` 放各功能模块的 `pages/`、`components/`、`data.ts`、`presentation.ts`。
- P4 起，页面只能 import 本 feature 的 `data.ts` / `presentation.ts` 和 `src/design/components`。
- P4 起，只有这三处可以 import `generated*.ts`：`features/*/data.ts`、`api/chat.ts`（经 `src/data/siteKnowledge.ts`）、`scripts/`。
- P3 起，颜色、间距、字号只能用 `src/design/tokens.css` 里的变量，页面里不要写新的色值。
- P2 起，站点常量和转义函数统一从 `shared/site.ts` 取，不要再复制一份 `SITE_URL` 或 `escapeHtml`。

### 任何时候都适用

- 生成文件不要手改。要改就改生成器，然后运行 `npm run generate:content`，并提交重新生成的产物。

## 常用命令

- `npm ci`：安装依赖。CI 和每日门禁用 Node 22，`release-controller.yml` 里有一步用 Node 24。
- `npm run dev`：本地开发。
- `npm run build`：包含全部测试、内容生成、公开安全检查、类型检查、vite build、meta 页面生成和体积预算检查，是提交前的唯一准绳。
- 单项检查：
  - `npm run test:radar`、`npm run test:market-radar`、`npm run test:notifications`、`npm run test:home`、`npm run test:quality`
  - `npm run test:contracts`：冻结契约快照。
  - `npm run check:public`：公开内容安全检查。
  - `npm run check:budget`：chunk 体积预算检查。

## 每日自动化（Codex / ResearchOps）

- **Learning Radar**：
  - 按 `docs/learning-radar-researchops.md` 执行。每期 2 条 AI、2 条 Web3、1 个专题；任一栏不足，整期停止，不用低质量内容凑数。
  - 每条 brief 至少要有一个带发布时间的 Tier 1 事件来源，专题必须含 Tier 1 来源。AI Hot、社区和社交内容只用来发现线索，最终引用必须回到原始来源。
  - 分支名 `automation/daily-radar-YYYY-MM-DD`，只改 `daily-radar.yml` 白名单内的文件。
  - 非草稿 PR 会触发自动合并。PR 要不要从草稿转成正式，以 researchops 文档写的当前阶段为准（目前是 M1：只建 Draft PR，合并要另外授权）。
- **Market Radar**：按 `docs/market-radar-researchops.md` 执行。只写事实、观察点和失效条件，不给交易方向。
- 新增生成产物时，要同步更新三处：对应 workflow 的文件白名单、"generated data committed" 检查，以及 workflow 测试。
- 网站发布、数据库写入和微信通知是三个独立状态。通知失败不回滚已经发布的页面。`LEARNING_RADAR_ENABLED` 和 `MARKET_RADAR_ENABLED` 这两个开关只能由人工改。

## 改动要求

- **提交粒度**：小步提交，一个 PR 只做一件事。
- **构建**：`npm run build` 必须全绿。不要放宽 `check:budget`；确实需要放宽时，在 PR 说明里写清理由。
- **测试**：
  - 新功能和 bug 修复要配 `node:test` 行为测试，测 `presentation.ts`、`data.ts`、生成器和接口的输入输出。
  - 不要再新增"用正则匹配 `.vue` 源码"的测试。迁移页面时，把它原有的这类断言换成行为测试。
  - 不引入新的测试框架或运行时依赖。确实需要新依赖时，固定版本，并在 PR 中说明。
- **UI 检查**：UI 改动要在 `vite preview` 里检查桌面宽度和 375px 宽度，确认没有横向溢出、焦点可见、触控目标不小于 44px，并且加载、空和错误三种状态都能正常显示。
- **安全**：不得提交 `.env*`、密钥、钱包地址、私有服务源码或本机路径，`check-public` 会拦截。
- **分支与发布**：
  - 不要直接推送到 `main`，用 `feat/*`、`fix/*`、`refactor/*` 分支开 PR。
  - 生产发布只走 `release-controller.yml`；Vercel 的 Git 自动部署保持关闭。
- **公开文案**：
  - 不夸大。历史证据不能包装成当前产品，模拟实验不能说成生产经验。
  - 自动汇总的内容要标注"未经人工复核"；市场内容不构成投资建议。

## 重构路线（每个阶段一个 PR，上一阶段全绿后再进下一阶段）

1. **P0 基线**（已完成）：`npm run test:contracts` 对比 `config/contract-snapshot.json`，锁定 `api/` 路由、workflow、迁移、校验器、被自动化调用的 script，以及 `content/` 未变时的全部生成产物。有意改动冻结契约时，经人工批准后运行 `node scripts/contract-snapshot.mjs --write`，让基线的 diff 进入评审。
2. **P1 清理**（已完成）：删除 Content Catalog Preview 整套代码、`article-catalog-shadow/` 和未引用的 `src/styles/ai-overview.css`。`ci.yml` 的 job 名保持不变。
3. **P2 共享库**：抽出 `shared/site.ts` 和 `scripts/lib/`；两组 outbox 路由改用同一个 handler 工厂，接口不变。
4. **P3 设计系统**：建立 tokens 和基础组件，先迁移 Radar 页面族。
5. **P4 架构迁移**：页面搬进 `src/features/*`，统一经各自的 `data.ts` 取数。
6. **P5 情报流与信息架构**：
   - 统一的 `IntelItem` 数据结构，learning 和 market 两类内容都归一到它。
   - `/` 改为信息流首页，新增 `/topics/:topic` 主题页、静态 API `public/data/intel/*` 和新导航。
   - 旧 URL 加 redirect。
7. **P6 其余页面**：articles、projects、proof、ai、about 迁到新设计系统，删除旧 CSS，收紧 CSS 预算。
8. **P7（可选）**：用预渲染替代客户端 SEO 和 `generate-meta-pages.mjs`。
