---
{"slug":"wallet-lab-tests","title":"Wallet Reliability Lab Go 断言","capabilityIds":["request-idempotency","fund-state","risk-authorization","signer-boundary","broadcast-finality","reconciliation","observability"],"projectSlugs":["web3-wallet-engineer-lab"],"kind":"test","status":"verified","visibility":"public","summary":"Go 测试断言重复请求只冻结一次、结果未知必须暂停、canonical 补偿幂等、reorg 写反向分录、replacement 只有一个终态以及关键依赖 fail-closed。","verifiedAt":"2026-07-13","command":"go test ./...","url":"https://github.com/qianqiu0404/web3-wallet-engineer-lab/actions","failureSlugs":["duplicate-request-id","broadcast-result-unknown","chain-success-local-failure","credited-deposit-reorg","evm-nonce-gap","risk-signer-unavailable"],"deliverySlugs":["wallet-reliability-lab-v1"]}
---

测试验证确定性模型，不声称复现过真实生产事故。
