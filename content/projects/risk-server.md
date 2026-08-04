---
{
  "id": 11,
  "slug": "risk-server",
  "name": "risk-server",
  "category": "风险审批与边界验证",
  "featured": false,
  "publish": true,
  "portfolioTier": "exploration",
  "activityStatus": "active",
  "stage": "verified-local",
  "sourceType": "source-study",
  "visibility": "none",
  "positioning": "面向钱包开发与集成环境的风险审批服务：校验交易请求与 V3 / V4 approval envelope 的字段一致性，使用确定性序列化生成 Ed25519 risk proof，并在外部风险能力缺失时失败关闭。",
  "currentFocus": "收敛交易字段绑定、审批版本、访问控制、mTLS 与错误分类，让 risk proof 的含义可被 wallet-service、wallet-sign 和 TSS 逐层复核，同时明确它不是生产 AML 或规则平台。",
  "verifiedEvidence": [
    "V3 / V4 测试覆盖 business、request、chain、asset、backend、key ref、election、地址、金额、链资源、message hash 与 unsigned payload 的精确绑定",
    "确定性 protobuf 与 Ed25519 risk proof 已通过与 wallet-sign / TSS 验证边界兼容的测试",
    "无效 token、重复 request ID、审批版本不足、字段篡改与缺少 AML provider 均会 fail closed",
    "非 loopback gRPC 要求 TLS 1.3 双向认证；本地 test、build、vet 与服务生命周期验证已通过"
  ],
  "targetOutcome": "形成一个不夸大生产能力的风险审批案例，能够从请求身份、字段绑定、证明生成、失败语义和下游复核解释当前实现与生产 AML / 风控平台之间的差距。",
  "nextMilestone": "定义外部 AML / 制裁检查的稳定 provider 合同与超时语义，并补齐密钥轮换、审计指标和按租户策略隔离的演进路线。",
  "knownLimits": [
    "属于第三方项目源码研究，不是从零原创实现",
    "没有接入真实 AML、制裁名单、设备指纹、账户画像或生产规则平台",
    "risk proof 只证明当前集成服务审批了精确 envelope，不表示交易天然安全，也不替代 wallet-sign / TSS 的再次验证",
    "没有证明生产密钥托管、证书轮换、容量、可用性或人工审批运营流程",
    "当前不提供个人公开仓库入口"
  ],
  "updatedAt": "2026-07-28",
  "coreAbilities": ["gRPC 风险审批", "V3 / V4 字段绑定", "Ed25519 Approval Proof", "mTLS", "fail-closed 边界"],
  "talkingPoints": ["risk proof 具体绑定哪些交易事实", "为什么没有 AML provider 时必须失败关闭", "risk-server、wallet-sign 与 TSS 为什么要逐层复核", "当前实现为什么不能包装成生产风控"],
  "techStack": ["Go", "gRPC", "protobuf", "Ed25519", "TLS 1.3", "LevelDB"],
  "engineering": {
    "role": "源码研究、审批证明集成、本地运行验证和生产边界分析",
    "systemBoundary": "risk-server 校验精确交易 envelope 并生成 risk proof；wallet-service 拥有资金流程，wallet-sign / TSS 仍需独立验签，外部 AML、规则运营和用户账本不属于本服务当前能力。",
    "callFlow": ["wallet-service 提交交易与 approval envelope", "risk-server 校验访问身份、审批版本和逐字段一致性", "确定性序列化并生成 Ed25519 risk proof", "wallet-sign / TSS 对同一 envelope 和 proof 再次验证"],
    "failureScenarios": ["字段、摘要、链资源或 request ID 冲突必须永久拒绝", "没有 AML provider、密钥配置无效或 mTLS 不完整时必须失败关闭", "gRPC timeout 不能允许 wallet-service 绕过审批继续签名"],
    "evidence": ["V3 / V4 golden vector 与字段篡改测试", "invalid token、duplicate request 与 AML fail-closed 测试", "非 loopback mTLS 与服务启停测试", "本地 test / build / vet 记录"],
    "knownLimits": ["没有真实 AML 供应商、规则平台和人工审批联调", "没有生产密钥轮换、容量、审计留存或高可用验收"],
    "overviewSummary": "risk-server 用于证明钱包交易审批边界可以被精确绑定和重复验证；当前证据只支持集成环境风险证明，不代表生产 AML 或完整风控平台经验。"
  },
  "learning": {
    "goal": "能够从代码说明审批 envelope、risk proof、访问身份和下游验签如何共同约束一笔钱包交易。",
    "verified": ["V3 / V4 字段绑定", "确定性序列化与 Ed25519 proof", "mTLS 与 token 边界", "缺少外部能力时的 fail-closed 行为"],
    "verification": ["go test ./...", "go build ./...", "go vet ./...", "git diff --check"],
    "verificationNote": "验证来自本地源码研究与钱包集成环境；没有接入真实 AML 供应商，也不证明生产风控运营能力。",
    "tradeoffs": ["明确标记源码学习和改造来源", "审批证明与风险结论分开", "本地可运行与生产可用分开", "不公开敏感配置"],
    "nextSteps": ["定义外部风险 provider 合同", "补密钥轮换与审计指标", "设计按租户隔离的策略和运营边界"]
  },
  "conceptTags": ["wallet-backend", "go-infra", "api-design"],
  "relatedArticleSlugs": ["withdrawal-error-handling", "wallet-api-boundary", "wallet-ledger-transaction-mq-consistency"],
  "suggestedQuestions": ["risk-server 当前真正实现了什么？", "risk proof 为什么不能替代真实 AML 与下游验签？", "字段篡改或外部风险能力不可用时如何失败关闭？"]
}
---

该页面只公开源码研究、集成改造和本地验证事实，不把风险审批证明包装成真实 AML 或生产风控平台。
