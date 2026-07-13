---
{
  "id": 1,
  "legacyIds": [2],
  "slug": "exchange-wallet-system",
  "name": "Exchange Wallet Infrastructure",
  "category": "钱包基础设施",
  "featured": true,
  "stage": "building",
  "sourceType": "adapted",
  "visibility": "private",
  "positioning": "围绕交易所充值、提现与资金安全组织的 Go 钱包基础设施：wallet-service 编排资金状态，risk-service 承担交易校验与风控放行，wallet-api 隔离多链节点能力，wallet-sign 收敛密钥与签名能力。",
  "currentFocus": "把资金编排、风险控制、链交互和签名四个服务的调用链、状态机与失败恢复整理成可以运行、可以讲解、可以复核的统一工程案例。",
  "verifiedEvidence": [
    "已定位充值扫链、提现构建、签名、广播与通知的核心代码入口",
    "已验证 ChainDispatcher 与多链 adaptor 的路由边界",
    "已记录 request_id 幂等、确认数推进和广播结果未知等异常场景",
    "已验证 risk-service 的提现提交、离线交易一致性校验、审批哈希与幂等标记单测",
    "已在独立 TSS 项目完成三节点 Keygen / Sign 本地验证，wallet-sign 接入仍在进行"
  ],
  "targetOutcome": "形成一套本地可复现的充值与提现演示：能够启动四个服务、跑通风控校验到签名广播的核心流程、展示状态变化，并用测试复现风控拒绝、广播超时和链上成功但本地更新失败的恢复策略。",
  "nextMilestone": "固定四个服务的兼容基线，统一验证命令，并跑通一条包含 risk-service 放行与失败注入的提现端到端流程。",
  "knownLimits": [
    "当前仍是学习与工程验证项目，不代表生产环境部署经历",
    "risk-service 当前仍以本地规则和模拟 AML 能力为主，不代表完整生产风控系统",
    "部分 context 传播、余额事务和链级资源并发仍需继续补强",
    "wallet-sign 当前以 Local Signer 为已验证基线；MPC/TSS 尚未完成端到端接入，HSM 属于下一阶段",
    "仓库暂按私有项目展示，不提供公开源码链接"
  ],
  "updatedAt": "2026-07-13",
  "coreAbilities": [
    "充值提现异步状态机",
    "多链 RPC 与 Chain Adaptor",
    "独立签名服务与私钥边界",
    "提现风控、审批凭证与离线交易一致性校验",
    "幂等、重试、确认数与失败补偿",
    "Go、gRPC、PostgreSQL 与 Redis"
  ],
  "talkingPoints": [
    "为什么资金编排、链节点、签名和风控要分属不同信任边界",
    "广播超时为什么不能直接重发第二笔交易",
    "链上成功但本地失败时如何以链上事实幂等恢复",
    "哪些生产化能力仍然没有完成"
  ],
  "techStack": ["Go", "gRPC", "PostgreSQL", "Redis", "LevelDB", "GORM", "Chain Adaptor", "EVM", "Bitcoin", "Solana", "Sui"],
  "engineering": {
    "role": "钱包基础设施代码理解、增量实现、运行验证与异常路径梳理",
    "systemBoundary": "wallet-service 维护业务资金状态，risk-service 校验提现内容并产生风控放行结果，wallet-api 负责链节点查询与交易构建/广播，wallet-sign 负责地址生成和签名；Local Signer、MPC/TSS 与未来 HSM 都位于 wallet-sign 后方，不增加新的业务服务边界。",
    "callFlow": [
      "业务请求进入 wallet-service 并持久化 request_id 与状态",
      "risk-service 校验提现内容、幂等状态与风险放行条件",
      "wallet-api 获取链资源并构建待签名交易",
      "wallet-sign 在独立边界内完成签名",
      "wallet-api 拼装并广播 raw transaction",
      "wallet-service 根据链上确认推进账务与通知"
    ],
    "failureScenarios": [
      "广播请求超时但节点可能已经接受交易",
      "链上成功后本地状态、账本或通知更新失败",
      "服务重启后需要从持久化状态继续推进而不是重复出金"
    ],
    "evidence": [
      "四个服务的 README、状态机文档和代码入口索引",
      "dispatcher、adaptor、RPC service 与业务模块测试",
      "risk-service 的 services、bigint 与 LevelDB 相关验证命令",
      "多链 E2E 文档、migrations 与失败恢复设计记录"
    ],
    "knownLimits": [
      "尚未形成一条覆盖四服务的稳定一键端到端演示",
      "MPC/TSS 已完成独立三节点验证但未接入 wallet-sign；HSM、严格账务模型与完整可观测性仍属于目标态"
    ],
    "overviewSummary": "这是我的 Web3 钱包后端主线：用 Exchange Wallet Infrastructure 拆开资金状态、多链节点、私钥签名和风险控制，并围绕幂等、确认数、风控放行、结果未知和补偿恢复理解资金系统。"
  },
  "learning": {
    "goal": "能够不依赖背稿讲清四个服务的职责、充值提现状态机和关键异常恢复案例，并能回到代码和测试证明判断。",
    "verified": [
      "API 与 Sign 两套 adaptor 的职责差异",
      "risk-service 的提现提交、离线一致性校验、审批哈希与幂等标记",
      "充值与提现 worker、数据库状态和通知路径",
      "广播超时与链上/本地状态不一致的处理原则"
    ],
    "verification": [
      "go test ./chaindispatcher ./chain/ethereum ./chain/bitcoin",
      "go test ./services/grpc",
      "go test ./services/rpc",
      "go test ./services ./common/bigint ./leveldb"
    ],
    "verificationNote": "命令来自对应私有仓库的当前验证记录；全链路稳定基线仍在整理。",
    "tradeoffs": [
      "当前代码事实、设计理解和生产化建议分开表达",
      "不使用线上规模、真实资金量或生产事故包装项目",
      "优先完成可复现失败路径，而不是继续堆叠支持链数量"
    ],
    "nextSteps": [
      "固定四个服务的兼容版本和启动顺序",
      "补齐风控拒绝、提现失败注入与重启恢复测试",
      "整理简版与完整两档工程说明"
    ]
  },
  "conceptTags": ["wallet-backend", "api-design", "multi-chain", "signer-service", "risk-control", "go-infra"],
  "relatedArticleSlugs": ["cex-evm-wallet-deposit-withdrawal-loop", "withdrawal-error-handling", "wallet-api-boundary", "wallet-sign-signer", "new-chain-integration-checklist"],
  "suggestedQuestions": [
    "Exchange Wallet Infrastructure 为什么要拆成四个服务边界？",
    "提现广播超时后应该如何恢复？",
    "当前哪些是已实现事实，哪些仍是生产化方向？"
  ]
}
---

四个仓库在网站中作为一个基础设施案例表达，避免把同一条资金链路拆成互相竞争的独立项目。
