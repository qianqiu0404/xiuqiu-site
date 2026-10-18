# xiuqiu-site

[Live site](https://xiuqiu-site.vercel.app) · [学习雷达 RSS](https://xiuqiu-site.vercel.app/radar/rss.xml)

以 AI + Web3 Radar 情报流为首页的个人站点，同时保留作品集与工程证据。

当前只把 Qiu Market 作为产品呈现；Wallet Infrastructure 是当前钱包后端学习与工程证据方向，仍处于学习、私有基线审计与最小失败证据阶段，不把历史材料或模拟实验包装成当前实现、生产钱包或真实资金经验。历史公开模拟与交付记录仍作为可追溯证据保留，例如 [Wallet Reliability Lab](https://wallet-reliability-lab.vercel.app) 和 [Wallet Domain Engine](https://github.com/qianqiu0404/web3-wallet-engineer-lab)；它们不定义当前产品优先级。

> 在本仓库工作的 AI 代理与协作者请先读 [`AGENTS.md`](AGENTS.md)：冻结契约、目录约定、改动要求和重构路线都在那里。

## 功能

- 情报流首页：学习雷达每日简报（2 条 AI、2 条 Web3、1 个专题）+ 市场雷达事件 + 趋势回顾，支持领域、主题筛选与搜索，显示距上次更新多久。
- 订阅出口：RSS、JSON Feed、`llms.txt` 和静态 JSON API，构建时生成。
- 交易雷达：静态、有来源的市场研究快照，另有写入 Neon 的影子引擎和读接口。
- 公开证据：Qiu Market = `current-product / evidence-ready`，Wallet Infrastructure = `current-direction / locked`，其余六项只作为 `historical-evidence`。
- 站内 xiuqiu AI：只检索公开知识层。
- 通知：经 Hermes 从 outbox 领取消息发到微信。

### 主要页面

| 路由 | 内容 |
| --- | --- |
| `/` | 情报流首页 |
| `/topics/:topic` | 主题页：某个主题的全部历史条目 |
| `/radar`、`/radar/:date`、`/radar/week/:week` | 学习雷达信息流、日报阅读器、人工复核周报 |
| `/radar/review/:period` | 趋势回顾：多周的趋势线、信号与里程碑 |
| `/market-radar`、`/market-radar/:date`、`/market-radar/events/:id` | 交易雷达快照与事件（不连接账户，不下单） |
| `/projects`、`/projects/:project` | 项目图谱与项目详情 |
| `/engineering`、`/engineering/failures`、`/engineering/evidence` | 工程证据与失败恢复手册 |
| `/ai`、`/ai/deliveries`、`/ai/deliveries/:slug`、`/ai/social-research` | AI 协作与交付记录 |
| `/about`、`/now`、`/learning`、`/articles`、`/articles/:slug` | 关于、当前动态、学习记录、工程笔记 |

订阅出口：`/radar/rss.xml`、`/radar/feed.json`、`/llms.txt`、`/data/intel/latest.json`、`/data/intel/topics.json`，格式见 [`docs/public-feeds.md`](docs/public-feeds.md)。

## 技术栈

- 前端：Vue 3 + Vite + vue-router，TypeScript（`vue-tsc` 类型检查）
- 接口：Vercel serverless（`api/`），数据库为 Neon（`@neondatabase/serverless`）
- 内容：Markdown + frontmatter，由 `scripts/generate-*.mjs`（Node.js）生成数据
- 测试：Node 内置 `node:test`
- 自动化：GitHub Actions；通知侧 Hermes 插件为 Python（`ops/hermes/`）

## 快速开始

### 环境要求

- Node.js 22（CI 使用 22；`release-controller.yml` 中有一步使用 Node 24）
- npm（使用 `package-lock.json`）

### 安装与运行

```bash
npm ci
npm run dev        # 先生成内容数据，再启动 vite
npm run preview    # 预览 vite build 产物
```

本地开发和构建不需要任何环境变量。`.env.example` 只列变量名和安全默认值，真实值不提交到仓库。

### 测试

```bash
npm run test:radar
npm run test:market-radar
npm run test:notifications
npm run test:home
npm run test:quality
npm run test:contracts     # 冻结契约快照，对比 config/contract-snapshot.json
npm run check:public       # 公开内容安全检查
npm run check:links        # 作品集外链检查（需要网络）
```

### 构建

```bash
npm run build
```

`build` 依次执行全部测试、内容生成、sitemap、知识层与公开安全检查、API 类型检查、`vue-tsc` + `vite build`、meta 页面生成、质量测试和体积预算（`check:budget`），是提交前的唯一准绳。只需前端构建时可用 `npm run build:vite`。

内容改动后运行 `npm run generate:content` 并提交重新生成的产物；生成文件不要手改。需要 Obsidian 显式公开覆盖时运行 `npm run sync:obsidian-public`（需 `OBSIDIAN_VAULT_PATH`）。

### 环境变量

只在 Vercel / GitHub 中配置，不提交到仓库。

| 位置 | 变量 | 用途 |
| --- | --- | --- |
| Vercel | `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL` | 站内 AI |
| Vercel | `MARKET_RADAR_DATABASE_URL`、`RADAR_DISPATCH_TOKEN`（兼容旧名 `MARKET_RADAR_DISPATCH_TOKEN`） | 交易雷达读接口与 outbox |
| GitHub secrets | `MARKET_RADAR_DATABASE_URL`、`DEEPSEEK_API_KEY`、`SEC_USER_AGENT` | 定时 worker |
| GitHub `production-release` 环境 | `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`（后两者也可放 variables）、`LEARNING_RADAR_DATABASE_URL` | 发布控制器 |
| GitHub variables | `LEARNING_RADAR_ENABLED`、`MARKET_RADAR_ENABLED`、`MARKET_RADAR_AUTOMATION_READY`、`DEEPSEEK_MODEL` | 人工开关，默认关闭 |
| worker | `QIU_MARKET_BASE_URL` | Qiu Market 健康检查 |

Hermes 只在本机密钥环境中保存 dispatch token 与微信通道配置，微信凭据不进入 Vercel 或 GitHub。

## 目录结构

```text
api/                 Vercel serverless 接口，文件路径即 URL
  chat.ts            POST /api/chat，站内 AI（转发 DeepSeek）
  market-radar/      交易雷达读接口、feedback、outbox
  radar/outbox/      学习雷达通知 outbox（claim / ack，需 Bearer token）
lib/                 接口共享逻辑：market-radar 数据访问、outbox handler 工厂
shared/site.ts       站点常量与转义函数
src/
  features/<name>/   intel、market-radar、projects、articles、proof、ai、about；pages/ + data.ts
  design/            设计 token（tokens.css）、外壳与 brief 样式、基础组件
  data/              生成数据 generated*.ts 与 *Presentation.ts 纯函数
  router/            路由
content/             Markdown 内容（frontmatter 即数据），含 radar、market-radar、radar-reviews、projects 等
scripts/             生成器、校验器和 node:test 测试
market-radar/        交易雷达引擎：migrations/ 与 worker/（采集、评分、digest、outbox）
ops/hermes/          Hermes 微信通知插件与调度脚本
config/              契约快照与学习雷达 ResearchOps 配置
public/              静态资源与生成的 sitemap、RSS、JSON Feed、data/
docs/                流程与契约文档
```

## 部署与自动化

- 生产发布只走 [`release-controller.yml`](.github/workflows/release-controller.yml)：精确 SHA、先迁移数据库、Vercel 候选验证后再提升，见 [`docs/release-controller.md`](docs/release-controller.md)。`vercel.json` 关闭了 Vercel 的 Git 自动部署（包括 PR Preview）。
- [`ci.yml`](.github/workflows/ci.yml)（Site CI）：`npm ci` → `test:radar` → `build` → `check:public` → `check:links`，并检查生成数据已提交；CI 用 gitleaks 扫描 Git 历史中的密钥。
- 学习雷达：每日由 ResearchOps 流程产出，分支 `automation/daily-radar-YYYY-MM-DD`，经 [`daily-radar.yml`](.github/workflows/daily-radar.yml) 白名单门禁后合并，见 [`docs/learning-radar-researchops.md`](docs/learning-radar-researchops.md)。
- 交易雷达：静态快照 PR（`automation/market-radar-YYYY-MM-DD`）走 [`static-market-radar.yml`](.github/workflows/static-market-radar.yml)；影子引擎 worker 由 [`market-radar.yml`](.github/workflows/market-radar.yml) 定时运行（`npm run market-radar:worker`），见 [`docs/market-radar-researchops.md`](docs/market-radar-researchops.md)。
- 静态快照与数据库共用同一个不可变 `snapshotId`，见 [`docs/radar-publication-boundary.md`](docs/radar-publication-boundary.md)。
- 网站发布、数据库写入和微信通知是三个独立状态，通知失败不回滚已发布页面。

## 当前状态

- site-2.0 重构 P0–P6 已完成：契约快照基线、清理、共享库、设计系统（纸感研究简报，浅色默认、深色跟随系统）、页面迁入 `src/features/*`、情报流首页与主题页、其余页面迁移。P7（用预渲染替代 `generate-meta-pages.mjs`）为可选项，尚未开始。
- 学习雷达 2026-08-14 至 2026-10-12 停更，由趋势回顾 `content/radar-reviews/2026-08-14--2026-10-13.md` 覆盖；2026-10-13 起恢复每日发布。仍处于 M1：每日 PR 以 Draft 建立，合并需另行授权。
- 学习雷达微信通知未开启（`LEARNING_RADAR_ENABLED=false`，M4 完成前不发送）。

## 边界与安全

- 公开仓库不包含私有钱包服务的源码、地址或配置；历史证据不包装成当前产品，模拟实验不说成生产经验。公开项目的 `publicRole` × `claimState` 规则见 [`docs/public-evidence-contract.md`](docs/public-evidence-contract.md)。
- `/market-radar` 是研究快照，不连接持仓、钱包或券商账户，不下单，也不构成投资建议。影子引擎失败不会覆盖已审核的静态快照。
- 站内 AI 只读取公开知识层（`src/data/siteKnowledge.ts`），不读取私有仓库或 Obsidian 原文；运行日志不记录提问内容；内存限流只是单实例的尽力保护。
- 本机绝对路径、类凭据值和私有 Git remote 会被 `npm run check:public` 拦截。

## 相关文档

- [`AGENTS.md`](AGENTS.md)：协作约定与冻结契约
- [`docs/README.md`](docs/README.md)：文档索引
- [`ops/hermes/README.md`](ops/hermes/README.md)：Hermes 通知

## 许可

源代码使用 MIT 许可（[LICENSE](LICENSE)）。`content/` 下的原创文字与内容默认使用 CC BY-NC-SA 4.0，另有说明的文件除外。见 [NOTICE.md](NOTICE.md) 和 [content/LICENSE.md](content/LICENSE.md)。
