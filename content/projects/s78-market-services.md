---
{
  "id": 3,
  "slug": "s78-market-services",
  "name": "Qiu Market",
  "category": "可信行情与虚拟交易",
  "featured": false,
  "publish": true,
  "portfolioTier": "verified",
  "activityStatus": "active",
  "stage": "verified-local",
  "sourceType": "adapted",
  "visibility": "private",
  "positioning": "多场所可信行情与虚拟现货交易学习产品：聚合 CEX、Perp 与 AMM 行情，以 PostgreSQL / Redis / Doris 组织数据事实，并通过仅使用虚拟资金的 BTC/USDT 撮合、账本和恢复链路学习交易系统。",
  "currentFocus": "冻结功能扩张，先把当前本地分支的迁移、恢复、未知结果、公开缓存与 outbox 修复推进到 Preview 和滚动证据门；真实交易、衍生品和新策略不在当前目标内。",
  "verifiedEvidence": ["当前本地分支已实现四家 CEX WebSocket / REST 对账、Hyperliquid、Uniswap / PancakeSwap、可信新鲜度和 16 个只读 gRPC RPC", "HTTP / gRPC / PostgreSQL / Redis、外部行情来源与 Doris 分析链路已有本地集成记录，动态资产和市场数量只作为现场快照", "BTC/USDT 虚拟交易已覆盖定点数撮合、available / held 双重记账、PostgreSQL 事件/快照/outbox、幂等、WebSocket cursor 与重启 state hash 恢复", "HEAD 7df9001 的 review 修复已通过 Go test/race/vet、前端 25 个测试与构建、隔离 PostgreSQL publisher/feed/cleanup 集成和当前二进制恢复演练"],
  "targetOutcome": "形成一个可重复、可解释的单用户虚拟资金交易学习产品：行情来源、新鲜度、撮合、账本、事件、恢复和失败降级都有明确事实边界，并能从浏览器结果追到代码和验证证据。",
  "nextMilestone": "先把当前 reviewed artifact 推送并合并到共享基线，再完成生产 migration、受保护 Preview 验收与完整七天滚动证据；任何门未通过都不晋级生产状态。",
  "knownLimits": ["当前证据来自本地 clean 分支 codex/trading-core-lab，仍领先 origin/main 26 个提交，尚未 push 或 merge", "生产 migration、受保护 Preview、OAuth 回调、容量与完整七天 soak 尚未验收", "交易只使用虚拟资金，不接充值、提现、私钥、真实交易所下单或实盘资产", "多场所资产数量、延迟和可用率都是时间点快照，不作为固定规模或 SLA 声明", "仓库暂按私有项目展示"],
  "updatedAt": "2026-07-28",
  "coreAbilities": ["多场所行情采集与身份治理", "数据新鲜度与故障隔离", "Redis/PostgreSQL/Doris", "HTTP/gRPC", "虚拟现货撮合与双重记账", "事件流、快照与恢复", "Vue 交易终端"],
  "talkingPoints": ["为什么 Perp/DEX 不能直接混入综合现货价", "行情可用与行情新鲜有什么区别", "虚拟交易为什么仍需要双重记账与结果未知恢复", "本地集成通过为什么不等于生产验收"],
  "techStack": ["Go", "HTTP", "gRPC", "Redis", "PostgreSQL", "Doris", "WebSocket", "Vue", "TypeScript", "Vite"],
  "engineering": {
    "role": "多场所行情、虚拟撮合、账本、恢复和浏览器产品链路的实现与验证",
    "systemBoundary": "Qiu Market 只处理行情与单用户虚拟资金交易；它不接交易所真实下单、充值提现、私钥或实盘资产，行情参考异常也不能伪造可成交价格。",
    "callFlow": ["Crawler / DEX adapter 获取并核对外部行情", "统一 Snapshot Writer 写 PostgreSQL 并派生 Redis / Doris", "HTTP / gRPC 向前端提供来源和新鲜度", "虚拟交易 gateway 把命令送入单市场 runner", "撮合、账本、事件、outbox 与快照在 PostgreSQL 恢复", "Vue 展示行情、订单、余额和错误状态"],
    "failureScenarios": ["外部来源失败时保留最后成功值并降级，不能生成 mock 行情", "交易存储提交结果未知时停止接单并从事件流恢复", "参考行情过期时 demo-maker 撤单停机但不破坏撮合恢复", "生产 migration 或恢复证据不完整时禁止晋级"],
    "evidence": ["Go test/race/vet 与交易 fuzz/benchmark", "前端单测、生产构建与浏览器回归", "真实 PostgreSQL restart/state-hash 集成", "Doris 与多场所来源本地交换数据记录", "HEAD 7df9001 review 修复与恢复演练"],
    "knownLimits": ["当前 reviewed artifact 尚未进入 origin/main", "生产 migration、Preview、OAuth、容量和七天滚动证据仍待验收", "虚拟资金边界不能包装成商业交易所或实盘经验"],
    "overviewSummary": "Qiu Market 是钱包主线之外的交易系统学习产品，用可信行情、虚拟撮合、双重记账和恢复证据串起数据与交易控制流，同时把本地集成与生产验收严格分开。"
  },
  "learning": {
    "goal": "理解多场所行情、撮合、双重记账、事件持久化和故障恢复如何组成一个完整但只使用虚拟资金的交易系统。",
    "verified": ["多场所行情身份、新鲜度和 rollout 边界", "BTC/USDT 定点数撮合与订单语义", "available / held 账本与费用分录", "PostgreSQL 事件/快照/outbox 与重启 state hash", "浏览器虚拟入金、挂单、成交、撤单和恢复链路"],
    "verification": ["go test ./...", "go test -race ./trading/...", "go vet ./...", "npm --prefix frontend test -- --run", "npm --prefix frontend run build", "git diff --check"],
    "verificationNote": "2026-07-28 当前本地分支验证通过；PostgreSQL 集成与恢复演练有独立记录，但分支尚未推送合并，生产迁移、Preview 和七天 soak 不计入已完成证据。",
    "tradeoffs": ["不使用假数据兜底", "真实行情与可执行路线价格分开", "教学可审计性优先于低延迟优化", "虚拟资金与真实交易严格隔离", "未完成生产门继续保持 pending"],
    "nextSteps": ["推送并合并 reviewed artifact", "执行生产 migration 与受保护 Preview 验收", "积累完整七天滚动证据后再评估生产状态"]
  },
  "conceptTags": ["go-infra", "api-design"],
  "relatedArticleSlugs": ["market-services-data-flow", "http-rpc-grpc", "api-system-calls", "wallet-ledger-transaction-mq-consistency"],
  "suggestedQuestions": ["Qiu Market 如何区分综合现货价、Perp 和 DEX 路线价？", "虚拟交易如何保证撮合与账本一致？", "结果未知时如何恢复而不重复执行？", "为什么当前仍是 verified-local？"]
}
---

该项目只展示当前本地分支能够支持的行情与虚拟交易事实；未推送、未合并和未完成生产证据的部分继续明确标记为 pending。
