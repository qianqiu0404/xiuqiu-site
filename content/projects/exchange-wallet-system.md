---
{
  "id": 1,
  "legacyIds": [
    2
  ],
  "slug": "exchange-wallet-system",
  "sourceProjectId": "wallet-infra-mainline",
  "name": "Wallet Infrastructure",
  "category": "钱包基础设施",
  "featured": false,
  "publish": true,
  "portfolioTier": "exploration",
  "activityStatus": "active",
  "publicRole": "current-direction",
  "claimState": "locked",
  "stage": "exploring",
  "sourceType": "adapted",
  "visibility": "private",
  "positioning": "当前的钱包后端基础设施学习与证据建设方向，聚焦 Sepolia 充值、Ledger、Outbox、余额投影、提现结果未知、对账与只读诊断；已存在运行和离线验证记录，公开 Claim 仍为 locked。",
  "currentFocus": "以资金一致性的离线验证为重点，核对网络阻断、广播拒绝后保留冻结与原交易观察；把历史测试网充值、当前运行记录、离线候选和未完成恢复分开表达。",
  "verifiedEvidence": [
    "已提交记录显示：2026-10-19 完成 SAFE 扫描上界运行切换与短时观察；本轮只读复核，升级后的新充值验收仍未完成",
    "2026-10-21 的离线完整 Gate 记录覆盖网络阻断后的签名/首次广播门，以及广播拒绝后保留冻结、继续观察原交易与幂等结算；不表示部署或实网提现通过",
    "USDC 入账、原生 ETH 提现和热钱包对账已有局部实现与离线记录，但相应实网验收仍缺失；公开 Claim 保持 locked"
  ],
  "targetOutcome": "形成一个本人能够定位代码、运行测试、注入失败并讲清资金、链、账务、签名和恢复边界的最小钱包基础设施证据闭环。",
  "nextMilestone": "在同一固定候选上补齐资金一致性、人工复核恢复与充值重组补偿的离线证据；分别列清尚未部署、尚未实网验证和需 Owner 解释的部分，再评估公开 Claim。",
  "knownLimits": [
    "本轮只核对已提交状态与既有回执，没有运行钱包服务、连接数据库/RPC、使用密钥、签名或广播",
    "历史 ETH 充值与 10 月 19 日运行观察不能代替升级后新充值、USDC 入账、提现或热钱包对账验收",
    "拒绝后保留冻结的离线修复不自动修复历史已释放记录；人工复核恢复、充值重组资金补偿等仍有缺口",
    "本地 Console 展示或合成浏览器通过不代表实网业务完成；归集、多链、MPC/TSS 和真实 Kafka 不进入当前完成项",
    "私有源码、路径和版本标识不公开；代码、测试、公开 Claim 与本人掌握度分别判断"
  ],
  "updatedAt": "2026-10-24",
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
    "SAFE 扫描上界与 FINALIZED 资金入账为什么要分开",
    "为什么广播拒绝或结果未知时仍要保留冻结并观察原交易",
    "哪些离线测试已通过，哪些实网与恢复门仍未完成"
  ],
  "techStack": [
    "Go",
    "PostgreSQL",
    "Ledger",
    "Outbox",
    "Chain Scanner",
    "Observability"
  ],
  "engineering": {
    "role": "钱包基础设施学习、资金一致性实现的证据核对与失败边界梳理",
    "systemBoundary": "当前方向以 Sepolia 单运营方钱包为边界：Scanner 观察链，Deposit 表达业务状态，Ledger 保存资金事实，Outbox 交付事务后事件，投影与 Console 派生展示；Core 不持私钥，只读 SRE 不拥有资金权限。",
    "callFlow": [
      "Scanner 扫描到 SAFE 上界，独立等待 FINALIZED 证据才允许充值入账",
      "地址归属与资产路由决定链上事件对应哪一个负债账户",
      "Deposit、Ledger、来源唯一约束、余额投影与 Outbox 在一个短事务中提交",
      "通知至少一次交付，消费者和资金效果依靠幂等避免重复",
      "提现按申请、冻结、签名边界、广播与原交易观察分阶段处理",
      "Reconciliation 在固定 finalized 区块比较托管与负债；冲突进入显式 Incident"
    ],
    "failureScenarios": [
      "链上事件或 finalized 证据冲突时停止资金入账",
      "网络 Incident 阻断新的签名许可与首次广播意图",
      "广播拒绝或结果未知后保留冻结，不自动重签、重发或释放",
      "历史已释放记录、人工复核恢复和充值重组补偿仍需独立方案与验收"
    ],
    "evidence": [
      "10 月 19 日运行切换与短时观察的历史回执",
      "10 月 21 日资金一致性相关离线完整 Gate 及独立复审记录",
      "本轮已提交文档与必要代码入口只读核对；未重新执行钱包测试"
    ],
    "knownLimits": [
      "公开 Claim 保持 locked，离线通过不等于实网验收或本人掌握",
      "USDC、提现与热钱包对账的实网闭环仍未完成",
      "旧四服务材料独立标为历史，不替代当前 WIF 的实现与验收"
    ],
    "overviewSummary": "钱包方向已从基线审计推进到具体实现与分层验证。网站公开可复核的去敏摘要，同时保留未部署、未实网验证、恢复缺口与 Claim 门禁。"
  },
  "learning": {
    "goal": "在固定候选上解释充值、Ledger、Outbox、提现冻结与结果未知的事实边界，能复现失败并说明恢复中仍缺少什么。",
    "verified": [],
    "verification": [],
    "verificationNote": "本轮仅复核已提交状态和既有测试回执，未执行钱包测试，也未验证本人掌握度。历史运行、离线完整 Gate、本地界面候选和实网资金闭环各有独立范围；本站不公开私有命令参数、路径或版本标识。",
    "tradeoffs": [
      "离线候选、运行版本与历史验收分开记录",
      "未知结果先保留冻结与原交易观察，不用重试制造确定性",
      "先完成资金一致性与恢复证据，再扩资产、界面或公开 Claim"
    ],
    "nextSteps": [
      "补齐人工复核恢复与充值重组补偿的离线证据",
      "核对同一候选的源代码、测试回执和未部署边界",
      "在独立授权的实网步骤与本人解释均完成后再评估 Claim"
    ]
  },
  "conceptTags": [
    "wallet-backend",
    "ledger",
    "chain-scanner",
    "outbox",
    "reconciliation",
    "go-infra"
  ],
  "relatedArticleSlugs": [
    "cex-evm-wallet-deposit-withdrawal-loop",
    "wallet-ledger-transaction-mq-consistency",
    "wallet-api-boundary",
    "wallet-sign-signer"
  ],
  "suggestedQuestions": [
    "当前钱包基础设施方向已经证明了什么？",
    "充值、Ledger 与 Outbox 的事务边界应该怎样划分？",
    "下一步如何从 Missing 走到可复现的实现证据？"
  ]
}
---

当前 WIF 的记录与旧四服务材料分开阅读。2026-10-24 只读核对了既有实现与验证材料，没有代替 Owner 验收，也没有提升公开 Claim。
