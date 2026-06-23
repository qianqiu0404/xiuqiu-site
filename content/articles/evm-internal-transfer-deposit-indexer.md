---
{
  "id": 19,
  "slug": "evm-internal-transfer-deposit-indexer",
  "title": "EVM 充值扫链进阶：如何识别 Internal Txns 原生币入账",
  "date": "2026-06-23",
  "summary": "在 EVM 链上，原生币充值不一定只来自外层 tx.value。Bridge、聚合器和合约钱包可能通过内部调用把 native coin 转入充值地址，扫链服务需要从区块交易、日志和 execution trace 里共同识别这类入账。",
  "tags": [
    "Web3",
    "Wallet",
    "Backend",
    "Indexer",
    "EVM",
    "Bridge"
  ],
  "difficulty": "项目拆解",
  "conceptTags": [
    "wallet-backend",
    "multi-chain",
    "api-design"
  ],
  "relatedProjectIds": [
    1,
    2
  ],
  "recommendedSlugs": [
    "new-chain-integration-checklist",
    "wallet-api-boundary",
    "wallet-address-models",
    "withdrawal-error-handling",
    "chainflip-cross-chain-dex-analysis"
  ],
  "suggestedQuestions": [
    "为什么 MetaMask Bridge 过来的 BNB 会出现在 Internal Txns 里？",
    "EVM 原生币充值为什么不能只看 tx.to 和 tx.value？",
    "扫链服务要怎么扫到 internal transfer 类型的原生币充值？"
  ]
}
---

# EVM 充值扫链进阶：如何识别 Internal Txns 原生币入账

在 EVM 链上，原生币充值不一定只来自一笔简单的外层转账。

很多钱包系统最早接入 ETH、BNB、MATIC 这类 native coin 时，都会先实现一套很直观的充值识别逻辑：

```text
tx.to == 用户充值地址
tx.value > 0
tx.status == success
```

这套逻辑可以覆盖普通 EOA 转账：

```text
用户钱包 -> 充值地址
```

但当用户通过 MetaMask Bridge、跨链聚合器、合约钱包、多签钱包、批量打款系统或某些托管出账系统转入 native coin 时，真实路径可能变成：

```text
用户钱包 -> Bridge / Aggregator / Executor Contract -> 充值地址
```

充值地址最终收到的仍然是原生 BNB 或 ETH，但这笔 value transfer 不一定体现在外层交易的 `tx.to` 字段里，而是发生在合约执行过程中的一次内部调用里。

这类交易在 BscScan、Etherscan 这类浏览器里通常会出现在 `Internal Txns` 区域。

从钱包后端角度看，这不是资产类型变了，而是扫链服务的数据源不够了。它不能只扫区块里的外层 transaction，还要能从交易执行轨迹里扫到充值地址收到的 internal value transfer。

# 普通外层转账和内部转账的区别

普通 native coin 转账的结构比较简单。

用户从自己的 EOA 地址直接给充值地址转 BNB：

```text
from: 用户地址
to:   充值地址
value: 1 BNB
```

扫链服务只要遍历区块交易，检查 `tx.to` 是否命中充值地址，就可以识别这笔充值。

但 Bridge 或聚合器场景里，外层交易通常不是直接发给充值地址：

```text
from: 用户地址
to:   Bridge / Executor Contract
value: 0 或某个桥接相关金额
```

真正让充值地址收到 BNB 的动作，可能发生在合约内部：

```text
Bridge / Executor Contract
  -> call{value: 1 BNB}(充值地址)
```

所以从链上结果看，充值地址的 native balance 增加了；但从外层交易字段看，`tx.to` 并不是充值地址。

这就是为什么用户在浏览器里能看到自己地址收到了 BNB，但扫链服务如果只遍历区块交易列表，就无法扫到这笔充值。

# Internal Txns 本质上是什么

`Internal Txns` 不是一类新的链上交易。

在 EVM 里，真正被打包进区块的是外层 transaction。所谓 internal transaction，更准确地说，是一次交易执行过程中产生的内部调用记录。

比如合约执行时可以调用：

```solidity
recipient.call{value: amount}("");
```

这会让 native coin 从合约地址转到 `recipient`。这笔转账不会变成一笔新的顶层 transaction，但它确实改变了地址余额。

区块浏览器通过 trace 执行过程，把这种内部 value transfer 展示出来，于是用户会看到它出现在 `Internal Txns` 中。

所以 Internal Txns 可以理解成：

```text
不是新的交易，而是交易执行轨迹中的 value transfer
```

这也是充值扫链需要单独处理它的原因。

# 扫链服务的三个数据源

生产级 EVM 充值扫链，难点不只是判断一笔交易是不是充值，而是从不同链上数据源里把充值事实扫出来。

我会把它拆成三层：

```text
transaction-level
event-level
execution-level
```

第一类数据源是区块交易列表，用来识别外层 native transfer。

```text
tx.to == deposit_address
tx.value > 0
tx.status == success
```

它覆盖普通 ETH、BNB、MATIC 转账。

第二类数据源是 receipt logs，用来识别 token event。

```text
ERC20 Transfer(from, to, value)
to == deposit_address
```

它覆盖 USDT、USDC、平台币和其他 ERC20 / BEP20 资产。

第三类数据源是 execution trace，用来识别 internal native transfer。

```text
trace.to == deposit_address
trace.value > 0
parent_tx.status == success
internal_call 未 revert
```

它覆盖 Bridge、合约钱包、批量出账、退款合约、聚合器执行合约等触发的 native coin 入账。

如果只接入前两类数据源，系统就会把 native coin 理解成“只有外层 tx.value 才算充值”。但在真实生产环境里，这个假设并不完整。

# 哪些场景会产生这类充值

MetaMask Bridge 是一个很典型的例子。

用户从一条链桥接资产到 BNB Chain，最终充值地址收到了 native BNB。但中间可能经过桥协议、聚合器、执行合约或 relayer，最后由合约内部调用把 BNB 转到充值地址。

除了 Bridge，还有很多场景也会出现类似路径：

```text
跨链聚合器
CEX 批量出账系统
Safe / 多签钱包
智能合约钱包
支付合约
退款合约
空投或分发合约
DeFi 协议提款
托管系统热钱包归集后出账
```

这些场景有一个共同点：

```text
收到的是 native coin
但发送动作不是简单的 EOA -> 充值地址
```

所以钱包后端不能只问“这笔交易的 to 是不是充值地址”，还要问：

```text
这次成功执行里，充值地址是否获得了 native balance increase？
```

# 怎么扫到 internal transfer

要识别 internal native transfer，扫链服务需要拿到交易执行 trace，并把 trace 里的 value call 也当成一种可匹配的充值候选。

常见方案有几种：

```text
自建支持 trace/debug 的节点
使用第三方 RPC provider 的 trace API
使用区块浏览器 internal tx API 做补充
构建独立 internal transfer indexer
```

在 EVM 链上，相关能力通常来自：

```text
debug_traceTransaction
debug_traceBlockByNumber
trace_block
trace_transaction
```

不同链和不同节点客户端支持程度不一样。比如 BSC、Polygon、Arbitrum、Base、Optimism 等链，在 trace API、节点成本、provider 限制上都会有差异。

所以这部分不应该写死在业务服务里，而应该收敛成 Chain Adapter 或 Deposit Indexer 的一部分。业务服务不应该直接关心 BSC、ETH、Polygon、Base 的 trace API 差异。

一个更稳的抽象是：

```text
Block Scanner
  -> Outer Native Transfer Parser
  -> Token Event Parser
  -> Internal Native Transfer Parser
  -> Deposit Matcher
  -> Confirmation Manager
  -> Ledger Writer
```

这里最关键的是 `Internal Native Transfer Parser`。

它不是重新扫一遍普通交易，而是对每个已确认区块或候选交易拉取执行轨迹，然后在 trace 树里找出满足条件的内部 value transfer：

```text
trace.type == CALL
trace.to in deposit_address_set
trace.value > 0
parent_tx.status == success
call 没有 error / revert
```

如果命中，就把它转成和普通充值一样的 deposit candidate。

业务层最终不关心这笔充值来自外层交易、ERC20 event，还是 internal call。它只关心扫链服务是否生成了一条可信的 deposit record。

# 实际扫链流程怎么走

更贴近生产实现的流程可以拆成六步。

第一步，按区块高度推进扫描游标：

```text
current_height -> scan_height -> confirmed_height
```

扫链服务不会直接扫最新块，而是根据确认数只处理已经相对稳定的区块。

第二步，拉取区块交易和 receipt：

```text
getBlockByNumber(block, fullTx = true)
getTransactionReceipt(tx_hash)
```

这一步可以识别普通 native transfer 和 ERC20 / BEP20 Transfer event。

第三步，判断这个区块是否需要 trace。

最直接的方式是对每个区块拉 `debug_traceBlockByNumber` 或 `trace_block`，再批量过滤充值地址。这样覆盖最完整，但节点成本更高。

也可以先根据交易类型、合约地址、用户提交的 txHash、余额变化线索做候选筛选，再对候选交易拉 `debug_traceTransaction`。这种成本更低，但实现上要避免漏掉没有明显特征的合约转账。

第四步，从 trace 树里展开内部调用。

一笔交易的执行过程可能是树状结构：

```text
tx -> bridge contract
  -> router contract
    -> executor contract
      -> call{value: 1 BNB}(deposit address)
```

扫链服务要递归遍历这棵 trace 树，找到所有带 `value` 的 call，并检查 `to` 是否命中平台充值地址。

第五步，把命中的 internal call 标准化成充值候选：

```text
chain_id
block_number
block_hash
tx_hash
trace_address / internal_index
from
to
value
asset = native coin
source = internal_transfer
```

这一步的目的，是让后面的确认、幂等、入账逻辑不需要感知它来自 trace。

第六步，进入统一的充值确认流程。

```text
deposit candidate
  -> deduplicate
  -> wait confirmations
  -> confirmed deposit
  -> ledger entry
```

所以难点不是“检查 value 字段”这么简单，而是要明确检查的是哪一层 value：

```text
外层原生币转账: tx.value
代币转账: log.data / Transfer event value
内部原生币转账: trace.value
```

MetaMask Bridge 这类入账，通常要看的就是第三种。

# 扫到以后还要能去重

internal transfer 也必须有稳定的唯一键。

普通外层 native transfer 可以用：

```text
chain_id + tx_hash
```

ERC20 Transfer 通常可以用：

```text
chain_id + tx_hash + log_index
```

internal transfer 则需要更细：

```text
chain_id + tx_hash + trace_address / internal_index + to + value
```

因为同一笔交易里可能对同一个地址产生多次 internal transfer，也可能对多个地址分发 native coin。

如果只用 `tx_hash` 做唯一键，就会有两个问题：

第一，同一笔交易里多个充值地址可能只能入一条。

第二，同一笔交易里同一地址多次收到 value 时，可能被错误合并。

所以 internal transfer 的 deposit key 必须包含 trace 维度。

# 确认数、reorg 和失败状态

internal transfer 不能只看 trace 里出现了 value transfer，还要结合整笔交易和区块状态。

至少要确认：

```text
parent transaction success
internal call 未 revert
block 已达到确认数
block hash 未被 reorg 替换
deposit address 命中平台地址
asset 是该链 native coin
value 大于最小入账阈值
没有重复入账
```

如果链发生 reorg，已经识别的 internal deposit 也要能回滚或重新确认。

这和普通充值扫链一样，只是 internal transfer 的数据来源更复杂，所以更需要把 block number、block hash、tx hash、trace index、确认状态一起保存下来。

# 和账务系统的边界

扫链服务只负责发现链上事实，不应该直接修改用户可用余额。

更稳的链路是：

```text
Deposit Indexer
  -> Deposit Record
  -> Confirmation Job
  -> Ledger Entry
  -> User Balance
```

当 internal transfer 被识别出来后，它应该先进入充值记录表，状态可能是：

```text
detected
confirming
confirmed
credited
reorged
ignored
manual_review
```

账务服务根据 confirmed deposit 生成入账流水。

这样做的好处是：即使 trace provider 出现延迟、浏览器 API 短暂不可用、节点返回不一致，也不会让业务账务直接暴露在不稳定数据源上。

# 补偿任务的作用

internal transfer 支持上线后，补偿任务也要跟上。

它至少应该覆盖几类情况：

```text
某个区块 trace 拉取失败，稍后补扫
某笔 tx 外层扫描成功但 trace 延迟返回
第三方 provider 和自建节点结果不一致
用户提交 txHash 后触发定向补扫
充值地址余额增加但没有 deposit record
```

尤其是 Bridge 场景，用户往往能拿出浏览器链接证明自己已经到账。系统侧需要能根据 `txHash` 做定向 trace 检查，而不是只让用户等待下一轮全量扫链。

这部分不是为了人工兜底，而是为了让充值系统具备自我修复能力。

# 对钱包后端的理解

这个场景让我重新审视了 EVM native coin 充值的建模方式。

最初我们很容易把 native coin 充值理解成：

```text
一笔 tx.value 转账
```

但更准确的生产模型应该是：

```text
在一次成功的链上执行中，平台充值地址获得了 native asset balance increase
```

外层转账只是其中最简单的一种情况。

当钱包开始接入 Bridge、合约钱包、聚合器、多签、批量出账和跨链协议时，充值 indexer 必须从 transaction-level indexing 升级到 execution-level indexing。

也就是说，生产级充值扫链至少要同时理解三类事实：

```text
外层 native transfer
token event transfer
internal native value transfer
```

只有这样，钱包系统才能覆盖用户真实的资产流入路径。

# 最后总结

MetaMask Bridge 过来的 BNB，本质上仍然是 native BNB。

区别在于，它可能不是通过外层 `tx.to = 充值地址` 转进来的，而是在桥或执行合约内部通过 value call 转进充值地址。

所以对钱包后端来说，这个问题的关键不是“BNB 是不是原生币”，而是：

```text
这笔原生币入账发生在 transaction level，还是 execution trace level？
```

如果只扫外层交易，充值系统只能覆盖最简单的 EOA 转账。

如果把 internal transfer / trace 纳入 indexer，充值系统才能真正覆盖 Bridge、合约钱包、聚合器和批量出账这些生产场景。

这也是 EVM 充值扫链从可用走向生产级时，必须补齐的一层能力。
