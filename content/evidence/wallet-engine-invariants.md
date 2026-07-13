---
{"slug":"wallet-engine-invariants","title":"Wallet Domain Engine 资金不变量","capabilityIds":["request-idempotency","fund-state","risk-authorization","signer-boundary","broadcast-finality","reconciliation"],"projectSlugs":["web3-wallet-engineer-lab"],"kind":"test","status":"verified","visibility":"public","summary":"Go 测试断言重复请求只冻结一次、结果未知必须暂停、canonical 补偿幂等、reorg 使用反向分录、replacement 只有一个终态以及关键依赖 fail-closed。","verifiedAt":"2026-07-13","command":"go test -race ./...","url":"https://github.com/qianqiu0404/web3-wallet-engineer-lab/actions","failureSlugs":["duplicate-request-id","broadcast-result-unknown","chain-success-local-failure","credited-deposit-reorg","evm-nonce-gap","risk-signer-unavailable"],"deliverySlugs":["wallet-domain-engine-v1"]}
---

断言针对确定性领域模型，不代表生产系统认证。
