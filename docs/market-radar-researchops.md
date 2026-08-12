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
