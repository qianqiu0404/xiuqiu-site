---
{
  "id": 22,
  "slug": "bitcoin-utxo-ordinals-runes-indexer",
  "kind": "research",
  "title": "Bitcoin 区块里都是 UTXO，为什么还能有 NFT 和 Token",
  "date": "2026-06-24",
  "summary": "Bitcoin 本身没有账户模型、智能合约 NFT 或 ERC20 余额表，但 UTXO 交易可以携带 OP_RETURN、Taproot witness 和 inscription 数据，再由 Ordinals、BRC-20、Runes 等协议和链下索引器解释成 NFT 或 Token 状态。",
  "tags": [
    "Bitcoin",
    "UTXO",
    "Ordinals",
    "Runes",
    "Indexer",
    "Wallet"
  ],
  "difficulty": "进阶",
  "conceptTags": [
    "wallet-backend",
    "multi-chain",
    "signer-service"
  ],
  "relatedProjectIds": [
    1,
    2
  ],
  "recommendedSlugs": [
    "wallet-address-models",
    "lubian-weak-private-key-op-return",
    "new-chain-integration-checklist",
    "wallet-evolution-2026",
    "wallet-sign-signer"
  ],
  "suggestedQuestions": [
    "Bitcoin 都是 UTXO 交易，为什么还能有 NFT 和 Token？",
    "Ordinals、BRC-20 和 Runes 分别依赖什么数据结构？",
    "BTC 钱包为什么需要链下索引器才能展示铭文和 Rune 资产？"
  ]
}
---

# Bitcoin 区块里都是 UTXO，为什么还能有 NFT 和 Token

Bitcoin 本身没有账户模型，没有智能合约 NFT，也没有 ERC20 那种合约余额表。

它的底层非常克制：

```text
花掉旧 UTXO
-> 生成新 UTXO
```

但 Bitcoin 生态里又确实出现了 Ordinals、Inscriptions、BRC-20、Runes 这些看起来像 NFT 或 Token 的资产。

这个矛盾可以用一句话解释：

```text
Bitcoin 主链负责保存和验证 UTXO
协议规则负责定义数据格式
链下索引器负责解释这些数据
钱包和市场负责展示成 NFT / Token
```

所以 Bitcoin 上的 NFT / Token，不是像 Ethereum 那样由智能合约原生管理，而是通过 UTXO 交易携带数据，再由链下索引器解释出来的资产层。

# Bitcoin 区块里的交易，本质都是 UTXO

Ethereum 里，我们常说：

```text
Alice 账户余额 -1 ETH
Bob 账户余额 +1 ETH
```

Bitcoin 不是这样。

Bitcoin 没有“账户余额”这个字段，它只有一堆还没有被花掉的交易输出，也就是 UTXO：

```text
Unspent Transaction Output
未花费的交易输出
```

你钱包里显示 1 BTC，底层可能不是一个整体，而是几个 UTXO 加起来：

```text
0.2 BTC
0.3 BTC
0.5 BTC
= 1 BTC
```

当你要转 0.6 BTC 给别人时，钱包可能选择两个 UTXO 作为输入：

```text
inputs:
  0.3 BTC
  0.5 BTC

outputs:
  0.6 BTC 给对方
  0.1999 BTC 找零给自己

fee:
  0.0001 BTC
```

所以 Bitcoin 交易的核心结构是：

```text
旧 UTXO 作为 input 被花掉
新 UTXO 作为 output 被创建
```

一个 Bitcoin 区块里的绝大多数普通交易，本质都在做这件事。

# Coinbase 交易是特殊的 UTXO 创建交易

Bitcoin 区块里的第一笔交易叫 Coinbase 交易。

这里的 Coinbase 不是交易所 Coinbase，而是 Bitcoin 协议里的矿工奖励交易。

普通交易需要引用之前的 UTXO：

```text
input: 之前某笔交易产生的 UTXO
output: 新的 UTXO
```

Coinbase 交易没有普通输入。它是矿工挖出新区块后，协议允许矿工创建的区块奖励：

```text
input: coinbase
output: miner reward address
```

矿工收到的金额由两部分组成：

```text
区块补贴 + 当前区块所有交易手续费
```

例如某个矿池在 Coinbase 交易里收到：

```text
3.14297184 BTC
```

如果当前区块补贴是：

```text
3.125 BTC
```

那么多出来的部分就是该区块里其他交易贡献的手续费：

```text
3.14297184 BTC
= 3.125 BTC 区块补贴
+ 0.01797184 BTC 手续费
```

Coinbase 交易本身不是普通用户交易，它的作用是创建矿工奖励 UTXO。

# Bitcoin 本身没有原生 NFT / Token

Bitcoin 节点真正理解的是：

```text
这个 UTXO 是否存在
这个 UTXO 是否已经被花掉
签名是否有效
脚本是否满足花费条件
交易是否符合共识规则
```

Bitcoin 主链不会原生理解：

```text
这是不是 NFT
这是不是 BRC-20
这是不是 Rune
这个图片是谁的
这个 Token 余额是多少
```

这些都是协议层和索引器解释出来的结果。

所以更准确地说：

```text
Bitcoin 本身没有 NFT / Token 状态
但 Bitcoin 交易可以携带数据
这些数据可以被协议和索引器解释成资产状态
```

这也是 BTC 生态资产和 EVM 合约资产最大的区别。

# Ordinals / Inscriptions：最像 BTC NFT

Ordinals 可以粗略理解成：

```text
给每一个 satoshi 编号
再把某段数据绑定到某个 satoshi 上
```

Bitcoin 的最小单位是 satoshi：

```text
1 BTC = 100,000,000 sats
```

Ordinals 的思路是：每个 sat 都可以被排序、编号和追踪。如果某个 sat 绑定了一段图片、文本、JSON、HTML 或其他内容，就可以形成 inscription。

所以 Bitcoin NFT 的本质不是：

```text
智能合约里记录 ownerOf(tokenId)
```

而更像是：

```text
某个 UTXO 里包含一个被编号和追踪的 sat
这个 sat 绑定了一段 inscription 数据
谁控制这个 UTXO，谁就控制这个 inscription
```

这和 Ethereum NFT 完全不同。

Ethereum NFT 是合约说了算：

```text
ERC721.ownerOf(tokenId) = address
```

Bitcoin Ordinals 是索引器按规则解释：

```text
某个 sat 当前在哪个 UTXO 里
这个 sat 是否绑定了 inscription 数据
```

所以 Ordinals 的关键不是智能合约，而是：

```text
UTXO
sat 编号规则
Taproot witness / inscription 数据
链下索引器
```

# BRC-20：把 JSON 当成 Token 指令

BRC-20 是 Bitcoin 上较早流行的一种 Token 协议。

它不是智能合约，也没有 ERC20 那种合约余额表。

它的做法是把一段 JSON 数据写入 inscription，例如：

```json
{
  "p": "brc-20",
  "op": "transfer",
  "tick": "ordi",
  "amt": "100"
}
```

这段 JSON 对 Bitcoin 节点来说，只是交易里携带的数据。

Bitcoin 节点不会理解：

```text
这是一笔 BRC-20 转账
```

真正理解它的是链下索引器。

索引器会按 BRC-20 协议规则扫描区块：

```text
发现 deploy 指令 -> 创建 ticker
发现 mint 指令 -> 记录铸造数量
发现 transfer 指令 -> 更新可转余额
```

所以 BRC-20 的本质是：

```text
把 Token 状态变化写成文本数据
再由链下索引器还原出一套 Token 账本
```

Bitcoin 负责保存数据，索引器负责解释数据。

# Runes：更贴近 UTXO 的 Token 协议

Runes 也是 Bitcoin 上的同质化 Token 协议，但它比 BRC-20 更贴近 UTXO 模型。

BRC-20 依赖 inscription 和 JSON，数据更重，也更依赖文本指令。

Runes 的思路更像：

```text
把 Token 状态绑定到 UTXO 上
通过 OP_RETURN 表达协议数据
由索引器按规则解释 Rune 的分配和转移
```

一个 UTXO 在 Bitcoin 主链看来可能只是：

```text
0.00000546 BTC
```

但在 Runes 索引器看来，它也可能代表：

```text
1000 个某 Rune Token
```

注意，Bitcoin 主链仍然只认识这个 UTXO 有多少 BTC。

它并不知道：

```text
这个 UTXO 里还有 1000 个 Rune Token
```

Rune Token 的余额、分配和流转，仍然要靠协议规则和索引器解释。

# OP_RETURN 只是链上数据，不等于 NFT

`OP_RETURN` 是 Bitcoin Script 里的一个操作码，可以把一小段数据放进交易 output 里。

一个 OP_RETURN output 大概长这样：

```text
value: 0 BTC
scriptPubKey: OP_RETURN <data>
```

它的特点是：

```text
不可花费
不进入长期 UTXO set
适合放协议标记、链上留言、时间戳证明或元数据
```

但看到 OP_RETURN，不代表它就是 NFT，也不代表它就是 Token。

它可能是：

```text
矿池标记
链上留言
Runes 协议数据
时间戳证明
其他协议元数据
```

所以 OP_RETURN 是“写数据”的一种方式，不是资产本身。

如果要理解 OP_RETURN 链上留言，可以看 LuBian 那篇。这里更关心的是：BTC 生态里的资产协议，如何利用链上数据和链下索引器组合出额外资产状态。

# 链下索引器才是关键

这篇文章真正想表达的重点是索引器。

Bitcoin 主链只负责：

```text
验证 UTXO 是否能被花费
验证签名是否正确
验证交易是否符合共识规则
把交易数据写进区块
```

它不会负责：

```text
识别 inscription
计算 BRC-20 余额
计算 Rune token 分配
判断某张图片当前属于谁
展示某个地址持有哪些铭文
```

这些都需要链下索引器完成。

索引器做的事情是：

```text
扫描 Bitcoin 区块
解析交易 inputs / outputs / witness / OP_RETURN
按 Ordinals / BRC-20 / Runes 协议规则解释数据
生成额外资产账本
提供给钱包、浏览器、市场和 API 使用
```

所以你在区块浏览器或市场里看到：

```text
Inscription
Rune
BRC-20 Transfer
```

本质上是索引服务解析出来的结果，不是 Bitcoin 协议原生字段。

这对钱包后端特别重要。

如果钱包只接 Bitcoin Core RPC，它能拿到 BTC 交易和 UTXO，但不一定能直接知道：

```text
这个 UTXO 是否携带 inscription
这个地址有哪些 Rune 资产
这个 BRC-20 transfer 是否有效
这个 UTXO 能不能安全拿去当普通 BTC 找零
```

所以 BTC 钱包如果要支持 Ordinals / Runes / BRC-20，必须额外接入或自建资产索引能力。

# 和 Ethereum NFT / ERC20 的区别

Bitcoin 资产协议和 Ethereum 合约资产的区别，可以这样看：

| 对比项 | Ethereum NFT / Token | Bitcoin Ordinals / Runes / BRC-20 |
| --- | --- | --- |
| 底层模型 | 账户模型 | UTXO 模型 |
| 资产表达 | 智能合约状态 | 交易数据 + 协议规则 |
| 所有权判断 | `ownerOf` / `balanceOf` | sat / UTXO 当前归属 |
| 数据位置 | 合约 storage、event、URI / IPFS | witness、OP_RETURN、inscription 数据 |
| 状态更新 | 合约调用 | UTXO 转移 + 索引器解析 |
| 主链是否理解 NFT | EVM 理解合约逻辑 | Bitcoin 不理解 NFT 概念 |
| 钱包依赖 | RPC + 合约 ABI / event | BTC 节点 + 协议索引器 |

一句话总结：

```text
Ethereum NFT 是合约资产
Bitcoin Ordinals 更像是被编号和追踪的特殊 UTXO 数据资产
```

# 钱包后端的启发

从钱包后端角度看，BTC 不能只当成“另一个 RPC”。

如果只是普通 BTC 收发，钱包重点是：

```text
地址生成
UTXO 查询
选币
找零
sat/vB 手续费
签名
广播
确认数
```

但如果要支持 Ordinals / Runes / BRC-20，还要多一层资产索引和 UTXO 保护：

```text
识别 inscription 所在 UTXO
避免把带 inscription 的 UTXO 当普通 BTC 找零花掉
识别 Rune / BRC-20 的资产余额
处理协议规则下的转移有效性
区分钱包 BTC 余额和协议资产余额
处理粉尘、找零和 UTXO 污染问题
```

这也是 BTC 钱包工程复杂的地方。

ETH 钱包可以问合约：

```text
balanceOf(address)
ownerOf(tokenId)
```

BTC 钱包则要问：

```text
哪些 UTXO 属于这个地址？
哪些 UTXO 携带 inscription？
这些 inscription / Rune / BRC-20 状态按哪个索引器规则计算？
这笔交易会不会误花掉特殊 UTXO？
```

所以 BTC 资产支持的难点，不只是交易构建，而是资产索引、UTXO 管理和协议规则解释。

# 最后总结

Bitcoin 区块里的交易，本质上都是 UTXO 交易。

普通交易是在花掉旧 UTXO，生成新 UTXO。

Coinbase 交易是矿工挖出新区块后，创建区块奖励 UTXO。

Ordinals、BRC-20、Runes 这些协议，并没有改变 Bitcoin 的底层模型。它们只是利用 Bitcoin 交易可以携带数据的能力，把额外信息写入链上，再由链下索引器解释成 NFT 或 Token 状态。

所以最终可以这样理解：

```text
Bitcoin 主链负责保存和验证 UTXO
Ordinals / Runes / BRC-20 负责定义数据规则
链下索引器负责解释这些数据
钱包和市场负责展示成 NFT / Token
```

Bitcoin 没有变成 Ethereum。

它仍然是 UTXO 系统。只是大家在 UTXO、witness、OP_RETURN 和索引器之上，构建出了一层额外的资产解释层。
