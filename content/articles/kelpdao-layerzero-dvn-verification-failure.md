---
{
  "id": 18,
  "slug": "kelpdao-layerzero-dvn-verification-failure",
  "kind": "research",
  "title": "KelpDAO 事件复盘：LayerZero 单 DVN 与跨链验证路径失效",
  "date": "2026-06-21",
  "summary": "从跨链验证路径角度复盘 KelpDAO：问题不是普通合约漏洞，而是单 DVN、RPC 可信边界和源链事实验证失效导致目标链释放 rsETH。",
  "tags": [
    "Web3",
    "Security",
    "Cross-chain",
    "LayerZero",
    "Bridge",
    "DeFi"
  ],
  "difficulty": "进阶",
  "conceptTags": [
    "multi-chain",
    "wallet-backend",
    "mpc-tss"
  ],
  "relatedProjectIds": [
    1,
    5
  ],
  "recommendedSlugs": [
    "chainflip-cross-chain-dex-analysis",
    "thorchain-tss-attack-analysis",
    "wallet-evolution-2026",
    "new-chain-integration-checklist"
  ],
  "suggestedQuestions": [
    "KelpDAO 事件为什么是跨链验证路径失败？",
    "LayerZero DVN 单点配置有什么风险？",
    "为什么 Aave 没被直接攻击却会被波及？"
  ]
}
---

# KelpDAO 事件复盘：LayerZero 单 DVN 与跨链验证路径失效

KelpDAO 事件不是普通合约漏洞。

它不是重入，不是闪电贷价格操纵，不是整数溢出，也不是私钥泄露。它的核心是跨链验证路径失效：目标链合约按规则执行了消息，但这条消息背后的源链事实是假的。

2026 年 4 月 18 日，攻击者利用 KelpDAO 的 LayerZero 跨链配置和验证路径问题，让 Ethereum 主网 adapter 释放了 **116,500 rsETH**。后续第二笔约 **40,000 rsETH** 的释放尝试被 emergency multisig 冻结 recipient 后阻止。

这类事件的危险之处在于：链上合约可以完全按照代码规则执行，但代码信任的输入已经坏了。

所以这篇复盘的重点不是“某个桥又被黑了”，而是跨链系统里的事实来源问题：目标链到底相信谁观察到的源链状态，RPC、DVN、packet 和 adapter 之间的信任边界是否足够分散。

# KelpDAO 和 rsETH 跨链模型

KelpDAO 做的是 Liquid Restaking Token。用户存入 ETH 相关资产，协议把资产放进 EigenLayer 相关体系里做 restaking，用户获得 rsETH 作为可流通凭证。

当 rsETH 被部署到多条链上时，它需要一套跨链模型来保证不同链上的 rsETH 供应和底层资产 backing 对得上。

简化后，跨链流程大概是：

```text
Ethereum -> 其他链:
  Ethereum adapter 锁定 rsETH
  目标链 mint 对应 rsETH

其他链 -> Ethereum:
  源链 burn rsETH
  Ethereum adapter 释放 rsETH
```

这个模型的关键是：Ethereum 主网上的 adapter / custody pool 里锁着大量真实 rsETH。其他链上的跨链消息一旦被验证为有效，Ethereum 端就会根据消息释放对应资产。

所以安全边界不只在 KelpDAO 合约本身，还在跨链消息验证路径上。

# LayerZero DVN 是什么

LayerZero V2 里有一个关键概念叫 DVN：Decentralized Verifier Network。

可以把 DVN 理解成跨链消息的验证者：

```text
源链发生跨链事件
-> DVN 观察源链事件是否真实存在
-> DVN 对消息或 payload 做验证签名
-> 目标链接收足够验证后执行对应动作
```

在理想情况下，跨链桥不应该只依赖单个验证者。更稳的结构通常会是多 DVN / 多来源 / 阈值验证：

```text
3 个 DVN 至少 2 个确认
5 个 DVN 至少 3 个确认
不同 RPC / indexer / proof source 交叉验证
```

这样单个 DVN 或单个基础设施源出问题，不会直接释放目标链资金。

# 单 DVN 配置如何变成单点故障

KelpDAO 事件里，关键路径是 Unichain -> Ethereum。

公开复盘里提到，这条路径的验证配置近似是：

```text
requiredDVNCount: 1
optionalDVNCount: 0
optionalDVNThreshold: 0
requiredDVNs: [LayerZero DVN]
```

也就是说，这条跨链路径只需要一个 required DVN 签名，没有 optional DVN，也没有多方阈值。

这种配置会把整个验证路径收缩成单点：

```text
一个 verifier
一个签名
一个被信任的 observation path
```

只要攻击者能让这个 DVN 看到伪造的源链状态，目标链就可能执行伪造消息。

# 攻击者如何伪造跨链消息

公开复盘对攻击方式有不同表述：LayerZero 侧提到 RPC poisoning，安全研究者则更强调 observation-layer compromise，也就是验证层依赖的 RPC / 节点基础设施被针对性污染。

抽象后，攻击方式可以理解成：

```text
正常情况:
  DVN 查询 Unichain RPC
  RPC 返回真实链状态
  DVN 判断源链事件是否真实发生

攻击情况:
  攻击者控制或污染 DVN 依赖的 RPC / 节点路径
  恶意基础设施只对 DVN 返回伪造链状态
  DVN 以为源链发生了巨额 burn / lock
  DVN 签署伪造 packet
```

最危险的是，这种攻击不一定让所有人都看到假链。

普通用户、普通监控、其他 RPC 查询可能仍然看到真实链状态；只有 DVN 查询的那条路径被喂了伪造数据。这样监控很难第一时间发现，因为异常只发生在关键验证者的视角里。

# 伪造 packet 为什么能释放 rsETH

攻击者构造的核心消息大意是：

```text
Unichain 上已经 burn / lock 了 116,500 rsETH
请 Ethereum 主网释放对应 rsETH 给指定地址
```

但公开复盘指出，真实 Unichain 上并不存在对应的源链事件。

异常点包括：

```text
不存在对应 outbound nonce
源链 rsETH 供应量不足以支持该 burn 数量
没有真实 Transfer / burn event
没有真实 PacketSent event
```

问题在于 Ethereum 端不会自己重新执行一次“去 Unichain 查真相”的流程。目标链合约依赖 LayerZero endpoint 和 DVN 验证结果。

所以 Ethereum 端看到的是：

```text
payload hash 匹配
DVN 签名有效
消息满足当前验证配置
```

在这套规则下，adapter 释放 rsETH 是“按规则执行”。事故不是目标链合约跳过了检查，而是它信任的验证输入本身已经被污染。

# 为什么 Aave 会被波及

攻击者拿到 rsETH 后，并不是只在 KelpDAO 系统内停留。

他把部分 rsETH 存入 Aave 作为抵押品，再借出 WETH / wstETH 等更通用、更有流动性的资产。

这导致 Aave 处在一个很尴尬的位置：

```text
Aave 合约没有被直接攻击
Aave 的借贷逻辑正常执行
但 Aave 接收了异常来源的 rsETH 作为抵押品
攻击者借走了真实 ETH 类资产
风险通过 DeFi 组合性传导到借贷协议
```

这就是可组合性的另一面。

正常情况下，DeFi composability 让资产可以高效流转；出事时，问题资产也会沿着组合路径进入其他协议，把风险传给没有被直接攻击的系统。

# 第二笔为什么没成功

攻击者还准备了第二个 packet，目标是继续释放约 **40,000 rsETH**。

但这次 KelpDAO emergency multisig 及时冻结了 recipient address。后续 delivery 尝试回滚，没有成功释放资产。

所以事件可以拆成两部分：

```text
第一笔:
  116,500 rsETH 成功释放

第二笔:
  约 40,000 rsETH 的伪造消息已排队
  但 recipient 被冻结
  delivery 回滚，未完成释放
```

这说明应急控制不是没有作用。它没能阻止第一笔，但阻止了后续更大损失。

# 这不是私钥泄露，也不是普通 DeFi bug

KelpDAO 事件容易被误解成“桥被黑了”。

更准确地说，它是 verification path failure。

可以对比几类常见攻击：

```text
重入攻击:
  合约状态更新顺序错误

价格操纵:
  oracle 或 AMM 价格被短时间扭曲

私钥泄露:
  攻击者拿到签名权限

KelpDAO:
  目标链信任的跨链验证路径读到了假源链状态
```

KelpDAO 的问题不在于 Ethereum adapter 不会执行代码，而在于它执行的前提来自一个被污染的验证路径。

这类事故最像“看门人被伪造通行证骗了”。门锁没坏，开门流程也没跳过，但通行证验证系统坏了。

# 对跨链后端的教训

第一，跨链消息不能依赖单一验证者。

单 DVN 配置会把跨链验证压缩成一个单点。高价值路径应该使用多 DVN、多来源和阈值策略，至少避免 1-of-1 verifier 控制大额释放。

第二，RPC 不是可信事实源。

RPC 是观察链状态的入口，不是链本身。验证层如果只依赖一组可被定向污染的 RPC，就可能看到“只有自己能看到的假链”。

第三，目标链应该尽量要求可验证源链事实。

跨链系统很难让目标链直接验证所有源链事实，但至少要尽量引入证明、多源交叉验证、延迟窗口、异常限额和人工应急机制。

第四，共享 custody pool 的风险要单独建模。

如果 Ethereum 主网 adapter 里锁着大量真实资产，那么任意一条源链 -> Ethereum 路径的验证失败，都可能打穿共享池。

第五，DeFi 组合性会传播风险。

一个跨链资产一旦进入借贷协议、抵押系统或聚合器，风险就不再停留在原协议里。接入资产时，协议不仅要看 token 合约，还要看跨链验证路径、发行/销毁机制和底层 backing。

# 对钱包和跨链产品的启发

钱包后端如果接入跨链协议，不能只看“API 能不能发起 bridge”。

还要看：

```text
跨链路径使用几个验证者
验证者是否有阈值
源链事件如何被证明
RPC / indexer 是否多源交叉验证
目标链释放是否有大额限额
异常路径是否有延迟窗口
是否支持暂停或冻结特定 recipient
跨链资产进入借贷协议后的风险如何展示
```

用户看到的是“从 A 链桥到 B 链”，后端要理解的是：这条路径到底信任谁，信任几个，信任的输入能不能被伪造。

最终结论是：

> 跨链桥的安全不只取决于目标链合约，也取决于源链事实如何被观察、验证和传递。

放到钱包后端语境里，KelpDAO 的价值在于提醒：接入跨链协议时，不能只把 bridge 当成一个 API。钱包需要理解跨链路径的验证者数量、RPC 依赖、异常限额、冻结能力和最终到账语义，否则前端展示的“桥接中”背后可能是一条单点验证路径。

# 参考来源

- [Chainalysis: KelpDAO Bridge Exploit](https://www.chainalysis.com/blog/kelpdao-bridge-exploit-april-2026/)
- [LayerZero: KelpDAO Incident Statement](https://layerzero.network/blog/kelpdao-incident-statement)
- [OpenZeppelin: Lessons from KelpDAO Hack](https://www.openzeppelin.com/news/lessons-from-kelpdao-hack)
- [Rekt: KelpDAO Rekt](https://rekt.news/kelpdao-rekt)
