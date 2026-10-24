# 交易雷达 ResearchOps

交易雷达在固定 ResearchOps 聊天中独立运行，只处理 `/market-radar`、公开市场来源、运行时 worker 和交易雷达通知。它与学习雷达使用不同的 `runKey`、ledger、分支、PR、发布判断和通知回执；不得读取或修改 Qiu-market，除非执行明确标记为可选、只读的健康检查。

## 每日状态机

1. **幂等检查**：先更新 `origin/main`，以 `market-radar/YYYY-MM-DD` 检查当日 Markdown、远端分支、所有状态 PR、生产页面、部署 SHA、outbox 和每个微信收件人的回执。已发布或已发送的状态只验收，不重复采集、提交、部署或通知。
2. **公开采集**：从央行、财政部、监管机构、交易所公告、协议规范和官方 release 等一手来源采集 1–5 条；允许安静日少发，不凑数。每条事件必须提供唯一 `id` 和 `sourceUrl`，以及 `fact`、`whyWatch`、`watchFor`、`invalidation`。事实、推断与待验证项必须分开。
3. **去重与边界**：对最近 30 天的标题、URL 和事件 ID 去重。禁止买卖方向、仓位、止损、目标价、收益承诺和没有证据支持的精确概率。事实不足、来源失效或隐私门禁失败时停止。
4. **v2 研究问题**：从 2026-08-13 起，日报必须声明 `schemaVersion: 2` 并包含恰好三个 `researchQuestions`。顺序固定为 `1/transmission`、`2/falsification`、`3/scenario`；每题的 `focusEventIds` 只能引用当日 1–2 条事件。
5. **确定性研究包**：只编写简短研究问题，不在 Markdown 内手写完整提示词或校验和。`npm run generate:market-radar` 从被引用事件的事实、机制、观察项、失效条件和一手来源确定性生成 `/data/market-radar-packs/YYYY-MM-DD.json`。网页、晨报与 Hermes 必须使用该文件的同一 `snapshotId` 和逐题 `promptChecksum`。
6. **唯一发布**：从最新 `origin/main` 建立 `automation/market-radar-YYYY-MM-DD` 隔离分支和唯一同日非草稿 PR。只允许当日 Markdown、当日研究包、生成市场雷达数据、对应月份数据与 sitemap 进入每日 PR；历史研究包不可修改。
7. **生产与通知验收**：合并后按 Release Controller 发布精确 main SHA。只有生产页面和研究包均为 HTTP 200、日期与 snapshot meta 一致、Vercel Ready 后才允许通知。两个微信正文相同，但幂等键和 provider 回执独立；没有 `providerMessageId` 只能报告未确认送达。

## v2 写作契约

```yaml
schemaVersion: 2
researchQuestions:
  - id: "1"
    lens: transmission
    shortQuestion: "事件通过哪些可验证的环节影响相关资产？"
    focusEventIds: ["event-id"]
  - id: "2"
    lens: falsification
    shortQuestion: "哪些跨资产证据最可能支持或推翻当前解释？"
    focusEventIds: ["event-id"]
  - id: "3"
    lens: scenario
    shortQuestion: "最强反方情景是什么，后续观察什么会让判断失效？"
    focusEventIds: ["event-id"]
```

- `shortQuestion` 必须彼此不同、最多 180 个字符，不得含占位符或交易指令。
- 被引用事件必须属于当日日报，并使用公开 HTTPS 一手来源。
- 完整提示词由生成器构建，每题最多 1,500 字、最多两个事件和两个来源；不要让 Hermes 临场补写。
- 若量化样本门禁关闭，研究问题可以讨论验证方法，但不得要求外部模型补精确概率。

## 发布门禁

至少运行：

```sh
npm ci
npm run generate:market-radar
npm run generate:sitemap
npm run test:market-radar
npm run test:notifications
npm run build
git diff --check
```

每日 PR 还必须确认：Markdown 日期、分支日期、JSON 日期、`snapshotId`、页面 snapshot meta 和通知引用完全一致；晨报最终渲染不超过 1,800 字，量化跟进不超过 1,600 字。已经进入 Git 历史的研究包不可被生成器重写，提示词契约变化必须使用新的 schema 版本。研究包门禁失败时停止 v2 发布和通知，不生成替代提示词；旧 v1 页面继续只读兼容且不回填。

## 定时 Worker 的恢复边界

- `MARKET_RADAR_ENABLED=true` 只表示运行通道被允许评估，不等于无人值守环境已经就绪。
- 定时触发只有在 `MARKET_RADAR_AUTOMATION_READY=true` 时才可请求生产环境；变量未设置或不为 `true` 时必须降级为 `dry-run`，并使用独立、可取消的 dry-run 并发组，避免长期等待人工环境审批或占住生产发布组。
- 手动 `workflow_dispatch` 仍可显式选择 `ingest|daily|premarket`，并继续经过 `production-release` 的 Owner 审批；`dry-run` 不请求环境或 secrets。
- 如果已经存在等待审批的历史运行，代码修复不会自动取消它。修复合并后新的定时／手动 `dry-run` 不再被该运行阻塞，但 Owner 仍应审查并取消或拒绝历史运行，再确认生产发布组已经释放。
- 仓库内的 `daily-radar.yml` 与 `static-market-radar.yml` 只是每日内容 PR 的校验／合并门禁，不负责创建新简报。Learn Radar 和静态 Market Radar 的内容生产器若未运行，页面会继续停留在最后一份已合并快照。

## 公开快照与采集健康

`/api/market-radar/summary` 的字段与枚举保持兼容，但总体 `healthy` 必须同时满足已发布研究快照达到应发布日、所有已知来源的最近运行成功且成功时间没有超过各自采集窗口。

- 日报以 `Asia/Shanghai` 每日 08:00 为截止，与 `docs/public-feeds.md` 的公开发布时间一致。08:00 前允许上一日快照；截止后要求当日快照。研究快照不用 worker 的 90 分钟窗口判定。
- `github_releases`、`sec_edgar`、`binance_market_data`、`qiu_market` 的成功记录窗口仍为 90 分钟。`federal_reserve` 实际每九个 20 分钟槽采集一次，窗口为 210 分钟（180 分钟周期加 30 分钟宽限）。每个来源独立判断，单个新心跳不能覆盖其他来源的过期。
- `lastSuccessAt` 只取真实成功运行的完成时间。最新运行失败或尚未完成时可保留以前的真实成功时间，但来源仍为 `degraded`；没有成功证据时为 `null`。
- `freshnessMinutes` 保留原语义：所有已知来源中最新一次成功距当前的分钟数，不能用它代表日报年龄或所有来源的健康。
- `isDelayed` 表示公开快照未达到应发布日，或至少一个来源缺少有效成功记录／超过窗口。来源最近运行失败但仍有窗口内的既往成功时，总体为 `degraded`，`isDelayed` 可为 `false`，由来源消息说明失败或尚未完成。
- 事件数量为零不参与失败判断；当前快照与成功采集可以对应正常无新增。API 与静态快照不一致时仍由静态快照保留展示权，不合并不同快照的数据。

这一判定修复不启动采集、不发布数据库快照、不发送通知，也不改变运行开关。恢复静态研究日报与恢复实时 worker 继续分别验收。
