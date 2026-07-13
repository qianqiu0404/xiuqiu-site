---
{
  "id": 8,
  "slug": "web3-wallet-engineer-lab",
  "name": "Wallet Reliability Lab",
  "category": "可运行实验",
  "featured": true,
  "stage": "showcase-ready",
  "sourceType": "original",
  "visibility": "public",
  "repositoryUrl": "https://github.com/qianqiu0404/web3-wallet-engineer-lab",
  "positioning": "以正常提现为基线，用共享场景数据、Go 资金不变量断言和 Vue 状态时间线实现六个钱包异常恢复实验。",
  "currentFocus": "让异常手册中的核心判断能够被确定性故障注入、状态迁移和恢复断言直接复核。",
  "verifiedEvidence": ["Go 测试已覆盖重复提现、广播结果未知、链上成功本地失败、充值 reorg、nonce replacement 与关键依赖 fail-closed", "共享 JSON 同时被 Go 与 Vue 校验，避免页面叙事与测试事实漂移", "GitHub Actions 已通过 Go、Vue、静态构建和敏感信息扫描；GitHub Pages 提供交互实验台"],
  "targetOutcome": "成为钱包可靠性判断的公开实验场：每个场景都有独立故障注入、资金不变量、第一处止损、状态时间线和恢复依据。",
  "nextMilestone": "增加 RPC 多节点结果仲裁与账务 outbox 故障注入，同时保持场景事实源和资金不变量唯一。",
  "knownLimits": ["使用内存与确定性模拟，不等同于生产数据库和真实链节点", "不使用真实资产或私钥，Go Runner 只允许本地 loopback", "MPC/TSS 与 HSM 只作为签名可用性边界，不在实验中实现真实密钥后端"],
  "updatedAt": "2026-07-13",
  "coreAbilities": ["钱包资金不变量", "异常状态机", "幂等与补偿", "Go 断言测试", "Vue 状态时间线"],
  "talkingPoints": ["结果未知时为什么必须暂停", "canonical 事实如何驱动本地补偿", "为什么 reorg 使用反向分录而不是删除历史"],
  "techStack": ["Go", "Vue 3", "TypeScript", "Vite", "Shared JSON Catalog", "GitHub Actions", "GitHub Pages"],
  "engineering": {
    "role": "钱包可靠性实验、资金不变量和可运行证据的设计实现",
    "systemBoundary": "只验证业务流程和接口边界，不声称包含真实链节点、生产密钥或分布式基础设施。",
    "callFlow": ["选择基线或异常场景", "注入确定性故障", "观察资金不变量与止损动作", "推进状态迁移", "按 canonical 事实恢复并断言终态"],
    "failureScenarios": ["重复提现", "广播结果未知", "链上成功本地失败", "充值区块 reorg", "nonce gap 与 replacement", "风控或签名服务不可用"],
    "evidence": ["go test ./...", "npm --prefix web test", "npm --prefix web run build", "GitHub Pages 交互实验台"],
    "knownLimits": ["内存状态不支持多实例", "没有真实链和签名机接入"],
    "overviewSummary": "这个实验把六类高资金风险异常压缩为可运行的状态模型，让止损、幂等、canonical 事实与补偿判断可以被测试复核。"
  },
  "learning": {
    "goal": "把异常恢复判断转成可重复运行的资金不变量、状态迁移和恢复断言。",
    "verified": ["六个异常恢复模型", "Go 与 Vue 共享场景事实", "静态实验台和 CI 门禁"],
    "verification": ["go test ./...", "npm --prefix web test", "npm --prefix web run build"],
    "verificationNote": "2026-07-13 本地与 GitHub Actions 均通过，静态实验台由 GitHub Pages 发布。",
    "tradeoffs": ["以可运行和可解释优先", "内存仓储只用于边界验证", "生产化差距必须明确展示"],
    "nextSteps": ["增加 RPC 多节点仲裁", "增加 outbox 与账务部分失败注入", "继续与 30 个异常手册建立双向关联"]
  },
  "conceptTags": ["wallet-backend", "go-infra", "api-design"],
  "relatedArticleSlugs": ["cex-evm-wallet-deposit-withdrawal-loop", "withdrawal-error-handling", "http-rpc-grpc"],
  "suggestedQuestions": ["这个最小实验验证了哪些钱包后端概念？", "它与生产钱包系统还差什么？"]
}
---

公开仓库只包含整理后的项目事实、可运行代码与测试，不包含私人 Obsidian 路径或真实密钥材料。
