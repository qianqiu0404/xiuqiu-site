---
{
  "id": 1,
  "legacyIds": [2],
  "slug": "exchange-wallet-system",
  "name": "Exchange Wallet Infrastructure",
  "category": "钱包基础设施",
  "featured": true,
  "publish": true,
  "portfolioTier": "flagship",
  "activityStatus": "active",
  "stage": "building",
  "sourceType": "adapted",
  "visibility": "private",
  "positioning": "面向交易所与稳定币支付的多链钱包基础设施：用统一资金状态承载充值、归集与提现，用独立风控、链适配和签名边界把业务权限、链上资源与资产控制权分开。",
  "currentFocus": "以 Sepolia 测试网闭环为基线，把 Base、BNB、Bitcoin 的本地无资金门禁、V4 intent / attempt / resource、多资产费用预留和 exact-raw 结果未知恢复收敛到统一 release candidate；同时推进 Agent Payment 的依赖组合，但保持 profile 不上线。",
  "verifiedEvidence": [
    "一键本地栈已串联 wallet-service、risk-server、wallet-api、wallet-sign、TSS 节点与 Wallet Launchpad，并执行仓库 test / build / vet、HTTP 冒烟和双租户隔离门禁",
    "Sepolia ETH 已完成测试网充值、手动归集、2-of-3 MPC 提现、广播、两个确认、账本结算与通知，最终账实差额为零",
    "wallet-sign 已收敛 local、HSM、TSS 与 FROST 后端；TSS 2-of-3 fail-closed / 恢复已通过本地栈验证，Solana FROST 链上 E2E 仍待验收",
    "Base Sepolia 原生 ETH、Base / BNB WLT 与 Bitcoin Testnet4 已完成独立 clean 本地无资金 Gate，覆盖链身份、资产元数据、原生手续费、nonce / UTXO 资源、scanner finality 与幂等恢复",
    "wallet-api 已验证 EVM、Bitcoin、Tron、Cosmos 与 Solana 的链级资源边界；当前没有 Sui adaptor",
    "risk-server 会绑定审批 envelope 与交易字段、生成 Ed25519 risk proof，并在没有 AML provider 时明确 fail closed"
  ],
  "targetOutcome": "形成一套可配置、可恢复、可审计的多链钱包后端：新链和新资产通过 profile 接入，充值、归集、提现、风控、门限签名、广播确认、账本与通知共享统一状态语义，任何结果未知都能沿原交易身份恢复。",
  "nextMilestone": "冻结统一多链 release candidate，完成一条非 Sepolia funded 测试网闭环，并完成 Agent Stablecoin Wallet 与 Wallet Launchpad 的版本化 risk / signer / delivery 依赖组合。",
  "knownLimits": [
    "当前仍是学习、工程验证和测试网验收项目，不代表生产钱包部署、真实业务规模或主网资金经历",
    "只有 Sepolia ETH 已形成完整测试网证据；Base Sepolia、BNB Testnet 与 Bitcoin Testnet4 已完成本地无资金门禁，Tron、Cosmos 与 Solana 仍处于本地链路或待注资验收状态",
    "risk-server 没有接入真实 AML、制裁名单、设备指纹或生产规则平台",
    "真实 PKCS#11 设备、生产 TSS 集群、Solana Devnet FROST 链上 E2E 和数据库迁移回滚演练仍未验收",
    "仓库暂按私有项目展示，不提供公开源码链接"
  ],
  "updatedAt": "2026-08-04",
  "coreAbilities": [
    "充值提现异步状态机",
    "多链 RPC 与 Chain Adaptor",
    "local / HSM / TSS / FROST 统一签名边界",
    "提现风控、审批凭证与离线交易一致性校验",
    "链级资源租约、幂等、确认数与失败补偿",
    "Go、gRPC、PostgreSQL 与 Redis"
  ],
  "talkingPoints": [
    "为什么资金编排、链节点、签名和风控要分属不同信任边界",
    "广播超时为什么不能直接重发第二笔交易",
    "链上成功但本地失败时如何以链上事实幂等恢复",
    "哪些生产化能力仍然没有完成"
  ],
  "techStack": ["Go", "gRPC", "PostgreSQL", "Redis", "LevelDB", "GORM", "Chain Adaptor", "EVM", "Bitcoin", "Solana", "Tron", "Cosmos", "TSS", "FROST"],
  "engineering": {
    "role": "钱包基础设施代码理解、增量实现、运行验证与异常路径梳理",
    "systemBoundary": "wallet-service 维护业务资金状态与链资源租约，risk-server 校验交易内容并生成审批证明，wallet-api 负责链节点查询与交易构建/广播，wallet-sign 是 local、HSM、TSS 与 FROST 的唯一钱包侧签名入口；任何后端故障都不能自动切换托管身份。",
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
      "Wallet Launchpad 一键栈、Sepolia 测试网充提记录，以及 Base、BNB、Bitcoin 的独立无资金验收 Gate",
      "dispatcher、adaptor、RPC service、资金状态与链资源相关测试",
      "risk-server envelope / proof 与 fail-closed 测试",
      "TSS / FROST 阈值不足、恢复与后端身份绑定验证"
    ],
    "knownLimits": [
      "Sepolia 之外的链尚未形成同等级真实测试网验收证据；无资金 Gate 不等于 funded E2E",
      "生产 HSM/TSS、主网写入、完整外部风控、长期可用性与容量仍属于外部验收或目标态"
    ],
    "overviewSummary": "这是我的 Web3 钱包后端主线：用 Exchange Wallet Infrastructure 拆开资金状态、多链节点、私钥签名和风险控制，并围绕幂等、确认数、风控放行、结果未知和补偿恢复理解资金系统。"
  },
  "learning": {
    "goal": "能够不依赖背稿讲清四个服务的职责、充值提现状态机和关键异常恢复案例，并能回到代码和测试证明判断。",
    "verified": [
      "API 与 Sign 两套 adaptor 的职责差异",
      "risk-server 的审批字段绑定、Ed25519 proof 与缺少 AML provider 时的失败关闭",
      "充值与提现 worker、数据库状态和通知路径",
      "Sepolia 测试网充值、归集、MPC 提现、确认、结算与通知链路",
      "Base 原生 ETH、Base / BNB WLT 与 Bitcoin Testnet4 的本地无资金验收边界",
      "广播超时与链上/本地状态不一致的处理原则"
    ],
    "verification": [
      "go test ./chaindispatcher ./chain/ethereum ./chain/bitcoin",
      "go test ./services/grpc",
      "go test ./services/rpc",
      "go test ./services ./common/bigint ./leveldb",
      "./scripts/dev-stack.sh test"
    ],
    "verificationNote": "2026-08-04 在整合多链 Gate 的 clean release candidate 上重新通过完整 Go test / vet / build；Sepolia 与各链 Gate 结果来自私有仓库的去敏记录。它们证明当前本地或测试网范围，不证明生产部署或所有链均已 funded 验收。",
    "tradeoffs": [
      "当前代码事实、设计理解和生产化建议分开表达",
      "不使用线上规模、真实资金量或生产事故包装项目",
      "优先完成可复现失败路径，而不是继续堆叠支持链数量"
    ],
    "nextSteps": [
      "固定统一多链 release candidate、启动顺序和验收矩阵",
      "完成一条非 Sepolia 测试网充提归集链路",
      "完成 Agent Payment 版本化依赖组合与跨进程本地门禁"
    ]
  },
  "conceptTags": ["wallet-backend", "api-design", "multi-chain", "signer-service", "risk-control", "go-infra"],
  "relatedArticleSlugs": ["evm-broadcast-unknown-canonical-recovery", "cex-evm-wallet-deposit-withdrawal-loop", "withdrawal-error-handling", "wallet-ledger-transaction-mq-consistency", "wallet-api-boundary", "wallet-sign-signer", "new-chain-integration-checklist"],
  "suggestedQuestions": [
    "Exchange Wallet Infrastructure 为什么要拆成四个服务边界？",
    "提现广播超时后应该如何恢复？",
    "当前哪些是已实现事实，哪些仍是生产化方向？"
  ]
}
---

四个仓库在网站中作为一个基础设施案例表达，避免把同一条资金链路拆成互相竞争的独立项目。
