# 公开订阅出口

学习雷达在构建时由 `scripts/generate-radars.mjs` 调用 `scripts/radar-feed.mjs` 生成以下静态文件。它们只包含公开字段（标题、一句话摘要、领域、主题、来源名称与链接），不包含 `mechanism`、`workedExample` 等正文。

| 路径 | 格式 | 条目上限 |
| --- | --- | --- |
| `/radar/rss.xml` | RSS 2.0 | 最近 60 条 |
| `/radar/feed.json` | [JSON Feed 1.1](https://jsonfeed.org/version/1.1) | 最近 60 条 |
| `/llms.txt` | Markdown，面向 Agent | 最近 12 条 + 入口链接 |

## 情报流静态 API

`scripts/generate-intel-feed.mjs` 把学习雷达 brief、市场雷达事件和趋势回顾归一为 `IntelItem`，额外生成：

| 路径 | 内容 |
| --- | --- |
| `/data/intel/latest.json` | 最近 7 天的 IntelItem（`schemaVersion: 1`，含绝对 `url`） |
| `/data/intel/topics.json` | 主题 → 条目数、首次与最近出现日期、主题页 URL |

`IntelItem` 字段：`id`（`learning:`/`market:`/`review:` 前缀，发布后不变）、`kind`、`date`、`domain`（ai / web3 / market / review）、`topic`、`title`、`summary`、`href`、可选 `source { name, tier?, url }` 与 `flags { deepDive?, priority? }`。站内使用 `src/data/generatedIntelFeed.ts`（首屏索引）与 `generatedIntelFeedMonths/YYYY-MM.ts`（懒加载）。两个每日 PR 门禁的白名单都包含这些文件。

## 条目约定

- 每条对应一条 brief（v2）或一个旧版栏目（v1），`id` 形如 `xiuqiu-radar:<brief-id>`，一经发布不变。
- `link` / `url` 指向 `/radar/YYYY-MM-DD#<anchor>`。
- 发布时间统一为当期日期的 08:00 `Asia/Shanghai`。
- 分类 / 标签：`ai` 或 `web3`，加上 `topic`。
- JSON Feed 的 `external_url` 是该条的第一个原始来源。

## 站内数据

前端信息流使用 `src/data/generatedRadarFeed.ts`（索引与按月加载器）和 `src/data/generatedRadarFeedMonths/YYYY-MM.ts`。这些文件和上面的静态文件都在 `daily-radar.yml` 的白名单里，每日自动 PR 会一起更新。

## 兼容性

字段只增不减。需要破坏性变更时，新开一个路径，旧路径保留一个发布周期以上。
