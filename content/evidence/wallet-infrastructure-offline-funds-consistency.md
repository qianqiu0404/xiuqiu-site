---
{
  "slug": "wallet-infrastructure-offline-funds-consistency",
  "title": "Wallet Infrastructure 离线资金一致性记录",
  "capabilityIds": [
    "fund-state",
    "signer-boundary",
    "broadcast-finality",
    "reconciliation",
    "observability"
  ],
  "projectSlugs": [
    "exchange-wallet-system"
  ],
  "kind": "test",
  "status": "partial",
  "visibility": "private-summary",
  "summary": "2026-10-21 的离线记录覆盖网络阻断后的签名与首次广播门、广播拒绝后保留冻结并继续观察原交易，以及重复处理不增加资金效果；完整本地 Gate 与独立复审有通过回执。2026-10-24 仅核对记录，未重跑；公开 Claim 保持 locked。",
  "verifiedAt": "2026-10-21",
  "failureSlugs": [],
  "deliverySlugs": [],
  "articleSlugs": [
    "cex-evm-wallet-deposit-withdrawal-loop",
    "wallet-ledger-transaction-mq-consistency"
  ]
}
---

该记录属于当前 WIF，与 7 月旧四服务证据分开。离线测试使用一次性 PostgreSQL 和签名/链替身，不证明真实提现、热钱包对账、历史已释放记录修复、人工复核恢复或充值重组补偿。未将本地 Console 合成浏览器记录视为实网能力。
