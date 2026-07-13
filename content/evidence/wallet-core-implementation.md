---
{"slug":"wallet-core-implementation","title":"wallet-core TypeScript 多链实现","capabilityIds":["chain-resources","signer-boundary"],"projectSlugs":["wallet-core"],"kind":"implementation","status":"verified","visibility":"public","summary":"公开 TypeScript 库覆盖 EVM、Bitcoin、Solana、TRON、Cosmos 与 Sui，并显式保留 nonce、UTXO、blockhash、TAPOS、sequence 和对象版本。","verifiedAt":"2026-07-13","url":"https://github.com/qianqiu0404/wallet-core","failureSlugs":["evm-nonce-gap"],"deliverySlugs":["wallet-core-public-v1"]}
---

库只负责离线构建和签名，不承担 RPC、资源锁定、广播和账务。
