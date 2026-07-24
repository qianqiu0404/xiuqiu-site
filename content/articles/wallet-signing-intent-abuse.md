---
{
  "id": 33,
  "slug": "wallet-signing-intent-abuse",
  "kind": "engineering-note",
  "series": "钱包签名与基础设施安全",
  "seriesOrder": 1,
  "evidenceLevel": "source-reviewed",
  "evidenceSummary": "基于当前四服务边界、Bybit 官方事件时间线、EIP-712 与 OWASP API 安全模型整理；签名意图篡改与重放实验仍待接入四服务基线。",
  "title": "私钥没有离开签名机，资金为什么仍会被转走",
  "date": "2026-07-20",
  "summary": "交易所钱包真正要保护的不只是私钥字节，还包括签名能力、审批意图与恢复权限。本文沿 wallet-service、risk-service、wallet-api、wallet-sign 拆解外部攻击者如何把一笔未授权交易变成链上合法签名。",
  "tags": ["Web3", "Wallet", "Security", "Signer", "Risk Control"],
  "difficulty": "安全工程",
  "conceptTags": ["wallet-backend", "signer-service", "api-design", "go-infra"],
  "relatedProjectIds": [1, 5],
  "recommendedSlugs": [
    "wallet-sign-signer",
    "withdrawal-error-handling",
    "multi-chain-wallet-acceptance-loop",
    "cryptographic-nonce-key-leak",
    "mpc-tss-security-boundaries",
    "wallet-software-supply-chain"
  ],
  "suggestedQuestions": [
    "为什么私钥不泄露也可能发生未授权出金？",
    "风险审批怎样绑定到最终签名交易？",
    "wallet-sign 为什么不能只验证内部 Token 和 Digest？"
  ]
}
---

# 私钥没有离开签名机，资金为什么仍会被转走

保护私钥当然重要，但交易所钱包如果只保护私钥文件，仍然可能被攻击。

攻击者不一定要导出私钥。他只需要让签名系统对一笔恶意交易产生有效签名，链上就会把它视为正常授权。

2025 年 Bybit 公布的事件时间线显示，签署人看到的界面与实际交易内容发生了偏离，恶意交易改变了冷钱包的合约逻辑。这个案例提醒我：多签、硬件设备和冷钱包都不能替代对“最终到底签了什么”的独立验证。[Bybit 官方事件时间线](https://www.bybit.com/en/learn/this-week-in-bybit/bybit-security-incident-timeline)

# 钱包真正保护的是四种资产

```text
私钥材料：能否复制或重建 Key
签名能力：谁能请求 Sign
审批意图：这次签名被批准用于什么
恢复权限：谁能轮换、升级、降级或迁移 Key
```

只保护第一项是不够的。

如果攻击者拿不到 Key，却拿到了 Sign API 的长期 Token，他可能直接请求签名。如果 Signer 只验证“调用者来自内网”，不验证订单、审批和交易内容，它就会成为远程盲签服务。

如果审批内容与交易内容没有绑定，risk-service 批准的可能是“向地址 A 提现 1 ETH”，wallet-sign 实际签署的却是“向地址 B 转出全部资产”。每个服务单独看都返回成功，但组合起来已经越过了原始业务意图。

# 四服务中的授权链

我希望四个服务形成的不是普通调用链，而是一条不能静默改写的授权链：

```text
wallet-service
  产生订单事实与 request_id
        ↓
risk-service
  审批 chain、asset、amount、to、有效期与策略版本
        ↓
wallet-api
  获取链资源并确定性构建 unsigned transaction
        ↓
wallet-sign
  复核审批摘要与交易 Digest 后签名
        ↓
wallet-api
  验证签名、组装并广播同一笔交易
```

这条链路至少需要绑定：

```text
business_id
request_id
chain_id / network
asset / token
from / to
amount
fee policy
nonce / UTXO / object reference
unsigned transaction hash
approval version
expires_at
sign backend / key reference
```

EVM 可以借鉴 [EIP-712](https://eips.ethereum.org/EIPS/eip-712) 的结构化签名思想：Domain 和 Message 一起进入确定性 Hash。协议本身不会自动解决重放，所以业务还必须让 request_id、版本和有效期具备幂等语义。

# 外部攻击者可能从哪里进入

## 公网 API

攻击者首先看到的是公网入口，常见目标不是直接取 Key，而是：

- 冒充合法用户或业务方；
- 修改不属于自己的订单；
- 重复提交提现；
- 利用批量接口放大请求；
- 探测未下线的旧接口和调试接口。

这些问题对应 OWASP API Security Top 10 中的身份认证、对象级权限、敏感业务流和资源消耗风险。[OWASP API Security Top 10](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)

## 内部服务凭证

公网 API 被挡住后，攻击者可能转向内部 Token、CI Secret、服务账号或云 IAM。拿到一个内部身份后，他会尝试横向调用 risk、api 或 sign。

因此，内部网络不是授权依据。内部请求仍需要短期身份、明确 audience、服务权限、超时、限流和审计；签名请求还必须携带可复核的业务与审批证据。

## 交易构建与展示层

即使审批系统本身没有被绕过，攻击者也可能替换：

- 收款地址；
- Token 合约；
- Chain ID；
- 合约调用 Data；
- Safe implementation 或代理升级目标；
- BTC Output；
- Sui Move Call 与 Object。

因此，管理台展示的内容不能成为唯一确认通道。对于大额或高权限交易，应从另一条独立路径展示规范化交易摘要，让签署人确认最终 Digest 对应的真实语义。

# wallet-sign 不能只做三件事

下面三种检查仍然不够：

```text
Token 正确
keyRef 存在
Digest 长度正确
```

更完整的 Sign Policy 应该回答：

- 这个调用方是否可以使用该 Key；
- Key 是否允许这条链和这种操作；
- Digest 是否来自经过批准的 Canonical Payload；
- 审批是否仍有效、未使用且版本匹配；
- 金额、地址和合约调用是否触发额外审批；
- 当前 Signer Backend 是否符合策略；
- 相同 request_id 是否已经产生签名或链上结果。

签名机不需要维护用户余额，但它必须拒绝脱离授权上下文的任意签名。

# 先做六个失败实验

1. risk-service 批准后修改 `to`、`amount`、`chainId` 或 Token，签名必须失败；
2. 重放同一审批，只能返回幂等结果，不能产生第二次独立出金能力；
3. 只携带内部 Token 和任意 Digest 请求签名，必须拒绝；
4. wallet-api 组装 Raw Transaction 后重新计算 Digest，任何字段变化都必须失败；
5. risk-service、MPC 或 HSM 不可用时必须 Fail-closed，禁止自动降级到更弱后端；
6. 批量签名部分失败时，成功项与失败项的订单、审批和签名结果不能串位。

每个实验都应记录：订单事实、审批摘要、Unsigned Hash、签名请求、签名结果和最终广播 Hash。这样才能证明“签名正确”与“签名被正确授权”同时成立。

# 当前项目边界

当前项目已经验证 risk-service 的提现提交、离线交易一致性、审批 Hash 和幂等标记，也完成了 Local Signer 基线与独立三节点 TSS Keygen/Sign。

仍需要继续补齐的是：

- 四服务端到端的审批内容绑定实验；
- 内部身份的短期化和最小权限；
- 管理台与签名设备的独立交易展示；
- MPC/HSM 接入后的相同策略校验；
- 紧急轮换、暂停和恢复演练。

最终要保护的不是一个私钥文件，而是从业务意图到链上结果的整条授权链。
