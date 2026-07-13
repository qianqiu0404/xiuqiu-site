---
{
  "id": 8,
  "slug": "web3-wallet-engineer-lab",
  "name": "Web3 Wallet Engineer Lab",
  "category": "可运行实验",
  "featured": true,
  "stage": "verified-local",
  "sourceType": "original",
  "visibility": "none",
  "positioning": "用 Go 标准库和内存仓储实现的最小钱包后端闭环，用于练习地址、充值、提现、审核、风控、nonce、归集、审计和指标。",
  "currentFocus": "让钱包领域模型和状态转换可以在一个轻量环境中运行、测试和演示，为 Exchange Wallet Infrastructure 提供更容易复现的证据。",
  "verifiedEvidence": ["项目包含可启动 HTTP API", "充值与提现流程具有单元测试和接口流程测试", "提供健康检查、Prometheus 文本指标和审计日志"],
  "targetOutcome": "成为一个五分钟可启动、十五分钟可讲完的钱包后端最小实验：完整演示充值入账、提现审核、风控拒绝、nonce 分配和链上确认。",
  "nextMilestone": "把实验代码与站点内容源分离，整理一条无需私人笔记路径的公开演示说明。",
  "knownLimits": ["当前使用内存仓储，不等同于生产数据库与分布式状态", "链上交互使用模拟接口", "当前没有独立公开仓库链接"],
  "updatedAt": "2026-07-13",
  "coreAbilities": ["钱包领域模型", "充值提现闭环", "风控与审核", "nonce 与审计", "Go HTTP 与测试"],
  "talkingPoints": ["为什么先用内存仓储验证领域边界", "哪些接口可以替换为 PostgreSQL、Redis 和链 adaptor", "如何从最小实验演进到钱包基础设施"],
  "techStack": ["Go", "net/http", "In-memory Store", "Prometheus Text", "Unit Test"],
  "engineering": {
    "role": "最小钱包后台领域模型与可运行证据的设计实现",
    "systemBoundary": "只验证业务流程和接口边界，不声称包含真实链节点、生产密钥或分布式基础设施。",
    "callFlow": ["创建用户并分配地址", "模拟充值并确认入账", "创建提现并通过风控/审核", "分配 nonce 并模拟广播", "确认链上交易并写审计"],
    "failureScenarios": ["黑名单或额度触发风控拒绝", "重复业务请求不得重复推进资金状态"],
    "evidence": ["go test ./...", "go run ./cmd/api", "/healthz 与 /metrics", "接口流程测试"],
    "knownLimits": ["内存状态不支持多实例", "没有真实链和签名机接入"],
    "interviewSummary": "这个实验把钱包业务闭环压缩到可运行的最小代码，用来证明我理解状态机、风控、nonce、审计和可观测性，而不只是背架构图。"
  },
  "learning": {
    "goal": "用最小代码重复验证钱包领域判断，并把每个面试概念对应到可运行接口和测试。",
    "verified": ["充值与提现状态流程", "黑名单和额度规则", "nonce、归集、审计与指标接口"],
    "verification": ["go test ./...", "go run ./cmd/api"],
    "verificationNote": "当前验证发生在本地实验目录，网站不会暴露私人 Obsidian 路径。",
    "tradeoffs": ["以可运行和可解释优先", "内存仓储只用于边界验证", "生产化差距必须明确展示"],
    "nextSteps": ["整理独立演示说明", "增加幂等冲突与重启恢复场景", "明确与钱包基础设施四个服务边界的概念映射"]
  },
  "conceptTags": ["wallet-backend", "go-infra", "api-design"],
  "relatedArticleSlugs": ["cex-evm-wallet-deposit-withdrawal-loop", "withdrawal-error-handling", "http-rpc-grpc"],
  "suggestedQuestions": ["这个最小实验验证了哪些钱包后端概念？", "它与生产钱包系统还差什么？"]
}
---

网站只公开整理后的项目事实，不暴露该实验在本机知识库中的存储位置。
