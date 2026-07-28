---
{
  "id": 12,
  "slug": "wallet-launchpad",
  "name": "Wallet Launchpad",
  "category": "钱包控制台与测试网验收",
  "featured": false,
  "publish": true,
  "portfolioTier": "verified",
  "activityStatus": "active",
  "stage": "verified-local",
  "sourceType": "adapted",
  "visibility": "private",
  "positioning": "面向交易所与支付业务方的多租户钱包控制台学习版，把地址、扫链、资金对账、风险审批、门限签名和交易状态组织成可演示、可复核的 B 端测试网工作台。",
  "currentFocus": "以 Sepolia 已验收链路为可信基线，继续统一测试网 profile、资产级 readiness、V4 资源与费用预留、签名后端健康和验收证据，同时保持普通浏览器写入与主网能力失败关闭。",
  "verifiedEvidence": [
    "Go BFF 与 React / Next.js 控制台支持两个隔离租户、Demo / Live 边界、资金总览、地址、充值提现、归集、签名健康、多链矩阵与状态时间线",
    "一键本地栈可启动钱包服务、风险服务、链 API、统一签名入口、TSS / FROST 节点、数据库与控制台，并执行仓库门禁、HTTP 冒烟和双租户隔离检查",
    "Sepolia ETH 已完成测试网充值、local 地址归集、2-of-3 MPC 提现、广播确认、账本结算与通知，最终账实差额为零",
    "受保护的 Vercel Preview 通过同源 BFF 与短期 OIDC 访问隔离的 Mac mini staging，数据库、gRPC 和签名节点不直接暴露公网",
    "其他测试网 profile 已有独立钱包空间、worker、scanner 或只读 readiness，但尚未形成与 Sepolia 同等级的充提归集证据"
  ],
  "targetOutcome": "形成一个五分钟内可讲清的钱包后端产品演示：从租户和链上下文进入充值、归集、提现和恢复路径，并能从每个界面状态继续追到服务边界、失败条件和去敏证据。",
  "nextMilestone": "冻结当前跨仓库兼容基线，完成至少一条非 Sepolia 测试网的充值、归集、提现与对账验收，并让私有 Preview 使用同一 reviewed artifact 复核。",
  "knownLimits": [
    "这是私有学习与测试网工程演示，不是生产钱包运营后台，也不代表真实业务规模或主网托管经验",
    "只有 Sepolia ETH 已形成完整测试网验收；其他链和代币仍有注资、资产配置或链级 E2E 缺口",
    "Vercel Preview 受身份保护且依赖隔离 staging，不是公开可用产品或生产部署",
    "真实 HSM、生产 TSS 集群、Solana Devnet FROST 链上 E2E、主网写入和长期可用性仍未验收",
    "仓库保持私有，不提供公开源码链接"
  ],
  "updatedAt": "2026-07-28",
  "coreAbilities": [
    "多租户 BFF 与数据隔离",
    "测试网充值、归集与提现体验",
    "资金账本与链上托管对账",
    "链与资产 readiness 门禁",
    "TSS / FROST 签名健康与失败关闭",
    "私有 Preview 与 OIDC 边界"
  ],
  "talkingPoints": [
    "为什么浏览器不能直接连接数据库、gRPC 或签名节点",
    "Demo、Live、测试网验收和生产状态如何区分",
    "充值地址、热钱包与储备钱包为什么使用不同托管身份",
    "链上成功后界面、账本或通知未推进时如何恢复"
  ],
  "techStack": ["Go", "gRPC", "PostgreSQL", "React", "Next.js", "TypeScript", "Vercel", "OIDC", "TSS", "FROST"],
  "engineering": {
    "role": "钱包控制台、BFF、测试网验收编排和去敏工程证据的设计实现",
    "systemBoundary": "浏览器只访问 BFF；BFF 通过租户、profile、asset 与 readiness 门禁读取数据或调用 wallet-service。数据库、链 RPC、wallet-sign、TSS / FROST 和运行凭据不进入浏览器，也不因 Live 依赖失败回退 Demo。",
    "callFlow": [
      "用户选择租户、测试环境、链 profile 与资产",
      "BFF 校验身份、Live allowlist、readiness 与资产级验收状态",
      "wallet-service 执行钱包空间、充值地址、归集或提现编排",
      "risk-server、wallet-api 与 wallet-sign / TSS / FROST 完成审批、链资源、签名和广播边界",
      "BFF 只读聚合账本、链上托管、事件与 scanner 状态",
      "控制台展示进度、阻断原因、差额和去敏证据"
    ],
    "failureScenarios": [
      "任一 Live profile、scanner、signer quorum 或资金前置条件不满足时禁止写入，不回退 Demo",
      "预检与正式提交之间费用或资金变化时要求重新确认，不能静默沿用旧报价",
      "签名或广播结果未知时保留原 request、资源和资金状态恢复，不能创建第二笔资金效果",
      "切换租户、链或资产时取消旧请求并清空旧上下文，避免跨租户或跨链串数据"
    ],
    "evidence": [
      "Wallet Launchpad README、架构与测试网验收手册",
      "一键栈 repository / HTTP / TSS / FROST 门禁记录",
      "Sepolia 充值、归集、MPC 提现、确认、结算与通知去敏证据",
      "受保护 Vercel Preview、OIDC BFF 与隔离 staging 验证"
    ],
    "knownLimits": [
      "私有 Preview 与本地测试网验收不等于生产部署",
      "其他链、真实 HSM、生产 TSS、主网写入和长期 soak 仍待独立验收"
    ],
    "overviewSummary": "Wallet Launchpad 是 Exchange Wallet Infrastructure 的产品化解释层：它不新增资金真值，而是把后端状态、边界、失败门禁和测试网证据组织成可操作的 B 端工作台。"
  },
  "learning": {
    "goal": "能够从控制台的一条测试网用户旅程解释后端服务、资金状态、链资源、签名托管和失败恢复，而不是只展示静态页面。",
    "verified": [
      "双租户 Demo / Live 隔离",
      "Sepolia 充值、归集与 MPC 提现闭环",
      "资金账本、链上托管与实际费用对账",
      "TSS / FROST 阈值不足时的 fail-closed / 恢复",
      "受保护 Preview 与同源 BFF 边界"
    ],
    "verification": [
      "./scripts/dev-stack.sh test",
      "go test ./...",
      "go build ./...",
      "go vet ./...",
      "npm --prefix web test",
      "npm --prefix web run lint",
      "npm --prefix web run build"
    ],
    "verificationNote": "命令与测试网结果来自私有仓库的去敏验证记录；本轮网站更新没有重新广播交易，也不把 Preview 或测试网证据表述为生产验收。",
    "tradeoffs": [
      "BFF 统一真实系统边界，不让浏览器持有服务凭据",
      "Demo 可演示性与 Live 事实严格分开",
      "按 profile / asset 记录验收，不用一个全局完成状态覆盖链级差异",
      "优先失败关闭和可解释阻断，不使用 mock 数据掩盖 Live 故障"
    ],
    "nextSteps": [
      "完成一条非 Sepolia 测试网完整验收",
      "固定跨仓库 reviewed artifact 与私有 Preview",
      "补多链结果未知、资源过期和重启恢复演示"
    ]
  },
  "conceptTags": ["wallet-backend", "multi-chain", "signer-service", "risk-control", "go-infra", "api-design"],
  "relatedArticleSlugs": ["cex-evm-wallet-deposit-withdrawal-loop", "withdrawal-error-handling", "wallet-ledger-transaction-mq-consistency", "wallet-api-boundary", "wallet-sign-signer"],
  "suggestedQuestions": [
    "Wallet Launchpad 与 Exchange Wallet Infrastructure 如何分工？",
    "Sepolia 测试网闭环证明了什么，又没有证明什么？",
    "为什么 Live 依赖异常时不能回退 Demo？"
  ]
}
---

该项目只进入完整项目图谱，不作为首页代表项目；私有 Preview、测试网验收与生产能力始终分开表达。
