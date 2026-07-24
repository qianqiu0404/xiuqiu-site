---
{
  "id": 35,
  "slug": "mpc-tss-security-boundaries",
  "kind": "engineering-note",
  "series": "钱包签名与基础设施安全",
  "seriesOrder": 3,
  "evidenceLevel": "source-reviewed",
  "evidenceSummary": "独立三节点 TSS Keygen/Sign 已本地验证；本文依据 NIST MPTC 与 bnb-chain/tss-lib 的协议边界整理，wallet-sign 端到端接入和攻击实验尚未完成。",
  "title": "MPC/TSS 不是万能保险：Share、Session 与盲签边界",
  "date": "2026-07-20",
  "summary": "门限签名让完整私钥不必出现在单机上，但不会自动解决节点身份、会话重放、Coordinator 越权、审批欺骗、重分享和不安全降级。本文把密码学门限与钱包业务授权分开讨论。",
  "tags": ["Web3", "Wallet", "MPC", "TSS", "Security"],
  "difficulty": "安全工程",
  "conceptTags": ["mpc-tss", "signer-service", "wallet-backend", "go-infra"],
  "relatedProjectIds": [1, 5],
  "recommendedSlugs": [
    "mpc-wallet-sign-integration",
    "wallet-signing-intent-abuse",
    "cryptographic-nonce-key-leak",
    "thorchain-tss-attack-analysis",
    "hsm-key-extractability-boundaries",
    "wallet-sign-signer"
  ],
  "suggestedQuestions": [
    "MPC/TSS 解决了什么，又没有解决什么？",
    "为什么 Coordinator 不能成为任意签名入口？",
    "TSS Session、成员集合和重分享为什么需要持久化状态？"
  ]
}
---

# MPC/TSS 不是万能保险：Share、Session 与盲签边界

MPC/TSS 最重要的价值，是让多个参与方协同完成 KeyGen 和 Sign，同时不在任何单台机器上重建完整私钥。

[NIST Multi-Party Threshold Cryptography](https://csrc.nist.gov/projects/threshold-cryptography) 对门限模型的描述很清楚：Secret 被分布到多个 Party，在允许的部分参与方失陷范围内仍保持机密，密码学操作通过 MPC 完成，最终签名仍可被普通验证算法验证。

但这只解决“密码学信任如何分散”，没有自动解决“这笔交易是否应该签”。

# 三种安全问题必须分开

```text
Key Secrecy：攻击者能否恢复完整私钥
Signing Authorization：攻击者能否凑够节点签恶意消息
Protocol Liveness：节点故障后系统能否继续安全运行
```

MPC 可以提高第一项的安全性，却可能因为错误的调度、节点身份、Session 或降级设计，在第二项和第三项出现问题。

例如，2-of-3 门限不代表“需要两个人批准”。如果三个节点都接受同一个 Coordinator 的请求，而 Coordinator 被攻破，攻击者可能让任意两个节点对恶意 Digest 完成协议。完整私钥仍未出现，但资金已经被有效签名转走。

# Share 不等于普通私钥，但仍是高价值 Secret

每个 TSS 节点保存的 Share 单独看不能直接签名，但仍需要像生产私钥一样保护：

- Share 不能进入日志、CI 或调试输出；
- 多个节点的备份不能集中存放在同一个账号或磁盘；
- 节点镜像、快照和灾备不能让门限失去地域与权限隔离；
- Share 轮换和销毁要有版本与审计；
- 旧成员退出后不能继续参与新 Session；
- 恢复流程不能把多个 Share 汇总到一台运维机。

如果三个节点部署在同一个云账号、同一个 Kubernetes 集群，并由同一个管理员控制，密码学上的 2-of-3 可能仍然是运维权限上的 1-of-1。

# Session 是门限签名的业务状态机

TSS Sign 不是一次普通 RPC，而是多轮消息协议。一个 Session 至少需要绑定：

```text
session_id
key_id / public_key
algorithm / curve
message_digest
participant_set
threshold
member_set_version
round
expires_at
approval_hash
```

所有节点必须对“参与者是谁、签什么、当前在哪一轮”形成一致视图。

[bnb-chain/tss-lib](https://github.com/bnb-chain/tss-lib) 的使用说明也强调：签名需要 `t+1` 个参与者，并且各节点应对参与者集合持有相同视图；Re-sharing 过程中不能在协议最终完成前覆盖持久化 Key Data。

如果 Session 没有严格绑定 Digest 和成员版本，可能出现：

- 旧消息进入新 Session；
- 同一 Round 消息被重复处理；
- 节点对不同参与者集合进行计算；
- Re-sharing 失败后旧 Share 和新 Share 状态混用；
- 超时重试创建第二个并行签名 Session；
- 部分签名被错误复用。

# Coordinator 不能成为超级签名机

Coordinator 的合理职责是发现节点、创建 Session、路由协议消息和汇总状态。它不应该拥有以下能力：

- 单方面决定任意 Digest 可以签名；
- 替节点解释审批是否有效；
- 修改 participant set 而不提高版本；
- 在节点不足时降低 threshold；
- 绕过 wallet-sign 的 Sign Policy；
- 把失败自动降级为 Local Signer。

每个 TSS 节点都应独立验证最小策略：

```text
请求来自合法 Coordinator
Session 未过期且未完成
成员集合和版本匹配
Digest 与审批摘要匹配
该 Key 允许当前链和操作类型
本节点尚未对冲突 Session 参与签名
```

# MPC 仍然可能盲签

即使门限协议完全正确，节点看到的通常仍是一个 Digest。

如果 wallet-api 构建的交易被篡改，或 risk-service 审批没有绑定最终 Unsigned Hash，三个诚实节点也可能共同签下一笔恶意交易。

因此，MPC 接入 wallet-sign 后，必须复用和 Local Signer 相同的业务授权链：

```text
订单事实
→ 风险审批
→ Canonical Transaction
→ Unsigned Hash
→ TSS Session
→ Signature
→ 广播前再次验证
```

MPC Backend 应该替换“如何产生 Signature”，而不是替换钱包业务的风险、状态机和审计边界。

# 可用性故障不能用不安全降级解决

TSS 常见运行问题包括节点离线、网络分区、Round 超时、消息乱序和 Re-sharing 失败。

资金系统应优先选择暂停和恢复，而不是自动降低安全门槛：

- 2-of-3 不足时暂停签名；
- 不自动切换到 Local Private Key；
- 不临时把 threshold 改成 1；
- 不复用超时 Session 的中间消息；
- 不在状态不明时创建第二个冲突 Session；
- 运维恢复也要经过审批与审计。

Liveness 下降会影响提现速度，不安全降级则可能直接改变资金控制权。

# 应该补的失败实验

1. Coordinator 重放已完成 Session，所有节点拒绝；
2. 相同 session_id 携带不同 Digest，立即报警并暂停；
3. 一个节点使用旧 member_set_version，协议不得继续；
4. Round 中途节点重启，必须从明确的持久化状态恢复或整体废弃；
5. 两个并行 Session 争用同一订单，只允许一个进入有效签名；
6. 节点不足时验证系统 Fail-closed，不切换 Local Signer；
7. 审批过期或被撤销后，即使 Session 已创建也不能继续；
8. Re-sharing 失败时，旧 Key Data 不被中间状态覆盖。

# 当前项目边界

当前独立 TSS 项目已完成三节点 Keygen/Sign 本地验证，说明基础协议可以运行。尚未完成的是把它作为 wallet-sign 后端接入订单、审批、Session、广播和恢复全链路。

因此当前可以表达：

```text
独立三节点协议已验证
wallet-sign Backend 接入中
生产级节点隔离、审计和灾备尚未验证
```

MPC/TSS 的正确定位不是“更高级的私钥存储”，而是一个需要密码学协议、分布式状态机和业务授权共同成立的签名后端。
