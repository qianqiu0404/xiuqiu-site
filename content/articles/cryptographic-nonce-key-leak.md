---
{
  "id": 34,
  "slug": "cryptographic-nonce-key-leak",
  "kind": "engineering-note",
  "evidenceLevel": "source-reviewed",
  "evidenceSummary": "依据 RFC 6979、RFC 8032 与当前 BTC/Sui 签名测试整理；未在项目中实现自定义密码学算法，也不把规范阅读视为生产安全审计。",
  "title": "一笔签名如何暴露长期密钥：随机数、Nonce 与实现边界",
  "date": "2026-07-20",
  "summary": "ECDSA 和 EdDSA 的安全不仅依赖私钥存储，还依赖每次签名的临时量、Digest、序列化和实现正确性。本文结合 BTC/EVM 与 Sui/Solana，解释为什么签名库不能自行拼装，以及应如何用测试守住密码学边界。",
  "tags": ["Web3", "Wallet", "Cryptography", "ECDSA", "Ed25519"],
  "difficulty": "安全工程",
  "conceptTags": ["signer-service", "wallet-backend", "multi-chain"],
  "relatedProjectIds": [1, 7],
  "recommendedSlugs": [
    "wallet-signing-intent-abuse",
    "wallet-sign-signer",
    "wallet-address-models",
    "multi-chain-wallet-resource-state",
    "mpc-tss-security-boundaries",
    "hsm-key-extractability-boundaries"
  ],
  "suggestedQuestions": [
    "为什么 ECDSA 的签名 Nonce 不能重复？",
    "Ed25519 不依赖外部随机数是否等于实现不会泄露密钥？",
    "钱包项目应该自己实现签名算法吗？"
  ]
}
---

# 一笔签名如何暴露长期密钥：随机数、Nonce 与实现边界

钱包工程里有两种容易混淆的 nonce。

```text
链上资源 Nonce：EVM 账户交易序号，用于排序和防重放
签名算法 Nonce：签名过程中使用的临时秘密量
```

前者冲突通常导致交易替换、Pending 或拒绝；后者如果生成或使用错误，可能直接破坏长期私钥安全。

# ECDSA 为什么依赖每次签名的临时量

BTC、EVM 和 TRON 常使用 secp256k1/ECDSA。ECDSA 每次签名都会使用一个临时秘密量，通常记作 `k`。

这个值必须满足两个条件：

- 对外不可预测；
- 不得在不同消息之间重复使用。

如果同一私钥对不同消息重复使用相同的 `k`，两份公开签名会共享关键关系，攻击者可能由此恢复临时量并进一步推导长期私钥。

如果 `k` 虽然没有完全重复，但随机源存在偏差、熵不足或泄露部分信息，也可能逐渐削弱密钥安全。

[RFC 6979](https://www.rfc-editor.org/rfc/rfc6979) 给出了确定性 DSA/ECDSA：从私钥和消息 Hash 确定性地产生临时量，减少外部随机数生成失败带来的风险。它的重点不是“固定使用同一个 nonce”，而是同一密钥对不同消息得到不同、不可由外部预测的结果。

# Ed25519 不需要外部随机数，但仍有实现边界

Sui 和 Solana 常使用 Ed25519。按照 [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032)，EdDSA 的签名临时量由私钥派生材料和消息共同计算，不要求每次调用系统随机数。

这降低了传统随机数生成器失效的风险，但不代表任何 Ed25519 实现都天然安全。实现仍可能在以下位置出错：

- 私钥派生材料被错误截断或复用；
- 消息、Prehash 或 Context 处理不一致；
- 自行修改标准算法；
- 依赖库或构建产物被替换；
- 侧信道暴露中间值；
- 把 Seed、Expanded Key 和普通私钥格式混用；
- 日志打印签名输入之外的敏感材料。

因此，“Ed25519 是确定性的”不能成为跳过实现审计和测试向量的理由。

# Digest 错了，正确签名也没有意义

签名算法只保证“这个 Key 对这些 Bytes 产生了有效 Signature”。它不知道 Bytes 是否代表正确业务。

多链钱包必须明确每条链的签名对象：

| 链 | 典型签名对象 | 容易混淆的边界 |
| --- | --- | --- |
| EVM | RLP 或 Typed Transaction Hash | chainId、Typed Tx Prefix、合约 calldata |
| BTC | 对应 Input 的 SIGHASH | Script 类型、Prevout 金额、SIGHASH Flag |
| Solana | Serialized Message | recent blockhash、账户列表、Instruction |
| Sui | Intent Message / Transaction Digest | Intent Scope、BCS Bytes、Object Reference |

如果 wallet-api 和 wallet-sign 对 Digest 的定义不同，可能出现签名永远无法验证，也可能出现更危险的情况：系统验证了某个 Hash，却没有验证它对应的业务交易。

# 为什么不要自己实现密码学

钱包项目可以自己实现业务编排和链适配，但不应该为了方便自行重写 ECDSA、Ed25519 或底层大数运算。

更稳妥的边界是：

```text
业务代码：定义交易与授权语义
链适配器：按协议生成 Canonical Bytes / Digest
成熟密码学库：执行 Sign / Verify
测试向量：证明序列化与签名结果符合规范
```

即使使用成熟库，也要固定版本、检查依赖来源，并用官方或公开标准测试向量验证升级前后的行为。

# 项目中应该建立哪些验证

## 标准测试向量

对固定私钥与固定消息，验证公钥、Digest 和 Signature 与规范向量一致。升级密码学依赖时必须重跑。

## 交叉实现验证

由 wallet-sign 产生签名，再使用另一套可信实现或链 SDK 验证。这样可以发现“自己签、自己验，所以错误保持一致”的问题。

## Digest 边界测试

- 只改变 Chain ID，Digest 必须变化；
- 只改变金额或地址，Digest 必须变化；
- BTC 改变 Prevout Amount 或 SIGHASH 类型，验证必须失败；
- Sui 改变 Intent Scope 或 Transaction Bytes，验证必须失败；
- 非预期长度、空消息和非法编码必须拒绝。

## 敏感输出扫描

测试日志、panic、CI Artifact、Coverage 和 Benchmark 输出都不应包含：

```text
助记词
Seed
Private Key
Expanded Secret
TSS Share
HSM 导出材料
```

## 失败后不重用中间状态

签名失败、超时或服务重启后，不应复用来源不明的临时量、MPC Round 状态或部分签名。恢复必须由明确的 Session 和协议规则驱动。

# 当前验证与边界

当前 BTC 路径已经验证规范 DER 签名，Sui 路径已经验证 Ed25519 Digest 签名与非法非 Digest 消息拒绝。这些测试说明链适配和格式边界开始清晰，但不等于完成了密码学实现审计。

下一步可以增加：

1. RFC 与链官方测试向量；
2. 两套独立实现之间的签名交叉验证；
3. 依赖升级前后的 Golden Fixture；
4. 日志、Core Dump 和构建 Artifact 的敏感材料扫描；
5. MPC Session 中间状态与失败恢复测试。

密钥安全不只是“私钥放在哪里”，还包括每一笔签名如何生成临时量、如何定义 Digest，以及实现是否始终符合协议。
