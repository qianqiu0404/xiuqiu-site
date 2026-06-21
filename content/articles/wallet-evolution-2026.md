---
{
  "id": 13,
  "slug": "wallet-evolution-2026",
  "title": "2026 钱包发展趋势：从私钥管理到用户意图执行层",
  "date": "2026-06-21",
  "summary": "截至 2026 年 6 月，我对钱包演进的理解是：钱包正在从私钥管理工具，升级为多链资产入口、交易执行入口，以及身份、风控和账户抽象层。",
  "tags": [
    "Web3",
    "Wallet",
    "Account Abstraction",
    "MPC",
    "Chain Abstraction",
    "BTCFi"
  ],
  "difficulty": "进阶",
  "conceptTags": [
    "wallet-backend",
    "multi-chain",
    "mpc-tss",
    "evm",
    "signer-service"
  ],
  "relatedProjectIds": [
    1,
    2,
    4,
    5,
    6
  ],
  "recommendedSlugs": [
    "mpc-wallet-sign-integration",
    "aws-cloudhsm-wallet-sign-integration",
    "eip-erc-protocol-evolution",
    "wallet-api-boundary",
    "wallet-address-models",
    "withdrawal-error-handling"
  ],
  "suggestedQuestions": [
    "未来钱包为什么是用户意图执行层？",
    "账户抽象和链抽象分别会改变钱包后端的哪些模块？",
    "CEX 钱包和 Web3 钱包融合后，后端需要补齐哪些能力？"
  ]
}
---

# 2026 钱包发展趋势：从私钥管理到用户意图执行层

截至 2026 年 6 月，我会把钱包的发展理解成一句话：

> 钱包正在从私钥管理工具，演变成多链资产入口、交易执行入口，以及身份、风控和账户抽象层。

早期钱包的核心问题是：用户怎么保存助记词、怎么生成地址、怎么签名和发交易。

现在钱包的核心问题已经变成：用户不想理解链、不想管 Gas、不想记助记词、不想切网络，但仍然想安全地使用链上资产。

所以未来钱包不只是一个地址和私钥工具，而会越来越像 Web3 的账户层、交易层和安全层。用户表达意图，钱包在背后处理链选择、Gas、签名、交易执行和风险控制。

换句话说，未来钱包之所以会成为用户意图执行层，是因为它要把复杂的链上操作折叠成用户能理解的一句话：我想换币、跨链、支付、投资或恢复账户。

# 从助记词钱包到 keyless / MPC / passkey

早期钱包的账户模型很直接：

```text
助记词 -> 私钥 -> 地址 -> 签名
```

这个模型足够简洁，也足够残酷。助记词丢了，资产很难恢复；助记词泄露了，资产也很难保住。

所以大钱包都在往 keyless、MPC、passkey 这类方向演进。OKX keyless wallet 用 MPC 把私钥拆成多个 share；Binance Wallet 也把 keyless、seedless、MPC、多链体验作为核心卖点之一。

这背后的工程目标不是让用户完全不承担安全责任，而是降低助记词这一个单点的认知和操作风险。

以后签名机不会只是一个“拿私钥签名”的服务，而会逐渐变成多种签名因素的编排层：

```text
MPC share
TEE
HSM
Passkey
设备密钥
社交恢复
风控策略
交易上下文校验
```

这也解释了为什么 `wallet-sign` 需要从本地私钥签名机，演进成支持 MPC、CloudHSM、local backend 等多种签名后端的能力边界。

# 从 EOA 到智能钱包和账户抽象

EOA 的优势是简单：一个私钥控制一个账户。

EOA 的问题也来自这个简单性：账户逻辑几乎不可编程。传统 EOA 很难天然支持批量交易、Gas 代付、session key、社交恢复、每日限额、白名单和细粒度权限。

ERC-4337 通过智能合约钱包、UserOperation、Bundler、EntryPoint 和 Paymaster 推动账户抽象。EIP-7702 则进一步让普通 EOA 可以设置并执行委托代码，让现有 EOA 更容易获得智能钱包能力。

从用户视角看，账户抽象带来的不是一个协议编号，而是一组体验变化：

```text
Gas sponsorship
  -> 应用或第三方可以替用户支付 Gas

batch transaction
  -> 一次签名执行 approve + swap 等多步操作

session key
  -> 给某个应用一段时间内的小额操作权限

social recovery
  -> 丢设备后通过 guardian 或其他恢复机制找回账户

spending limit
  -> 设置每日限额或特定资产限额

passkey login
  -> 用设备生物识别触发授权和签名流程
```

这会改变钱包后端的职责。钱包不再只是“给一笔交易签名”，而是要判断用户意图如何被安全地拆成多步链上操作。

```text
我要用 USDC 买 ETH
我要把资产跨到 Base
我要存入某个收益产品
我要定投 BTC
```

这些都不是单笔签名问题，而是意图执行问题。

# 从多链支持到链抽象

多链支持已经是钱包的基础能力。

一个现代钱包支持 EVM、BTC、Solana、Tron、Sui、Cosmos 并不稀奇。真正的下一步是链抽象：用户不再被迫理解每条链的账户模型、Gas 模型、资产标准和跨链路径。

用户不关心：

```text
资产在哪条链
这条链用什么 Gas
要不要切网络
是 ERC20、BEP20、TRC20 还是 SPL
bridge 怎么走
交易要拆成几步
```

用户真正关心的是：

```text
我有多少钱
我想换什么
我要付给谁
什么时候到账
成本是多少
风险有多大
```

这意味着钱包会变成意图入口。底层需要 swap router、bridge aggregator、paymaster、solver、账户抽象、风控引擎和交易状态机一起协作。

对后端来说，多链钱包的难点也会从“接入更多 RPC”升级为“统一多链资产、签名、Gas、跨链执行、状态补偿和风险判断”。

# 从资产展示到交易和流动性入口

以前钱包的核心页面是资产列表和转账。

现在钱包越来越像链上交易终端：

```text
Swap
Bridge
DApp 聚合
DeFi 收益
NFT / inscription / Runes
BTCFi
RWA
stablecoin payment
on-chain card / pay
```

OKX Wallet、Bitget Wallet、Binance Wallet、MetaMask 这类产品都不是只做收发币。它们在争夺的是 Web3 入口，也是链上交易流量入口。

这会让钱包后端天然接近交易系统：

```text
报价
路由
滑点
手续费
交易模拟
失败补偿
链上确认
资产归集
风控拦截
审计追踪
```

钱包的商业价值也从“安全工具”扩展成“交易和流动性入口”。谁离用户的资产入口更近，谁就更容易承接 swap、bridge、支付、DeFi 和收益产品。

# 从单点安全到策略化安全

早期钱包安全更像一句口号：

```text
不要泄露助记词
硬件钱包更安全
```

现在安全变成了一整套策略系统：

```text
MPC 分片
Passkey / biometric
硬件隔离
TEE / HSM
交易模拟
反钓鱼
黑地址识别
大额延迟
新地址冷静期
spending limit
多设备恢复
社交恢复
链上 KYT 风控
```

尤其是智能钱包和账户抽象普及后，钱包可以在账户层写规则，而不是只能依赖“一把私钥控制全部资产”。

比如：

```text
每日最多转出 1,000 USDC
新地址首次转账延迟 24 小时
session key 只能访问某个 DApp
guardian 可以触发恢复但不能直接转账
高风险合约调用必须二次确认
```

这类策略会把钱包安全从密钥安全扩展到交易安全、身份安全和行为安全。

对 `wallet-sign` 来说，这也意味着签名前校验会越来越重要。签名服务不能只判断“有没有这把 key”，还要判断“这次签名是否符合业务、风控、权限和账户策略”。

# CEX 钱包和 Web3 钱包会融合

未来 CEX 钱包和 Web3 钱包的边界会越来越模糊。

CEX 的优势是：

```text
法币入口
深度和撮合
用户体系
KYC
风控
客服
合规
```

Web3 钱包的优势是：

```text
用户自持资产
链上 DeFi
DApp 生态
多链资产
可组合性
```

所以大交易所都会做 Web3 Wallet。用户可能在一个 App 里同时拥有：

```text
交易所账户钱包
Web3 自托管钱包
MPC / keyless 钱包
Earn / DeFi 入口
跨链 Swap
支付卡
```

这对钱包后端的要求更高。单纯会接一条链不够，还要理解交易所账本、链上钱包、签名机、扫链、风控、对账和用户体验之间的关系。

尤其是提现、充值、归集、热冷钱包、签名授权、链上确认和账务一致性，这些能力会变成 CEX 钱包和 Web3 钱包融合时的底层基础设施。

# BTC 钱包会重新变重要

2024 到 2026 年，BTC 生态的变化非常明显。

Ordinals、BRC-20、Runes、BTC L2、BTCFi 让 BTC 钱包不再只是“收发 BTC”。它开始变成更复杂的 BTC 资产入口。

BTC 钱包未来会处理更多对象：

```text
BTC 主网转账
Taproot
inscription
Runes
PSBT
多签
BTC staking / restaking
BTC L2 资产
BTC 映射资产
UTXO 管理和粉尘整理
```

这对钱包工程要求很高，因为 BTC 不是账户模型，而是 UTXO 模型。资产发行、索引器、交易构造、找零、粉尘整理、PSBT、多签和签名验证都和 EVM 不一样。

因此，多链钱包不能只把 BTC 当成“另一个 RPC”。BTC 钱包要单独设计地址模型、UTXO 管理、资产索引和交易构建逻辑。

# 对钱包后端的工程判断

把这些趋势放在一起看，钱包后端的能力重心会发生变化。

过去的核心能力是：

```text
生成地址
保存私钥
构建交易
签名交易
广播交易
扫链入账
```

未来的核心能力会变成：

```text
统一多链资产视图
抽象不同链的账户和交易模型
编排 MPC / HSM / passkey / session key
执行用户意图
处理 Gas 代付和链抽象
模拟交易和识别风险
保证充值、提现、归集、对账最终一致
为 CEX 钱包和 Web3 钱包提供统一账户体验
```

所以我理解未来的钱包，不是单纯管理私钥，而是管理用户意图。

用户只表达“我想做什么”，钱包负责选择链、处理 Gas、完成签名、执行交易、追踪状态并控制风险。

这也是为什么钱包后端不能只停留在“接一条链”的层面。真正有价值的是把多链、签名、账户抽象、风控、对账和交易执行统一起来。

# 参考来源

- [EIP-7702: Set Code for EOAs](https://eips.ethereum.org/EIPS/eip-7702)
- [OKX: What is OKX keyless wallet?](https://www.okx.com/en-us/help/what-is-okx-keyless-wallet)
- [Binance Wallet](https://web3.binance.com/en/about)
- [MetaMask](https://metamask.io/)
