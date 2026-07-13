---
{
  "id": 5,
  "slug": "tss-mpc",
  "name": "TSS / MPC 签名研究",
  "category": "安全扩展",
  "featured": false,
  "stage": "exploring",
  "sourceType": "source-study",
  "visibility": "private",
  "positioning": "基于现有 TSS 项目进行源码学习与安全边界改造，理解 Manager、Node、Keygen、Sign、committee、threshold 和 key share。",
  "currentFocus": "建立可复现的三节点运行证据，并明确 TSS 在 wallet-sign 后方的接入位置、可用性风险和不能替代的业务风控。",
  "verifiedEvidence": ["已完成 Manager/Node 职责与 Keygen/Sign 流程导读", "已定位 CPK、committee、threshold 与本地 share 的元数据路径", "已记录当前 Go/依赖版本兼容限制"],
  "targetOutcome": "形成一个本地可重复的三节点 Keygen/Sign 演示，并能说明节点不足门限、请求路由、份额存储和钱包签名网关的失败边界。",
  "nextMilestone": "在指定兼容工具链下运行三节点 Keygen/Sign，并保存不包含密钥材料的验证记录。",
  "knownLimits": ["属于源码学习和改造，不是从零原创协议实现", "尚未接入生产钱包或真实资金", "完整测试受旧版依赖和 Go 工具链限制"],
  "updatedAt": "2026-07-13",
  "coreAbilities": ["TSS Keygen/Sign", "Manager/Node 边界", "threshold 与 committee", "key share 安全", "钱包签名网关接入"],
  "talkingPoints": ["TSS 与链上多签的区别", "Manager 为什么不应持有完整 share", "TSS 为什么不能替代提现风控", "节点不足门限如何影响可用性"],
  "techStack": ["Go", "tss-lib", "ECDSA", "Paillier", "libp2p", "WebSocket", "LevelDB"],
  "engineering": {
    "role": "TSS 源码学习、安全边界梳理与局部改造",
    "systemBoundary": "TSS 负责多方 Keygen/Sign 和份额安全，不承担业务审核、限额、幂等和提现状态推进。",
    "callFlow": ["Manager 接收请求并选择 committee", "Nodes 参与协议轮次", "满足 threshold 后产生标准签名", "签名返回钱包签名网关"],
    "failureScenarios": ["在线节点不足门限导致签名不可用", "控制面错误路由或元数据不一致导致会话失败"],
    "evidence": ["Manager/Node 代码导读", "CPK 和 committee 持久化路径", "本地运行手册与兼容性记录"],
    "knownLimits": ["完整三节点证据待重新验证", "未生产接入 wallet-sign"],
    "interviewSummary": "这是一个源码学习与安全改造项目，用来理解 TSS 如何降低完整私钥单点风险，以及它在钱包系统里仍然依赖业务风控和高可用设计。"
  },
  "learning": {
    "goal": "能够从代码和运行结果解释门限签名的控制面、协议面、份额边界和可用性风险。",
    "verified": ["Manager 调度与响应路由", "Node 本地 share 与协议轮次", "committee 和 threshold 元数据"],
    "verification": [],
    "verificationNote": "当前证据以源码导读和局部改造为主，三节点完整运行仍是下一里程碑。",
    "tradeoffs": ["明确标注源码学习来源", "安全理解与生产部署分开", "不公开任何密钥份额或敏感配置"],
    "nextSteps": ["验证三节点 Keygen/Sign", "设计 wallet-sign 到 Manager 的契约", "增加节点掉线和请求超时场景"]
  },
  "conceptTags": ["mpc-tss", "signer-service"],
  "relatedArticleSlugs": ["mpc-wallet-sign-integration", "thorchain-tss-attack-analysis", "aws-cloudhsm-wallet-sign-integration"],
  "suggestedQuestions": ["TSS 在钱包系统里解决什么问题？", "当前项目哪些是理解，哪些已经运行验证？"]
}
---

该项目明确标注为源码学习与改造，不包装成原创生产级 TSS 实现。
