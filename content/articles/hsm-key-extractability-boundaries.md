---
{
  "id": 36,
  "slug": "hsm-key-extractability-boundaries",
  "kind": "engineering-note",
  "series": "钱包签名与基础设施安全",
  "seriesOrder": 4,
  "evidenceLevel": "source-reviewed",
  "evidenceSummary": "依据 AWS CloudHSM 官方 Key Attribute 与 Key Management 文档整理；当前项目尚未接入 HSM，本文是接入前安全设计与验收门禁。",
  "title": "HSM 接入以后，密钥就一定不可导出吗",
  "date": "2026-07-20",
  "summary": "HSM 能把签名运算和密钥材料隔离在硬件边界中，但 Key Attribute、Crypto User、Wrapping、应用权限和任意签名策略仍会决定真实安全性。本文给出 wallet-sign 接入 HSM 前需要验证的工程门禁。",
  "tags": ["Web3", "Wallet", "HSM", "CloudHSM", "Security"],
  "difficulty": "架构设计",
  "conceptTags": ["signer-service", "wallet-backend", "mpc-tss", "api-design"],
  "relatedProjectIds": [1, 5],
  "recommendedSlugs": [
    "aws-cloudhsm-wallet-sign-integration",
    "wallet-signing-intent-abuse",
    "cryptographic-nonce-key-leak",
    "mpc-tss-security-boundaries",
    "wallet-sign-signer",
    "wallet-software-supply-chain"
  ],
  "suggestedQuestions": [
    "HSM 中的 Key 为什么仍要检查 extractable 属性？",
    "密钥不可导出为什么仍不能阻止任意签名？",
    "wallet-sign 接入 HSM 时应该保留哪些业务边界？"
  ]
}
---

# HSM 接入以后，密钥就一定不可导出吗

HSM 的核心价值，是让密钥生成、保存和密码学运算发生在受保护的硬件边界中。应用把 Digest 交给 HSM，HSM 返回 Signature，私钥字节不需要进入普通应用内存。

但“使用了 HSM”不等于“密钥一定不可导出”，也不等于“资金一定不会被签走”。

真实安全性还取决于：

```text
Key Attribute
HSM 用户与权限
Wrap / Unwrap 策略
应用主机和客户端凭证
Sign Policy
审计、限流与恢复流程
```

# 先理解 Key Attribute

以 AWS CloudHSM 为例，官方文档区分了多种属性：

- `extractable`：Key 是否允许被导出；
- `never-extractable`：Key 是否从未处于可导出状态；
- `sensitive`：是否按敏感 Key 处理；
- `sign`：是否允许执行签名；
- `wrap / unwrap`：是否允许包装或解包其他 Key；
- `trusted / wrap-with-trusted`：是否限制可信包装路径；
- `local`：Key 是否在 HSM 内生成。

AWS 的 [CloudHSM Key Management Best Practices](https://docs.aws.amazon.com/cloudhsm/latest/userguide/bp-hsm-key-management.html) 明确说明，Key 可以被标记为 extractable 或 non-extractable；可导出 Key 可以通过 Wrapping 导出，而 non-extractable Key 不能导出。

更需要注意的是，[CloudHSM CLI Key Attributes](https://docs.aws.amazon.com/cloudhsm/latest/userguide/cloudhsm_cli-key-attributes-table.html) 当前文档显示 `extractable` 默认值可能为 True。这说明“创建成功”不能作为验收结果，系统必须读取并记录实际属性。

# 不可导出不等于不可滥用

即使 Key 是严格 non-extractable，攻击者如果控制了一个有 `SIGN` 权限的 HSM Client，仍可能不断请求 HSM 对恶意 Digest 签名。

这种情况下：

```text
私钥没有离开 HSM
密码学运算完全正确
链上签名也完全有效
但业务授权已经失效
```

因此 HSM 只能替换 wallet-sign 内部的 Key Backend，不能替代 risk-service、审批 Hash、Sign Policy 和业务状态机。

# hsm-gateway 应该收敛什么

直接让 wallet-sign 的每个业务分支调用 PKCS#11，会让 HSM 会话、错误码和权限散落在代码中。我更倾向于在 wallet-sign 内部增加稳定的 HSM Backend 或 hsm-gateway：

```text
wallet-sign Sign Policy
→ hsm-gateway
  → 身份与 Key Alias
  → Session Pool
  → PKCS#11 Sign
  → Signature 格式转换
  → 审计与指标
```

它需要收敛：

- 业务 `keyRef` 到 HSM Key Handle 的映射；
- Chain、Curve、Algorithm 与 Key Attribute 校验；
- HSM Session 生命周期和连接池；
- 限流、超时和重试分类；
- DER、Recovery ID、Ed25519 等签名格式；
- HSM Audit 与钱包 request_id 的关联。

它不应该决定提现是否合理，也不应该拥有绕过 wallet-sign Policy 的独立公网接口。

# HSM 还存在哪些攻击面

## HSM Client 主机

攻击者可能控制 wallet-sign 或 hsm-gateway 主机，窃取 Client 配置、Crypto User 凭证或当前 Session。Key 可能仍不可导出，但签名能力已经暴露。

## 管理员与 Crypto User

管理员负责集群和用户，Crypto User 负责 Key 操作。角色分离如果只存在于账号名称、实际由同一个人或同一凭证控制，安全边界仍是单点。

## Wrapping 与迁移

为了备份或跨集群迁移，系统可能启用 Key Wrapping。Wrapping Key 的权限、可信属性和保管方式会成为新的高价值边界。

## Session 与资源耗尽

攻击者不一定追求出金，也可能耗尽 HSM Session、连接或签名吞吐，让全部提现停摆。限流和容量保护应位于 wallet-sign 与 HSM Client 两侧。

## 审计缺口

只记录“HSM Sign 成功”不够。还需要知道是哪个业务请求、哪份审批、哪个 Key、哪个算法和哪个 Digest 触发了这次签名。

# 接入前的验收门禁

1. Key 必须在 HSM 内生成，并验证 `local`；
2. 生产签名 Key 明确设为 non-extractable，并验证 `never-extractable`；
3. 禁止不必要的 decrypt、derive、wrap 和 unwrap 权限；
4. wallet-sign 只能使用允许的 Key Alias，不能枚举或任意选择 Key；
5. 签名前仍要验证订单、审批和 Canonical Digest；
6. HSM 不可用时 Fail-closed，不降级到 Local Key；
7. Session、超时、限流和错误分类有自动化测试；
8. Key 创建、属性变更、Sign、Wrap、用户变更全部进入独立审计；
9. 灾备集群和备份恢复保持相同 Key Policy；
10. 定期运行“尝试导出必须失败”的负向验收。

# 当前项目边界

HSM 目前尚未接入 wallet-sign，所以本文不能标记为已实现能力。当前可以确定的是目标边界：

```text
wallet-service / risk-service：业务与审批
wallet-api：交易构建与广播
wallet-sign：统一 Sign Policy
HSM Backend：不可导出 Key 与密码学运算
```

接入完成的标准不应该是“成功调用一次 Sign”，而应该同时证明 Key 属性、业务授权、错误恢复、不安全降级禁止和完整审计。
