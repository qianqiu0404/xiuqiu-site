---
{
  "slug": "exchange-wallet-implementation",
  "title": "历史四服务钱包工程边界",
  "capabilityIds": [
    "request-idempotency",
    "fund-state",
    "risk-authorization",
    "chain-resources",
    "signer-boundary",
    "broadcast-finality",
    "reconciliation",
    "observability"
  ],
  "projectSlugs": [
    "exchange-wallet-system"
  ],
  "kind": "implementation",
  "status": "partial",
  "visibility": "private-summary",
  "summary": "2026-07-13 的历史四服务材料定位了资金编排、风险审批、多链适配与签名边界；它不是当前 Wallet Infrastructure 的实现或验收记录。",
  "verifiedAt": "2026-07-13",
  "failureSlugs": [
    "duplicate-request-id",
    "broadcast-result-unknown",
    "chain-success-local-failure",
    "credited-deposit-reorg",
    "evm-nonce-gap",
    "risk-signer-unavailable"
  ],
  "deliverySlugs": []
}
---

这条记录保留旧四服务的历史含义。与当前钱包方向的关联仅用于阅读背景，不能作为当前 WIF 的代码、运行或本人贡献证据。
