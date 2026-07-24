---
{
  "slug": "signing-intent-failure-experiment",
  "title": "签名意图不一致失败实验",
  "capabilityIds": ["risk-authorization", "signer-boundary"],
  "projectSlugs": ["exchange-wallet-system", "wallet-reliability-lab"],
  "kind": "demo",
  "status": "design",
  "visibility": "private-summary",
  "summary": "下一项实验将修改已审批交易的地址、金额、链或资产，验证 wallet-sign 必须拒签，并保持订单未签名、未广播且可审计。",
  "verifiedAt": "2026-07-24",
  "failureSlugs": ["authorization-replay-mismatch", "risk-signer-unavailable"],
  "deliverySlugs": [],
  "articleSlugs": ["wallet-signing-intent-abuse"]
}
---

当前只完成实验契约与验收条件设计；在公开 Lab 中可运行以前，不提升为部分验证或已验证。
