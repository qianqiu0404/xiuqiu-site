---
{
  "id": 6,
  "slug": "wallet-address-models",
  "kind": "engineering-note",
  "evidenceLevel": "local-verified",
  "evidenceSummary": "wallet-core 的多链地址派生与网络参数测试提供本地证据。",
  "title": "BTC、ETH、Solana 地址生成与签名模型对比",
  "date": "2026-05-27",
  "summary": "对比 UTXO 模型、账户模型、HD 钱包路径、地址格式和不同链的签名逻辑差异，理解多链钱包为什么需要抽象。",
  "tags": [
    "BTC",
    "ETH",
    "Solana",
    "Multi-chain"
  ],
  "readingTime": "12 min",
  "difficulty": "进阶",
  "conceptTags": [
    "multi-chain",
    "signer-service",
    "wallet-backend"
  ],
  "relatedProjectIds": [
    1,
    2
  ],
  "recommendedSlugs": [
    "wallet-api-boundary",
    "wallet-sign-signer"
  ],
  "suggestedQuestions": [
    "BTC、ETH、Solana 的地址和签名模型有什么差异？",
    "多链钱包为什么不能用一套交易模型硬套所有链？"
  ]
}
---

# 问题背景

多链钱包开发中最容易踩的坑，就是把所有链当成同一种账户模型来理解。BTC 用 UTXO 模型，ETH 用账户模型，Solana 用账户/公钥模型——这三种模型在地址生成、交易构建和签名流程上的差异，直接决定了 wallet-api 和 wallet-sign 中 Chain Adapter 的设计思路。

# 核心概念

## BTC：UTXO 模型

BTC 没有"余额"概念。一个地址的余额是所有未花费输出（UTXO）的总和。交易由输入和输出组成：

- 输入：引用一个已有的 UTXO
- 输出：创建一个新的 UTXO，包含收款地址和金额
- 找零：输入总额大于输出部分，需要创建找零输出回到发送方

地址类型：
- P2PKH（Legacy）：以 1 开头
- P2SH-P2WPKH（Nested SegWit）：以 3 开头
- P2WPKH（Native SegWit）：以 bc1 开头
- Taproot：以 bc1p 开头

HD 钱包路径示例：m/44'/0'/0'/0/0（BIP44）或 m/84'/0'/0'/0/0（BIP84）

## ETH：账户模型

ETH 使用账户模型，每个地址有一个余额和一个 nonce。交易直接修改账户状态：

- 发送方减少余额
- 接收方增加余额
- nonce 递增防止重放和保证交易顺序

地址从 secp256k1 公钥中取 keccak256 哈希的最后 20 字节，前面补 0x。HD 钱包路径：m/44'/60'/0'/0/0

关键概念：
- nonce：交易计数器，从 0 开始递增
- gas：交易执行的计算成本
- EIP-1559：引入基础费用和优先费用，取代原来的 gasPrice
- chainId：防止交易在不同链上被重放

## Solana：账户/公钥模型

Solana 使用 Ed25519 签名算法，地址直接是公钥的 Base58 编码。交易由指令（instructions）组成，每个指令包含程序 ID、账户列表和指令数据。

关键概念：
- recentBlockhash：代替 nonce，用于防止重放和交易过期
- instructions：交易的执行单元
- ATA（关联代币账户）：SPL Token 的持有方式

# 对钱包后端设计的影响

## 地址生成模块必须按链适配

每条链的地址生成算法不同。不能用一个函数生成所有链的地址。Chain Adapter 中的地址生成方法应该按链实现：

- BTC：根据公钥和地址类型生成不同格式的地址
- ETH：公钥取 keccak256 后 20 字节
- Solana：公钥编码为 Base58

## 交易构建不能统一成一种结构

BTC 需要构建输入输出列表、找零地址和手续费估算。ETH 需要 nonce、gas、data 字段。Solana 需要 instructions 和 recentBlockhash。强行统一只会让代码变得难以维护。

## 签名逻辑必须链隔离

不同链的签名算法不同：BTC 和 ETH 使用 secp256k1（ECDSA），Solana 使用 Ed25519。签名机的内部实现需要为每条链提供独立的签名器。

## 数据流差异

```
BTC 余额查询：
  调用链节点 → 获取地址的所有 UTXO → 汇总金额

ETH 余额查询：
  调用链节点 → 获取地址的余额和 nonce

Solana 余额查询：
  调用链节点 → 获取账户的 lamports 余额
```

# 常见坑

- 把所有链都当 ETH 账户模型处理。BTC 的 UTXO 模型完全不同于账户模型
- 忽略 BTC 找零。构建 BTC 交易时如果忘记找零，多余的金额会被矿工拿走
- 忽略 nonce/sequence。ETH 的 nonce 不连续会导致交易卡死
- 不区分签名算法。用 secp256k1 去签 Solana 的交易
- HD 路径写错。不同链的 coin type 不同，路径不对会导致地址不一致

# 可继续深入的方向

- 多链地址格式转换：如何统一管理不同链的地址显示
- EIP-712 结构化签名在 DApp 中的使用
- BTC Taproot 升级对签名模型的影响
- Solana 版本化交易和查找表的机制
