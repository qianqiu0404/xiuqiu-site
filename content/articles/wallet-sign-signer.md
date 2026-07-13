---
{
  "id": 4,
  "slug": "wallet-sign-signer",
  "kind": "engineering-note",
  "evidenceLevel": "local-verified",
  "evidenceSummary": "Local Signer 与签名服务加固分支已验证；MPC/HSM 后端不计入已完成能力。",
  "title": "wallet-sign：多链签名机为什么要独立设计",
  "date": "2026-05-21",
  "summary": "从安全边界、私钥管理、离线签名、批量签名和多链差异角度，拆解签名机在钱包系统中的位置。",
  "tags": [
    "Wallet",
    "Signer",
    "Security",
    "Multi-chain"
  ],
  "readingTime": "12 min",
  "difficulty": "项目拆解",
  "conceptTags": [
    "signer-service",
    "wallet-backend",
    "multi-chain"
  ],
  "relatedProjectIds": [
    1,
    2,
    5
  ],
  "recommendedSlugs": [
    "wallet-api-boundary",
    "wallet-address-models"
  ],
  "suggestedQuestions": [
    "为什么签名机要从 API 层独立出来？",
    "签名服务如何降低私钥暴露风险？",
    "为什么 wallet-api 和 wallet-sign 之间适合用内部 RPC / gRPC？"
  ]
}
---

# 问题背景

签名机（Signer）是钱包系统中安全要求最高的组件。它负责一件事：用私钥对交易进行签名。但正是这个看似简单的操作，决定了钱包系统的安全边界。为什么要把签名能力单独拆分出来，而不是直接在 API 层签名？这是理解 wallet-sign 设计的关键。

# 核心概念

签名机解决的是"私钥能力如何安全使用"的问题。它不是业务服务，更像一个能力服务：

- 输入：待签名的交易数据
- 处理：校验请求合法性，找到对应的密钥材料
- 输出：返回签名结果

签名机不应该做太多业务逻辑。它不应该关心交易是否合理、金额是否合法、链是否正常——这些是 API 层的职责。

## 为什么签名机要独立

- 降低攻击面：API 层面向公网，签名机只暴露给受信任的内部服务
- 隔离私钥相关逻辑：私钥的加载、缓存、使用全部在签名机内部完成
- 权限边界更清晰：API 层拿到的是签名结果，不是签名能力
- 方便审计和限流：签名操作需要严格审计，API 层的普通请求不需要这么高规格的审计

# 放到我的项目里怎么理解

## 多链签名差异

不同链的签名逻辑差异巨大，这是签名机设计时必须面对的复杂性：

### BTC
- UTXO 模型：交易由输入和输出组成
- 需要处理找零地址
- SIGHASH 类型决定签名的覆盖范围
- PSBT（部分签名比特币交易）支持多签协作

### ETH
- 账户模型：交易结构包含 nonce、gasPrice、gasLimit、to、value、data
- EIP-1559 引入 maxPriorityFeePerGas 和 maxFeePerGas
- chainId 防止跨链重放攻击
- 签名使用 secp256k1 椭圆曲线

### Solana
- 使用 Ed25519 签名算法
- recentBlockhash 替代 nonce
- 交易由指令（instructions）组成
- 需要处理 ATA（关联代币账户）地址

### Cosmos
- 使用 Tendermint 共识
- account number 和 sequence 控制重放
- fee 和 memo 字段需要处理

# 关键调用链

```
wallet-api → gRPC SignTransaction(request)
  → wallet-sign gRPC Server
    → 请求鉴权（内部 Token 验证）
    → 校验请求参数和签名内容
    → Signer Module
      → 根据 chainId 获取对应链的签名器
      → 从 Key Storage 获取私钥
      → 执行签名逻辑
      → 返回签名结果
    → 审计日志记录
  → 返回签名后的交易
```

## 为什么内部调用更适合 RPC / gRPC

`wallet-api` 对外暴露 HTTP，是因为前端、管理台和外部调用方更适合使用 JSON、状态码、鉴权 Header 和清晰的资源路径。

但 `wallet-api` 调用 `wallet-sign` 时，调用语义已经不是“访问一个网页资源”，而是“请求一次内部签名能力”：

```text
SignTransaction(chainId, unsignedTx, keyRef)
SignDigest(chainId, digest, keyRef)
GetPublicKey(keyRef)
```

这类调用天然接近 RPC。gRPC 的价值不在于“比 HTTP 高级”，而在于它适合内部服务之间定义强类型契约：proto 明确字段、Go 代码自动生成、调用方式接近本地函数，也更容易给签名能力加超时、审计、限流和内部鉴权。

所以这里的技术选择不是为了炫技，而是为了表达安全边界：

```text
公网 HTTP:
  面向用户请求和业务语义

内部 gRPC:
  面向签名能力和强类型契约

签名机:
  只暴露给受信任的内部服务
```

如果把 `wallet-sign` 的 gRPC 接口直接暴露给公网，或者让前端直接传待签名内容给签名机，就等于绕过了 `wallet-api` 的风控、参数校验和业务状态机。

# 工程设计取舍

## 批量签名策略

- 串行批量：简单但吞吐有限，适合低频场景
- 并发签名：需要控制 goroutine 数量，避免资源耗尽
- 签名任务天然适合按请求隔离，每条签名请求互不依赖

## 安全边界设计

- 私钥不能出签名机：签名结果返回给调用方，私钥始终在签名机内部
- 签名请求要鉴权：不是谁都能调用签名机
- 重要操作要审计：谁在什么时间签了什么交易，必须有记录
- 签名内容要可验证：签名机返回的结果应该能被调用方验证
- 防止任意消息签名：签名机应该验证被签名的内容是否合理

# 常见坑

- API 层直接处理私钥。这是最严重的错误，等于把资产安全交给公网接口
- 签名机暴露给公网。签名机应该只在内部网络可达
- 把内部 gRPC 当成外部开放 API。签名能力必须经过 wallet-api 的业务校验和风控编排
- 不校验签名内容。签名机应该拒绝明显不合理的签名请求
- 批量签名无并发限制。大量签名请求同时到达可能导致资源耗尽或死锁
- 错误信息泄露敏感细节。签名失败的原因如果包含私钥状态信息，等于主动暴露安全细节

# 可继续深入的方向

- HSM（硬件安全模块）集成：从软件签名到硬件签名的升级路径
- 多签和 MPC（多方计算）签名的设计差异
- 签名请求的限流和优先级策略：提现签名应该比普通签名有更高的优先级
- 签名机的灾备设计：签名机挂了怎么办？如何做热备？
