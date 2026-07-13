---
{"slug":"wallet-lab-implementation","title":"Wallet Reliability Lab 状态机实现","capabilityIds":["request-idempotency","fund-state","risk-authorization","signer-boundary","broadcast-finality","reconciliation","observability"],"projectSlugs":["web3-wallet-engineer-lab"],"kind":"implementation","status":"verified","visibility":"public","summary":"公开 Go 项目包含钱包领域 API、六个异常恢复模型和共享场景目录，不接触真实私钥与资产。","verifiedAt":"2026-07-13","url":"https://github.com/qianqiu0404/web3-wallet-engineer-lab","failureSlugs":["duplicate-request-id","broadcast-result-unknown","chain-success-local-failure","credited-deposit-reorg","evm-nonce-gap","risk-signer-unavailable"],"deliverySlugs":["wallet-reliability-lab-v1"]}
---

代码实现与生产系统边界在仓库 README 中明确分开。
