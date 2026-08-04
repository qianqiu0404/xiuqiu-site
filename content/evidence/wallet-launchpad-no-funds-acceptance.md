---
{
  "slug": "wallet-launchpad-no-funds-acceptance",
  "title": "Wallet Launchpad 多链无资金验收门",
  "capabilityIds": ["fund-state", "chain-resources", "signer-boundary", "broadcast-finality", "reconciliation"],
  "projectSlugs": ["exchange-wallet-system", "wallet-launchpad"],
  "kind": "test",
  "status": "verified",
  "visibility": "private-summary",
  "summary": "Base Sepolia 原生 ETH、Base / BNB WLT 与 Bitcoin Testnet4 已分别通过 clean 本地无资金 Gate，覆盖链和资产身份、原生手续费、nonce / UTXO 资源、scanner finality、签名前置条件与幂等恢复；它不包含注资、真实广播或生产验收。",
  "verifiedAt": "2026-08-04",
  "command": "./script/base-sepolia-native-eth-no-funds-e2e.sh && ./script/evm-base-bnb-no-funds-e2e.sh && ./script/bitcoin-testnet4-no-funds-e2e.sh",
  "failureSlugs": ["broadcast-result-unknown", "evm-nonce-gap", "bitcoin-utxo-conflict"],
  "deliverySlugs": [],
  "articleSlugs": []
}
---

这条证据只证明各链在隔离环境中的无资金工程门。页面不会据此宣称 funded testnet、真实 TSS、staging 或生产运行已经完成。
