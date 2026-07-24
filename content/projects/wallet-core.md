---
{
  "id": 7,
  "slug": "wallet-core",
  "name": "wallet-core",
  "category": "TypeScript 多链",
  "featured": true,
  "publish": true,
  "portfolioTier": "verified",
  "activityStatus": "active",
  "stage": "showcase-ready",
  "sourceType": "original",
  "visibility": "public",
  "repositoryUrl": "https://github.com/qianqiu0404/wallet-core",
  "positioning": "TypeScript 多链离线钱包核心：统一密钥派生、交易构建与签名入口，同时保留 nonce、UTXO、blockhash、TAPOS 和 object version 等链级资源差异。",
  "currentFocus": "稳定不同链的输入契约、异常参数校验和可复现测试，让离线边界比支持链数量更可信。",
  "verifiedEvidence": [
    "Node 20/22 CI 已完成类型检查、九套 Jest、45 个测试、构建和 dist 导入验证",
    "已覆盖 EVM、BTC、Solana、TRON、Cosmos 与 Sui 的交易模型，并修正 Solana 私钥 Base58 编码",
    "v1.0.0 GitHub Release 已公开；Sui 示例默认 dry-run，广播必须显式启用"
  ],
  "targetOutcome": "形成一个有清晰 API、链级输入文档、示例和稳定测试矩阵的 TypeScript 离线钱包库，调用方可以安全地准备链上资源、离线签名并自行广播。",
  "nextMilestone": "补齐链资源过期、错误最小单位和无效对象引用的统一负向测试，再评估是否稳定 npm API。",
  "knownLimits": [
    "不查询 RPC、不广播交易，调用方必须提供新鲜链状态",
    "未经独立安全审计，不应直接用于生产资金",
    "V1 只发布 GitHub Release，package 继续保持 private，尚未发布 npm"
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
    "evidence": ["Node 20/22 CI", "九套链 Jest 与 45 个测试", "dist import smoke test", "Sui dry-run 充值模拟", "v1.0.0 Release"],
    "knownLimits": ["未经独立安全审计", "不包含在线 RPC、资源预占、广播和账务服务", "暂未发布 npm"],
    "overviewSummary": "wallet-core 用 TypeScript 收敛多链钱包入口，但保留每条链影响资产安全的资源状态，而不是假装所有链都只有 from、to、amount。"
  },
  "learning": {
    "goal": "把不同链的密钥、交易和签名差异收敛成可测试的离线核心，同时保留不可抹平的链级约束。",
    "verified": ["EVM 原生币与 Token", "BTC 多 UTXO、找零和多地址类型", "SOL/SPL、TRX/TRC20 与 Sui 原生转账"],
    "verification": ["npm run typecheck", "npm test -- --runInBand", "npm run test:sui", "npm run build", "npm run sui:deposit"],
    "verificationNote": "2026-07-13 在干净 npm ci 环境通过类型检查、九套链 Jest、45 个测试、构建、dist 导入与敏感信息扫描。",
    "tradeoffs": ["离线核心不负责网络状态", "金额只接受最小单位整数", "示例不保存真实密钥"],
    "nextSteps": ["补充链资源过期用例", "补充错误单位和无效对象引用校验", "稳定链适配器输入契约"]
  },
  "conceptTags": ["wallet-core", "multi-chain", "signer-service", "wallet-backend"],
  "relatedArticleSlugs": ["multi-chain-wallet-resource-state", "wallet-address-models", "wallet-sign-signer", "wallet-api-boundary"],
  "suggestedQuestions": ["wallet-core 如何处理不同链的离线签名输入？", "为什么金额只接受最小单位整数？", "如何验证多链交易构建？"]
}
---

该项目用于展示 TypeScript 工程能力，以及对多链资源状态和离线签名边界的理解。
