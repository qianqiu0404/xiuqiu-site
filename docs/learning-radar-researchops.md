# 学习雷达 ResearchOps

学习雷达由一个固定聊天中的主流程端到端负责。它每天北京时间 05:30 开始，只处理 `/radar`、学习雷达来源、周度人工收敛与学习雷达微信通知；不读取或修改交易雷达。

## 每日状态机

1. **幂等检查**：先更新 `origin/main`，检查当天内容、远端分支、提交、PR 和生产页面。任一位置已经存在有效结果时进入验收，不重复采集或建 PR。
2. **建立唯一 ledger**：使用 `learning-radar/YYYY-MM-DD` 作为 `runKey`。每条候选记录栏目、一手链接、发布时间、核验时间、是否一手来源和核验备注。
3. **受控采集**：行业/钱包信号最多三条；AI Engineering、Web3 Design、工具项目、长文阅读各最多一条。AI Hot 的 24 小时精选接口只用于 AI 线索发现，最终引用必须回到原始来源。
4. **深度编辑**：每项至少回答事实、关键机制、为什么值得关注、风险边界与一个可执行动作。页面摘要压缩为读者第一眼能抓住的结论，不能把推断写成事实。
5. **门禁**：运行 `npm run prepare:researchops -- <ledger.json> <public-source.md>`，执行 30 天 URL/标题去重、七项上限、至少三类公开输入、来源和隐私检查。来源不足时少发；低于三类或核验失败时停止。
6. **唯一发布**：从最新 `origin/main` 创建 `automation/daily-radar-YYYY-MM-DD`，只提交当日日报、生成雷达数据与 sitemap。运行候选校验、`npm run test:radar`、完整构建和差异白名单，再创建唯一非草稿 PR。GitHub 门禁通过后 squash 合并并删除分支。
7. **分别验收**：确认合并提交已进入 `origin/main`，生产 `/radar/YYYY-MM-DD` 返回 200 且内容正确。随后才发送微信；只有拿到带 event id、发送时间和通道结果的送达回执才能标记通知成功。

## 来源策略

- 行业/钱包优先协议规范、官方客户端或节点发布、官方安全公告和标准组织材料。
- AI Engineering 可由 AI Hot 发现线索，但必须打开原始论文、官方工程博客、产品发布或代码仓库核验。
- Web3 Design 优先 EIP/ERC、CAIP、钱包官方设计规范与可验证实现。
- 工具项目只收录固定版本、官方 release 或可复现实验，并写明安装成本和权限边界。
- 长文必须是一手研究或工程复盘，摘要需要还原问题、论证链和适用边界。

不使用只有二手摘要、无法确认发布时间、来源失效或需要暴露私密凭据的材料。AI Hot 不承担发布、事实背书或最终引用角色。

## 失败与恢复

- ledger、日期、分支与 PR 都以同一个日期键幂等；失败后从已保存状态恢复，不重新搜索已完成栏目。
- 任一候选可以被删除而不要求补足七项；质量优先于数量。
- GitHub、生产页面和微信是三个独立状态。网站成功不代表微信成功，通知失败也不回滚已发布页面。
- 微信限流只允许按通道返回的冷却时间重试一次；仍无回执则记录 `partial`，下一次运行先补验收，不重复发布。

## 周度人工收敛

每周日的日报发布完成后，主流程汇总最近七天的 `accepted`、`rejected` 与 `edited` 判断，提出来源权重、重复规则和内容结构的改进建议。规则只有在人工确认后才进入配置或测试，避免把一次编辑偏好自动固化成长期门禁。

## T7 上线前只读核查

正式发布前只在目标 Neon 数据库执行下面的只读计数，不更新或恢复历史 payload。结果用于量化 008 迁移前已经清除、因此无法重建原始 fingerprint 的 legacy loss window；这些行首次重新出现时只建立 incoming baseline，不恢复 raw payload。

```sql
select 'market_radar' as schema_name, count(*)::bigint as legacy_purged_without_fingerprint
from market_radar.raw_items
where payload_purged_at is not null
  and payload_fingerprint is null
union all
select 'learning_radar' as schema_name, count(*)::bigint as legacy_purged_without_fingerprint
from learning_radar.raw_items
where payload_purged_at is not null
  and payload_fingerprint is null
order by schema_name;
```

计数不为零不是自动恢复 raw payload 的授权。记录数量后继续保持 fail-closed；只有首次 baseline 之后可确定的真实 payload 或结构变化，才从该次修订起重新保留 14 天。
