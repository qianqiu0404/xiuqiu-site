---
{
  "slug": "multichain-wallet-acceptance",
  "title": "多链钱包本地与测试网验收摘要",
  "capabilityIds": ["fund-state", "chain-resources", "signer-boundary", "broadcast-finality", "reconciliation"],
  "projectSlugs": ["exchange-wallet-system", "wallet-core"],
  "kind": "test",
  "status": "partial",
  "visibility": "private-summary",
  "summary": "Exchange Wallet 的 Base、Solana 与 BNB 链路完成本地验收，BTC adaptor 完成 Testnet4 验证；原生 Sui Testnet 结果属于 wallet-core 及相关链实验，不代表 Exchange Wallet 已接入 Sui。结果覆盖链适配、状态推进和部分幂等检查，但不等于生产规模或安全审计。",
  "verifiedAt": "2026-07-20",
  "failureSlugs": ["broadcast-result-unknown", "credited-deposit-reorg", "evm-nonce-gap", "bitcoin-utxo-conflict", "sui-object-version-lock"],
  "deliverySlugs": [],
  "articleSlugs": ["multi-chain-wallet-acceptance-loop"]
}
---

公开证据来自已发布的工程复盘与去敏验收结论；未公开测试网地址、密钥、账户、节点配置或私有运行记录。
