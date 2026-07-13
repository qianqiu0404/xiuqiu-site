---
{"id":11,"slug":"mpc-wallet-sign-integration","kind":"engineering-note","evidenceLevel":"design","evidenceSummary":"独立三节点 TSS Keygen/Sign 已本地验证；MPC 作为 wallet-sign 后端的接入尚未完成。","title":"wallet-sign × MPC/TSS：已验证能力与接入设计","date":"2026-06-19","updatedAt":"2026-07-13","summary":"独立三节点 TSS Keygen/Sign 已在本地验证；本文设计它如何作为 wallet-sign 后端接入，并明确当前尚未完成端到端整合。","tags":["Web3","Wallet","MPC","TSS","wallet-sign","Security"],"difficulty":"架构设计","conceptTags":["mpc-tss","signer-service","wallet-backend","multi-chain"],"relatedProjectIds":[1,5],"recommendedSlugs":["wallet-sign-signer","wallet-api-boundary","wallet-address-models","withdrawal-error-handling"],"suggestedQuestions":["MPC/TSS 目前真正验证到了哪一步？","为什么 MPC 应位于 wallet-sign 后方？","接入完成前还缺哪些验收证据？"]}
---

# wallet-sign × MPC/TSS：已验证能力与接入设计

> 证据边界：我已经在独立 TSS 项目完成三节点 Keygen / Sign 的本地验证，但它尚未成为 `wallet-sign` 可用的端到端后端。本文将已验证事实与接入目标分开。

# 已经验证的部分

独立三节点环境能够完成分布式 Keygen，并在满足门限时共同产生可验证签名。这证明我已经运行和理解 committee、threshold、key share 与多轮协议的基本流程。

它没有证明以下事情已经完成：

- `wallet-sign` 已稳定调度 TSS 节点；
- 审批凭证已经与 TSS sign session 绑定；
- 节点离线、消息重复、超时和中断恢复已经通过故障测试；
- key share 备份、轮换、灾备和生产审计已经实现。

# 为什么放在 wallet-sign 后方

```text
wallet-service -> 资金状态与业务编排
risk-service   -> 风险校验与审批凭证
wallet-api     -> 链级资源、交易构建和广播
wallet-sign    -> 签名请求校验与后端选择
  -> Local Signer（当前基线）
  -> MPC/TSS（接入中）
  -> HSM（下一阶段设计）
```

MPC 改变的是密钥持有与签名生成方式，不应让 wallet-service 或 wallet-api 感知 committee、round message 和 key share。稳定的 `SignerBackend` 契约可以阻止协议细节扩散到业务层。

# 接入时必须绑定的事实

一个 TSS sign session 不能只接收任意 hash。它需要绑定：

- `sign_request_id` 与提现 attempt；
- 审批凭证和 canonical payload hash；
- key id、key version、committee 与 threshold；
- 算法、链类型和预期公钥；
- 每轮会话状态、参与节点和最终签名结果。

重复请求必须返回原结果或稳定冲突。结果未知时应暂停并查询原 session，不能创建另一个可能同时完成的签名会话。

# 不可用时的边界

节点不足、key share 异常或门限无法满足时，提现应 fail-closed。不能降低 threshold，也不能临时拼回完整私钥。Local Signer 只能作为明确隔离的开发基线，不能作为生产故障降级路径。

# 接入完成的验收条件

- `wallet-sign` 能通过统一接口选择 TSS backend；
- 三节点 Keygen/Sign 在服务调用链内完成，而不是只在独立 demo；
- 重复 request、节点离线、轮次超时和恢复测试通过；
- 签名与预期公钥、unsigned payload、审批哈希一致；
- 审计记录可追踪但不暴露 key share；
- Local 与 TSS 的能力状态在配置和页面上不会被混淆。

# 当前结论

现阶段准确说法是：“独立三节点 TSS 已验证，wallet-sign 接入中”。等统一接口、失败恢复和端到端测试完成后，网站再把证据等级从架构设计升级为集成验证。
