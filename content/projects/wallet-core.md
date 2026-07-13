---
{
  "id": 7,
  "slug": "wallet-core",
  "name": "wallet-core",
  "category": "TypeScript 多链",
  "featured": true,
  "stage": "verified-local",
  "sourceType": "original",
  "visibility": "private",
  "positioning": "TypeScript 多链离线钱包核心：统一密钥派生、交易构建与签名入口，同时保留 nonce、UTXO、blockhash、TAPOS 和 object version 等链级资源差异。",
  "currentFocus": "稳定不同链的输入契约、异常参数校验和可复现测试，让离线边界比支持链数量更可信。",
  "verifiedEvidence": [
    "TypeScript 类型检查与构建可以运行",
    "已覆盖 EVM、BTC、Solana、TRON、Cosmos 与 Sui 的交易模型",
    "已完成 Sui 原生充值交易 dry-run 流程"
  ],
  "targetOutcome": "形成一个有清晰 API、链级输入文档、示例和稳定测试矩阵的 TypeScript 离线钱包库，调用方可以安全地准备链上资源、离线签名并自行广播。",
  "nextMilestone": "修复 Cosmos 依赖解析并恢复全量测试，再补齐链资源过期和异常金额输入用例。",
  "knownLimits": [
    "不查询 RPC、不广播交易，调用方必须提供新鲜链状态",
    "Cosmos 全量测试仍受依赖解析问题影响",
    "仓库暂按私有项目展示"
  ],
  "updatedAt": "2026-07-13",
  "coreAbilities": ["TypeScript SDK 集成", "多链离线交易构建", "账户/UTXO/对象模型", "最小单位整数金额", "Jest 链级测试"],
  "talkingPoints": ["离线核心为什么不读取 RPC", "不同链的资源状态为何不能被统一字段抹平", "整数金额约束如何降低资产错误", "测试如何覆盖链模型差异"],
  "techStack": ["TypeScript", "ethers", "bitcoinjs-lib", "@solana/web3.js", "@mysten/sui", "CosmJS", "TronWeb", "Jest"],
  "engineering": {
    "role": "TypeScript 多链离线钱包核心的实现与验证",
    "systemBoundary": "只负责密钥派生、交易构建与签名；RPC 查询、资源锁定和广播由调用方承担。",
    "callFlow": ["调用方准备链上资源", "wallet-core 校验链级输入", "构建并签名交易", "返回 raw transaction"],
    "failureScenarios": ["链资源过期后旧签名不可继续使用", "浮点金额或错误单位可能造成资产精度错误"],
    "evidence": ["TypeScript typecheck", "链相关 Jest 套件", "Sui dry-run 充值模拟"],
    "knownLimits": ["Cosmos 依赖解析待修复", "不包含在线 RPC、资源预占和广播服务"],
    "overviewSummary": "wallet-core 用 TypeScript 收敛多链钱包入口，但保留每条链影响资产安全的资源状态，而不是假装所有链都只有 from、to、amount。"
  },
  "learning": {
    "goal": "把不同链的密钥、交易和签名差异收敛成可测试的离线核心，同时保留不可抹平的链级约束。",
    "verified": ["EVM 原生币与 Token", "BTC 多 UTXO、找零和多地址类型", "SOL/SPL、TRX/TRC20 与 Sui 原生转账"],
    "verification": ["npm run typecheck", "npm test -- --runInBand", "npm run test:sui", "npm run build", "npm run sui:deposit"],
    "verificationNote": "类型检查、构建和主要链套件已有本地验证记录；Cosmos 依赖问题明确列为限制。",
    "tradeoffs": ["离线核心不负责网络状态", "金额只接受最小单位整数", "示例不保存真实密钥"],
    "nextSteps": ["修复 Cosmos 测试依赖", "补充异常交易参数校验", "整理链适配器输入契约"]
  },
  "conceptTags": ["wallet-core", "multi-chain", "signer-service", "wallet-backend"],
  "relatedArticleSlugs": ["multi-chain-wallet-resource-state", "wallet-address-models", "wallet-sign-signer", "wallet-api-boundary"],
  "suggestedQuestions": ["wallet-core 如何处理不同链的离线签名输入？", "为什么金额只接受最小单位整数？", "如何验证多链交易构建？"]
}
---

该项目用于展示 TypeScript 工程能力，以及对多链资源状态和离线签名边界的理解。
