# xiuqiu-site

[Live site](https://xiuqiu-site.vercel.app) · [学习雷达 RSS](https://xiuqiu-site.vercel.app/radar/rss.xml)

xiuqiu-site 是一个个人站点，正在从「作品集 + 工程证据」转向以 **AI + Web3 Radar 情报流** 为主：每天整理 2 条 AI、2 条 Web3 工程简报和 1 个专题，并提供信息流、主题筛选、搜索与 RSS / JSON Feed 订阅。

站点同时保留 Qiu Market、Wallet Infrastructure 与 AI Engineering 的公开证据。当前只把 Qiu Market 作为产品呈现；Wallet Infrastructure 是当前钱包后端学习与工程证据方向，仍处于学习、私有基线审计与最小失败证据阶段，不把历史材料或模拟实验包装成当前实现、生产钱包或真实资金经验。

历史公开模拟与交付记录仍作为可追溯证据保留，例如 [Wallet Reliability Lab](https://wallet-reliability-lab.vercel.app) 和 [Wallet Domain Engine](https://github.com/qianqiu0404/web3-wallet-engineer-lab)；它们不定义当前产品优先级。

> 在本仓库工作的 AI 代理与协作者请先读 [`AGENTS.md`](AGENTS.md)：冻结契约、目录约定、改动要求和重构路线都在那里。

## 主要页面

| 路由 | 内容 |
| --- | --- |
| `/` | 情报流首页：学习雷达简报 + 市场雷达事件 + 趋势回顾，按领域、主题筛选与搜索，显示距上次更新多久 |
| `/topics/:topic` | 主题页：某个主题的全部历史条目 |
| `/radar` | 学习雷达：最新一期简报 + 按日期分组的信息流，支持 AI / Web3、主题筛选与搜索 |
| `/radar/:date`、`/radar/week/:week` | 日报阅读器、人工复核周报 |
| `/market-radar` | 交易雷达：静态、有来源的市场研究快照（不连接账户，不下单） |
| `/projects`、`/projects/:slug` | 项目图谱与项目详情 |
| `/engineering/*`、`/ai/*` | 工程证据、失败恢复手册、AI 协作交付记录 |
| `/about`、`/now`、`/articles` | 关于（原首页）、当前动态、工程笔记 |
| `/radar/review/:period` | 趋势回顾：多周的趋势线、信号与里程碑 |

订阅出口（构建时生成的静态文件）：`/radar/rss.xml`、`/radar/feed.json`、`/llms.txt`、`/data/intel/latest.json`、`/data/intel/topics.json`，格式见 [`docs/public-feeds.md`](docs/public-feeds.md)。

## 架构

- **内容**：`content/**` 下的 Markdown（frontmatter 即数据），包括 `articles`、`projects`、`radar`、`market-radar`、`evidence`、`deliveries`、`failure-cases`、`learning`、`now`；`content/obsidian-public/*.json` 是从 Obsidian 显式 `publish: true` 字段导出的可选覆盖层。
- **生成**：`scripts/generate-*.mjs` 校验内容并写出 `src/data/generated*.ts`（大数据按月拆分、懒加载）以及 `public/` 下的 sitemap、RSS、JSON Feed、`llms.txt` 和交易雷达研究包。
- **前端**：Vue 3 + Vite + vue-router，页面在 `src/pages/`，展示逻辑在 `src/data/*Presentation.ts`。
- **接口**（Vercel serverless，`api/` 的文件路径即 URL）：
  - `POST /api/chat`：站内 xiuqiu AI，只检索公开知识层（`src/data/siteKnowledge.ts`），转发到 DeepSeek。
  - `GET /api/market-radar/{summary,digests,events}`、`GET /api/market-radar/events/:id`、`POST /api/market-radar/feedback`：交易雷达影子引擎读接口。
  - `POST /api/{radar,market-radar}/outbox/{claim,ack}`：Hermes 领取 / 确认通知，需要 Bearer token。
- **Market Radar 引擎**：`market-radar/`（迁移、采集、评分、digest、outbox worker），写入 Neon 的独立 schema，由 GitHub Actions 定时运行。
- **通知**：`ops/hermes/` 从 outbox 领取已准备好的消息发到微信；Hermes 不调用上游数据源，也不持有其凭据。

## 命令

```bash
npm ci
npm run dev
npm run build            # 全部测试 + 内容生成 + 公开安全检查 + 类型检查 + vite build + 体积预算
npm run test:radar
npm run test:market-radar
npm run check:public
npm run sync:obsidian-public   # 仅在需要显式公开覆盖时，需 OBSIDIAN_VAULT_PATH
```

## 环境变量

只在 Vercel / GitHub 中配置，不提交到仓库；`.env.example` 只列名称和安全默认值。

| 位置 | 变量 | 用途 |
| --- | --- | --- |
| Vercel | `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL` | 站内 AI |
| Vercel | `MARKET_RADAR_DATABASE_URL`、`RADAR_DISPATCH_TOKEN`（兼容旧名 `MARKET_RADAR_DISPATCH_TOKEN`） | 交易雷达读接口与 outbox（启用影子引擎时） |
| GitHub secrets | `MARKET_RADAR_DATABASE_URL`、`DEEPSEEK_API_KEY`、`SEC_USER_AGENT` | 定时 worker |
| GitHub `production-release` 环境 | `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`（后两者也可放 variables）、`LEARNING_RADAR_DATABASE_URL` | 发布控制器 |
| GitHub variables | `LEARNING_RADAR_ENABLED`、`MARKET_RADAR_ENABLED`、`MARKET_RADAR_AUTOMATION_READY` | 人工开关，默认关闭 |

Hermes 只在本机密钥环境中保存 dispatch token 与微信通道配置，微信凭据不进入 Vercel 或 GitHub。

## 发布与自动化

- **生产发布**只走 [`release-controller.yml`](.github/workflows/release-controller.yml)：精确 SHA、先迁移数据库、Vercel 候选验证后再提升，见 [`docs/release-controller.md`](docs/release-controller.md)。Vercel 的 Git 自动部署（包括 PR Preview）已关闭。
- **学习雷达**每日由 ResearchOps 流程产出，PR 分支 `automation/daily-radar-YYYY-MM-DD`，只能改白名单内文件，见 [`docs/learning-radar-researchops.md`](docs/learning-radar-researchops.md)。
- **交易雷达**每日流程与 v2 研究问题规则见 [`docs/market-radar-researchops.md`](docs/market-radar-researchops.md)。
- 静态快照与数据库共用同一个不可变 `snapshotId`，见 [`docs/radar-publication-boundary.md`](docs/radar-publication-boundary.md)。

## 公开证据契约

每个公开项目声明两个正交状态：`publicRole`（`current-product` / `current-direction` / `historical-evidence`）回答它是否属于当前叙事；`claimState`（`locked` / `evidence-ready` / `publishable`）回答公开 Claim 是否成熟。当前固定为 Qiu Market = `current-product / evidence-ready`，Wallet Infrastructure = `current-direction / locked`，其余六项只作为 `historical-evidence`。完整映射与失败关闭规则见 [`docs/public-evidence-contract.md`](docs/public-evidence-contract.md)。

## 边界与安全

- 公开仓库不包含私有钱包服务的源码、地址或配置；私有工程只展示经过门禁的脱敏边界和当前限制。
- `/market-radar` 是研究快照，不连接持仓、钱包或券商账户，不下单，也不构成投资建议。影子引擎失败不会覆盖已审核的静态快照。
- 站内 AI 只读取公开知识层，不读取私有仓库或 Obsidian 原文；运行日志只记录耗时和响应大小，不记录提问内容；内存限流只是单实例的尽力保护。
- 模型密钥只存在于服务端环境变量；CI 用 gitleaks 扫描完整 Git 历史中的密钥；本机绝对路径、类凭据值和私有 Git remote 会被 `npm run check:public` 拦截。

## 许可

源代码使用 MIT 许可。`content/` 下的原创文字与内容默认使用 CC BY-NC-SA 4.0，另有说明的文件除外。见 [NOTICE.md](NOTICE.md) 和 [content/LICENSE.md](content/LICENSE.md)。
