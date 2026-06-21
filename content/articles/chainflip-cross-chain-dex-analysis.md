---
{
  "id": 15,
  "slug": "chainflip-cross-chain-dex-analysis",
  "title": "Chainflip 工程拆解：原生资产跨链兑换网络如何工作",
  "date": "2026-06-21",
  "summary": "Chainflip 不是传统 wrapped bridge，而是用 validator 网络、TSS vault、State Chain 和 JIT AMM 实现原生资产跨链兑换，把 BTC、ETH、SOL、USDC 等资产的跨链闪兑体验协议化。",
  "tags": [
    "Web3",
    "Wallet",
    "Cross-chain",
    "DEX",
    "MPC",
    "Liquidity"
  ],
  "difficulty": "进阶",
  "conceptTags": [
    "multi-chain",
    "mpc-tss",
    "wallet-backend",
    "signer-service"
  ],
  "relatedProjectIds": [
    1,
    2,
    5,
    6
  ],
  "recommendedSlugs": [
    "thorchain-tss-attack-analysis",
    "wallet-evolution-2026",
    "mpc-wallet-sign-integration",
    "wallet-api-boundary",
    "wallet-address-models"
  ],
  "suggestedQuestions": [
    "Chainflip 和普通跨链桥的本质区别是什么？",
    "Chainflip 的 JIT AMM 为什么适合跨链兑换？",
    "钱包接入 Chainflip 这类协议时，后端要处理哪些风险？"
  ]
}
---

# Chainflip 工程拆解：原生资产跨链兑换网络如何工作

Chainflip 不是普通意义上的跨链桥。

普通跨链桥更常见的模式是把资产锁在 A 链，然后在 B 链铸造一个 wrapped asset。Chainflip 做的是另一件事：用户把原生 BTC、ETH、SOL、USDC 等资产打进协议，协议在另一条链上给用户发出目标链的原生资产。

所以它更像一个去中心化的跨链闪兑网络：

```text
BTC -> ETH
ETH -> BTC
SOL -> USDC
ETH -> SOL
```

用户不需要注册账户，不需要自己处理 wrapped token，不需要理解 bridge 路径，也不需要在多条链之间手动拼交易。Chainflip 把多链 vault、validator witnessing、State Chain、JIT AMM 和 TSS 出账组合起来，让跨链兑换变成一次相对完整的协议级流程。

# Chainflip 是什么

Chainflip 官方把自己定位成 cross-chain decentralized exchange / cross-chain liquidity network。它要解决的问题不是“把某个资产映射到另一条链”，而是“让用户直接完成原生资产之间的跨链兑换”。

从用户视角看，一笔 swap 可以被理解成：

```text
用户选择源链资产和目标链资产
-> Chainflip 生成 deposit address 或 vault swap 参数
-> 用户把源链资产打到指定地址
-> Chainflip validator 网络确认入账
-> State Chain 记录 swap 状态
-> JIT AMM 处理报价和兑换
-> validator 网络通过 TSS 从目标链 vault 出账
-> 用户收到目标链原生资产
```

这和中心化交易所里的 Convert / 闪兑体验很像，只是背后不再依赖一个中心化账户系统，而是由协议、验证者网络、流动性提供者和多链 vault 一起完成。

# 它和普通跨链桥有什么不同

跨链系统可以粗略分成几类。

```text
wrapped bridge
  -> 锁定 A 链资产，在 B 链铸造 wrapped asset

message bridge
  -> 传递跨链消息，让目标链合约执行某个动作

native cross-chain DEX
  -> 直接用一条链的原生资产兑换另一条链的原生资产

CEX convert
  -> 在中心化账户体系内完成资产兑换

aggregator
  -> 帮用户路由多个 bridge、DEX 或跨链协议
```

Chainflip 更接近 native cross-chain DEX，和 THORChain 属于同一个大方向。它不是重点做资产映射，而是重点做资产兑换。

这点对钱包产品很重要。用户通常不关心“这个 USDC 是哪条链上的版本”“这个 BTC 是不是 wrapped BTC”“这条 bridge 的赎回路径是什么”。用户真正关心的是：

```text
我付出什么资产
我收到什么资产
预计多久到账
滑点和手续费是多少
失败后怎么处理
```

Chainflip 的价值就在于，它把这些复杂跨链细节尽量收敛成一个 swap 流程。

# 核心架构：多链 vault + State Chain + JIT AMM + TSS 出账

Chainflip 可以拆成四个核心部分。

第一层是多链 vault。

Chainflip 需要在不同链上持有和发出资产，因此每条支持链都需要对应的 vault 设计。用户从源链打入资产，目标链 vault 负责发出目标资产。

第二层是 validator witnessing。

外部链发生 deposit 以后，Chainflip validator 网络需要观察并确认这笔链上入账。不同链有不同确认时间和重组风险，所以协议不能像单链 DEX 一样假设交易立刻最终确定。

第三层是 State Chain。

Chainflip 有自己的 State Chain，用来协调 swap 状态、LP 报价、vault 状态、validator 行为和协议内部结算。它相当于跨链兑换流程里的协调层。

第四层是 JIT AMM 和 TSS 出账。

JIT AMM 负责处理流动性和定价；TSS/MPC 则负责让 validator 网络共同签名，从目标链 vault 给用户目标地址发出资产。

可以压缩成一句：

```text
Chainflip = 多链 vault + validator witnessing + State Chain 协调 + JIT AMM 做市 + TSS 出账
```

# JIT AMM 为什么特别

Chainflip 的 AMM 不是传统 Uniswap V2 那种恒定乘积池，也不是单纯把流动性被动放在池子里等用户来吃。

官方文档把它称为 Just-In-Time AMM。它的核心原因来自跨链场景本身：跨链 deposit 需要等待外部链确认，这意味着 LP 和做市商在 swap 真正进入 State Chain 执行前，已经能看到即将被处理的订单流。

传统 AMM 更像：

```text
LP 提前把资金放进池子
用户交易时按池子曲线成交
价格由池子状态和外部套利慢慢拉回
```

Chainflip 的 JIT AMM 更像：

```text
用户发起跨链 swap
源链 deposit 被 validators witnessed
LP 看到即将处理的订单流
LP 在 State Chain 上更新 range order / limit order
协议按 block 把同方向 swaps 打包执行
目标链 vault 出账给用户
```

这套设计的重点是让 LP 围绕真实订单流竞争报价。官方文档也明确提到，JIT AMM 的目标是提升资本效率和报价准确性，并且由于 swap 会按 block 分组处理，可以减少普通单链 AMM 里用户被抢跑的部分问题。

它的好处是：

```text
资本效率更高
大额订单有机会获得接近市场的报价
LP 可以根据即将执行的订单调整策略
多跳路径可以在 State Chain 内协调
```

代价也存在：

```text
用户在最终执行前不能绝对确定最后成交结果
跨链确认时间会引入等待
LP 竞争不足时，报价质量会下降
大额订单可能耗尽某个方向的流动性
```

所以 JIT AMM 不是“无风险更优 AMM”，而是为跨链交易的延迟和可观察订单流重新设计的一套做市机制。

# 为什么 Chainflip 对钱包和聚合器有价值

Chainflip 的商业价值不只是“又一个 DEX”。它更像是钱包、聚合器、交易产品可以接入的 native asset routing layer。

一个钱包如果要自己做跨链兑换，需要处理很多东西：

```text
对接多条链
管理 deposit address
识别链上充值
选择 bridge / swap 路径
处理 wrapped asset 风险
跟踪目标链到账
处理失败、退款和超时
展示用户可理解的状态
```

如果接入 Chainflip，钱包可以把一部分跨链流动性和原生资产出账能力交给协议，只需要围绕 quote、deposit、status、refund、destination address 做产品和后端集成。

从不同角色看，它的定位可以是：

```text
面向用户: 跨链闪兑
面向钱包: 原生资产跨链兑换后端
面向 LP: 跨链订单流和做市机会
面向协议: native asset routing layer
面向聚合器: 可组合的跨链流动性来源
```

这也是它和钱包发展趋势的关系：未来钱包不是只展示资产，而是要帮助用户完成“我想把 A 链资产换成 B 链资产”的意图。Chainflip 这类协议可以成为这类意图背后的执行层之一。

# Chainflip 的风险边界

Chainflip 做得有意思，不代表没有风险。恰恰相反，原生跨链兑换网络因为直接处理多链 vault，风险边界比普通单链 DEX 更复杂。

第一类是 validator / TSS 风险。

只要一个协议用多链 vault 持有原生资产，就一定要面对签名系统安全问题。validator 网络、TSS 实现、节点准入、签名阈值、密钥轮换和 vault 升级都属于核心安全边界。

```text
如果足够多 validators 作恶
如果 TSS 实现出现漏洞
如果 key rotation 或 vault migration 出问题
如果签名请求缺少独立审计
```

那么 vault 资金就可能暴露风险。这也是 THORChain 安全复盘对同赛道项目有参考价值的原因。

第二类是经济安全风险。

Chainflip 依赖 validator staking 和协议经济模型来约束行为。如果协议管理的资产规模远大于作恶成本，系统就会面临经济安全不匹配的问题。

这个逻辑和 PoS 网络类似：

```text
攻击收益 > 作恶成本
=> 经济安全边界不够
```

第三类是流动性风险。

跨链 swap 的体验高度依赖 LP 和做市商。如果某条路径流动性不足，用户会看到更差的报价、更高滑点、更长等待时间，甚至交易失败或需要走退款路径。

典型路径包括：

```text
BTC -> ETH
ETH -> BTC
SOL -> BTC
BTC -> USDC
ETH -> SOL
```

这些路径的体验不是“协议支持了就一定好”，而是取决于真实订单流、LP 策略、池子状态和市场波动。

第四类是协议可用性和状态复杂度。

跨链 swap 横跨多条外部链和 State Chain。任何一个环节延迟或失败，都会影响用户感知：

```text
源链 deposit 未确认
外部链重组
witnessing 延迟
JIT AMM 报价变化
目标链出账延迟
退款路径复杂
目标地址填写错误
```

所以对钱包后端来说，接入 Chainflip 这类协议时，不能只做一个“发起 swap”按钮。更重要的是完整状态机、失败解释、退款提示和用户可理解的进度展示。

# 和 THORChain 的比较

Chainflip 和 THORChain 属于同一个大方向：native cross-chain swap。

可以粗略这样看：

```text
THORChain
  -> 更老牌
  -> native BTC swap 心智更强
  -> 经历过更多安全和市场周期考验
  -> 社区认知更成熟

Chainflip
  -> JIT AMM 设计更有特色
  -> 目标是更好的报价和资本效率
  -> SDK / broker / aggregator 集成方向更现代
  -> 更像新一代跨链做市网络
```

两者都不是普通 bridge，也都不是传统单链 DEX。它们共同面对的问题是：如何在不发行 wrapped asset 的前提下，把多链原生资产的托管、报价、兑换和出账做成一个可持续的协议。

THORChain 的安全事件提醒我们：TSS/MPC vault 的安全边界不能只看“有没有门限签名”。Chainflip 的 JIT AMM 则提醒我们：跨链兑换的难点也不只是“资产怎么从 A 链到 B 链”，还包括“订单流如何被定价、LP 如何竞争、用户如何获得可接受的成交结果”。

# 对钱包后端的启发

如果一个钱包要接入 Chainflip 这类协议，后端要处理的不只是 quote API。

一个比较完整的接入流程会包含：

```text
1. 获取支持链和支持资产
2. 请求 quote
3. 生成 deposit address 或 vault swap 参数
4. 展示源链转账要求和最小确认数
5. 监听用户 deposit 是否上链
6. 跟踪 Chainflip State Chain swap 状态
7. 展示 JIT AMM 处理中的价格和滑点风险
8. 跟踪目标链出账交易
9. 处理超时、失败、退款和用户填错地址
10. 对账用户侧资产变化和协议侧状态
```

这里最容易被低估的是状态展示。用户做跨链 swap 时，等待和不确定性比普通单链 swap 更强。如果前端只显示一个 spinner，用户会很难判断是源链还没确认、协议还没 witness、JIT AMM 还没执行，还是目标链还没出账。

后端需要把状态拆清楚：

```text
waiting_for_deposit
deposit_seen
deposit_confirming
witnessed
swap_queued
swap_executed
egress_signing
egress_broadcasted
completed
refunding
failed
```

这和钱包提现状态机很像。区别是这里跨了多条链、协议内部状态和外部链出入金。

# 我的理解

Chainflip 真正有意思的地方，不是它“又做了一个跨链桥”，而是它把原生资产跨链兑换拆成了一套协议化系统。

它的强处是：

```text
native asset swap
TSS vault 出账
validator witnessing
State Chain 协调
JIT AMM 做市
broker / SDK 集成
```

它的代价是：

```text
跨链 vault 安全边界更重
validator 和 TSS 实现必须足够可靠
流动性质量决定用户体验
跨链状态机比单链 swap 复杂得多
经济安全和协议 TVL 必须匹配
```

所以我会把 Chainflip 理解成：一个把中心化交易所跨链闪兑体验，拆成 validator 网络、TSS vault、State Chain 和 JIT AMM 的去中心化协议。

对钱包后端来说，这类协议的价值非常明确：它可以成为“用户意图执行层”的一个跨链流动性后端。但接入时不能只看 swap 成功路径，还要把报价、确认、出账、失败、退款、对账和用户状态展示一起设计。

# 参考来源

- [Chainflip Docs](https://docs.chainflip.io/)
- [Chainflip JIT AMM Protocol](https://docs.chainflip.io/protocol/just-in-time-amm-protocol)
- [Chainflip Brokers](https://docs.chainflip.io/brokers)
- [Chainflip Validators](https://docs.chainflip.io/validators/validators-role)
