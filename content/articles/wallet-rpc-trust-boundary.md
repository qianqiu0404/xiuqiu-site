---
{
  "id": 38,
  "slug": "wallet-rpc-trust-boundary",
  "kind": "engineering-note",
  "evidenceLevel": "source-reviewed",
  "evidenceSummary": "依据 Ethereum、Bitcoin Core、Solana 与 Sui 官方协议/RPC 文档，以及当前多链验收代码整理；多节点分歧和错误 RPC 故障注入尚待完整实现。",
  "title": "RPC 节点说谎时，充值、提现和对账会发生什么",
  "date": "2026-07-20",
  "summary": "钱包后端依赖 RPC 获取区块、余额、Nonce、UTXO、Checkpoint 与交易结果，但 RPC 只是证据来源，不是业务真相。本文拆解节点落后、分叉、错误网络和响应不一致如何影响资金状态。",
  "tags": ["Web3", "Wallet", "RPC", "Indexer", "Security"],
  "difficulty": "安全工程",
  "conceptTags": ["wallet-backend", "multi-chain", "api-design", "go-infra"],
  "relatedProjectIds": [1, 7],
  "recommendedSlugs": [
    "multi-chain-wallet-acceptance-loop",
    "multi-chain-wallet-resource-state",
    "evm-internal-transfer-deposit-indexer",
    "withdrawal-error-handling",
    "new-chain-integration-checklist",
    "wallet-software-supply-chain"
  ],
  "suggestedQuestions": [
    "为什么 RPC 返回成功不等于链上事实已经成立？",
    "多节点返回不同区块或交易状态时钱包应该怎么做？",
    "EVM、BTC、Solana 与 Sui 应分别记录什么最终性证据？"
  ]
}
---

# RPC 节点说谎时，充值、提现和对账会发生什么

钱包后端几乎所有链上判断都来自节点：区块、交易、余额、Nonce、UTXO、Receipt、Checkpoint 和 Object。

这很容易形成一个危险的默认假设：

> RPC 返回的数据就是链上真相。

实际上，RPC 只是一个节点在某个时间点提供的视图。节点可能落后、处于分叉、配置错误、被限流、缺少历史索引，也可能由第三方运营并返回不完整或错误数据。

钱包系统不应该先问“RPC 成功了吗”，而应该问：

```text
这是哪条链
节点同步到哪里
返回结果属于哪个区块或 Checkpoint
这个结果是否达到业务要求的最终性
另一个独立来源是否能复核
```

# RPC 错误会影响哪些资金事实

## 假充值或漏充值

节点可能返回一笔尚未达到确认数、随后被 Reorg 的交易；也可能因为 Trace、Event、历史索引不完整而漏掉充值。

如果钱包看到一次返回就增加可用余额，用户可能在 Reorg 前把临时到账的资产提现走。

## 错误链与跨网混淆

配置把 Mainnet Chain ID 对应到 Testnet 或另一条兼容链时，地址格式看起来仍然正确，RPC 也可能正常返回，但签名、余额和交易全部属于错误网络。

EIP-695 明确引入 `eth_chainId` 帮助调用方识别当前链，并指出 Chain ID 对重放保护和链识别的重要性。[EIP-695](https://eips.ethereum.org/EIPS/eip-695)

## 资源选择错误

- EVM 节点落后，返回过期 nonce；
- BTC 节点或 Indexer 漏掉已消费 UTXO；
- Solana 节点返回即将过期的 recent blockhash；
- Sui 节点返回旧 Object Version 或错误 Gas Object 状态。

这些错误不一定立刻造成盗币，但可能导致替换、双花尝试、卡单、重复构建和错误恢复。

## 广播结果未知

`sendRawTransaction` 超时不能说明节点没收到交易。直接构建第二笔交易，可能让同一订单关联多个交易 Hash，甚至产生重复出金风险。

正确做法是保留相同 Raw Transaction，并根据 txHash、sender/nonce、UTXO 或 Object 查询链上事实。未确认前暂停新资金动作。

# 不同链应记录不同最终性证据

## EVM

[Ethereum JSON-RPC](https://ethereum.org/developers/docs/apis/json-rpc/) 区分 `latest`、`safe` 和 `finalized` 等 Block Tag。钱包不应把 `latest` 返回的 Receipt 直接等同最终完成。

至少记录：

```text
chain_id
block_number
block_hash
parent_hash
tx_hash
receipt.status
confirmations / finality tag
```

如果相同高度的 blockHash 变化，就需要识别 Reorg，并回滚或反向处理尚未最终确认的账务。

## BTC

BTC 需要验证交易是否进入当前最佳链、达到确认数，以及输入 UTXO 是否仍属于预期状态。只依赖 Mempool API 不足以判断长期最终性。

关键证据包括：

```text
txid
block_hash / height
confirmations
vin: prev_txid + vout
输出与找零
是否存在 replacement / conflict
```

钱包自己的 UTXO Lock 与节点的 UTXO Set 是两层状态，任何一层发生冲突都不能继续选币。

## Solana

Solana RPC 使用 `processed`、`confirmed` 和 `finalized` 等 Commitment。官方确认指南说明 recent blockhash 有有效窗口，RPC 节点也可能相对集群落后。[Solana Transaction Confirmation](https://solana.com/developers/guides/advanced/confirmation)

充值和提现需要明确使用的 Commitment，并记录 Slot、Blockhash、Signature 和交易 Meta。过期交易应重新构建和签名，不能只替换 Blockhash 后复用旧签名。

## Sui

Sui 需要围绕 Transaction Digest、Effects、Checkpoint Sequence 和 Object Version 建立证据。Sui 的 Checkpoint 用于收敛最终交易和 Effects，而不是硬套 EVM Block Number。[Sui 协议文档](https://docs.sui.io/paper/sui-lutris.pdf)

如果交易构建以后 Object Version 变化，需要重新选择对象、模拟、构建并签名。

# 多节点不是简单多数投票

接入两个或三个 RPC 不能自动解决信任问题。

如果它们来自同一家 Provider、同一上游节点或同一错误配置，看起来是多节点，实际仍然是单一故障域。

多节点策略应该先区分用途：

```text
快速读：允许单节点，但有高度和延迟门禁
资金确认：要求独立来源复核区块 Hash 与交易结果
交易构建：资源读取必须绑定节点高度和有效期
广播：可以向多个节点提交同一个 Raw Transaction
恢复：以 Canonical Chain 与账务规则决定补偿
```

不能为了“多数一致”而忽略协议事实。例如三个落后节点一致，也不代表它们比一个已同步节点更接近 Canonical Head。

# wallet-api 应该承担的信任边界

wallet-api 不只是 RPC 转发器，它需要把不稳定节点响应转换成可审计证据：

- 启动时验证 Chain ID、Network 和必要的 Genesis/Checkpoint 标识；
- 记录 Provider、请求时间、节点高度和响应区块；
- 监控 Head Lag、错误率、限流和分歧；
- 对资金确认使用独立来源；
- 构建交易时返回资源版本和 Unsigned Hash；
- 广播相同 Raw Transaction，而不是在超时后静默重建；
- 将节点错误、业务失败和结果未知分开分类。

wallet-service 则根据这些证据推进资金状态，而不是直接解析第三方 RPC 的任意 JSON。

# 应该补的错误 RPC 实验

1. 节点返回错误 Chain ID，Preflight 阻止启动；
2. 两个节点在同一高度返回不同 blockHash，充值暂停确认；
3. Receipt 先成功后因 Reorg 消失，待确认账务回滚或反向分录；
4. 广播超时但另一节点能查到交易，不创建第二笔交易；
5. BTC Indexer 返回已消费 UTXO，选币前交叉验证并拒绝；
6. Solana RPC 返回过期 Blockhash，重建而不是复用签名；
7. Sui Object Version 冲突，重新模拟、构建和审批；
8. 通知和数据库恢复后重扫相同区块，余额与记录数量保持不变。

# 当前项目边界

当前多链项目已经验证 EVM、BTC、Solana、Sui 等链的部分真实链路和适配测试，也记录了确认数、UTXO、Checkpoint 与广播结果未知等边界。

下一阶段应该把多节点分歧、错误网络、落后节点和 Reorg 变成可重复故障实验，而不是只写成生产建议。

RPC 可以提供链上证据，但钱包系统必须保存证据来源、最终性和恢复依据，才能把节点响应转成可信资金事实。
