---
{
  "id": 1,
  "legacyIds": [2],
  "slug": "exchange-wallet-system",
  "name": "Wallet Infrastructure",
  "category": "钱包基础设施",
  "featured": false,
  "publish": true,
  "portfolioTier": "exploration",
  "activityStatus": "active",
  "stage": "exploring",
  "sourceType": "adapted",
  "visibility": "private",
  "positioning": "当前的钱包后端基础设施学习与证据建设方向，聚焦资金状态、链上事实、Ledger、签名边界、恢复与可观测性；私有基线审计已经完成，但尚未形成通过公开 Claim 门禁的新实现。",
  "currentFocus": "围绕已核验的私有基线，继续验证单资产充值、Ledger、Outbox、余额投影和对账能否组成默认可运行的最小闭环。",
  "verifiedEvidence": [
    "已完成一个私有 canonical baseline 的只读审计与仓库级构建验证",
    "充值、Ledger、Outbox、Projection 与 Reconciliation 存在相邻实现，但尚未形成默认可运行的完整 authority 闭环",
    "当前对外 Claim 仍为 locked；私有路径、固定 SHA 与未通过发布门禁的实现细节不在网站公开"
  ],
  "targetOutcome": "形成一个本人能够定位代码、运行测试、注入失败并讲清资金、链、账务、签名和恢复边界的最小钱包基础设施证据闭环。",
  "nextMilestone": "在固定私有基线上完成一个可复现失败切片，独立验证 Deposit、Ledger 与 Outbox 的事务边界，再决定哪些结论可以通过公开 Claim 门禁。",
  "knownLimits": [
    "私有 baseline 已审计，但默认运行路径与 dormant authority 路径仍不等价",
    "当前页面只公开方向和证据等级，不公开未通过发布门禁的仓库路径、SHA 或私有实现细节",
    "不会连接真实资金、签名或广播，也不会把 fixture、no-funds 或历史材料写成当前测试网或生产证据",
    "本人掌握度仍处于 learning，公开材料和 AI 整理不能替代闭卷复现"
  ],
  "updatedAt": "2026-08-24",
  "coreAbilities": [
    "充值扫描与地址归属",
    "确认策略与链重组处理",
    "双分录 Ledger 与余额投影",
    "Outbox 原子性与幂等事件",
    "签名边界与广播结果未知",
    "固定高度对账与失败恢复"
  ],
  "talkingPoints": [
    "为什么链上托管余额不等于用户负债",
    "为什么 Deposit、Ledger entry 与 Outbox 需要同一短事务",
    "scanner cursor 为什么只能推进最高连续已提交高度",
    "当前哪些是设计范围，哪些仍然是 Missing"
  ],
  "techStack": ["Go", "PostgreSQL", "Ledger", "Outbox", "Chain Scanner", "Observability"],
  "engineering": {
    "role": "钱包基础设施学习、候选基线选择与最小证据闭环设计",
    "systemBoundary": "目标边界是让 Scanner 负责链上观察，ownership 负责地址归属，Deposit 负责业务状态，Ledger 负责负债事实，Outbox 负责事务后交付；当前仍是设计范围，尚未绑定具体实现。",
    "callFlow": [
      "Scanner 读取区块并产生候选链上事件",
      "地址归属与链身份校验决定事件是否进入业务域",
      "Finality 策略决定何时允许业务入账",
      "Deposit、Ledger entry 与 Outbox 在同一短事务中提交",
      "Balance Projection 从 Ledger 派生可用余额",
      "Reconciliation 在固定高度比较 custody 与 liability"
    ],
    "failureScenarios": [
      "Deposit 已识别但 Ledger 或 Outbox 原子写失败",
      "区块重组使已观察事件失去 canonical 身份",
      "scanner cursor 越过未提交高度导致永久漏扫"
    ],
    "evidence": [
      "私有 baseline 的仓库级测试、构建与静态检查已经通过",
      "下一阶段证据必须来自同一固定基线上的可复现失败注入和默认运行路径"
    ],
    "knownLimits": [
      "尚无默认启用的完整 authority 闭环、集成运行验收或公开 Claim",
      "旧项目材料和公开实验不得自动升级为当前实现或本人贡献"
    ],
    "overviewSummary": "这是当前的钱包后端基础设施学习与证据方向；私有 baseline 已审计，但网站继续保留 Partial、Missing 与公开 Claim 门禁边界。"
  },
  "learning": {
    "goal": "能够在固定代码基线上解释充值、Ledger、Outbox、余额投影与对账的事实边界，并复现至少一个失败场景。",
    "verified": [],
    "verification": [],
    "verificationNote": "私有 baseline 已完成仓库级验证，但命令、路径和 SHA 尚未通过公开发布门禁，因此本站不列出为公开项目证据。",
    "tradeoffs": [
      "先建立一个可复现闭环，不先扩多链、微服务或新 UI",
      "设计理解、历史材料和当前代码证据分开表达",
      "不使用生产规模、真实资金或未复验的旧结果包装项目"
    ],
    "nextSteps": [
      "在已选私有 baseline 上复现一个最小失败切片",
      "验证 Deposit、Ledger 与 Outbox 是否进入同一默认运行路径",
      "为 Ledger 与 Outbox 原子失败编写最小失败合同"
    ]
  },
  "conceptTags": ["wallet-backend", "ledger", "chain-scanner", "outbox", "reconciliation", "go-infra"],
  "relatedArticleSlugs": ["cex-evm-wallet-deposit-withdrawal-loop", "wallet-ledger-transaction-mq-consistency", "wallet-api-boundary", "wallet-sign-signer"],
  "suggestedQuestions": [
    "当前钱包基础设施方向已经证明了什么？",
    "充值、Ledger 与 Outbox 的事务边界应该怎样划分？",
    "下一步如何从 Missing 走到可复现的实现证据？"
  ]
}
---

本页只表达当前方向、证据缺口和下一次验证，不把历史项目或学习材料改写成新的实现事实。
