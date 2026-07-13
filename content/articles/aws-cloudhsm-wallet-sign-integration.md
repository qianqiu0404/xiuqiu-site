---
{"id":12,"slug":"aws-cloudhsm-wallet-sign-integration","kind":"engineering-note","evidenceLevel":"design","evidenceSummary":"HSM 尚未接入 wallet-sign；本文只记录目标架构、安全边界和失败策略。","title":"wallet-sign × AWS CloudHSM：签名后端架构设计","date":"2026-06-19","updatedAt":"2026-07-13","summary":"这是尚未实现的 HSM 目标架构：让 wallet-sign 保持稳定契约，由 hsm-gateway 收敛 PKCS#11、会话、审计和不可导出密钥边界。","tags":["Web3","Wallet","AWS","CloudHSM","HSM","Security"],"difficulty":"架构设计","conceptTags":["signer-service","wallet-backend","multi-chain","mpc-tss"],"relatedProjectIds":[1,5],"recommendedSlugs":["mpc-wallet-sign-integration","wallet-sign-signer","wallet-api-boundary","withdrawal-error-handling"],"suggestedQuestions":["HSM 如果接入 wallet-sign，安全边界会如何变化？","为什么需要 hsm-gateway 收敛 PKCS#11？","HSM 不可用时为什么不能降级到本地私钥？"]}
---

# wallet-sign × AWS CloudHSM：签名后端架构设计

> 证据边界：HSM 当前没有接入 `wallet-sign`。这里描述的是我为下一阶段整理的目标架构与验收条件，不是生产接入复盘。

# 要解决的问题

当前可验证基线是 Local Signer。它适合学习接口、签名格式和策略校验，但完整私钥仍处在应用可访问边界内。HSM 目标不是增加一个产品名，而是改变密钥的信任假设：私钥在硬件边界内生成和使用，应用只持有 key metadata，不能导出私钥。

# 目标调用链

```text
wallet-service / risk-service
  -> wallet-api 构建 unsigned transaction
  -> wallet-sign 校验审批与待签内容
  -> hsm-gateway 管理 PKCS#11 session 与错误语义
  -> CloudHSM 内部完成签名
```

`wallet-sign` 仍然是唯一签名服务边界。`hsm-gateway` 只负责把 PKCS#11、登录、session pool、key handle 和厂商错误码隔离起来，不承担提现审批或链上交易构建。

# 接口需要保持稳定

签名后端至少需要统一这些输入：`sign_request_id`、`key_id/key_version`、算法、待签摘要、审批哈希和调用方身份。输出包含签名、可审计的后端标识和错误类别，不返回任何私钥材料。

这样 Local、MPC/TSS 和 HSM 可以位于同一个 `SignerBackend` 契约之后，但“可切换”不等于“发生故障时可以降低安全等级”。

# 必须 fail-closed 的异常

- HSM 集群或 Crypto User 登录不可用；
- key handle、key version 或算法不匹配；
- 审批内容与待签交易不一致；
- session pool 耗尽或请求结果未知；
- 审计记录不能可靠落地。

这些场景下应暂停签名。不能为了可用性把同一密钥导出到本地，也不能静默切回 Local Signer。恢复应基于原 `sign_request_id`、相同 `key_version` 和相同 payload hash，并先确认旧请求是否已经产生签名。

# 实现前的验收清单

- 在隔离环境验证密钥生成、不可导出属性和签名校验；
- 对 session 断开、集群不可用和超时进行故障注入；
- 验证重复 `sign_request_id` 返回相同结果或稳定冲突；
- 验证审批哈希与 unsigned payload 不一致时拒签；
- 记录 key version、调用方、算法、payload hash 和结果，但不记录敏感明文；
- 明确备份、轮换、灾备和人工恢复流程。

# 当前结论

HSM 是 `wallet-sign` 的后端演进方向，不是新的业务服务。当前网站只把它标为生产设计；只有真实代码接入、故障测试和端到端验收完成后，证据等级才会升级。
