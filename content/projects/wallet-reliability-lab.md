---
{
  "id": 10,
  "slug": "wallet-reliability-lab",
  "name": "Wallet Reliability Lab",
  "category": "可交互可靠性实验",
  "featured": true,
  "publish": true,
  "portfolioTier": "verified",
  "activityStatus": "active",
  "stage": "showcase-ready",
  "sourceType": "original",
  "visibility": "public",
  "repositoryUrl": "https://github.com/qianqiu0404/wallet-reliability-lab",
  "positioning": "面向钱包开发者与技术交流的交互实验台，通过三种提现路径展示状态机、可重试广播和链上事实补偿，并把每个判断连接到脱敏测试证据。",
  "currentFocus": "把 Runner API、顺序 SSE、浏览器安全模拟和工程证据统一为可暂停、单步和确定性重放的体验。",
  "verifiedEvidence": ["正常提现、可重试广播失败和广播后补偿恢复三个场景可确定性运行", "Vue 工作台支持开始、暂停、单步、重置、速度、服务过滤与开发者证据模式", "Go Runner 通过 race 测试，覆盖单播放器、暂停/重置代次、SSE 续传和地址脱敏"],
  "targetOutcome": "让访问者三分钟内说清系统边界和一个恢复判断，并能继续定位到状态、事件和测试证据。",
  "nextMilestone": "固定引用 Wallet Domain Engine 的 Scenario Catalog v1，并把本地连接模式收敛为明确的开发沙箱适配器。",
  "knownLimits": ["公开 Vercel 版本只运行确定性模拟，不连接真实服务", "首版只覆盖提现，不包含充值 reorg、TSS/HSM 或主网广播", "本地 connected adapter 不代表生产集成"],
  "updatedAt": "2026-07-13",
  "coreAbilities": ["提现状态机", "故障恢复", "SSE 事件流", "工程可视化", "脱敏证据"],
  "talkingPoints": ["广播失败为什么继续保持 signed", "为什么补偿要查询链上事实而不是重新广播", "如何让暂停、重连和重放保持一致"],
  "techStack": ["Vue 3", "TypeScript", "Vite", "Go", "SSE", "Vitest", "Vercel"],
  "engineering": {
    "role": "钱包可靠性状态机、交互工作台和本地 Runner 的设计实现",
    "systemBoundary": "负责交互和解释，不保存资产、不接触密钥、不声称是生产钱包；公开版只运行 simulation。",
    "callFlow": ["选择提现场景", "创建 Runner run 或使用浏览器安全模拟", "按顺序消费状态事件", "检查工程判断和脱敏字段", "定位到对应测试证据"],
    "failureScenarios": ["节点暂时不可用时保留 signed 并复用同一 raw transaction", "broadcasted 长期未推进时跨过阈值并按 txHash 对账", "Runner 重复 start、暂停、重置和 SSE 重连不能破坏顺序"],
    "evidence": ["npm test", "npm run build", "go vet ./...", "go test -race ./...", "桌面与 390px 浏览器验收"],
    "knownLimits": ["模拟数据固定且脱敏", "不部署 Go Runner 到公开 Vercel"],
    "overviewSummary": "这个项目把钱包状态和恢复判断做成可操作的工程工作台，访客可以从结果继续追到请求字段、事件和测试。"
  },
  "learning": {
    "goal": "把难以解释的钱包异常恢复判断转成三分钟内可操作、可复核的交互证据。",
    "verified": ["三种提现路径", "前端与 Runner action/SSE 链路", "桌面和移动端响应式体验"],
    "verification": ["npm test", "npm run build", "npm run check:public", "go test -race ./..."],
    "verificationNote": "2026-07-13 本地单元测试、Go race、构建和浏览器验收通过。",
    "tradeoffs": ["公开版安全模拟优先", "交互解释与底层领域引擎分仓", "首版保持三个成熟提现场景"],
    "nextSteps": ["完成独立 Vercel 生产部署", "发布 Catalog checksum 锁定", "补浏览器 E2E 自动化"]
  },
  "conceptTags": ["wallet-backend", "go-infra", "api-design"],
  "relatedArticleSlugs": ["withdrawal-error-handling", "wallet-ledger-transaction-mq-consistency", "cex-evm-wallet-deposit-withdrawal-loop", "http-rpc-grpc"],
  "suggestedQuestions": ["三个提现场景分别证明什么？", "Runner 如何保证 SSE 顺序和重连？", "公开模拟与生产钱包的边界在哪里？"]
}
---

在线演示只使用确定性脱敏数据，不连接生产服务或真实资产。
