---
{
  "id": 3,
  "slug": "s78-market-services",
  "name": "S78 Market Services",
  "category": "数据服务扩展",
  "featured": false,
  "stage": "building",
  "sourceType": "adapted",
  "visibility": "private",
  "positioning": "交易所行情数据服务学习项目：串联外部数据源、Crawler、Worker、Redis/PostgreSQL、HTTP/gRPC API 与 Vue Dashboard。",
  "currentFocus": "把数据新鲜度、真实错误状态和本地运行链路整理为可复现证据，而不是用 mock 行情掩盖数据源故障。",
  "verifiedEvidence": ["已拆分 Crawler、Worker、存储和查询职责", "Dashboard 展示更新时间与数据延迟", "API 失败时明确显示 Error，不使用 mock 数据兜底"],
  "targetOutcome": "形成一条可重复的本地行情链路：采集真实数据、写入 Redis/PostgreSQL、通过 API 查询并在前端展示更新时间、延迟和错误状态。",
  "nextMilestone": "固定本地依赖和 seed 流程，运行后端测试、前端构建与一条端到端行情查询。",
  "knownLimits": ["多数据源容灾、K 线缺口补偿和价格异常检测仍未完成", "当前不包含撮合或钱包资金状态", "仓库暂按私有项目展示"],
  "updatedAt": "2026-07-13",
  "coreAbilities": ["行情采集与 Worker", "Redis/PostgreSQL", "HTTP/gRPC", "Vue Dashboard", "数据新鲜度与错误状态"],
  "talkingPoints": ["为什么采集和查询要分层", "行情可用与行情新鲜有什么区别", "为什么不能使用 mock 兜底真实故障"],
  "techStack": ["Go", "HTTP", "gRPC", "Redis", "PostgreSQL", "GORM", "Vue", "Vite"],
  "engineering": {
    "role": "行情采集、处理、存储和展示链路的运行梳理与可信数据表达",
    "systemBoundary": "负责交易所后台行情数据流，不承担撮合、订单或钱包资金状态。",
    "callFlow": ["Crawler 拉取外部行情", "Worker 处理热点价格", "Redis/PostgreSQL 持久化", "HTTP/gRPC 查询", "Dashboard 展示新鲜度"],
    "failureScenarios": ["外部 API 失败时不能伪造行情", "数据存在但过期时必须明确标记 stale"],
    "evidence": ["Crawler/Worker 分层", "last_updated 与 data_delay_seconds", "Dashboard Error 状态"],
    "knownLimits": ["一键本地验收仍需固定", "完整数据质量与容灾策略未完成"],
    "interviewSummary": "S78 是钱包主线之外的数据服务补充，证明我能处理外部数据源、异步处理、缓存、数据库、API 和前端之间的完整链路。"
  },
  "learning": {
    "goal": "理解交易所数据服务的采集、处理、存储和查询边界，并用时间和错误状态表达数据可信度。",
    "verified": ["服务分层", "数据更新时间与延迟", "前端真实错误态"],
    "verification": ["go test ./...", "go build ./cmd/market-services", "make verify-local", "npm run build"],
    "verificationNote": "命令已经整理，完整稳定基线将在下一里程碑重新执行。",
    "tradeoffs": ["不使用假数据兜底", "延迟与错误作为 API 语义的一部分", "未完成能力继续保持目标态标签"],
    "nextSteps": ["跑通本地依赖和行情查询", "补齐 K 线缺口验证", "设计多数据源容灾和告警"]
  },
  "conceptTags": ["go-infra", "api-design"],
  "relatedArticleSlugs": ["market-services-data-flow", "http-rpc-grpc", "api-system-calls"],
  "suggestedQuestions": ["行情服务如何表达数据新鲜度？", "为什么失败时不应该展示 mock 行情？"]
}
---

该项目在工程页作为交易所数据服务补充，不抢占钱包主线。
