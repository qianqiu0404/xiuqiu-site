---
{"slug":"exchange-wallet-implementation","title":"Exchange Wallet Infrastructure 工程边界","capabilityIds":["request-idempotency","fund-state","risk-authorization","chain-resources","signer-boundary","broadcast-finality","reconciliation","observability"],"projectSlugs":["exchange-wallet-system"],"kind":"implementation","status":"partial","visibility":"private-summary","summary":"四个私有服务已定位资金编排、风险审批、多链适配与签名边界；网站只公开去敏后的代码事实和当前限制。","verifiedAt":"2026-07-13","failureSlugs":["duplicate-request-id","broadcast-result-unknown","chain-success-local-failure","credited-deposit-reorg","evm-nonce-gap","risk-signer-unavailable"],"deliverySlugs":[]}
---

私有工程只提供可复核摘要，不生成无效仓库链接。
