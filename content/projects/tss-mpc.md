---
{
  "id": 5,
  "slug": "tss-mpc",
  "name": "TSS / MPC 签名研究",
  "category": "安全扩展",
  "featured": false,
  "stage": "verified-local",
  "sourceType": "source-study",
  "visibility": "private",
  "positioning": "基于现有 TSS 项目进行源码学习与安全边界改造，理解 Manager、Node、Keygen、Sign、committee、threshold 和 key share。",
  "currentFocus": "把已本地验证的三节点 Keygen / Sign 收敛为 wallet-sign 可替换后端，并明确会话路由、超时、份额存储和降级边界。",
  "verifiedEvidence": ["已完成 Manager/Node 职责与 Keygen/Sign 流程导读", "已定位 CPK、committee、threshold 与本地 share 的元数据路径", "已在本地运行三节点 Keygen 并产生不含密钥材料的验证记录", "已在本地运行三节点 Sign 并验证标准签名结果"],
  "targetOutcome": "在 wallet-sign 保持统一策略与审计边界的前提下，将 TSS 作为可替换签名后端，完成请求路由、签名返回和节点不足门限的失败演示。",
  "nextMilestone": "设计并实现 wallet-sign → TSS Manager 的最小接口，跑通一条不含真实资金的端到端签名请求。",
  "knownLimits": ["属于源码学习和改造，不是从零原创协议实现", "三节点 Keygen / Sign 已独立验证，但尚未接入 wallet-sign", "尚未接入生产钱包或真实资金", "完整回归仍受旧版依赖和 Go 工具链限制"],
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
    "knownLimits": ["三节点证据来自独立 TSS 环境", "尚未完成 wallet-sign 接入，也未用于生产资金"],
    "interviewSummary": "这是一个源码学习与安全改造项目，用来理解 TSS 如何降低完整私钥单点风险，以及它在钱包系统里仍然依赖业务风控和高可用设计。"
  },
  "learning": {
    "goal": "能够从代码和运行结果解释门限签名的控制面、协议面、份额边界和可用性风险。",
    "verified": ["Manager 调度与响应路由", "Node 本地 share 与协议轮次", "committee 和 threshold 元数据"],
    "verification": ["三节点 Keygen 本地运行记录", "三节点 Sign 本地运行记录"],
    "verificationNote": "网站只描述验证结论，不公开 key share、助记词、私钥或敏感运行配置；具体兼容命令保留在私有运行记录中。",
    "tradeoffs": ["明确标注源码学习来源", "安全理解与生产部署分开", "不公开任何密钥份额或敏感配置"],
    "nextSteps": ["设计 wallet-sign 到 Manager 的契约", "跑通端到端签名请求", "增加节点掉线和请求超时场景"]
  },
  "conceptTags": ["mpc-tss", "signer-service"],
  "relatedArticleSlugs": ["mpc-wallet-sign-integration", "thorchain-tss-attack-analysis", "aws-cloudhsm-wallet-sign-integration"],
  "suggestedQuestions": ["TSS 在钱包系统里解决什么问题？", "当前项目哪些是理解，哪些已经运行验证？"]
}
---

该项目明确标注为源码学习与改造，不包装成原创生产级 TSS 实现。
