# 学习雷达 ResearchOps

学习雷达由一个固定聊天中的主流程端到端负责。它每天北京时间 05:30 开始，07:20 编辑截止、07:35 门禁截止、07:45 形成不可变发布快照，时区固定 `Asia/Shanghai`。它只处理 `/radar` 和学习研究输入；不读取或修改交易雷达。

## 每日状态机

1. **幂等检查**：先更新 `origin/main`，检查当天内容、远端分支、提交、PR 和生产页面。任一位置已经存在有效结果时进入验收，不重复采集或建 PR。
2. **建立唯一 ledger**：使用 `learning-radar/YYYY-MM-DD` 作为 `runKey`。每条候选记录栏目、一手链接、发布时间、核验时间、是否一手来源和核验备注。
3. **受控采集**：每天恰好 2 条 AI、2 条 Web3，并从四条中选择 1 条做专题。AI Hot、社区与社交来源只用于发现，最终引用必须回到原始来源。
4. **深度编辑**：每项固定回答发生了什么、核心机制、具体工作示例、为什么与你有关、风险与限制、一手来源与精选研究、下一步问题。
5. **门禁**：运行 `npm run prepare:researchops -- <ledger.json> <public-source.md>`，执行 30 天 URL/标题去重、2/2 域分布、同域主题多样性、专题引用与来源时间边界检查。任一栏目不足时整期停止，不用低质量内容补数。
6. **唯一发布**：生成 v2 日报并运行候选校验、`npm run test:radar`、类型检查和完整构建。M1 只写 Preview 隔离快照并建立 Draft PR，是否合并另行授权。
7. **通知阻断**：v2 微信构建器在 M4 完成前显式拒绝发送；回填与 Preview 验收都不创建 outbox。

## 来源策略

- Tier 1：论文、标准、官方文档、协议规范、安全公告和代码。
- Tier 2：Trail of Bits、OpenZeppelin、Flashbots、研究机构和高质量工程团队解读。
- AI 聚焦模型与推理、Agent、评测、安全、数据和工程基础设施。
- Web3 聚焦钱包/CEX、MPC、安全、协议、L2、跨链和链上基础设施。

不使用只有二手摘要、无法确认发布时间、来源失效或需要暴露私密凭据的材料。AI Hot 不承担发布、事实背书或最终引用角色。

## 失败与恢复

- ledger、日期、分支与 PR 都以同一个日期键幂等；失败后从已保存状态恢复，不重新搜索已完成栏目。
- 任一候选被删除后若不满足 2 AI + 2 Web3 + 1 专题，整期不发布。
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
