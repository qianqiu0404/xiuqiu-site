---
{
  "id": 39,
  "slug": "evm-broadcast-unknown-canonical-recovery",
  "kind": "engineering-note",
  "evidenceLevel": "local-verified",
  "evidenceSummary": "基于 exchange-wallet-service 已提交的本地基线与自动化测试：durable broadcast_unknown、原 signed raw 身份校验、canonical hash/nonce 查询、同字节重放和数据库 CAS 已验证；不代表生产事故、主网运行或 staging provider 验收。",
  "title": "广播超时后不能重发第二笔：broadcast_unknown 的 Canonical Recovery",
  "date": "2026-07-28",
  "summary": "EVM 广播超时不是普通失败。本文用已实现的 broadcast_unknown 恢复路径说明：先锁住资金和链资源，再验证原始签名交易，查询 canonical 事实，只有在安全条件成立时才重放完全相同的 raw transaction。",
  "tags": [
    "Web3",
    "Wallet",
    "Withdrawal",
    "EVM",
    "Recovery"
  ],
  "difficulty": "安全工程",
  "conceptTags": [
    "wallet-backend",
    "evm",
    "multi-chain",
    "go-infra"
  ],
  "relatedProjectIds": [
    1
  ],
  "recommendedSlugs": [
    "withdrawal-error-handling",
    "wallet-rpc-trust-boundary",
    "wallet-ledger-transaction-mq-consistency",
    "cex-evm-wallet-deposit-withdrawal-loop"
  ],
  "suggestedQuestions": [
    "为什么 eth_sendRawTransaction 超时后不能直接构建第二笔交易？",
    "broadcast_unknown 恢复前必须验证哪些本地与链上事实？",
    "为什么 nonce 已推进但找不到原 txHash 时仍不能释放资金？"
  ]
}
---

# 广播超时后不能重发第二笔：broadcast_unknown 的 Canonical Recovery

> 证据边界：本文只描述 `exchange-wallet-service` 本地已提交基线 `cf450a2` 中存在的代码与测试。它不是生产事故复盘，不代表主网资金运行、staging 节点代理验收或生产可用性结论。当前工作树中尚未提交的跨 OS 进程恢复与失败 receipt 费用结算不计入本文证据。

# 问题不是“接口失败”，而是“资金事实未知”

钱包后端向节点提交 signed raw transaction 时，客户端可能遇到 timeout、连接中断或响应丢失。调用方看到的是错误，但节点可能已经接收并传播了交易。

这时存在两种互相冲突的可能：

```text
可能 A：节点没有收到交易，可以安全重试
可能 B：节点已经收到交易，只是响应没有回来
```

如果系统把两种情况都归为普通失败，再重新构建、重新签名或分配新 nonce，就可能把同一个业务意图变成第二笔链上交易。

因此，恢复逻辑先要回答的不是“要不要重试”，而是三个更具体的问题：

```text
业务身份：这是哪个 withdrawal request 和 attempt？
交易身份：持久化的 raw、txHash、nonce、sender、chainId 是否仍然一致？
链上事实：原 txHash 是否已被观察，账户 pending nonce 是否已经推进？
```

# durable broadcast_unknown 是一个资金状态

本地实现为结果未知增加了独立、可持久化的 `broadcast_unknown` 状态。进入该状态时：

- 提现资金继续保持 `reserved`；
- 原 signed raw、预计算 txHash 和 nonce 保留；
- nonce 与相关链资源不能被另一笔提现复用；
- worker 重启后仍从数据库恢复，而不是依赖进程内记忆；
- Console 可以解释为“广播结果核验中”，而不是普通失败。

`broadcast_unknown` 不是错误字符串，也不是等待下一轮自动重试的临时标记。它表达的是：系统尚未取得足够证据决定成功、失败或释放资金。

# 恢复算法先校验本地身份

任何 RPC 查询或重放之前，恢复代码先解码持久化的 signed raw transaction，并检查：

- raw 计算出的 txHash 是否等于预计算 hash；
- raw 内 nonce 是否等于提现和 sendout 保存的 nonce；
- 签名恢复出的 sender 是否等于提现地址；
- raw 的 EVM chain ID 是否等于当前 adapter chain。

任一项不一致都会在访问 RPC 前 fail closed。这样可以避免数据库记录、链配置或 signed raw 被错误组合后，恢复任务把另一笔交易当作原交易处理。

这一步也说明了为什么只保存 `request_id` 不够。结果未知恢复依赖的是不可变的交易身份，而不是一个可以重新构建 payload 的业务编号。

# Canonical Recovery 的决策顺序

已验证的 EVM 路径按下面的顺序收敛：

```text
验证 persisted signed raw identity
  ↓
按 predicted txHash 查询交易
  ├─ 已观察：推进原交易，不再重放
  ├─ 查询不可用：保持锁定，稍后换节点或重试查询
  └─ 明确未找到
       ↓
     查询 pending nonce
       ├─ nonce 已推进：保持锁定，等待其他 canonical 来源或人工判断
       └─ nonce 未推进：只重放完全相同的 signed raw bytes
```

这里有三个重要限制。

第一，看到原 txHash 后不能再发。系统只推进原提现与原 sendout。

第二，RPC 查询不可用时不能把“查不到”当作“链上不存在”。查询能力本身失败，只能继续保持 unknown。

第三，pending nonce 已推进但原 hash 尚未被当前节点观察，也不是成功或永久失败的充分证据。可能存在节点分歧、替换交易或传播延迟，因此资金和资源继续锁定。

# 为什么只允许重放同一份 raw

当且仅当原 txHash 明确未找到，并且 pending nonce 没有超过原 nonce 时，恢复路径才会调用广播；发送内容必须是数据库里保存的同一份 signed raw bytes。

同一 raw transaction 的签名字段、nonce、收款地址、金额和 chain ID 都不变，确定性 txHash 也不变。它是在重放同一交易身份，不是在制造第二次出金意图。

相反，下面这些动作都不属于安全恢复：

- 重新查询 gas 后构建新交易；
- 用新 request ID 再走一遍提现；
- 更换 nonce 后重新签名；
- 修改金额或目标地址后沿用旧审批；
- 节点返回一次拒绝就立即释放资金。

一旦第一次提交结果曾经未知，后来某一个节点的拒绝仍不足以证明其他节点从未接收原交易。当前实现会继续保留锁定并查询更强的 canonical 证据。

# CAS 防止旧 worker 改写新事实

恢复不只涉及 withdrawal 状态，还涉及 sendout、nonce、attempt、resource reservation 和资金预留。如果两个 worker 同时处理，旧 worker 可能在新 worker 已经确认原交易后，仍尝试写入失败并释放资源。

本地 PostgreSQL 测试使用两个独立数据库连接模拟这种竞争：

```text
worker A：把 broadcast_unknown 推进为 broadcasted
worker B：基于旧观察尝试写 broadcast_failed 并释放资源
```

状态更新使用条件转换与事务边界。只有 canonical withdrawal 状态转换成功的分支，才允许继续更新 nonce、attempt、resource 和 sendout；旧分支得到 stale transition，整组修改回滚。

这条规则比“最后写入者获胜”更适合资金系统：恢复动作必须服从已经提交的更新事实，不能让过期 worker 用旧判断覆盖新状态。

# 本地自动化验证到了哪里

已提交基线的测试覆盖：

1. 客户端 timeout 后观察到原 txHash，推进原交易且不重放；
2. 使用持久化 raw 和新的 client 恢复时，只发送原始 raw；
3. canonical 查询不可用时不广播；
4. nonce 已推进但原 hash 未观察到时保持资金锁定；
5. `already known` 或结果仍未知时不伪装成成功；
6. 单节点拒绝不能释放一次曾经模糊的提交；
7. raw、hash、nonce、sender 或 chain 被篡改时，在任何 RPC 前拒绝；
8. PostgreSQL 中 stale worker 不能释放已经由 canonical 分支推进的资金和资源。

这些证据支持“本地已验证的恢复实现”，但不能证明：

- 发生过真实生产事故；
- 主网或真实业务资金已经运行；
- staging provider 已完成丢响应故障注入；
- 完整 wallet-service 二进制跨进程恢复已验收；
- 所有 EVM 节点、mempool 和 replacement 场景都已覆盖；
- mined failed receipt 的本金与实际 Gas 结算已进入本文基线。

# 结论

广播 timeout 的安全默认值不是失败，而是未知。

一个可恢复的提现系统需要把 unknown 持久化，锁住资金与链资源，先验证原交易身份，再按 txHash 与 nonce 查询 canonical 事实。只有证据允许时，才重放完全相同的 signed raw；证据不足时宁可继续锁定，也不能用第二笔交易“修复”第一笔未知结果。
