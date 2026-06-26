---
{
  "id": 17,
  "slug": "lubian-weak-private-key-op-return",
  "title": "LuBian 事件复盘：弱私钥熵与 BTC OP_RETURN 链上留言",
  "date": "2026-06-21",
  "summary": "从钱包 key generation 安全角度复盘 LuBian：BTC 私钥生成熵不足会让地址可枚举，OP_RETURN 链上留言只是事故后的链上痕迹。",
  "tags": [
    "Web3",
    "Security",
    "Bitcoin",
    "Wallet",
    "OP_RETURN"
  ],
  "difficulty": "进阶",
  "conceptTags": [
    "wallet-backend",
    "signer-service",
    "multi-chain"
  ],
  "relatedProjectIds": [
    1,
    2
  ],
  "recommendedSlugs": [
    "wallet-sign-signer",
    "wallet-address-models",
    "new-chain-integration-checklist",
    "withdrawal-error-handling"
  ],
  "suggestedQuestions": [
    "LuBian 事件为什么是私钥生成安全事故？",
    "BTC OP_RETURN 链上留言是怎么工作的？",
    "钱包系统为什么不能自研随机数或 keygen 算法？"
  ]
}
---

# LuBian 事件复盘：弱私钥熵与 BTC OP_RETURN 链上留言

LuBian 事件不是 DEX 漏洞，不是智能合约漏洞，也不是 Bitcoin 协议被攻破。

它更像是钱包系统最底层的信任根出了问题：私钥生成随机性不足，导致攻击者可以枚举候选私钥，命中 LuBian 控制的 BTC 地址后，直接签名转走资金。

公开分析里，LuBian 被认为在 2020 年 12 月损失了 **127,426 BTC**。这件事长期没有被主流市场理解，直到 2025 年 Arkham 和后续安全分析重新把它挖出来，才被广泛讨论为历史上规模极大的 Bitcoin 盗窃事件之一。

这件事对钱包后端和签名系统特别重要，因为它说明了一件事：

> 如果 key generation 坏了，后面的签名机、风控、审批和对账都只是站在沙地上的高楼。

所以这篇文章不把 LuBian 当作安全新闻，而是把它放回钱包工程里看：随机数、密钥生成、地址批量生成、签名机和链上监控之间，哪一个边界最不能出错。

# 这不是 DEX 漏洞，而是 key generation 事故

LuBian 是一个曾经很大的 Bitcoin mining pool。它不是 DeFi 协议，不是 AMM，也不是跨链桥。

这类系统的资金安全核心很朴素：

```text
生成 BTC 私钥
-> 推导公钥和地址
-> 接收矿池或钱包资金
-> 用私钥签名转账
```

如果私钥是安全随机生成的，攻击者不可能通过暴力枚举找到它。Bitcoin 私钥空间接近 2^256，这个数量级在现实世界里不可穷举。

LuBian 的问题在于：公开分析认为它的私钥生成熵严重不足，疑似只有 **32 bit** 左右。

这意味着攻击者不需要攻击 Bitcoin 网络，不需要破解 ECDSA，也不需要打穿矿池服务器。他只需要枚举低熵空间里的候选私钥。

# 32 bit 熵为什么危险

正常 Bitcoin 私钥应该接近 256 bit 熵。

可以简单对比：

```text
正常 BTC 私钥:
  2^256 级别空间
  现实中无法暴力枚举

32 bit 低熵私钥:
  2^32 ≈ 42.9 亿种可能
  对现代计算设备来说已经进入可枚举范围
```

42.9 亿听起来很大，但对计算机来说并不是天文数字。尤其当攻击者知道私钥生成算法大致形态、seed 范围或实现缺陷时，枚举成本会继续下降。

这就是弱随机数的危险之处：它不会让系统立刻报错，地址也能正常生成，交易也能正常签名，链上看起来一切都对。但攻击者可以在后台把候选私钥一个个生成出来，再推导地址去和链上资金地址匹配。

# 攻击者如何从弱私钥转走 BTC

攻击路径可以简化成：

```text
1. LuBian 钱包系统批量生成 BTC 私钥
2. 私钥随机性不足，不是真正的 256 bit 安全随机
3. 攻击者发现或推测 keygen 熵很低
4. 攻击者枚举可能的私钥
5. 从候选私钥推导公钥和 BTC 地址
6. 将推导出的地址与链上 LuBian 相关地址匹配
7. 一旦命中，就用该私钥签名转走 BTC
```

这里最关键的是第 5 步和第 6 步。

Bitcoin 地址是可以从私钥单向推导出来的。攻击者不需要先知道 LuBian 的数据库，也不需要进入 LuBian 内网。只要私钥空间足够小，他就可以离线枚举候选私钥，推导地址，再和链上已有地址对比。

命中以后，链上并不知道这把私钥是怎么来的。对 Bitcoin 网络来说，只要签名合法，交易就是合法交易。

所以这类事故的残酷之处在于：链上执行完全正确，但私钥生成这个前提已经坏了。

# 为什么多年后才被重新挖出

公开资料里提到，LuBian 在 2020 年 12 月底发生大规模资金转移，2021 年 2 月左右停止活跃，随后逐渐从公众视野里消失。

当时外界更容易把 LuBian 的退出理解成矿业监管、市场环境或运营问题。真正的链上资金异常虽然一直存在，但没有马上被广泛归因成一次巨大盗窃。

到了 2025 年，Arkham 等链上分析重新梳理资金流，才把这批长期沉睡的 BTC 和 LuBian 联系起来，并提出弱私钥生成导致盗窃的解释。

一个很特别的细节是：LuBian 后续似乎曾通过 Bitcoin 链上消息请求攻击者归还资金。公开报道提到，他们发送过 **1500+** 条 `OP_RETURN` 相关消息，并为这些链上消息支付了约 **1.4 BTC** 矿工费。

这个细节很重要。它说明 LuBian 很可能知道这不是正常迁移，而是资金被盗，只是他们没有通过传统公告把事件完整披露出来。

# BTC OP_RETURN 链上留言原理

Bitcoin 没有账户余额模型，而是 UTXO 模型。

一笔普通 BTC 交易大概是：

```text
inputs:
  - 花掉之前某些 UTXO

outputs:
  - 给地址 A 0.01 BTC
  - 找零给自己 0.9899 BTC

fee:
  - 输入总额 - 输出总额
```

`OP_RETURN` 是 Bitcoin Script 里的一个操作码，可以把一小段数据放进交易 output 里。

一个 OP_RETURN output 大概长这样：

```text
value: 0 BTC
scriptPubKey: OP_RETURN <data>
```

它的含义是：

```text
这个 output 永远不可花费
后面的 data 只是链上附带信息
```

比如：

```text
OP_RETURN 48656c6c6f20426c6f636b636861696e
```

这串 hex 解码后就是：

```text
Hello Blockchain
```

所以 BTC 链上留言的本质是：在交易 output 里放一个 `OP_RETURN <data>`，让这段数据被矿工打包进区块。Bitcoin 网络不理解这句话的语义，但区块浏览器可以把 hex 解码成人类可读文本。

# 为什么 OP_RETURN 输出不可花费

普通 BTC 转账 output 的脚本通常表达的是：

```text
谁能提供对应私钥签名
谁就能花这笔钱
```

而 OP_RETURN 的语义不同。脚本执行到 `OP_RETURN` 会直接失败，所以这个 output 被称为 provably unspendable output，也就是可证明不可花费输出。

这有两个好处。

第一，节点知道它永远不能被花费，所以不会把它长期保留在 UTXO set 里。

第二，它比早期“把数据伪装成地址输出”的方式更干净。它明确告诉网络：这不是可花的钱，只是一段数据。

因此 OP_RETURN output 通常设置为 0 BTC。如果往里面放 BTC，本质上就是把钱烧掉。

# OP_RETURN 可以放多少数据

常见标准策略里，OP_RETURN 数据通常限制在 **80 bytes** 左右。

它适合放：

```text
短句
哈希
协议标记
订单 ID
链上证明摘要
```

它不适合放长文章。如果要写很长的内容，只能拆成很多笔交易。

这也解释了为什么 LuBian 相关链上消息会是 1500+ 条：每条 OP_RETURN 能承载的数据很小，长消息只能像短信一样拆开发。

# dust + OP_RETURN 如何和目标地址产生关联

如果只发一笔 OP_RETURN 交易，交易本身未必和攻击者地址直接产生 output 关系。

更常见的链上喊话方式是：

```text
outputs:
  - 546 sats 给目标地址
  - OP_RETURN "Please return the BTC..."
  - 找零回自己
```

这里的 546 sats 是常见 dust amount。金额很小，但它会让这笔交易出现在目标地址的链上记录里。

这样区块浏览器或链上分析工具就能看到：

```text
LuBian 相关地址
-> dust output 到攻击者地址
-> 同一笔交易里带 OP_RETURN 留言
```

Bitcoin 本身没有银行转账备注，也没有 ETH 那种 calldata。`dust + OP_RETURN` 就成了一种把“目标地址”和“链上留言”放在同一笔交易里的方法。

# 为什么会花约 1.4 BTC

OP_RETURN 本身不是向协议缴纳留言费。成本来自矿工费。

Bitcoin 交易手续费大致是：

```text
fee = transaction vbytes * fee rate
```

OP_RETURN 会增加交易体积。如果发送 1500+ 条消息，每条都是一笔或多笔 BTC 交易，就会累计出很高的矿工费。

所以那约 1.4 BTC 不是“留言服务费”，而是矿工打包这些带 OP_RETURN 数据交易所收取的手续费。

# 对钱包后端的教训

LuBian 事件最值得钱包后端记住的，不是攻击者多复杂，而是 key generation 不能出错。

生产钱包系统必须遵守几条底线：

```text
必须使用 CSPRNG
不能使用普通 rand()
不能使用时间戳、用户 ID、递增数作为 seed
不能自研私钥生成算法
不能把测试 keygen 逻辑带进生产
不能只靠“地址能生成、交易能签名”判断安全
```

还要有配套审计：

```text
熵源审计
keygen 代码审计
依赖库版本审计
生成结果重复性排查
地址批量分布检查
异常相似私钥 / 地址检测
```

对 `wallet-sign`、MPC、HSM 这些模块来说，私钥生成是最底层的信任根。如果随机数坏了，签名流程越稳定，攻击者转账反而越顺畅。

最终结论很简单：

> 钱包安全不是从签名那一刻开始，而是从随机数生成那一刻开始。

这也决定了 LuBian 这类文章在站内的位置：它不是“历史大案复述”，而是 `wallet-sign`、MPC、CloudHSM 和 BTC 地址模型文章的底层安全补充。它回答的是一个更工程化的问题：如果私钥生成这一步不可信，后面的所有钱包后端设计都会失去意义。

# 参考来源

- [Rekt: The One That Got Away](https://rekt.news/the-one-that-got-away)
- [CoinDesk: Arkham Says LuBian Bitcoin Theft Went Undetected for Nearly Five Years](https://www.coindesk.com/tech/2025/08/02/arkham-says-usd3-5b-lubian-bitcoin-theft-went-undetected-for-nearly-five-years)
- [Real Random: How Weak Entropy Led to the LuBian Heist](https://realrandom.co/how-weak-entropy-led-to-the-lubian-bitcoin-theft/)
- [Bitcoin Core: OP_RETURN relay policy](https://github.com/bitcoin/bitcoin/blob/master/doc/release-notes/release-notes-0.11.0.md)
