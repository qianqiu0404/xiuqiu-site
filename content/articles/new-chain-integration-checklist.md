---
{
  "id": 16,
  "slug": "new-chain-integration-checklist",
  "title": "钱包系统上线一条新链，需要调研什么",
  "date": "2026-06-21",
  "summary": "上线一条新链不能只看能不能转账，而要系统调研链模型、地址体系、签名交易、充值扫链、提现构建、手续费、归集、节点、异常、风控、安全、账务和测试。",
  "tags": [
    "Web3",
    "Wallet",
    "Backend",
    "Multi-chain",
    "Operations"
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
    "wallet-api-boundary",
    "wallet-address-models",
    "wallet-sign-signer",
    "withdrawal-error-handling",
    "wallet-evolution-2026"
  ],
  "suggestedQuestions": [
    "钱包系统上线一条新链前，为什么不能只测试转账？",
    "Account 模型和 UTXO 模型会怎样影响充值、提现和归集？",
    "新链接入时，账务和对账为什么必须提前设计？"
  ]
}
---

# 钱包系统上线一条新链，需要调研什么

上线一条新链，核心不是验证“这条链能不能转账”。

真正的问题是：这条链能不能被钱包系统安全、稳定、可充值、可提现、可归集、可对账地接入生产环境。

单次转账成功只是 demo。生产接入要覆盖链模型、地址体系、签名交易、充值扫链、提现构建、手续费、归集、节点、异常、风控、安全、账务和测试。任何一个环节没想清楚，都可能在真实资金流里变成事故。

# 不是能转账就能上线

钱包系统上线新链，通常要同时服务四条资金链路：

```text
充值
提现
归集
对账
```

这四条链路背后的问题完全不一样。

充值看的是平台能不能正确识别用户入金，能不能处理确认数、重组、代币事件和 Memo / Tag。

提现看的是平台能不能安全构建交易、正确签名、可靠广播，并且在失败、pending、nonce 卡住、UTXO 被消费时不重复出金。

归集看的是用户地址上的资产能不能低成本、安全地归到热钱包或冷钱包。

对账看的是链上余额、内部账、用户账、热钱包和冷钱包余额能不能长期保持一致。

所以新链接入不是一个 RPC 调用问题，而是一个完整的钱包后端生产能力问题。

# 链模型决定整体接入方案

第一步要判断这条链属于什么模型。

```text
账户模型:
  ETH / BSC / Polygon / TRON / Solana / Cosmos

UTXO 模型:
  BTC / LTC / DOGE / BCH

Memo / Tag 类:
  XRP / XLM / EOS / TON 的部分场景

EVM 兼容链:
  BSC / Polygon / Arbitrum / Optimism / Base

非 EVM 链:
  BTC / Solana / Cosmos / TON / Aptos / Sui
```

链模型会影响后面所有模块。

账户模型通常围绕地址余额、nonce / sequence、gas 和交易状态处理。UTXO 模型要处理 input / output、找零、UTXO 锁定、粉尘和手续费选择。Memo / Tag 类链则常用统一充值地址加用户标识，如果 Memo 丢失，充值归属就会变得困难。

这个判断越早做，后面的 chain adapter、扫链服务、提现状态机和签名服务越容易设计。

# 地址体系和签名体系

地址体系要先确认：

```text
地址格式
地址前缀
checksum 校验
HD 钱包派生路径
签名算法
公私钥算法
是否一个私钥对应多种地址格式
```

常见例子：

```text
ETH:
  0x 地址，secp256k1，m/44'/60'/0'/0/0

BTC:
  secp256k1，P2PKH / P2WPKH / P2SH / Taproot

TRON:
  T 开头地址，secp256k1

Solana:
  ed25519，地址就是 public key

Cosmos:
  bech32 地址，常见 cosmos1 前缀
```

地址生成错误会直接导致用户充值资产丢失，所以地址合法性校验不能只做字符串长度检查。checksum、前缀、base58 / bech32 / hex 编码、链 ID、派生路径都要明确。

签名体系要继续往下看：

```text
交易体有哪些字段
签名原文是什么
交易 hash 怎么算
序列化格式是什么
是否支持离线签名
nonce / sequence 怎么取
fee / gas 怎么设置
是否支持 MPC / HSM
```

不同链差异很大：

```text
ETH / EVM:
  nonce、gasLimit、chainId、maxFeePerGas、maxPriorityFeePerGas

BTC:
  UTXO、input/output、script、witness、sighash

Cosmos:
  account_number、sequence、fee、gas、memo

Solana:
  recentBlockhash、instruction、account metas、signature

TRON:
  raw_data、ref_block、expiration、contract
```

交易所钱包通常要求私钥不联网，因此新链必须能支持离线构建和离线签名，或者至少能把签名边界清晰收敛到 `wallet-sign`、MPC 或 HSM 里。

# 充值扫链和确认策略

充值接入要回答的问题是：平台如何可靠地知道用户真的打钱进来了。

需要调研：

```text
如何获取区块
如何解析交易
是否支持按地址查交易
是否支持 event / log 查询
充值如何识别
确认数怎么判断
交易失败怎么判断
链重组怎么处理
```

不同链的充值识别逻辑不能硬套。

ETH 原生币充值通常看：

```text
to == 用户地址
value > 0
tx status == success
确认数达到要求
```

ERC20 充值要看：

```text
Transfer event
contract address 正确
to == 用户地址
tx status == success
decimals 按资产配置解析
```

BTC 充值看的是：

```text
交易 outputs 是否包含平台地址
UTXO 是否确认
是否达到充值确认数
是否后续被重组回滚
```

XRP / XLM 这类场景经常使用统一充值地址加 Memo / Tag。扫链不只要识别充值地址，还要识别 Memo / Tag，才能把充值归属到具体用户。

Solana 充值则要区分 SOL balance change 和 SPL Token transfer instruction，还要处理 token account / owner / mint 的关系。

确认数策略要结合：

```text
平均出块时间
最终确定性
历史重组情况
资产价值
小额 / 大额充值
链异常时期
```

小额充值可以设置较少确认数，大额充值需要更多确认。链上异常、节点分叉或网络拥堵时，要能临时提高确认数或暂停充值。

# 提现构建和手续费模型

提现是平台主动出资产，风险比充值更高。

需要调研：

```text
提现交易怎么构建
是否需要 nonce / sequence
是否需要 UTXO 选择
是否支持批量转账
手续费怎么估算
提现失败怎么处理
是否支持替换或加速
广播后如何确认状态
```

EVM 链的重点是 nonce 管理、gas 估算、EIP-1559 fee、ERC20 transfer calldata、pending 交易替换和交易回执查询。

BTC 类链的重点是 UTXO 选择、找零地址、sat/vB 手续费、RBF 加速、粉尘限制和 UTXO 锁定。

TRON 的重点是带宽、能量、TRX 手续费，以及 USDT-TRC20 提现是否需要提前准备能量或 TRX。

Solana 的重点是 recentBlockhash 会过期、ATA 可能需要创建、交易需要快速重试，以及模拟成功不代表最终上链成功。

手续费模型也必须单独调研：

```text
手续费资产是什么
手续费单位是什么
手续费如何估算
是否动态 fee
是否需要 gas limit
是否有能量 / 带宽模型
代币转账手续费由谁支付
是否需要提前下发原生币
```

典型例子：

```text
USDT-ERC20 提现需要 ETH 支付 gas
USDT-TRC20 提现需要 TRX 或能量
USDT-BEP20 提现需要 BNB
BTC 手续费按 sat/vB
Solana 手续费用 SOL
Cosmos 手续费用原生 token
```

如果手续费资产准备不足，提现和归集都会失败。

# 归集和热冷钱包管理

归集不是简单把用户地址上的资产转走。

需要调研：

```text
用户地址资产能不能归集
归集是否需要手续费
是否需要下发原生币
是否支持批量归集
归集阈值怎么设置
归集失败怎么处理
是否有粉尘问题
归集到热钱包还是冷钱包
```

ERC20 归集经常遇到的问题是：用户地址有 USDT，但没有 ETH。平台要先下发 ETH 作为 gas，再归集 USDT。

TRC20 归集类似，需要 TRX 或能量。能量租赁、能量冻结、TRX 下发策略都会影响成本。

BTC 不需要提前下发手续费，因为手续费从 UTXO 里扣，但它会遇到 UTXO 膨胀、粉尘、找零输出和批量归集成本问题。

Solana SPL Token 归集要处理 token account / ATA。如果用户没有对应 token account，或 token account 关闭、租金不足，也会影响流程。

归集策略最终要和热冷钱包余额管理结合：

```text
用户地址 -> 热钱包
热钱包 -> 冷钱包
冷钱包 -> 热钱包补充流动性
```

否则就会出现充值能收、提现没热钱包余额，或者热钱包余额过高暴露安全风险的问题。

# 代币标准和资产配置

智能合约链上线代币时，不能只看 symbol。

需要确认：

```text
contract address
decimals
symbol / name 是否可信
Transfer event 格式
是否有黑名单
是否有暂停功能
是否有增发权限
是否有转账税
是否有特殊转账逻辑
```

入账必须认 contract address，不能只认 symbol。同名假币很多，decimals 也不能写死。

比如：

```text
USDT 常见 decimals 是 6
很多 ERC20 是 18
BTC 是 8
SOL 是 9
```

代币合约如果有黑名单、暂停、转账税、rebasing 或特殊 hook，也会影响充值、提现、归集和对账。

# 节点 RPC 和异常状态

生产环境不能只依赖一个公共 RPC。

节点侧要调研：

```text
是否自建节点
节点同步成本
磁盘 / 内存 / CPU 要求
是否需要归档节点
RPC 是否稳定
是否支持 websocket
是否限流
是否支持历史查询
是否有备用节点服务
```

常见生产方案是：

```text
自建节点 + 第三方节点备份
主 RPC + 备用 RPC
扫链节点 + 广播节点隔离
节点高度监控
节点延迟监控
节点响应错误率监控
```

这里要特别区分“能调用 RPC”和“RPC 能支撑钱包生产链路”。

普通余额查询只需要基础 RPC，但交易所钱包还要确认这条链是否支持：

```text
稳定读取历史区块
按高度回放交易
查询 receipt / logs / events
识别 internal transfer 所需的 trace 能力
归档历史状态查询
WebSocket 或订阅能力
广播和查询隔离
错误码可识别
限流策略可预期
主备节点返回能交叉校验
```

如果这条链或节点服务不支持 trace，EVM internal native transfer 充值就可能漏扫；如果历史查询不稳定，补扫和对账就会困难；如果广播节点和扫链节点共用同一个被限流 RPC，提现高峰时很容易同时影响出金和状态确认。

所以 RPC 调研不是填一个 endpoint，而是判断它能不能支撑扫链、广播、确认、回捞、对账和异常恢复。

异常状态也要提前调研：

```text
交易 pending 怎么处理
交易 failed 是否扣手续费
广播成功但查不到怎么办
长时间不确认怎么办
nonce 卡住怎么办
节点回滚怎么办
重复回调怎么办
区块高度倒退怎么办
```

EVM 常见异常包括：

```text
nonce too low
nonce too high
replacement underpriced
pending 太久
交易 dropped / replaced
```

BTC 常见异常包括：

```text
手续费太低
长时间不确认
RBF 替换
UTXO 双花
找零输出太小
```

Solana 常见异常包括：

```text
blockhash 过期
模拟成功但上链失败
token account 不存在
```

这些异常如果不上线前设计好，钱包状态机会乱，账务也会对不上。

# 风控、安全和账务对账

上线一条链不能只看技术接入，还要看风控和安全边界。

风控侧要调研：

```text
是否接 Chainalysis / TRM / Elliptic
是否支持地址风险评分
是否有黑名单地址
是否有混币器风险
是否有高危合约交互
是否有异常充值来源
```

提现侧要考虑：

```text
小额自动
大额人工审核
黑名单拦截
地址风险评分
频率限制
新地址冷却期
异常 IP / 设备
```

安全侧要确认：

```text
私钥如何保存
是否支持离线签名
是否支持 MPC / HSM
签名机怎么接入
交易原文如何校验
是否有冷热钱包隔离
是否有提现白名单
是否有多级审批
```

几个原则必须明确：

```text
私钥不出安全环境
签名机不暴露公网
交易内容签名前可校验
提现地址和金额不能被篡改
冷热钱包隔离
大额提现人工审批
```

账务和对账也必须提前设计：

```text
充值什么时候入账
提现什么时候冻结
提现成功怎么扣账
提现失败怎么解冻
手续费怎么记账
链上余额和系统余额怎么对账
热钱包余额怎么监控
冷钱包余额怎么同步
```

典型充值状态流：

```text
扫到交易
-> 等确认数
-> 入账
-> 生成充值记录
```

典型提现状态流：

```text
用户申请
-> 冻结余额
-> 风控审核
-> 签名广播
-> 成功扣账 / 失败解冻
```

如果账务状态机没有设计清楚，新链最容易在异常路径里出问题：充值回滚后用户已经入账、提现失败后余额没有解冻、手续费记错、链上余额和内部账长期不一致。

# 上线前测试清单

上线前不能只测成功路径。成功路径只能证明 demo 能跑，不能证明生产能跑。

至少要覆盖：

```text
地址生成测试
地址合法性校验
充值测试
提现测试
代币充值提现测试
归集测试
手续费不足测试
交易失败测试
节点异常测试
重复回调测试
确认数测试
链重组模拟
对账测试
冷热钱包划转测试
```

对于 EVM 链，还要测 nonce 并发、pending 替换、dropped transaction、合约调用失败、ERC20 Transfer event 异常。

对于 BTC 类链，要测 UTXO 选择、粉尘、RBF、手续费过低、找零、双花或 UTXO 被占用。

对于 Memo / Tag 类链，要测 Memo 缺失、Memo 错误、统一充值地址归属错误。

对于 Solana，要测 blockhash 过期、ATA 不存在、SPL Token transfer、模拟成功但上链失败。

# 最终方法论

上线新链可以按这条线梳理：

```text
链模型
-> 地址体系
-> 签名交易
-> 充值扫链
-> 提现构建
-> 手续费模型
-> 归集策略
-> 代币标准
-> 节点 RPC
-> 异常状态
-> 风控合规
-> 安全体系
-> 账务对账
-> 上线测试
```

这条线背后的工程逻辑是：

```text
先能生成正确地址
再能构建和签名正确交易
先能安全收钱
再能安全出钱
最后能归集、能对账、能兜底异常
```

所以新链接入真正要回答的问题，不是“这条链能不能转账”，而是：

> 这条链能不能在钱包生产系统里安全、稳定、可充值、可提现、可归集、可对账地长期运行。
