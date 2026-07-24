---
{
  "id": 11,
  "slug": "risk-server",
  "name": "risk-server",
  "category": "风控源码研究",
  "featured": false,
  "publish": true,
  "portfolioTier": "exploration",
  "activityStatus": "active",
  "stage": "verified-local",
  "sourceType": "source-study",
  "visibility": "none",
  "positioning": "基于 DappLink mock 风控 gRPC 服务的源码研究与本地验证，聚焦提现内容一致性、幂等标记、链上查询和资金流水判断的真实边界。",
  "currentFocus": "把六个 RPC、LevelDB 状态和 Wallet API Gateway 依赖整理成可讲解的风控边界，并明确 mock AML、固定全局流水键和静态 token 的生产化缺口。",
  "verifiedEvidence": [
    "go test ./... 与 go vet ./... 已在本地通过",
    "make risk-server 构建成功，服务使用本地配置成功监听",
    "已定位提现 canonical hash、成功后幂等标记和六个 RPC 的数据依赖"
  ],
  "targetOutcome": "形成一个不夸大生产能力的风控源码案例，能够从请求、状态、外部依赖和失败路径解释当前实现与生产风控平台之间的差距。",
  "nextMilestone": "为主要 RPC 补充可复现测试，并把按用户隔离的资金流水、真实 AML、鉴权和可观测性整理为明确演进路线。",
  "knownLimits": [
    "属于第三方项目源码研究，不是从零原创实现",
    "AML 当前固定放行，不能代表真实制裁或地址风险检查",
    "资金流水校验读取固定全局 key，不是按用户隔离的生产方案",
    "当前不提供个人公开仓库入口"
  ],
  "updatedAt": "2026-07-12",
  "coreAbilities": ["gRPC 服务导读", "提现一致性校验", "幂等状态", "LevelDB", "风控边界"],
  "talkingPoints": ["六个 RPC 的职责如何划分", "成功校验后为什么需要幂等标记", "当前实现为什么不能直接作为生产风控"],
  "techStack": ["Go", "gRPC", "LevelDB", "Wallet API Gateway"],
  "engineering": {
    "role": "源码阅读、本地运行验证和生产边界分析",
    "systemBoundary": "risk-server 校验提现内容、查询部分链上事实并保存本地状态；它不实现完整 AML、账户隔离、细粒度权限和生产审计。",
    "callFlow": ["调用方提交提现", "服务保存 canonical 请求", "离线校验比较摘要并写幂等状态", "链上查询通过 Wallet API Gateway 获取交易与确认数"],
    "failureScenarios": ["固定流水 key 造成跨用户状态混淆", "外部 Gateway 返回空数组或异常高度时缺少充分保护"],
    "evidence": ["本地测试与 vet", "构建与启动记录", "六个 RPC 与 LevelDB key 导读"],
    "knownLimits": ["没有真实 AML 供应商联调", "没有生产级 TLS、权限、限流与指标"],
    "overviewSummary": "risk-server 用于理解提现风控接口与状态边界；当前证据证明源码已分析并能在本地运行，不代表生产风控平台经验。"
  },
  "learning": {
    "goal": "能够从代码说明提现提交、离线一致性、链上查询和资金流水校验各自依赖什么状态。",
    "verified": ["六个 RPC 分类", "canonical hash 与幂等键", "LevelDB 与外部 Gateway 边界"],
    "verification": ["go test ./...", "go vet ./...", "make risk-server"],
    "verificationNote": "验证来自本地源码研究环境；没有接入真实资金或生产风控供应商。",
    "tradeoffs": ["明确标记源码学习来源", "本地可运行与生产可用分开", "不公开敏感配置"],
    "nextSteps": ["补主要 RPC 测试", "设计按用户隔离的数据模型", "补鉴权、审计和指标路线"]
  },
  "conceptTags": ["wallet-backend", "go-infra", "api-design"],
  "relatedArticleSlugs": ["withdrawal-error-handling", "wallet-api-boundary", "wallet-ledger-transaction-mq-consistency"],
  "suggestedQuestions": ["risk-server 当前真正实现了什么？", "为什么固定全局流水键不是生产方案？"]
}
---

该页面只公开源码研究和本地验证事实，不把 mock 风控能力包装成生产平台。
