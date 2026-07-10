---
{
  "id": 19,
  "slug": "evm-internal-transfer-deposit-indexer",
  "kind": "engineering-note",
  "title": "EVM 充值扫链进阶：如何识别 Internal Txns 原生币入账",
  "date": "2026-06-23",
  "summary": "EVM Internal Native Transfer 不会出现在外层 tx.to，也不一定出现在 receipt logs。交易所要识别这类充值，本质是解析 EVM 的 CALL 执行树，通过 debug_traceTransaction 或 trace_transaction 找到 value > 0 且 to 命中平台充值地址的调用节点。",
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
    "cex-evm-wallet-deposit-withdrawal-loop"
  ],
  "suggestedQuestions": [
    "Internal Native Transfer 怎么通过 CALL 树解析？",
    "为什么 receipt logs 看不到原生币内部转账？",
    "ETH 普通充值、ERC20 和 Internal ETH 充值分别应该看哪里？"
  ]
}
---

# EVM 充值扫链进阶：如何识别 Internal Txns 原生币入账

交易所做 EVM 充值扫链时，最容易理解的是普通充值：

```text
Alice -> ExchangeAddress
```

链上交易里直接能看到：

```json
{
  "from": "Alice",
  "to": "ExchangeAddress",
  "value": "1000000000000000000"
}
```

这种场景很好扫：

```text
tx.to in exchange_addresses
tx.value > 0
tx.status == success
```

但真实用户不一定总是从 EOA 地址直接转账。用户可能通过 MetaMask Bridge、跨链聚合器、合约钱包、多签钱包、支付合约、批量出账系统把 ETH、BNB、MATIC 这类 native coin 打到交易所充值地址。

这时链上看起来可能不是：

```text
Alice -> ExchangeAddress
```

而是：

```text
Alice -> Vault / Bridge / Router
         -> ExchangeAddress
```

充值地址最终确实收到了 native coin，但外层交易的 `tx.to` 不是充值地址。这个时候，交易所如果只扫区块里的 transaction，就会看不到这笔入账。

这类入账通常会出现在 Etherscan / BscScan 的 `Internal Txns` 里。它不是一种新的链上交易，而是 EVM 执行过程中发生的内部 value transfer。

# 先看一笔普通交易为什么扫不到

假设用户调用一个合约：

```solidity
contract Vault {
    address payable exchangeAddress;

    function deposit() external payable {
        exchangeAddress.transfer(msg.value);
    }
}
```

用户 Alice 调用：

```text
Vault.deposit{value: 1 ETH}()
```

外层交易长这样：

```json
{
  "from": "Alice",
  "to": "Vault",
  "value": "1000000000000000000"
}
```

如果扫链服务只看外层交易字段，它会看到：

```text
tx.to = Vault
tx.value = 1 ETH
```

但交易所真正关心的不是 Vault 收到了 1 ETH，而是合约内部又把这 1 ETH 转给了平台充值地址：

```text
Alice
  -> Vault.deposit()
      -> ExchangeAddress receives 1 ETH
```

也就是说，外层交易只能告诉你“用户调用了 Vault”，不能告诉你执行过程中谁最终收到了钱。

# 为什么 receipt logs 也看不到

很多充值扫链会依赖 receipt logs。

比如 ERC20 充值，通常看的是：

```text
Transfer(from, to, value)
```

只要 `to` 命中平台充值地址，就能识别代币充值。

但 native coin transfer 不一定会产生 event。

上面的 `exchangeAddress.transfer(msg.value)` 只是一次原生币转账，不会自动产生 ERC20 的 `Transfer` event。它也不一定会产生任何业务日志。

所以 receipt 可能是：

```json
{
  "status": "0x1",
  "logs": []
}
```

这时你会遇到一个很关键的事实：

```text
tx.to 看不到充值地址
receipt logs 也看不到充值地址
```

但充值地址的余额确实增加了。

这就是 Internal Native Transfer 的难点：它不在 transaction 外层字段里，也不一定在 event logs 里，而在 EVM 执行过程里。

# 真正要看的是 trace

要发现这类入账，需要看交易执行轨迹，也就是 trace。

比如对这笔交易执行：

```text
debug_traceTransaction(txHash)
```

或使用支持 OpenEthereum / Erigon 风格的：

```text
trace_transaction(txHash)
```

可以拿到类似这样的调用信息：

```json
{
  "calls": [
    {
      "type": "CALL",
      "from": "Alice",
      "to": "Vault",
      "value": "1000000000000000000"
    },
    {
      "type": "CALL",
      "from": "Vault",
      "to": "ExchangeAddress",
      "value": "1000000000000000000"
    }
  ]
}
```

第二个 `CALL` 才是交易所关心的那笔入账：

```text
from = Vault
to = ExchangeAddress
value = 1 ETH
```

所以 Internal Native Transfer 的识别逻辑可以简化成：

```text
遍历 trace calls
找到 type = CALL
找到 value > 0
找到 to in exchange_addresses
生成充值候选
```

这个逻辑和 ERC20 扫 `Transfer Event` 很像，只是数据源从 receipt logs 换成了 execution trace。

# 交易所如何匹配平台充值地址

生产系统里，交易所通常会维护一张充值地址索引：

```text
exchange_addresses:
  0xaaa...
  0xbbb...
  0xccc...
```

扫链时，把它放进一个适合快速查询的集合：

```text
deposit_address_set
```

拿到 trace 后，对每个内部调用做匹配：

```text
if call.type == "CALL"
and call.value > 0
and normalize(call.to) in deposit_address_set
and parent_tx.status == success
and call 没有 revert / error
then create deposit candidate
```

生成的充值候选大概包含：

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

这里最重要的是 `to` 和 `value`。

很多人会以为要解析 `tx.input`，其实 Internal Native Transfer 的核心不是 input data，而是执行后的 CALL 节点。

`tx.input` 只能告诉你用户调用了哪个函数。  
trace 才能告诉你这个函数执行过程中发生了哪些 value transfer。

# CALL 树怎么遍历

真实交易的 trace 往往不是一个平铺列表，而是一棵执行树。

比如一个跨链聚合器或 swap 路径可能是：

```text
User
  -> Router
      -> Pool
          -> TokenA
          -> TokenB
      -> Executor
          -> ExchangeAddress
```

trace 里可能类似：

```text
CALL
├─ CALL
│  ├─ CALL
│  └─ CALL
└─ CALL
   └─ CALL value -> ExchangeAddress
```

扫链服务要做的是 DFS 或 BFS：

```text
walk(trace):
  if node.type == CALL and node.value > 0:
      match node.to
  for child in node.calls:
      walk(child)
```

只要遍历到这样的节点：

```json
{
  "type": "CALL",
  "from": "Executor",
  "to": "ExchangeAddress",
  "value": "1000000000000000000"
}
```

并且 `ExchangeAddress` 属于平台充值地址，就可以识别为 Internal Native Transfer。

这里要注意几个边界。

第一，`DELEGATECALL` 通常不会携带独立的 ETH value 转移，它更像是在调用方上下文里执行代码；识别原生币入账时，核心还是看带 value 的 `CALL`。

第二，`STATICCALL` 不能修改状态，也不会转出 native value，一般不会形成入账。

第三，`CREATE` / `CREATE2` 可能在创建合约时携带 value，如果平台充值地址模型涉及合约地址，也需要按链和业务规则单独处理。

第四，不同客户端返回的 trace 结构不完全一样。有的叫 `calls`，有的给 `traceAddress`，有的以 flat list 返回，所以工程上要先统一成内部格式。

# 生产环境两种扫法

识别 Internal Transfer，生产环境通常有两种思路。

第一种是逐交易 trace。

流程是：

```text
收到区块
-> 遍历区块交易
-> 对每笔交易调用 debug_traceTransaction / trace_transaction
-> 遍历 CALL 树
-> 匹配平台充值地址
```

优点是实现直观，适合早期接入和问题排查。

缺点是 RPC 压力很大。一个区块里如果有大量交易，逐笔 trace 会很吃节点资源，也容易被第三方 RPC 限流。

第二种是自建支持 trace 的索引能力。

比如基于：

```text
Erigon
Reth
Geth debug trace
自研 indexer
第三方 enhanced API
```

这类方案可以按区块批量拿 trace，或者直接从执行结果里抽取 internal transfer / state diff。

如果能拿到 state diff，也可以从余额变化角度判断：

```json
{
  "0xExchangeAddress": {
    "balance": "+1000000000000000000"
  }
}
```

state diff 的好处是更接近“谁的余额变了”。但充值系统仍然需要关联到 `tx_hash`、区块高度、确认数和幂等键，否则后面无法入账、回滚和对账。

所以早期可以逐交易 trace，生产规模上来后，最好把 internal transfer 抽成独立 indexer 或 trace service。

# 充值来源识别表

EVM 充值扫链可以整理成一张表。

| 充值类型 | 主要看哪里 | 关键字段 |
| --- | --- | --- |
| ETH / BNB 普通充值 | transaction | `tx.to + tx.value` |
| ERC20 / BEP20 充值 | receipt logs | `Transfer(from, to, value)` |
| ERC721 充值 | receipt logs | `Transfer(from, to, tokenId)` |
| ERC1155 充值 | receipt logs | `TransferSingle / TransferBatch` |
| Internal ETH / BNB 充值 | execution trace | `CALL.to + CALL.value` |
| 合约内部 ERC20 转账 | receipt logs | `Transfer Event` |
| Account Abstraction 资金流 | trace + event | `UserOperation event + CALL / Transfer` |

这张表背后的核心判断是：

```text
普通原生币看 tx.value
代币转账看 Transfer Event
内部原生币转账看 trace CALL.value
```

不要把这三类混在一起。

# 入账后的幂等和确认

扫到 internal transfer 只是第一步，后面还要处理幂等、确认数和账务边界。

普通外层 native transfer 通常可以用：

```text
chain_id + tx_hash
```

ERC20 Transfer 通常可以用：

```text
chain_id + tx_hash + log_index
```

Internal Native Transfer 需要更细：

```text
chain_id + tx_hash + trace_address / internal_index + to + value
```

原因是同一笔交易里可能有多个 internal transfer，也可能同时给多个平台充值地址打款。如果只用 `tx_hash` 去重，就可能漏记或合并错误。

确认规则也不能省。

至少要确认：

```text
parent transaction success
internal CALL 没有 revert / error
block 已达到确认数
block hash 没有被 reorg 替换
to 命中平台充值地址
value 大于最小入账阈值
deposit key 没有重复入账
```

然后再进入统一的充值入账链路：

```text
deposit candidate
-> wait confirmations
-> confirmed deposit
-> ledger entry
-> user balance
```

扫链服务只负责发现链上事实，不应该直接修改用户可用余额。更稳的方式是先生成充值记录，再由账务服务根据 confirmed deposit 生成流水和余额变更。

# 最后总结

EVM Internal Native Transfer 的核心不是解析 `tx.input`，也不是看 receipt logs。

它的核心是解析 EVM 执行过程：

```text
debug_traceTransaction / trace_transaction
-> CALL tree
-> CALL.value > 0
-> CALL.to in exchange_addresses
```

普通交易字段只能告诉你“这笔交易发给了谁”。  
receipt logs 能告诉你“合约主动记录了哪些事件”。  
trace 才能告诉你“执行过程中 native coin 实际流向了谁”。

所以交易所要支持 MetaMask Bridge、合约钱包、批量出账系统、跨链聚合器这类充值来源，就不能只扫外层交易和 ERC20 event。它必须能解析 EVM CALL 树，把内部 value transfer 标准化成充值候选，再走确认、幂等、账务入账和补偿流程。

这也是 EVM 充值扫链从“能扫普通转账”走向“能覆盖真实生产资金流”的关键一步。
