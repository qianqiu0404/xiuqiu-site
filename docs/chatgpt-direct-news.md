# ChatGPT 每日推荐：私有原稿到独立新闻源

这条通道复用已存在的 ChatGPT 推荐，不重新搜索、不调用模型，也不改变 ChatGPT 或 Grok 的任务。身份为 `chatgpt-daily`，独立数据分支为 `news/chatgpt-daily`；既有 Grok 调用仍默认使用 `x-ai-digest` 和 `news/x-ai-digest`。

## 读取边界

推荐的原始答案可由有权限的聊天读取工具或已登录浏览器只读取得。这里只接受人工保存的原稿文件，没有新增 ChatGPT 消费者账号 API、自动抓取、登录状态读取或定时器。工具返回占位符、页面加载失败或拿不到实际消息时间时，保留原稿，不能推断“今日无推荐”，也不能用计划执行时间替代实际时间。

## 私有文件夹与原稿格式

原稿、来源消息标识、身份 ledger 和本地回执都放在仓库外的私有任务资料目录。建议分为 `inbox/`、`drafts/`、`ready/`、`state/`、`receipts/`。目录权限建议 `0700`，文件 `0600`；本机开发盘的挂载与设备校验遵循 `AGENTS.md`。先建立这些目录，转换器不会自动建立缺失的父目录。

`inbox/YYYY-MM-DD.md` 的 frontmatter 示例（虚构测试资料）：

```yaml
---
producer: "chatgpt-daily"
edition_date: "2026-10-26"
recommended_at: "2026-10-26T09:06:48.994+08:00"
timezone: "Asia/Taipei"
message_id: "private-source-message-id"
content_scope: "private_original"
---
```

时区统一约定为 `Asia/Taipei`，简报日期必须与实际消息时间在该时区的日期一致。后面保留原答案；每条新闻使用如下结构：

```markdown
## ① AI 动态：公开新闻标题

### 新闻摘要
允许公开的新闻摘要。

### 推荐理由
原有个人建议留在私有原稿，不进入公开候选。

**原始来源：** [原始机构：页面标题](https://example.org/news/item)
```

支持 `①` 至 `⑳` 或 `1.`、`1、`、`1)` 编号，最多 50 条。必须有明确新闻摘要，只提取该选段；出处必须在 `原始来源` 或 `原始数据` 行中。没有出处的条目跳过并记录原因；全部缺失时不产生候选。相同 canonical URL 的完全重复条目合并，内容冲突则整批停止。URL 去除 fragment 和常见追踪参数；私人对话、邮箱地址、个人称呼、路径、HTML 和疑似凭据会拒绝转换。这些检查只提供保守筛选，不能代替发布前对公开选段逐条审查。

## 本地转换与首版迁移

以下 `$PRIVATE_DIR` 指仓库外已建立的私有资料目录。检查模式是默认行为，不写 ledger、不产生候选、不访问网络：

```sh
node scripts/import-chatgpt-news.mjs \
  --input "$PRIVATE_DIR/inbox/2026-10-26.md" \
  --ledger "$PRIVATE_DIR/state/importer-ledger.json" \
  --output "$PRIVATE_DIR/ready/2026-10-26.json"
```

检查通过后，同一命令加 `--write` 才写入本地文件，并进行读回核对。已有人工分配的首版完整候选时，首次执行显式加 `--seed "$PRIVATE_DIR/drafts/2026-10-26.json"`，保留原有 `origin_id`、版本和首次推荐时间；不能以此导入缺失历史的后续版本，也不能覆盖旧实验 ledger。

身份由简报日期与 canonical 来源 URL 确定，同一期中消息 ID 改变不重新分配身份。相同内容重放不改变 ledger 或候选；内容修订保留身份并递增 `revision`，历史不可变。已知旧版重投保留最新版本，计入 `staleIgnored`。不同日期再次推荐同一 URL 视为另一条推荐；跨日合并或原始 URL 本身修正应单独审查。

`collected_at` 使用该条首次推荐的实际消息时间；后续修订仍保留首次时间。回执 `sourceRecommendedAt` 是本次原稿实际时间，`candidateTimeBasis` 明确候选按每条首次推荐时间记录。`published_at`、`event_date` 保持未知，`source_access=not_checked`，`review_status=unreviewed`，不把导入等同于事实核验。新条目不自动提取私人推荐理由作为分析；首版 seed 的通用分析只有在原稿对应条目仍有相同文字时才保留。

ledger 先于候选原子写入；候选写失败后，用相同参数重跑即可恢复身份和版本。并发写入由独占锁阻止。锁存在时检查原运行状态；不要盲目删除。候选存在但 ledger 丢失时，必须恢复 ledger 或提供经确认的首版 seed，不能重新生成身份。

本地修订号不表示已投递。如果在首版尚未投递时已转换成 r2，不能把 r2 直接首投：远端沿用从 r1 连续增版的保护。需要先只读核对远端缺少哪些版本，再从私有 ledger 的 `records[*].revisions[*].item` 提取缺失版本，按每条 r1、r2 的顺序组成并检查资料包（同批每个身份最多一个版本），逐批获得发布授权并投递；不能改写版本号或清空 ledger。当前转换器不查询远端，也不自动补投历史。

## 候选检查与发布边界

公开候选使用既有 v1 新闻字段，但必须显式选择 ChatGPT 校验器：

```sh
node scripts/publish-grok-news.mjs \
  --check "$PRIVATE_DIR/ready/2026-10-26.json" --producer chatgpt
```

`--check` 离线运行。未指定 `--producer` 仍按 Grok 校验，不能把 ChatGPT 资料伪装成 Grok。转换器没有发布开关，也不会自动调用发布器。实际投递需要单独授权后使用发布器的 `--publish` 与显式 `--producer chatgpt`；它只写对应数据分支，沿用权限核验、版本冲突拒绝、原子更新、体积限制和分支读回规则。本站代码发布仍受现有 Release Controller 约束。

不要把私有原稿、整个聊天、ledger、来源消息 ID、浏览器状态或凭据提交到仓库。只将经审查的候选交给发布步骤。数据分支写入成功、站点部署、网页实际读回、用户验收分别记录。

## 页面和手动验收

- 读取入口：`/chatgpt-news-data/index.json`，独立于 `/grok-news-data/index.json`。
- 列表筛选：`/?domain=chatgpt`；详情：`/research?producer=chatgpt&id=chatgpt-…`。领域、关键词、主题和返回焦点沿用既有阅读流程。
- 找不到来源或读取失败时显示“来源尚未接入或暂时无法读取”，不能将其显示为确认的零条推荐；成功读到空索引才显示空状态。
- 默认构建快照与既有健康检查仍处理 Grok 和共享研究。手动探测 ChatGPT 使用 `node scripts/external-sources.mjs --source chatgpt`；此命令会读网络。没有创建数据分支时，404 是尚未接入的真实状态。
- 本地预览可设置 `CHATGPT_NEWS_PREVIEW_ORIGIN=http://127.0.0.1:PORT`，提供本地 `/feed/v1/index.json`；只用于验收，不创建公开分支，不修改计划任务。

提交前运行完整 `npm run build`，在桌面和 375px 下验收列表、筛选、详情来源、返回位置、加载/空/错误反馈，并单独确认旧 Grok 路由正常。
