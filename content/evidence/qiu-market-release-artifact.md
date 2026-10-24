---
{
  "slug": "qiu-market-release-artifact",
  "title": "Qiu Market Server 可恢复交易基线",
  "capabilityIds": [
    "request-idempotency",
    "fund-state",
    "reconciliation",
    "observability"
  ],
  "projectSlugs": [
    "s78-market-services"
  ],
  "kind": "test",
  "status": "verified",
  "visibility": "private-summary",
  "summary": "2026-08-04 的历史基线完整 Go test 复验通过；已有去敏记录覆盖虚拟 BTC/USDT 撮合、available / held 双重记账、PostgreSQL 事件/快照/outbox、幂等与 state hash 恢复。该证据不包含真实资金或生产验收，本轮未重跑。",
  "verifiedAt": "2026-08-04",
  "command": "go test ./...",
  "failureSlugs": [],
  "deliverySlugs": [],
  "articleSlugs": [
    "qiu-market-virtual-funds-recovery"
  ]
}
---

保留 2026-08-04 的原始证据日期与本地验证含义；后续本地集成和公开读链路分别记录，不覆盖旧证据。私有版本标识不公开。
