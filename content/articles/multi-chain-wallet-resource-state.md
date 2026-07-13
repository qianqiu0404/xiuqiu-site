---
{
  "id": 28,
  "slug": "multi-chain-wallet-resource-state",
  "kind": "engineering-note",
  "title": "钱包后端不能隐藏的资源状态：Nonce、UTXO、Blockhash 与 Object Version",
  "date": "2026-07-03",
  "summary": "多链钱包可以统一转账、签名和广播的业务语义，但不能隐藏决定交易唯一性、时效性和可执行性的资源状态。这篇文章用 EVM nonce、ERC-4337 nonce key、BTC UTXO、Solana blockhash 和 Sui object version，复盘资源如何解析、预占和冻结，以及资源过期后为什么需要重新构建和签名。",
  "tags": [
    "Web3",
    "Wallet",
    "Multi-chain",
    "Nonce",
    "UTXO",
    "Solana",
    "Sui"
  ],
  "difficulty": "项目拆解",
  "conceptTags": [
    "wallet-backend",
    "multi-chain",
    "signer-service",
    "api-design"
  ],
  "relatedProjectIds": [
    1,
    2
  ],
  "recommendedSlugs": [
    "new-chain-integration-checklist",
    "wallet-address-models",
    "wallet-api-boundary",
    "wallet-sign-signer",
    "withdrawal-error-handling",
    "eip-erc-protocol-evolution"
  ],
  "suggestedQuestions": [
    "为什么多链钱包不能把 nonce、UTXO、blockhash 和 objectRef 全部藏在 adaptor 里？",
    "资源过期后为什么需要重新构建和签名？",
    "钱包编排、风险控制、链交互和签名四个服务分别负责哪一层资源状态？"
  ]
}
---

# 钱包后端不能隐藏的资源状态：Nonce、UTXO、Blockhash 与 Object Version

多链钱包经常希望向上提供统一接口：输入链、币种、收款地址和金额，底层 adaptor 负责构建并发送交易。

这个方向没有错，但统一到什么程度非常关键。

```text
业务语义可以统一：
  转账、归集、签名、广播、查询状态

安全资源不能隐藏：
  nonce、UTXO、recent blockhash、account locks、object reference
```

这些字段并不是普通的链参数。它们决定一笔交易使用哪份链上状态、是否仍然有效、是否会和其他任务争用同一份资产，以及签名后还能不能安全广播。

如果 adaptor 在签名前临时查询、签名后自动替换，或者多个 worker 各自选择资源，统一接口反而会把并发冲突和重复出金藏起来。

# 一条共同的交易生命周期

不同链的数据结构差异很大，但托管钱包可以把资源处理过程收敛为同一条生命周期：

```text
解析资源
-> 预占与冻结
-> 构建交易
-> 策略校验
-> 签名
-> 广播
-> 确认
-> 释放或对账
```

这里有两类状态需要区分。

第一类是协议原生状态，例如 EVM nonce、BTC UTXO、Solana recent blockhash 和 Sui object version。节点会根据它们判断交易是否可执行。

第二类是钱包内部预占状态。链不会替钱包协调多个提现 worker，因此系统需要自己记录哪个订单占用了 nonce、UTXO、gas object 或其他资源。

协议状态回答“链现在允许什么”，内部预占回答“平台已经把什么分配给了哪个任务”。只有两者同时成立，并发出金才可控。

# EVM：Nonce 是账户级串行资源

EVM 账户的 nonce 既用于排序，也用于防止同一笔交易被重复执行。

假设热钱包当前链上 nonce 是 100，两个提现 worker 同时读取节点：

```text
worker A -> nonce 100
worker B -> nonce 100
```

如果两者分别构建并签名，最终只有一笔可以按预期进入链上；另一笔可能替换前一笔、长期 pending，或者被节点拒绝。

因此生产系统不能让每个 worker 在 adaptor 内部独立调用 `eth_getTransactionCount`。Nonce Manager 需要把分配结果和提现订单绑定：

```text
address + chain_id + nonce
-> withdrawal_id
-> unsigned_tx_hash
-> signed_tx_hash
-> broadcast status
```

交易 pending 后，系统还要区分继续等待、按相同 nonce 提高费用替换，还是确认原交易已失效后重建。所谓“加速”不是创建一笔无关的新交易，而是使用相同 nonce 提交符合替换规则的新交易。

这里统一的是提现状态机，不是把 nonce 从接口里抹掉。

# ERC-4337：Nonce 不再只有一条队列

ERC-4337 的 `UserOperation.nonce` 被解释成两部分：192 bit 的 `key` 和 64 bit 的 `sequence`。不同 key 可以表达不同的并行通道，而 EntryPoint 会分别校验各通道的 sequence。

这意味着账户抽象钱包处理的状态不只是“下一个 nonce 是多少”，还包括：

```text
sender
nonce key
sequence
EntryPoint
validation window
paymaster context
simulation result
```

Paymaster、账户验证逻辑或链上状态在 UserOperation 进入 bundle 前发生变化，都可能让原先可接受的操作失效。因此构建服务需要保留模拟所依据的上下文，签名策略也要确认 EntryPoint、nonce 通道和赞助条件符合预期。

账户抽象提高了并行能力，但并没有消除资源管理。它只是把一条简单 nonce 队列，升级成了带验证条件的多通道状态。

# BTC：UTXO 是必须被选定和锁定的输入

BTC 没有账户 nonce。交易直接消费一个或多个未花费输出，并创建新的输出。

```text
UTXO A + UTXO B
-> 收款输出
-> 找零输出
-> 矿工费
```

当两个提现任务同时选择了 UTXO A，它们构建出的交易会形成双花冲突。节点不会帮平台判断哪个业务订单更应该使用这笔钱。

所以 UTXO 选择必须伴随内部锁定：

```text
available
-> reserved(withdrawal_id)
-> signed
-> spent / released
```

签名内容必须绑定准确的 inputs、outputs、找零地址、金额和 sighash。`wallet-sign` 不能在签名阶段重新选币，否则业务层审核的金额、手续费和找零边界已经不再对应实际交易。

RBF 同样不是随便重建交易。替换交易仍需围绕原输入、费用策略、找零变化和订单状态进行审计。即便广播结果不确定，也应先查询原 txid 和输入是否已花费，不能立即解锁 UTXO 再发一笔。

# Solana：交易带着一个会过期的时间窗口

Solana 交易消息包含账户列表、instructions 和 `recentBlockhash`。recent blockhash 既参与交易消息，也限制交易的有效窗口。

这会直接影响离线签名和审批链路：

```text
获取 recent blockhash
-> 构建 message
-> 签名
-> 审批或传输耗时
-> blockhash 过期
```

一旦 blockhash 过期，不能只替换字段后继续使用旧签名。blockhash 是已签名 message 的一部分，交易必须重新构建并重新签名。需要较长审批窗口时，可以单独评估 durable nonce，而不是让广播服务静默刷新 blockhash。

Solana 交易还会声明要读取和写入的 accounts。运行时会根据这些访问关系处理并行执行和账户锁冲突。钱包构建服务因此需要显式保存 instruction 涉及的账户、读写权限、ATA 是否已存在，以及费用支付者等上下文。

ATA 不像 BTC UTXO 那样被“消费”，但创建 ATA 会改变交易 instructions、账户集合和费用。它仍然不能在签名之后由 adaptor 悄悄补上。

# Sui：对象版本本身就是交易输入

Sui 把资产和状态组织成对象。一个 owned object 的引用不是只有 `objectId`，而是：

```text
(objectId, version, digest)
```

`version` 表示对象的当前版本，`digest` 对对象内容作出承诺。交易执行后，被修改的对象会产生新版本，旧引用随之失效。

假设两个提现任务读取了同一个 coin object：

```text
task A -> (coinId, version 12, digest X)
task B -> (coinId, version 12, digest X)
```

task A 先执行后，对象进入 version 13。task B 即使已经完成签名，也不能继续把 version 12 当成有效输入。系统要把它识别为资源冲突，重新解析可用对象、重新构建并重新签名。

Shared object 还需要携带其 `initialSharedVersion` 等引用信息，并走与 owned object 不同的执行路径。Gas 也可能体现为参与交易的对象；采用 address balance 等模式可以改变上层资源选择方式，但不能假设所有 Sui 交易都只需要“地址、金额、签名”三个字段。

因此 Sui adaptor 应把 object reference 当成显式构建结果，而不是内部临时变量：

```text
objectId
version
digest
ownership type
initialSharedVersion
gas resource
```

# 四个服务边界如何共同管理资源

资源状态不能全部塞进某一个 adaptor。它需要在业务、链适配和签名边界之间传递，同时保持职责清楚。

| 服务 | 负责什么 | 不应该做什么 |
| --- | --- | --- |
| wallet-service | 订单状态、资源预占、并发控制、失败恢复和账务补偿 | 不直接拼装每条链的底层交易 |
| risk-service | 校验提现内容、风控放行条件和审批凭证 | 不选择链资源，也不持有私钥或直接广播交易 |
| wallet-api | 查询链上状态、解析资源、构建交易、广播和确认 | 不在签名后静默替换 nonce、UTXO、blockhash 或 objectRef |
| wallet-sign | 校验策略并签署已经冻结的精确交易上下文 | 不重新选币、刷新资源或替业务层决定失败重试 |

四者之间传递的不能只有一段不透明 raw transaction。至少还要有可审计的资源摘要：

```text
chain_id
resource_type
resource_refs
resource_snapshot_hash
expires_at / last_valid_height
business_order_id
policy_result
```

具体字段可以因链而异，但签名机看到的交易必须与业务层批准、构建服务冻结的资源是同一份事实。

# 统一失败状态，而不是统一掉差异

不同链返回的原始错误并不相同。钱包上层可以把它们映射成一组稳定的工程状态：

```text
resource_unavailable
resource_conflict
resource_expired
rebuild_required
resign_required
broadcast_unknown
```

这些状态的价值在于决定恢复动作。

| 状态 | 典型场景 | 恢复动作 |
| --- | --- | --- |
| resource_unavailable | 余额不足、无可用 UTXO、找不到合适 coin object | 等待补充资源或停止出金 |
| resource_conflict | nonce/UTXO/object 已被其他任务占用或消费 | 回滚预占，重新解析资源 |
| resource_expired | Solana blockhash 或授权有效期过期 | 重建交易并重新签名 |
| rebuild_required | 费用、找零、对象版本或账户集合发生变化 | 重新进入构建和策略校验 |
| resign_required | 已签名消息发生任何变化 | 生成新的签名请求 |
| broadcast_unknown | RPC timeout，无法确定节点是否接收 | 查询原交易或重发相同 raw transaction |

不能把所有失败都归为 `send_failed`，更不能一失败就重新构建。恢复动作必须取决于：原资源是否仍有效、原签名是否仍对应当前交易、链上事实是否已经发生。

# 我最终沉淀下来的边界

多链抽象真正应该统一的是：

```text
用户意图
业务订单
审批和风控
交易生命周期
错误分类
账务与审计
```

不能被统一掉的是：

```text
决定交易唯一性的状态
决定交易有效期的状态
会被并发任务争用的资源
签名实际承诺的链上对象
```

一个好的 chain adaptor 不是把所有链伪装成 EVM，也不是只返回 `raw_tx`。它应该把链的差异收敛成清晰、可验证的资源契约，让业务层知道资源已被谁占用，让签名层知道自己究竟在授权什么，让失败恢复知道应该重试原交易还是重新构建。

这也是我从 Sui object version、BTC UTXO 和 EVM nonce 之间看到的共同点：

**钱包可以隐藏链的使用复杂度，但不能隐藏资金安全所依赖的状态。**

# 参考资料

- [ERC-4337: Account Abstraction Using Alt Mempool](https://eips.ethereum.org/EIPS/eip-4337)
- [Bitcoin Developer Guide: Transactions](https://developer.bitcoin.org/devguide/transactions.html)
- [Solana: Transaction Confirmation and Expiration](https://solana.com/developers/guides/advanced/confirmation)
- [Sui Object Model](https://docs.sui.io/concepts/object-model)
- [Sui Object Ownership](https://docs.sui.io/concepts/object-ownership)
