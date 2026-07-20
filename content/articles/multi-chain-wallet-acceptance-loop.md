---
{
  "id": 31,
  "slug": "multi-chain-wallet-acceptance-loop",
  "kind": "engineering-note",
  "evidenceLevel": "local-verified",
  "evidenceSummary": "Base、Solana、BNB 以及 BTC Testnet4、Sui Testnet 的对应链路已完成本地或测试网验证；本文记录验收方法与当前边界，不代表生产环境运行结论。",
  "title": "从适配一条链到验收一条链：多链钱包的统一工程 Loop",
  "date": "2026-07-20",
  "summary": "多链钱包不只是增加 RPC 适配器。本文复盘如何用统一资金状态机串起地址、充值、归集、提现、确认、对账与幂等重扫，同时显式处理 EVM nonce、BTC UTXO、TRON 资源和 Sui Object。",
  "tags": [
    "Web3",
    "Wallet",
    "Backend",
    "Multi-chain",
    "Bitcoin",
    "Sui"
  ],
  "difficulty": "工程复盘",
  "conceptTags": [
    "wallet-backend",
    "multi-chain",
    "signer-service",
    "go-infra",
    "api-design"
  ],
  "relatedProjectIds": [
    1
  ],
  "recommendedSlugs": [
    "multi-chain-wallet-resource-state",
    "cex-evm-wallet-deposit-withdrawal-loop",
    "new-chain-integration-checklist",
    "wallet-api-boundary",
    "wallet-sign-signer",
    "withdrawal-error-handling"
  ],
  "suggestedQuestions": [
    "适配一条链和真正验收一条链有什么区别？",
    "为什么多链钱包应该统一业务状态机，但不能隐藏链资源？",
    "BTC、EVM、TRON 和 Sui 的验收依据分别是什么？",
    "怎样证明扫链、余额和通知在重跑后仍然幂等？"
  ]
}
---

# 从适配一条链到验收一条链：多链钱包的统一工程 Loop

最开始做多链钱包时，我很容易把“支持一条链”理解成：能生成地址、能查询余额、能构建交易、能签名、能广播。

随着充值、提现、扫链和签名服务逐渐连起来，我发现这些能力只能说明链适配器可以工作，还不能说明钱包系统真正支持了这条链。

对交易所钱包后端来说，更完整的问题应该是：

```text
地址是否正确登记
充值能否被稳定识别
确认数是否正确推进
余额是否只更新一次
提现是否先冻结资金
签名内容是否与审批内容一致
广播以后如何判断最终结果
服务重启和重复扫链会不会重复入账
失败以后资金状态能否恢复
```

因此，我现在更愿意把一条链的接入过程分成三个层次：

```text
链适配
→ 业务闭环
→ 可重复验收
```

链适配解决“如何与这条链交互”，业务闭环解决“如何让链上事实进入钱包状态机”，可重复验收则回答“如何证明这套流程能够再次运行，并且不会破坏资金不变量”。

# 业务状态机应该统一，链上资源不能被隐藏

EVM、BTC、TRON 和 Sui 的交易模型差异很大，但交易所钱包面对的业务过程基本一致：

```text
Preflight
→ 生成并登记地址
→ 充值与扫链
→ 归集
→ 提现
→ 链上确认
→ 账务更新
→ 业务通知
→ Audit 与幂等重扫
```

多链钱包不应该为每条链重新设计一套业务状态机，但必须让每条链特有的资源状态显式进入构建、恢复和验收流程。

统一的部分包括请求幂等、风控审批、余额冻结、签名边界、广播状态、最终性、账务更新、失败补偿和业务通知。

不能强行隐藏的部分包括：

- EVM 的 nonce 和 Gas；
- BTC 的 UTXO、找零和费率；
- TRON 的 TAPOS、Energy 和 Bandwidth；
- Sui 的 Coin Object、Gas Object 和 Object Version。

如果为了统一接口而把这些资源全部藏在 adaptor 里面，异常发生以后，系统就很难判断应该重试、暂停、补偿，还是重新构建交易。

# 第一步不是发交易，而是 Preflight

一条完整的钱包链路至少依赖 wallet-service、wallet-api、wallet-sign、risk-service、scanner、notifier、PostgreSQL、Redis 和链节点。

如果关键依赖不可用，继续运行可能产生误导性的结果：

- risk-service 不可用时，不应绕过风控继续签名；
- wallet-sign 不可用时，不应生成虚假的签名成功状态；
- 节点落后时，不应把“查询不到交易”直接判断为交易失败；
- notifier 不可用时，业务可以停在 `wallet_done`，但不能假装已经通知成功。

Preflight 的意义不是简单检查端口，而是确认本次验收依赖的环境、Chain ID、网络和服务边界一致。同一个业务 Chain ID 也不应该在运行中随意切换主网和测试网，否则地址、交易和账务记录会失去明确的网络归属。

# 地址生成需要保持私钥边界

生成充值地址时，验收工具不应该直接接触私钥。

我目前采用的边界是：

```text
wallet-sign 生成或管理密钥
→ 返回公钥或地址所需材料
→ wallet-service 登记业务地址
→ 创建按业务和链隔离的余额记录
```

验收工具只处理公钥、地址、Chain ID、地址类型、业务标识和测试标识。私钥仍然留在签名服务的本地密钥存储、MPC/TSS 或未来的 HSM 后端中。

这也意味着签名服务不应该理解提现订单和用户余额。它只负责验证审批内容、签名请求和密钥引用是否匹配，然后对明确的数据执行签名。

# 充值完成需要同时验证三类事实

一笔链上转账被扫描到，不等于充值已经完成。我现在会把充值结果拆成三类事实。

链上事实：

- 交易是否存在并执行成功；
- 是否达到要求的确认数；
- 是否仍在 canonical chain 上。

业务事实：

- 是否生成唯一的 deposit 记录；
- 是否关联正确的业务和充值地址；
- 状态是否按照预期推进；
- 重复扫描是否不会重复创建记录。

账务事实：

- 余额是否只增加一次；
- available 与 lock 是否满足约束；
- 是否生成对应交易流水；
- 从相同区块重新扫描后，余额和记录数量是否保持不变。

因此，充值验收不能只检查 txHash。更接近完成的判断应该是：

```text
链上交易成立
+ deposit 唯一
+ transaction 唯一
+ 余额变化正确
+ 达到确认数
+ 通知只执行一次
```

# 提现需要从资金冻结开始

提现不是从构建交易开始，而是从请求幂等、风控和余额冻结开始：

```text
接收提现请求
→ 校验 request_id
→ 检查余额和链资源
→ 风控审批
→ 冻结金额与预计网络费
→ 构建待签名交易
→ 请求 wallet-sign
→ 广播 raw transaction
→ 等待链上结果
→ 更新账务终态
→ 通知业务方
```

这里最重要的边界之一是：`broadcasted` 只能表示交易已经尝试提交给节点，不能直接表示资金已经在链上成功转出。

```text
create_unsign
→ signed
→ broadcasted
→ wallet_done
→ notified
```

如果节点明确拒绝交易，并且能够确认没有产生链上资金事实，系统可以进入失败状态并释放冻结。

如果广播发生超时，无法确认节点是否收到交易，就不能直接重新构建第二笔交易。此时应先根据交易哈希、sender/nonce、raw transaction 指纹、BTC UTXO 或 Sui Object Version 对账。结果仍然不确定时，宁愿暂停，也不能重复出金。

# 同一条业务 Loop 下，不同链的验收重点不同

| 链族 | 构建时必须显式处理 | 链上成功依据 | 主要资源风险 |
| --- | --- | --- | --- |
| EVM | chain ID、nonce、Gas、legacy/EIP-1559 | receipt `status=1` 和确认数 | nonce 冲突、replacement、Gas 不足 |
| BTC | UTXO、sat/vB、dust、找零、DER 签名 | 交易进入区块并达到确认数 | UTXO 重复选择、费用不足、找零错误 |
| TRON | Base58/hex、TAPOS、expiration、TRC20 calldata | receipt 执行成功和确认数 | Energy、Bandwidth、Fee Limit、交易过期 |
| Sui | Coin Object、Gas Object、Object Version、交易 Digest | Effects 成功和 Checkpoint 最终结果 | Object 被占用、版本变化、交易字节过期 |

这些差异不应该泄漏成四套完全不同的业务流程，但应该作为链适配器和验收 Profile 的明确输入。

EVM 提现通常要控制 nonce，BTC 提现要预占具体 UTXO，Sui 提现需要避免并发选择同一个 Gas Object。它们解决的其实是同一个业务问题：如何确保同一份链上可消费资源不会被两笔提现同时使用。

# Audit 和幂等重扫才是闭环的最后一步

链路第一次跑通并不能证明扫链和账务具有幂等性。更可靠的验收方式是：

1. 保存交易前后的区块或 Checkpoint；
2. 完成一次充值或提现；
3. 记录 deposit、withdraw、internal、sendout、transaction 和余额快照；
4. 重启 scanner；
5. 从交易前的位置重新扫描；
6. 再次执行 Audit；
7. 比较记录数量、余额和通知次数。

重扫以后应该满足：

```text
充值记录不增加
交易流水不重复
余额不重复变化
提现状态不回退
通知不重复发送
```

如果重扫一次就多出一条充值记录，说明系统只是“第一次运行成功”，并没有形成可恢复的钱包链路。

# 当前已经验证到哪里

目前完成的本地与测试网验证包括：

- Base 原生资产充值、提现与状态推进闭环；
- Solana 原生资产充值、提现、余额更新与通知流程；
- BNB 原生资产提现闭环；
- BTC Testnet4 真实链路验证；
- Sui Testnet 原生 SUI 链路验证；
- BTC 的 UTXO 选择、Sweep、余额不足和规范 DER 签名测试；
- Sui 的地址派生、Checkpoint 余额变化解析和 Build → Sign → Execute 测试；
- EVM ERC20 Log、Internal Transfer、ERC721 和 ERC1155 解析测试；
- chain-e2e 默认 dry-run、Profile 加载和参数边界测试。

这些结果说明统一验收框架和对应链路已经在本地或测试网得到验证，但它们不是生产环境的规模、稳定性或安全性结论。

当前仍然存在的边界包括：

- BTC 还需要扩展多输入选币、UTXO 并发锁定、RBF/CPFP、粉尘整理与 Reorg 恢复；
- Sui 当前以原生 SUI 为主，Coin、NFT、Move Call、赞助交易和多签尚未纳入；
- Sui 待签名交易缓存过期或 wallet-api 重启后，需要安全地重新构建；
- BSC Internal Transfer 充值依赖支持 Trace 的节点；
- TRON 的完整真实网络闭环还需要继续验证；
- 故障注入和重扫恢复需要在更多链族上持续运行。

# 从“能运行”继续追问“怎样会 Rekt”

验收成功证明的是预期路径能够闭环，但资金系统还必须从真实事故反推边界。

后续我会把 [Rekt](https://rekt.news/) 作为事故线索索引，再结合项目官方复盘、链上交易和可复现测试，继续拆解与钱包基础设施直接相关的问题：

- **签名内容被替换或界面欺骗：** 多签和硬件设备存在，并不自动代表签署人看到了真实交易；审批摘要、交易 Digest 和独立展示通道应该如何绑定；
- **私钥或管理员权限泄露：** Local Signer、MPC/TSS 和 HSM 分别能解决什么，哪些权限即使使用硬件密钥仍然过大；
- **签名算法实现错误：** 随机数、nonce、digest、DER 或序列化实现错误，为什么可能从一笔公开签名反推出长期密钥风险；
- **链资源被重复消费：** nonce、UTXO、recent blockhash 和 Object Version 的并发控制失败，如何演变成重复出金、卡单或错误替换；
- **扫链与最终性误判：** RPC 返回不一致、确认数不足、Reorg 或解析遗漏，如何导致重复入账与账务不平；
- **恢复路径本身成为风险：** 紧急降级、人工补账、密钥迁移和合约升级为什么需要和正常路径一样接受审批、审计与演练。

这里的目标不是复述损失金额，而是把每次事故转成一个可运行的失败实验：它破坏了哪个不变量，第一处止损动作是什么，现有架构能否发现，以及怎样用测试证明修复有效。

# 这次学习带来的变化

以前我更关注接口有没有返回、交易能不能发出去。现在我更关注：

```text
资金事实是否明确
状态是否能够推进
失败是否能够恢复
重试依据是否幂等
链上和账务是否一致
验证过程能否再次运行
```

多链钱包真正困难的地方，不是支持更多 RPC 方法，而是在不同的交易模型和资源约束下，仍然保持同一组资金安全原则：

```text
请求不能重复执行
余额不能重复使用
签名不能脱离审批
广播不能代表成功
重扫不能重复入账
结果不确定时不能重复出金
```

当这些原则能够被状态机、测试、Audit 和失败路径共同证明时，一条链才算从“已经适配”走向“可以验收”。

# 下一步

接下来我准备继续补齐四部分证据：

1. 为 BTC 增加多输入选币、UTXO 锁定、RBF 和 Reorg 故障实验；
2. 为 Sui 增加 Coin Object 并发、缓存过期重建和 Checkpoint 重扫实验；
3. 继续完成 TRON 的真实链闭环；
4. 从真实 Rekt 事件中选择与签名、密钥和链资源相关的案例，转成可复现的失败测试。

最终目标不是让网站显示“支持了多少条链”，而是让每一条被列出的链，都能回答：

```text
如何构建
如何签名
如何确认
如何恢复
如何复现验证
```
