---
{"slug":"wallet-lab-implementation","title":"Wallet Reliability Lab 交互与 Runner 实现","capabilityIds":["fund-state","risk-authorization","signer-boundary","broadcast-finality","reconciliation","observability"],"projectSlugs":["wallet-reliability-lab"],"kind":"implementation","status":"verified","visibility":"public","summary":"Vue 工作台通过 Runner run/action/SSE 接口运行三个提现场景，Runner 不可用时退回公开安全的浏览器确定性模拟。","verifiedAt":"2026-07-13","url":"https://github.com/qianqiu0404/wallet-reliability-lab","failureSlugs":["rpc-lag-rate-limit","chain-success-local-failure","long-pending-transaction"],"deliverySlugs":["wallet-reliability-lab-v1"]}
---

实现不保存资产、密钥或生产 RPC 地址。
