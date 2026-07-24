---
{
  "id": 8,
  "slug": "web3-wallet-engineer-lab",
  "name": "Web3 Wallet Domain Engine",
  "category": "钱包领域引擎",
  "featured": false,
  "publish": true,
  "portfolioTier": "verified",
  "activityStatus": "active",
  "stage": "showcase-ready",
  "sourceType": "original",
  "visibility": "public",
  "repositoryUrl": "https://github.com/qianqiu0404/web3-wallet-engineer-lab",
  "positioning": "公开的 Go 钱包领域引擎，负责状态机、幂等、资金不变量、故障注入和版本化 Scenario Catalog；精致交互体验由独立 Wallet Reliability Lab 提供。",
  "currentFocus": "把共享 Catalog、Go 断言和 HTTP 领域 API 收敛为稳定的底层事实与证据层。",
  "verifiedEvidence": ["Go 测试覆盖重复提现、广播结果未知、canonical 补偿、充值 reorg、nonce replacement 和关键依赖 fail-closed", "Scenario Catalog v1 同时被 Go 模型和技术检查页消费，并发布 JSON Schema", "GitHub Actions 执行 Go race、Vue Catalog 测试、构建和敏感信息扫描"],
  "targetOutcome": "成为公开 Wallet Reliability Lab 的底层领域与证据引擎，让每个资金判断都有版本化场景和可执行断言。",
  "nextMilestone": "发布 Scenario Catalog v1 release，并让交互实验台固定校验来源版本与 checksum。",
  "knownLimits": ["使用内存与确定性模拟，不等同于生产数据库和真实链节点", "GitHub Pages 只部署 Catalog Inspector，不部署 Go API", "不依赖或公开四个私有钱包服务"],
  "updatedAt": "2026-07-13",
  "coreAbilities": ["钱包领域建模", "资金不变量", "幂等与补偿", "Go 断言测试", "版本化场景契约"],
  "talkingPoints": ["为什么领域引擎和交互体验应该分仓", "canonical 事实如何驱动本地补偿", "Scenario Catalog 如何防止叙事与测试漂移"],
  "techStack": ["Go", "JSON Schema", "Vue 3 Catalog Inspector", "GitHub Actions", "GitHub Pages"],
  "engineering": {
    "role": "公开钱包领域 API、资金不变量和故障模型的设计实现",
    "systemBoundary": "负责可执行领域事实和测试证据，不负责正式产品交互，不连接生产节点、真实签名机或资产。",
    "callFlow": ["加载版本化 Scenario Catalog", "注入确定性故障", "执行 Go 领域动作", "检查资金不变量", "输出可复核测试结果"],
    "failureScenarios": ["重复提现与参数冲突", "广播结果未知与 canonical 补偿", "充值 reorg、nonce replacement、风控或签名边界不可用"],
    "evidence": ["go vet ./...", "go test -race ./...", "npm --prefix web test", "Scenario Catalog v1 contract"],
    "knownLimits": ["内存状态不支持多实例", "没有真实链、数据库与签名机接入"],
    "overviewSummary": "这个仓库是底层事实与证据层：Go 模型说明资金规则，Catalog 连接故障描述和测试，正式交互由独立 Lab 负责。"
  },
  "learning": {
    "goal": "把钱包恢复判断变成可重复运行的资金不变量和版本化场景契约。",
    "verified": ["一条基线与六个异常模型", "Go 领域 API 与断言", "Catalog v1 Schema 和技术检查页"],
    "verification": ["go vet ./...", "go test -race ./...", "npm --prefix web test", "npm --prefix web run build"],
    "verificationNote": "2026-07-13 本地测试与构建通过；仓库定位调整通过独立 PR 提交。",
    "tradeoffs": ["优先保持领域模型可执行和可解释", "技术检查页不与正式 Lab 竞争产品定位", "生产化差距显式展示"],
    "nextSteps": ["发布 Catalog v1 release", "增加 RPC 多节点仲裁模型", "增加账务 outbox 部分失败注入"]
  },
  "conceptTags": ["wallet-backend", "go-infra", "api-design"],
  "relatedArticleSlugs": ["cex-evm-wallet-deposit-withdrawal-loop", "withdrawal-error-handling", "wallet-ledger-transaction-mq-consistency", "http-rpc-grpc"],
  "suggestedQuestions": ["领域引擎与正式实验台如何分工？", "资金不变量由哪些测试证明？", "Scenario Catalog v1 解决了什么漂移问题？"]
}
---

公开仓库只包含确定性模型、测试与脱敏证据，不包含真实密钥、生产地址或私人笔记路径。
