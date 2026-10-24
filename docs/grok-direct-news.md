# x-ai-digest 直接投递个人站

2026-10-24：新闻接入已通过既有 Release Controller 上线。指定 Bot「X」即 x-ai-digest，
其已有 GitHub 身份 xoqiu09 具备本站数据分支写权限；一条真实公开新闻已投递并从 GitHub 与
正式站独立读回。既有 x-ai 每日任务已追加本站投递，首次新增定时步骤仍待 10 月 25 日实际执行。

## 路径

指定 Bot 搜索公开资料，输出资料包 → 本脚本校验 → 本站独立数据分支 `news/x-ai-digest`
→ 网站通过 `/grok-news-data/index.json` 读取 → 首页的 Grok Bot 筛选及站内详情。

资料不经过 shared-research；原有 shared-research API 可以独立保留。首次上线页面代码仍走
本站既有 Release Controller。此后每批新闻只更新数据分支，读者刷新页面或点“刷新新闻”即可
读取；不触发整站构建、数据库迁移、通知或 Market worker，不改既有定时任务。
原有 RSS/JSON/API 仍只覆盖 Radar，没有把 Bot 输出改成已核查日报或市场快照。

## 给新闻 Bot 的执行规则

仅适用于本 Bot x-ai-digest 已被用户指定的公开新闻输出，不同步私人聊天、其他 Bot 历史、
账户材料或凭据。使用自己环境中的独立 checkout，不使用维护者电脑路径。

1. 从维护者明确批准并固定的完整提交 SHA 取得本文件和 `scripts/publish-grok-news.mjs`；运行需 Node 22.18+
   或支持 TypeScript type stripping 的更新版本，以及已登录的 gh。不要下载执行不明脚本。
2. 一条新闻首次采集时分配并保存稳定 origin_id，建议 `x-ai-digest:<首次批次>:<来源帖子ID>`。
   重试保持原包和 collected_at 不变；修订增加 revision，不重生成 ID。
3. 使用下方格式，每批最多 50 条。未知原文时间填 null；区分摘录、Bot 摘要与分析，
   访问状态如实记录。必须 public、unreviewed；公开链接不能含凭据、内网或本机地址。
4. 先离线校验，再在**已有本站写权限**的 GitHub 身份下投递：

```sh
node --experimental-strip-types scripts/publish-grok-news.mjs --check batch.json
node --experimental-strip-types scripts/publish-grok-news.mjs --publish batch.json
```

`--check` 不访问网络。`--publish` 先核对当前身份权限，再原子更新数据分支，绝不写 main
或强推。首次有效投递自动创建只有新闻数据的分支；无需初始化虚构新闻。

5. 成功回执 `data_verified` 只表示 GitHub 分支内容已读回。首次页面代码上线后，还必须
   打开个人站的 `/?domain=grok` 和对应详情核对，才回报“网站已更新”。保留批次、版本、
   commit SHA、分支回执和站内地址，不把模型回复或数据提交当成上线证据。
6. 无权限、字段错误、同版本内容冲突时停止。网络超时或并发冲突先读回分支与固定包，
   不重新搜索、不生成另一条、不强推。原包重投没有变化时返回 unchanged，不创建提交。
   旧修订重投按下方 `verified_replay` / `stale_ignored` 回执处理，不能据此声称新增发布。
   更正保存 `feed/v1/records/<稳定ID>/r<版本>.json`；旧版本保留。

## 资料包 v1

以下是格式占位示例，不能作为新闻投递。正文只按文本展示，不接受 HTML 或脚本模板。

```json
{
  "schema_version": 1,
  "bot_id": "x-ai-digest",
  "items": [{
    "origin_id": "x-ai-digest:首次批次:来源ID",
    "revision": 1,
    "bot_id": "x-ai-digest",
    "visibility": "public",
    "review_status": "unreviewed",
    "collected_at": "带时区的实际首次采集时间",
    "published_at": null,
    "event_date": null,
    "domain": "ai",
    "title": "真实资料标题",
    "summary": "Bot 整理，保留来源陈述与未知事项",
    "source_url": "https://example.org/实际原始出处",
    "source_name": "来源作者或机构",
    "source_access": "not_checked",
    "source_excerpt": null,
    "bot_analysis": null
  }]
}
```

domain 可用 ai/web3/market/research；source_access 可用 accessible/partial/unavailable/not_checked。
来源时间不能用发布脚本运行时间代替。首次条目版本为 1，更正逐版递增；同 origin_id +
revision 不同内容会拒绝。索引有 2000 条和 2 MiB 上限，达到任一上限时在写入前停止并报告，
保留可读的旧索引，不静默删除历史；后续先制定归档方案。

GitHub 的 [Contents API 大文件约束](https://docs.github.com/en/rest/repos/contents#get-repository-content)
规定：超过 1 MB 的文件不能依赖内联 `content`；使用 object 媒体类型时它为空且 `encoding=none`。
脚本显式请求 object 元数据，必要时用返回的安全 SHA 读取 Git Blob 的 Base64 内容；读取与写入
仍遵守 2 MiB 硬上限和既有 schema 校验，不因 GitHub 的内联阈值降低页面上限。

旧 revision 重试时先核对不可变历史版本：指纹一致返回 `unchanged`，并在 `ignored` 中标为
`verified_replay`；同版本指纹冲突仍拒绝。历史版本缺失时不声称它曾成功发布，回执明确标为
`stale_ignored`，保留当前较新版本，并允许同批的其他新条目继续发布。旧包全部被忽略时总状态
为 `stale_ignored`；混合批次仍以实际新条目的提交与读回决定 `data_verified`。

## 验证与回滚

`node --test scripts/grok-news.test.mjs` 覆盖公开边界、离线校验、权限拒绝、固定 ID、重复包、
版本冲突、更正保留、原子数据写入与读回、日期口径、模型输出标识和缓存失败恢复；它也进入
既有 build 的测试入口，没有更改 build 或工作流。网站仍需桌面/375px 与真 Bot 的实际读回。

本地联合预览给 `GROK_NEWS_PREVIEW_ORIGIN` 指向只读测试 HTTP 服务，其目录中放
`feed/v1/index.json`。测试资料必须标明 fixture，不发布到 GitHub 数据分支或正式站。

每次脚本升级前核对 live main、当前修复 PR 与批准的完整候选 SHA；定时任务只切换到明确批准的版本。
数据分支不是代码 PR 的合并目标。
回滚只撤回 Grok 数据读取和展示或停止 Bot 对本站投递，保留数据分支与旧版本恢复材料；
原雷达、共享研究及 Bot 向其他已授权目标的工作继续独立。
