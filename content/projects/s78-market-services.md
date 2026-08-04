---
{
  "id": 3,
  "slug": "s78-market-services",
  "name": "Qiu Market Server",
  "category": "可信行情与交易基础设施",
  "featured": false,
  "publish": true,
  "portfolioTier": "verified",
  "activityStatus": "active",
  "stage": "verified-local",
  "sourceType": "adapted",
  "visibility": "private",
  "positioning": "面向行情产品与交易系统的统一 Market Server：接入 CEX、Perp 与 AMM 来源，输出带来源、新鲜度和降级状态的可信市场事实，并为虚拟现货交易提供撮合、账本、事件和确定性恢复。",
  "currentFocus": "以统一市场身份、行情新鲜度、虚拟资金账本和结果未知恢复为核心，收敛可重复发布的 Market Server；真实交易所下单、充值提现和衍生品执行不进入产品边界。",
  "verifiedEvidence": ["release artifact 72343ba 已实现四家 CEX WebSocket / REST 对账、Hyperliquid、Uniswap / PancakeSwap、可信新鲜度和 16 个只读 gRPC RPC", "HTTP / gRPC / PostgreSQL / Redis、外部行情来源与 Doris 分析链路已有本地集成记录，动态资产和市场数量只作为现场快照", "BTC/USDT 虚拟交易已覆盖定点数撮合、available / held 双重记账、PostgreSQL 事件/快照/outbox、幂等、WebSocket cursor 与重启 state hash 恢复", "2026-08-04 在 release artifact 上重新通过完整 Go test；已有记录还覆盖 race / vet、前端测试与构建、隔离 PostgreSQL publisher/feed/cleanup 集成和二进制恢复演练"],
  "targetOutcome": "完成后的 Qiu Market Server 是一套可独立部署的行情与虚拟交易后端：上游异常不会制造假价格，下游可以按统一市场身份读取报价、来源和健康状态；订单、余额、成交、事件和 WebSocket cursor 能在重启或提交结果未知后从 PostgreSQL 确定性恢复。",
  "nextMilestone": "完成标准是固定同一 release artifact，通过生产迁移、受保护 Preview、OAuth、备份恢复、容量与连续七天稳定性门，并让浏览器展示的行情、订单、余额和系统状态都能追溯到同一后端事实。",
  "knownLimits": ["当前 `verified-local` 证据不等于生产 migration、公开 Preview、容量或连续七天可用性验收", "交易只使用虚拟资金，不接充值、提现、私钥、真实交易所下单或实盘资产", "多场所资产数量、延迟和可用率都是时间点快照，不作为固定规模或 SLA 声明", "仓库暂按私有项目展示"],
  "updatedAt": "2026-08-04",
  "coreAbilities": ["多场所行情采集与身份治理", "数据新鲜度与故障隔离", "Redis/PostgreSQL/Doris", "HTTP/gRPC", "虚拟现货撮合与双重记账", "事件流、快照与恢复", "Vue 交易终端"],
  "talkingPoints": ["为什么 Perp/DEX 不能直接混入综合现货价", "行情可用与行情新鲜有什么区别", "虚拟交易为什么仍需要双重记账与结果未知恢复", "本地集成通过为什么不等于生产验收"],
  "techStack": ["Go", "HTTP", "gRPC", "Redis", "PostgreSQL", "Doris", "WebSocket", "Vue", "TypeScript", "Vite"],
  "engineering": {
    "role": "多场所行情、虚拟撮合、账本、恢复和浏览器产品链路的实现与验证",
    "systemBoundary": "Qiu Market 只处理行情与单用户虚拟资金交易；它不接交易所真实下单、充值提现、私钥或实盘资产，行情参考异常也不能伪造可成交价格。",
    "callFlow": ["Crawler / DEX adapter 获取并核对外部行情", "统一 Snapshot Writer 写 PostgreSQL 并派生 Redis / Doris", "HTTP / gRPC 向前端提供来源和新鲜度", "虚拟交易 gateway 把命令送入单市场 runner", "撮合、账本、事件、outbox 与快照在 PostgreSQL 恢复", "Vue 展示行情、订单、余额和错误状态"],
    "failureScenarios": ["外部来源失败时保留最后成功值并降级，不能生成 mock 行情", "交易存储提交结果未知时停止接单并从事件流恢复", "参考行情过期时 demo-maker 撤单停机但不破坏撮合恢复", "生产 migration 或恢复证据不完整时禁止晋级"],
    "evidence": ["Go test/race/vet 与交易 fuzz/benchmark", "前端单测、生产构建与浏览器回归", "真实 PostgreSQL restart/state-hash 集成", "Doris 与多场所来源本地交换数据记录", "release artifact 72343ba 与恢复演练"],
    "knownLimits": ["生产 migration、Preview、OAuth、容量和七天滚动证据仍待验收", "虚拟资金边界不能包装成商业交易所或实盘经验"],
    "overviewSummary": "Qiu Market Server 的产品形态是可信行情平面加可恢复的虚拟交易纵切片：它向上游治理来源与新鲜度，向下游提供一致的市场、订单、账本和事件事实。"
  },
  "learning": {
    "goal": "理解多场所行情、撮合、双重记账、事件持久化和故障恢复如何组成一个完整但只使用虚拟资金的交易系统。",
    "verified": ["多场所行情身份、新鲜度和 rollout 边界", "BTC/USDT 定点数撮合与订单语义", "available / held 账本与费用分录", "PostgreSQL 事件/快照/outbox 与重启 state hash", "浏览器虚拟入金、挂单、成交、撤单和恢复链路"],
    "verification": ["go test ./...", "go test -race ./trading/...", "go vet ./...", "npm --prefix frontend test -- --run", "npm --prefix frontend run build", "git diff --check"],
    "verificationNote": "2026-08-04 在 release artifact 72343ba 上重新通过完整 Go test；PostgreSQL 集成、race / vet、前端构建与恢复演练来自已有去敏记录。生产迁移、Preview、容量和七天 soak 不计入已完成证据。",
    "tradeoffs": ["不使用假数据兜底", "真实行情与可执行路线价格分开", "教学可审计性优先于低延迟优化", "虚拟资金与真实交易严格隔离", "未完成生产门继续保持 pending"],
    "nextSteps": ["固定前后端和迁移使用同一 release artifact", "执行生产 migration、受保护 Preview、OAuth 与备份恢复验收", "积累完整七天滚动证据并补容量边界"]
  },
  "conceptTags": ["go-infra", "api-design"],
  "relatedArticleSlugs": ["qiu-market-virtual-funds-recovery", "market-services-data-flow", "http-rpc-grpc", "api-system-calls", "wallet-ledger-transaction-mq-consistency"],
  "suggestedQuestions": ["Qiu Market 如何区分综合现货价、Perp 和 DEX 路线价？", "虚拟交易如何保证撮合与账本一致？", "结果未知时如何恢复而不重复执行？", "为什么当前仍是 verified-local？"]
}
---

页面先表达 Market Server 完成后的产品边界，再用当前 `verified-local` 证据说明已经走到哪里；虚拟资金、私有仓库和未完成的生产门保持明确。
