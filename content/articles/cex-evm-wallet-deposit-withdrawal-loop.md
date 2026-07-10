---
{
  "id": 20,
  "slug": "cex-evm-wallet-deposit-withdrawal-loop",
  "kind": "engineering-note",
  "title": "从充值到提现：我完整跑通了一条交易所 EVM 钱包链路",
  "date": "2026-06-23",
  "summary": "这篇复盘记录我如何跑通交易所钱包充值提现闭环：把一条 EVM 链从地址生成、充值扫链、余额入账、提现冻结、交易构建、签名广播、receipt 确认到业务通知串成完整资金链路。",
  "tags": [
    "Web3",
    "Wallet",
    "Backend",
    "Exchange Wallet",
    "EVM"
  ],
  "difficulty": "项目拆解",
  "conceptTags": [
    "wallet-backend",
    "multi-chain",
    "api-design",
    "evm"
  ],
  "relatedProjectIds": [
    1,
    2
  ],
  "recommendedSlugs": [
    "evm-internal-transfer-deposit-indexer",
    "withdrawal-error-handling",
    "new-chain-integration-checklist",
    "wallet-api-boundary",
    "wallet-sign-signer"
  ],
  "suggestedQuestions": [
    "交易所钱包充值提现闭环是什么？",
    "为什么 broadcasted 不等于提现成功？",
    "提现时 available_balance 和 lock_balance 应该怎么变化？"
  ]
}
---

# 从充值到提现：我完整跑通了一条交易所 EVM 钱包链路

这次测试 Base、Sepolia、BNB 这些 EVM 链时，我最大的感受是：接一条链真正有价值的部分，不是调通 RPC，也不是发出一笔交易，而是把充值、提现、扫链、账务和状态推进跑成一个闭环。

单看链上，充值和提现都只是交易。但放到交易所钱包系统里，它们会变成一套资金状态机：

```text
地址生成
-> 用户充值
-> 扫链命中
-> deposit / transaction 入库
-> 余额更新
-> 创建提现
-> 冻结余额
-> 构建交易
-> 签名
-> 广播
-> receipt 确认
-> 扣减冻结金额
-> 通知业务方
```

这条链路里任何一个环节只做“能跑”，都不够。充值扫到了但没有增加可用余额，用户还是不能提现；提现广播成功但没有等 receipt，就会把节点接收误认为链上成功；余额冻结和释放没设计好，账务迟早会对不上。

所以这篇文章不是记录“我接了某条链”，而是复盘一条交易所 EVM 钱包链路从能转账到状态一致，中间必须补齐哪些工程边界。

# 这不是调通 RPC，而是跑通资金闭环

EVM 链接入最容易让人产生错觉的地方是：只要 `eth_getBalance` 能查余额，`eth_sendRawTransaction` 能发交易，好像链就接完了。

但交易所钱包不是普通钱包客户端。普通钱包关心“我能不能签名并发出交易”，交易所钱包还要关心：

```text
这笔充值属于哪个用户
充值经过多少确认后入账
入账增加的是总余额还是可用余额
提现创建时是否先冻结
广播成功是否等于提现成功
链上失败后冻结金额怎么释放
业务通知失败后状态怎么补偿
链上余额和内部账怎么对账
```

所以完整链路不是一个 RPC 调用问题，而是三个系统协作：

```text
wallet-api: 业务状态机、余额、提现单、交易构建和广播
wallet-sign: 私钥隔离和交易签名
scanner / worker: 扫链、receipt 查询、确认数、补偿和状态推进
```

我这次测试的重点，就是让这三块从充值到提现跑通，而不是停在“交易发出去了”。

RPC 在这里更像链上事实的查询和提交入口，而不是业务系统本身。

```text
eth_getBalance:
  只能告诉你某个地址当前链上余额

eth_sendRawTransaction:
  只能把 raw transaction 提交给节点

eth_getTransactionReceipt:
  只能告诉你交易是否被打包以及执行结果
```

它们都不会自动回答交易所真正关心的问题：

```text
这笔充值属于哪个用户
是否已经达到入账确认数
是否生成了幂等账务流水
提现冻结是否正确释放
业务方是否收到最终通知
链上余额和内部负债是否对齐
```

所以我现在不会把“RPC 调通”当成链路完成。RPC 只是原材料，钱包后端要把这些原材料加工成可审计、可补偿、可对账的资金状态。

# 充值链路：地址生成到扫链入账

充值链路的第一步是地址生成。

对交易所钱包来说，地址不是临时生成给用户看的字符串，而是后续扫链归属的索引。系统至少要保存：

```text
user_id
chain_id
address
address_normalized
derivation_path / key_ref
asset_config
created_at
```

EVM 地址尤其要注意大小写。链上地址本质上是 20 bytes，大小写通常不影响地址含义，但数据库查询、缓存 key、扫链匹配如果没有统一 normalize，就可能出现同一个地址被当成两个地址的情况。

充值发生后，扫链服务按区块推进：

```text
scan block
-> parse transactions / receipts
-> match deposit address
-> create deposit record
-> wait confirmations
-> mark confirmed
-> update user balance
```

这里不能只生成一条 transaction 记录，还要明确它对账务的影响。充值确认后，至少应该同时增加：

```text
balance += amount
available_balance += amount
```

我测试时就遇到过一个很典型的问题：充值记录生成了，总余额也变化了，但可用余额没有同步增加。结果就是用户资产看起来到账了，却不能继续发起提现。

这类问题说明，充值入账不是“扫到交易”就结束，而是要生成账务流水，并让用户可用余额发生正确变化。

另外，EVM native coin 充值不一定只来自外层 `tx.value`。像 MetaMask Bridge、聚合器、合约钱包这类场景，充值地址收到的可能是 internal transfer。这个细节我已经单独拆成一篇扫链文章，这里只保留结论：充值扫链至少要能识别外层 native transfer、ERC20 event 和 internal native transfer 三类数据源。

# 提现链路：冻结余额到链上确认

提现是交易所钱包里风险更高的一侧，因为它是平台主动出资产。

完整提现链路不能从“构建交易”开始，而应该从业务校验和余额冻结开始：

```text
create withdraw order
-> check balance
-> mock / call risk service
-> freeze available balance
-> build unsigned transaction
-> request wallet-sign
-> broadcast raw transaction
-> query receipt
-> update withdraw status
-> settle locked balance
-> notify business
```

冻结余额是一个关键动作。用户发起提现时，不能等链上成功后才扣余额，因为这会让同一份可用余额被重复使用。

更合理的模型是：

```text
创建提现:
available_balance -= amount
lock_balance += amount
```

如果链上成功：

```text
lock_balance -= amount
balance -= amount
```

如果链上失败，且确定没有出金：

```text
available_balance += amount
lock_balance -= amount
```

这也是为什么提现不能只看链上交易，还要看业务状态机。提现单、sendout 记录、签名结果、广播结果、receipt、账务流水必须能串起来。

在测试环境里，风控和业务通知经常会先 mock。但 mock 也要模拟完整状态，否则状态机会卡住。比如风控 mock 永远成功，只能说明链路能往下走；通知 mock 如果不记录状态，就无法验证提现最终是否进入 `notified`。

# 状态机边界：broadcasted 不等于成功

这次测试里最值得沉淀的状态机边界，是 `broadcasted` 不等于提现成功。

`eth_sendRawTransaction` 返回 txHash，只能说明节点接受了这笔 raw transaction，或者至少返回了一个广播结果。它不代表交易已经被打包，也不代表 EVM 执行成功。

更准确的状态应该拆开：

```text
create_unsign
-> signed
-> broadcasted
-> wallet_done
-> notified
```

这里每个状态的含义都不一样：

| 状态 | 含义 |
| --- | --- |
| `create_unsign` | 提现单已创建，交易还没签名 |
| `signed` | raw transaction 已签名，但还没广播 |
| `broadcasted` | 交易已提交给节点，等待链上结果 |
| `wallet_done` | receipt 已确认，钱包侧完成链上状态 |
| `notified` | 上游业务方已收到最终结果 |

真正决定链上成功的是 receipt：

```text
receipt.status == 1
```

如果 `receipt.status == 0`，说明交易被打包了，但执行失败。比如合约调用 revert、gas 不足、token transfer 失败，都可能走到这个结果。

这里还要区分 `withdraw` 和 `sendout`。

`withdraw` 是业务提现单，关心用户、金额、余额、风控、业务通知和最终状态。

`sendout` 更像链上发送记录，关心 raw transaction、txHash、nonce、gas、广播和 receipt。

所以 `sendout` 不应该承担 `notified` 这种业务状态。通知业务方是提现单的完成动作，不是 raw tx 发送记录的职责。

这个边界一旦混在一起，后续补偿任务会很难写：链上成功但业务未通知、广播成功但链上失败、同一提现多次广播，这些情况都会挤在一个状态里，最后只能靠人工判断。

# Gas 和交易格式：不能写死 21000

EVM native coin 普通 EOA 转账，常见 gasLimit 是 21000。但这个数字不能当成所有提现的默认答案。

至少有几类情况会超过 21000：

```text
提现目标是合约钱包
ERC20 / BEP20 transfer
合约内部有额外逻辑
目标地址 fallback / receive 逻辑消耗 gas
多签或智能钱包交互
```

`eth_getCode` 可以判断目标地址是不是合约：

```text
eth_getCode(to) != "0x"
```

但它只能告诉你“是不是合约”，不能告诉你这笔交易到底需要多少 gas。真正应该用的是：

```text
eth_estimateGas
```

然后再加 buffer：

```text
gasLimit = estimatedGas * 1.2
```

不同链的 fee 模型也要区分。Ethereum、Base、Sepolia 这类链默认要按 EIP-1559 处理：

```text
maxFeePerGas
maxPriorityFeePerGas
```

BNB Chain 在很多场景里仍然可以先按 legacy `gasPrice` 处理：

```text
gasPrice
gasLimit
```

Blob 交易、EIP-4844 这类能力不应该混进普通提现链路。普通 ETH / BNB 提现不需要 blob fee，错误地把复杂交易类型混进提现构建，反而会增加不可控因素。

所以我对 Gas 的理解是：不能把 21000 当作业务规则。它只是普通 EOA native transfer 的一个常见结果，生产系统应该基于交易内容 estimate，然后按链配置决定 fee 格式。

# 账务模型：余额、可用余额、冻结余额

交易所钱包和普通钱包最大的区别之一，就是内部账。

普通钱包展示的是链上余额。交易所钱包要维护用户内部资产，所以至少要区分三类余额：

| 字段 | 含义 |
| --- | --- |
| `balance` | 用户总余额 |
| `available_balance` | 用户可提现、可交易的余额 |
| `lock_balance` | 已被冻结、等待链上结果的余额 |

充值确认后：

| 动作 | balance | available_balance | lock_balance |
| --- | --- | --- | --- |
| 充值确认 | 增加 | 增加 | 不变 |

提现创建并冻结后：

| 动作 | balance | available_balance | lock_balance |
| --- | --- | --- | --- |
| 提现冻结 | 不变 | 减少 | 增加 |

提现链上成功后：

| 动作 | balance | available_balance | lock_balance |
| --- | --- | --- | --- |
| 提现成功 | 减少 | 不变 | 减少 |

提现链上失败并确认没有出金后：

| 动作 | balance | available_balance | lock_balance |
| --- | --- | --- | --- |
| 提现失败 | 不变 | 增加 | 减少 |

这套模型看起来简单，但它是交易所钱包避免重复提现、余额错乱和账务不平的基础。

测试时如果只验证链上 txHash，很容易漏掉内部账错误。更好的测试断言应该同时检查：

```text
withdraw status
sendout status
txHash / receipt
deposit / transaction record
balance
available_balance
lock_balance
ledger entries
business notification
```

只有这些都一致，才能说链路真的跑通。

# 测试复盘：从能跑到可信

这次跑完整链路，最有价值的不是某个接口调通，而是暴露出一批“demo 能跑、系统不一定可信”的边界。

第一类是地址规范化问题。

EVM 地址大小写如果没有统一处理，扫链匹配、余额查询、用户地址映射都可能出现重复或查不到。比较稳的做法是内部统一用 lowercase 存储和匹配，展示层再按 checksum 格式展示。

第二类是充值入账不完整。

充值不能只生成 deposit，也不能只更新 `balance`。如果没有同步增加 `available_balance`，用户看到到账但不能提现，这说明链上事实和内部账没有真正闭环。

第三类是广播成功误判提现成功。

`broadcasted` 只是中间态。必须由 worker 继续查 receipt，并根据 `receipt.status` 推进到成功或失败。否则节点接受交易后，系统就会提前扣账或通知业务方。

第四类是 `withdraw` 和 `sendout` 职责混淆。

提现单应该表达业务状态，sendout 应该表达链上发送状态。如果把业务通知、链上广播、账务扣减都塞到一个状态里，补偿任务很难判断下一步该做什么。

第五类是 mock 服务不完整。

测试环境里的 risk service、notifier、worker 如果只是返回 success，但不记录请求和状态，就很难验证整条链路是否最终一致。mock 不只是为了让流程通过，也要能暴露状态推进是否完整。

第六类是 worker 轮询延迟。

链上已经成功，但数据库状态还停在 `broadcasted`，这在异步系统里很常见。测试时要接受短暂延迟，但也要验证 worker 最终能把状态推进到 `wallet_done` 和 `notified`。

第七类是链配置问题。

`chainId`、RPC、gas 模型、确认数、native symbol、explorer、是否 EIP-1559、nonce 策略，这些都不是静态文案配置。任何一项错了，都可能导致签名无效、广播失败、扫链不稳定或状态推进异常。

# 最后总结

这次测试让我对交易所 EVM 钱包链路的理解更清楚了。

接一条链不是把 RPC 调通，也不是能发出一笔交易，而是让资金在系统里形成完整闭环：

```text
链上充值事实
-> 内部充值记录
-> 用户可用余额
-> 提现冻结
-> 签名广播
-> 链上 receipt
-> 账务结算
-> 业务通知
```

真正的工程难点在于状态一致性。

充值侧要保证扫链事实能正确变成用户可用余额；提现侧要保证冻结、签名、广播、receipt、扣账和通知各自有清晰状态；账务侧要保证总余额、可用余额和冻结余额在成功、失败、延迟、重试场景下都能对上。

当这条链路跑通以后，我才会认为自己不是只“会发交易”，而是开始理解交易所钱包后端真正关心的问题：资金安全、状态机边界、异步补偿和最终一致性。
