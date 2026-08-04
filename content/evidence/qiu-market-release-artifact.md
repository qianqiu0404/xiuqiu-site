---
{
  "slug": "qiu-market-release-artifact",
  "title": "Qiu Market Server 可恢复交易基线",
  "capabilityIds": ["request-idempotency", "fund-state", "reconciliation", "observability"],
  "projectSlugs": ["s78-market-services"],
  "kind": "test",
  "status": "verified",
  "visibility": "private-summary",
  "summary": "release artifact 72343ba 的完整 Go test 于 2026-08-04 重新通过；已有去敏记录覆盖虚拟 BTC/USDT 撮合、available / held 双重记账、PostgreSQL 事件/快照/outbox、幂等与 state hash 恢复。该证据不包含真实资金或生产验收。",
  "verifiedAt": "2026-08-04",
  "command": "go test ./...",
  "failureSlugs": [],
  "deliverySlugs": [],
  "articleSlugs": ["qiu-market-virtual-funds-recovery"]
}
---

Market Server 的目标完成形态与当前验证层级分开表达：这条记录证明本地可恢复的交易核心，不证明真实交易、生产容量或长期可用性。
