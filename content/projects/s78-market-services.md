---
{
  "id": 3,
  "slug": "s78-market-services",
  "sourceProjectId": "qiu-market",
  "name": "Qiu Market Server",
  "category": "可信行情与交易基础设施",
  "featured": false,
  "publish": true,
  "portfolioTier": "verified",
  "activityStatus": "active",
  "publicRole": "current-product",
  "claimState": "evidence-ready",
  "stage": "verified-local",
  "sourceType": "adapted",
  "visibility": "private",
  "positioning": "面向行情产品与交易系统的统一 Market Server：接入 CEX、Perp 与 AMM 来源，输出带来源、新鲜度和降级状态的可信市场事实，并为虚拟现货交易提供撮合、账本、事件和确定性恢复。",
  "currentFocus": "在保留虚拟资金与本地恢复边界的同时，分别核对行情读链路、参考价新鲜度、研究发布与交易验收；入口恢复不能替代数据质量恢复。",
  "verifiedEvidence": [
    "原有虚拟 BTC/USDT 撮合、available / held 双重记账、PostgreSQL 事件/快照/outbox、幂等与 state hash 恢复证据继续保留，2026-08-04 完整 Go test 复验属于历史基线",
    "2026-08-10 的本地 full-stack golden 记录覆盖浏览器、HTTP/gRPC、真实一次性 PostgreSQL、进程强制终止后 snapshot + event tail 恢复与独立账务核对；外部行情与研究使用隔离夹具",
    "2026-10-17 的恢复记录确认公开行情读链路的 502 消除；同次现场参考价仍不可用、市场雷达公开列表为空，不能据此宣布整套产品恢复"
  ],
  "targetOutcome": "完成后的 Qiu Market Server 是一套可独立部署的行情与虚拟交易后端：上游异常不会制造假价格，下游可以按统一市场身份读取报价、来源和健康状态；订单、余额、成交、事件和 WebSocket cursor 能在重启或提交结果未知后从 PostgreSQL 确定性恢复。",
  "nextMilestone": "在 Node 24 上重跑同一固定候选的 full-stack golden，并由 Owner 现场追踪 submit→ledger→recovery，修改一条失败测试并说明虚拟资金边界；再分别复验参考价、公开研究更新和生产交易门。跨日 Owner Gate 未完成前，Q-01/Q-02 保持 evidence-ready。",
  "knownLimits": [
    "跨日 Owner Gate 尚未通过，Q-01/Q-02 保持 evidence-ready；本轮内容核对没有代替本人闭卷解释或修改失败测试",
    "交易只使用虚拟资金，不接充值、提现、私钥、真实交易所下单或实盘资产",
    "2026-10-17 入口恢复是当日读链路记录；当时参考展示价不可用、公开研究为空，本轮未重新验收线上数据质量",
    "本地 full-stack golden 使用隔离的行情、研究与质量夹具，不证明真实 provider 已启用、数据许可已批准、生产迁移、OAuth、容量或长期 soak 通过",
    "多场所数量、延迟和可用率均是时间点快照，不作为固定规模或 SLA；私有仓库不公开源码与版本标识"
  ],
  "updatedAt": "2026-10-24",
  "coreAbilities": [
    "多场所行情采集与身份治理",
    "数据新鲜度与故障隔离",
    "Redis/PostgreSQL/Doris",
    "HTTP/gRPC",
    "虚拟现货撮合与双重记账",
    "事件流、快照与恢复",
    "Vue 交易终端"
  ],
  "talkingPoints": [
    "为什么 Perp/DEX 不能直接混入综合现货价",
    "行情可用与行情新鲜有什么区别",
    "虚拟交易为什么仍需要双重记账与结果未知恢复",
    "本地集成通过为什么不等于生产验收"
  ],
  "techStack": [
    "Go",
    "HTTP",
    "gRPC",
    "Redis",
    "PostgreSQL",
    "Doris",
    "WebSocket",
    "Vue",
    "TypeScript",
    "Vite"
  ],
  "engineering": {
    "role": "多场所行情、虚拟撮合、账本、恢复和浏览器产品链路的实现与验证",
    "systemBoundary": "Qiu Market 只处理行情与单用户虚拟资金交易；它不接交易所真实下单、充值提现、私钥或实盘资产，行情参考异常也不能伪造可成交价格。",
    "callFlow": [
      "Crawler / DEX adapter 获取并核对外部行情",
      "Snapshot Writer 先写 PostgreSQL，再派生 Redis 缓存与 Doris 分析数据",
      "Redis 还决定同一读快照的版本；HTTP / gRPC 输出来源、新鲜度与降级状态",
      "独立虚拟交易 gateway 把命令送入单市场 runner",
      "撮合、账本、事件、outbox 与快照在独立交易 PostgreSQL 中恢复",
      "Vue 展示行情、订单、余额和错误状态；行情与交易分别报告可用性"
    ],
    "failureScenarios": [
      "外部来源失败时保留最后成功值并降级，不能生成 mock 行情",
      "交易存储提交结果未知时停止接单并从事件流恢复",
      "参考行情过期时 demo-maker 撤单停机但不破坏撮合恢复",
      "生产 migration 或恢复证据不完整时禁止晋级"
    ],
    "evidence": [
      "历史 Go test/race/vet 与前端构建记录",
      "本地 full-stack golden：真实一次性 PostgreSQL、浏览器与进程恢复",
      "研究/质量故障夹具与独立账务核对",
      "2026-10-17 公开读链路恢复与同次数据降级记录"
    ],
    "knownLimits": [
      "跨日 Owner Gate 尚未通过，当前 Claim 保持 evidence-ready",
      "本地隔离集成与公开读链路快照不替代生产交易、外部数据许可或持续新鲜度验收",
      "虚拟资金边界不能包装成商业交易所或实盘经验"
    ],
    "overviewSummary": "Qiu Market Server 的产品形态是可信行情平面加可恢复的虚拟交易纵切片：它向上游治理来源与新鲜度，向下游提供一致的市场、订单、账本和事件事实。"
  },
  "learning": {
    "goal": "理解多场所行情、撮合、双重记账、事件持久化和故障恢复如何组成一个完整但只使用虚拟资金的交易系统。",
    "verified": [
      "多场所行情身份、新鲜度和 rollout 边界",
      "BTC/USDT 定点数撮合与订单语义",
      "available / held 账本与费用分录",
      "PostgreSQL 事件/快照/outbox 与重启 state hash",
      "浏览器虚拟入金、挂单、成交、撤单和恢复链路"
    ],
    "verification": [
      "go test ./...",
      "go test -race ./trading/...",
      "go vet ./...",
      "npm --prefix frontend test -- --run",
      "npm --prefix frontend run build",
      "make verify-full-stack-golden",
      "git diff --check"
    ],
    "verificationNote": "这些命令来自历史审核记录，本轮只读核对，没有重跑 Qiu 服务或测试。8 月本地 full-stack golden 覆盖真实一次性 PostgreSQL 与隔离 provider 夹具；10 月 17 日公开读链路恢复仍伴随参考价和研究数据缺口。Owner Gate、真实 provider 许可及生产交易门分别保留。",
    "tradeoffs": [
      "不使用假数据兜底",
      "真实行情与可执行路线价格分开",
      "教学可审计性优先于低延迟优化",
      "虚拟资金与真实交易严格隔离",
      "Owner Gate 未通过前保持 evidence-ready"
    ],
    "nextSteps": [
      "在 Node 24 与固定候选上重跑 full-stack golden，保留原始失败与清理回执",
      "由 Owner 追踪 submit→ledger→recovery 并修改一条失败测试",
      "分别核对参考价新鲜度、公开研究与生产交易门，不把页面可达视为整链路通过"
    ]
  },
  "conceptTags": [
    "go-infra",
    "api-design"
  ],
  "relatedArticleSlugs": [
    "qiu-market-virtual-funds-recovery",
    "market-services-data-flow",
    "http-rpc-grpc",
    "api-system-calls",
    "wallet-ledger-transaction-mq-consistency"
  ],
  "suggestedQuestions": [
    "Qiu Market 如何区分综合现货价、Perp 和 DEX 路线价？",
    "虚拟交易如何保证撮合与账本一致？",
    "结果未知时如何恢复而不重复执行？",
    "为什么当前仍是 verified-local？"
  ]
}
---

当前产品仍以可信行情与可恢复虚拟交易为边界。2026-10-24 更新的是已提交材料的核对结果；各条证据保留实际发生日期，不表示当天重新运行或完成生产验收。
