---
{
  "id": 14,
  "slug": "thorchain-tss-attack-analysis",
  "title": "THORChain Asgard Vault 被攻击不是合约漏洞：TSS/MPC 实现缺陷的安全复盘",
  "date": "2026-06-21",
  "summary": "从 TSS/MPC 签名安全边界复盘 THORChain Asgard vault 攻击：旧版 GG20 实现的 Paillier 参数校验不足，让恶意节点逐步泄露 key material 并重构 vault 私钥。",
  "tags": [
    "Web3",
    "Security",
    "TSS",
    "MPC",
    "THORChain",
    "Cross-chain"
  ],
  "readingTime": "13 min",
  "difficulty": "进阶",
  "conceptTags": [
    "mpc-tss",
    "signer-service",
    "multi-chain"
  ],
  "relatedProjectIds": [
    2,
    5
  ],
  "recommendedSlugs": [
    "mpc-wallet-sign-integration",
    "aws-cloudhsm-wallet-sign-integration",
    "wallet-sign-signer",
    "wallet-evolution-2026",
    "withdrawal-error-handling"
  ],
  "suggestedQuestions": [
    "THORChain 的攻击和普通 DEX 合约攻击有什么本质区别？",
    "GG20 TSS 的 Paillier 参数校验不足如何导致密钥泄露？",
    "为什么 THORChain 的 solvency checker 没有拦截这次攻击？",
    "TSS/MPC 系统设计中有哪些生产级安全边界容易被低估？",
    "这次攻击对 wallet-sign 接入 MPC 有什么警示？"
  ]
}
---

# THORChain Asgard Vault 被攻击不是合约漏洞：TSS/MPC 实现缺陷的安全复盘

2026 年 5 月 15 日，THORChain 的一个 Asgard vault 被攻击，损失口径大约在 **10.7M 到 11M+ 美元**之间。

这次事件不是传统 AMM 合约里的闪电贷操纵价格、重入、授权漏洞或池子数学 bug，而是更底层的跨链金库安全事件：攻击者成为 THORChain 的节点运营者，进入 vault 的 TSS 签名参与集合，利用旧版 GG20 TSS 实现里的 Paillier 参数校验问题，在正常签名交互中逐步获得其他节点 key share 的泄露信息，最终离线重构出某个 Asgard vault 的完整私钥。

拿到完整私钥以后，攻击者不再走 THORChain 的正常 outbound 签名流程，而是像控制普通钱包一样，直接在多条链上签名并广播转账。

一句话总结：

> 这不是交易合约被打穿，而是管钱的 TSS/MPC 金库钥匙被推出来了。

所以这篇文章的重点不是“跨链 DEX 事故”，而是签名系统事故。它和 `wallet-sign`、MPC、CloudHSM 文章放在一起看，讨论的是同一个问题：当资金控制权收敛到某套签名系统里，协议实现、参数校验、节点准入和链上异常出金监控是否真的能撑住生产环境。

# THORChain 的钱是怎么保管的

THORChain 是跨链 DEX / 流动性网络。它和 Uniswap 这类单链 AMM 不同，THORChain 要管理 BTC、ETH、BNB、DOGE、LTC、BCH、XRP 等多链资产。

因此它有一类核心金库叫 Asgard Vault。

可以把正常流程简化成：

```text
用户把 BTC / ETH / USDC / DOGE 等资产打进 THORChain vault
-> THORChain 在内部账本记录用户和池子的资产状态
-> 用户换币或出金时，网络从对应链的 vault 发出资产
```

这些 vault 不是单个私钥控制，而是由 TSS / MPC 门限签名控制。THORChain 的 TSS 设计目标是：多个节点各自持有 key share，每次出金时共同参与 GG20 签名流程，最终生成一笔 BTC、ETH、BNB 等链上的合法签名，但完整私钥不应该出现在任何单台机器上。

理论上的安全边界是：

```text
没有单个节点持有完整私钥
签名必须由足够多节点协作完成
单个恶意节点最多让签名失败，不能偷走整把 key
```

这次事件打穿的，正是第三条。

# 攻击者怎么进入签名集合

攻击者不是从外部直接调用一个合约函数。

他先完成了一系列很工程化的准备：

```text
创建新身份
准备 RUNE bond
成为 THORChain 节点运营者
等待 churn 轮换进入 active validator set
被随机分配到某个 Asgard vault
参与正常 GG20 签名流程
```

公开分析里提到，攻击者是新 churn 进来的 node operator，bond 规模约为 635,000 RUNE，并在 2026 年 5 月中旬进入 active validator set。随后，他被分配进某个 Asgard vault 的签名参与集合。

这一步很关键。

TSS 的风险不只来自“外部黑客能不能打进来”，还来自“协议参与方里是否可能有恶意节点利用实现缺陷”。攻击者一旦成为签名参与者，就不再是站在金库门外的人，而是进入了签名房间的人。

# 真正的漏洞点：GG20 TSS 实现泄露 key material

公开复盘和技术分析普遍指向一个核心问题：THORChain 使用的旧版 GG20 TSS stack 在 Paillier 参数校验上存在缺陷，导致恶意节点可以在多轮签名交互中逐步获得其他参与者 key share 的信息。

更具体地说，THORChain 使用的是一个较老的 tss-lib fork。banteg 的分析指出，该 fork 在 keygen 阶段接受并持久化 peer 的 Paillier key，但没有现代 GG20 实现里需要的 MOD / FAC proofs 校验。恶意节点可以提交一个“看起来能过旧校验、但实际由攻击者构造”的 Paillier modulus。

后续 signing round 中，其他 honest nodes 会和这个恶意节点进行 MtA / MtAwc 相关交互。因为恶意 Paillier 参数已经被持久化，这些正常交互会变成一种泄露面：一次签名泄露一点，签名轮次多了以后，攻击者可以把这些信息离线组合起来。

可以这样理解：

```text
正常 TSS:
  每个节点只暴露足够生成签名、但不足以泄露私钥的中间值

漏洞 TSS:
  恶意节点提交特制 Paillier 参数
  其他节点在正常签名交互中无意间吐出 key share 相关信息
  攻击者多轮收集后离线重构 vault 私钥
```

这里不是 GG20 数学模型本身被证明失败，而是生产实现没有跟上协议要求的参数校验。

# Paillier 为什么会成为问题

GG20 这类 ECDSA TSS 协议里，会用 Paillier 同态加密来辅助完成多方之间的安全计算，尤其是 MtA / MtAwc 这类乘法转加法的交互。

简化理解：

```text
ECDSA 签名需要多个秘密值参与计算
节点不能直接暴露自己的 secret share
所以用 Paillier 做一部分安全交互
```

问题在于，参与者提交的 Paillier modulus 不能只看位数和旧式 proof。它必须证明自己满足协议需要的结构约束，否则恶意节点就能构造特殊参数，把签名交互变成 oracle。

Threshold Network 早在 2023 年披露过类似类别的风险：如果参与者生成包含小因子的 Paillier modulus，就可能在签名协议交互中恢复其他参与方的 secret shares。现代修复方向是增加更严格的 Paillier modulus validation，比如 MOD proofs、FAC proofs 等。

所以这次事件的工程教训非常直接：

```text
TSS 协议安全不等于库调用安全
库版本不等于生产安全边界
peer 提交的密码学参数必须严格验证
旧 fork 如果长期不跟进补丁，会变成金库级风险
```

# 攻击流程按时间线拆开

这次事件可以按攻击链路拆成十步：

```text
1. 攻击者准备 RUNE bond，成为 THORChain node operator
2. 节点通过 churn 进入 active validator set
3. 攻击者被分配到某个 Asgard vault 的 TSS 签名组
4. 恶意节点在 keygen / signing 相关流程中提交畸形 Paillier 参数
5. honest nodes 持久化该 peer 的 Paillier key material
6. 多轮正常签名交互中，恶意节点逐步收集 key share 泄露信息
7. 攻击者离线重构该 vault 的完整 TSS 私钥
8. 攻击者绕过 THORChain 正常 GG20 signing ceremony
9. 攻击者直接在 BTC / ETH / BNB / Base 等链上签名广播 outbound transactions
10. THORChain reactive solvency checker 发现账实不符并 halt，但资金已经离开 vault
```

这条链路里最关键的分界点是第 7 步。

在第 7 步之前，攻击者还是一个恶意 co-signer；第 7 步之后，攻击者已经变成了 vault 私钥的实际控制者。

一旦完整私钥被重构，链上系统无法区分这笔交易是“THORChain 正常签出来的”，还是“攻击者拿完整 key 私下签出来的”。对 BTC、ETH、BNB 等外部链来说，只要签名合法，交易就是有效交易。

# 为什么自动风控没有拦住

THORChain 有 solvency checker，大致可以分成 proactive 和 reactive 两类。

Proactive mode 是签名前检查：节点准备签 outbound tx 前，先模拟这笔交易会不会让 vault 资不抵债。如果会，就不签。

Reactive mode 是事后检查：链上持续对比 THORChain 内部账本认为 vault 应该持有的资产，和真实链上 vault 地址实际持有的资产。如果偏差超过阈值，就 halt 网络。

这次 proactive checker 没有机会工作，因为攻击者没有请求 THORChain 网络帮他签名。

```text
正常出金:
  txOut -> TSS signing ceremony -> proactive checker 有机会拦截

这次攻击:
  攻击者已重构完整私钥 -> 自己签名广播 -> proactive checker 没有入口
```

Reactive checker 能发现账实不符，但它天然是事后检测。它可以缩小后续损失、触发 halt、阻止更多签名活动，但不能把已经被合法签名广播出去的链上交易撤回。

这个点对钱包后端特别重要：如果安全边界只覆盖“正常签名流程”，但没有覆盖“私钥被重构后的异常链上出金”，那监控再快也可能只是事后报警。

# 涉及哪些链和资产

不同来源的统计口径略有差异。

早期报道常用的口径是：约 10.7M 美元，涉及 BTC、ETH、BNB、Base 等链。TRM Labs 后续把范围扩展到至少九条链，总额超过 11M 美元。

可确认的重点不是某一个具体 ERC20 被打穿，而是攻击者获得了 vault 对多链资产的控制能力。

这类资产包括：

```text
Bitcoin: BTC
Ethereum: USDT、USDC、WBTC、LINK、DAI、AAVE 等
BNB Chain: USDC、BSC-USD、BUSD、TWT、ETH、BTCB 等
Base: USDC
Avalanche: USDC、USDT
Dogecoin: DOGE
Litecoin: LTC
Bitcoin Cash: BCH
XRP Ledger: XRP
```

这也是为什么这次事件不能按普通 DEX 合约漏洞理解。攻击者拿到的不是某个合约池子的执行权限，而是一个跨链 vault 在多条链上的出金能力。

# 和普通 DEX 攻击的本质区别

普通 DEX 攻击常见模式是：

```text
价格预言机被操纵
AMM 池子被闪电贷套利
合约重入
权限配置错误
无限 approve 被滥用
池子数学公式有 bug
```

这次 THORChain 事件更接近：

```text
跨链 vault 的门限签名系统出问题
攻击者成为签名参与节点
利用 TSS 协议实现漏洞泄露 key material
离线重构 vault 私钥
绕过正常出金流程
直接链上转走多链资产
```

所以它的关键词不是 AMM，而是：

```text
TSS / MPC
GG20
Paillier modulus
MOD / FAC proof
key material leakage
validator churn
vault private key reconstruction
unauthorized outbound transactions
after-the-fact solvency detection
```

# 对 wallet-sign / MPC 系统的工程警示

这次攻击对钱包签名服务非常有参考价值，尤其是我自己在 `wallet-sign`、MPC/TSS、CloudHSM 这条线上的工程理解。

第一，TSS 库版本不能落后太久。

MPC/TSS 系统的安全依赖密码学协议，也依赖具体实现。旧 fork 如果不跟进上游补丁、proof 校验和安全公告，风险会被隐藏在“系统一直能正常签名”的表象下面。

第二，peer 提交的密码学参数不能被默认信任。

keygen 不是一次性的初始化小事，而是之后所有签名安全的基础。如果 keygen 阶段持久化了恶意 Paillier material，后续每一次 signing round 都可能变成泄露面。

第三，恶意参与者的上限必须是 abort，而不是 extract key。

一个生产级 TSS 系统可以接受恶意节点让签名失败、拖慢流程、触发惩罚，但不能接受恶意节点通过正常协议交互恢复其他人的 share。这个边界一旦被突破，TSS 就从“分布式钥匙”变成“慢速钥匙泄露器”。

第四，签名流程监控和链上异常出金监控要分开。

只监控 `wallet-sign` 内部签名请求是不够的。还要监控 vault 地址真实链上余额变化、异常 outbound、非预期 nonce / UTXO 消耗、非系统 request_id 对应的链上出金。

第五，高价值 vault 不能只依赖单层 TSS。

高价值资产还需要叠加：

```text
签名频率限制
大额出金延迟
多层审批
链上余额实时对账
异常出金 halt
TSS 参数审计
库版本安全基线
节点 churn 风险控制
```

TSS/MPC 解决的是“完整私钥不在单点出现”，但不自动解决“协议实现、节点准入、异常出金和长期补丁治理”的问题。

# 复盘后的理解

THORChain 这次事件最值得记住的不是“某个跨链 DEX 又被黑了”，而是它暴露了 TSS/MPC 在生产环境里的真实风险边界。

一个理想的 TSS 系统应该满足：

```text
单点拿不到完整私钥
恶意节点最多让签名失败
peer 参数被严格验证
keygen 结果可审计
签名轮次不会泄露长期 key share
异常链上出金能被独立发现
库版本和安全公告持续跟进
```

这次事件说明：如果实现落后、参数校验不足、恶意节点能进入签名集合，那么“没有单点私钥”这句话并不等于安全。

TSS 不是魔法盾牌。它是更复杂的签名系统。复杂系统真正的安全来自协议、实现、运维、监控、审计和应急响应一起成立。

对钱包后端来说，最实际的结论是：

```text
不要只问有没有用 MPC
要问 MPC 的 keygen 参数怎么校验
要问 tss-lib 版本怎么跟踪
要问恶意节点最多能造成 abort 还是 extract
要问 vault 余额和链上出金怎么独立对账
要问签名系统失败时会不会绕过安全边界
```

如果这些问题没有答案，MPC/TSS 只是把“单点私钥风险”换成了“分布式实现风险”。

# 参考来源

- [Rekt: THORChain - Rekt III](https://rekt.news/thorchain-rekt3)
- [banteg: Malformed Paillier Keys in THORChain's TSS Stack](https://banteg.xyz/posts/thorchain-tss-lib/)
- [TRM Labs: THORChain exploit drains USD 11M+ across at least nine chains](https://www.trmlabs.com/resources/blog/thorchain-exploit-drains-usd-11m-across-at-least-nine-chains-what-trm-knows-now)
- [Threshold Network tss-lib security advisory](https://github.com/threshold-network/tss-lib/security/advisories/GHSA-h24c-6p6p-m3vx)
- [THORChain dev docs: TSS implementation](https://dev.thorchain.org/bifrost/tss.html)
