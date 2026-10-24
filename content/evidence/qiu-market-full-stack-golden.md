---
{
  "slug": "qiu-market-full-stack-golden",
  "title": "Qiu Market 本地全链路集成记录",
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
  "status": "partial",
  "visibility": "private-summary",
  "summary": "2026-08-10 的隔离集成记录覆盖浏览器→HTTP/gRPC→真实一次性 PostgreSQL→虚拟撮合与账本，并在强制终止后用 snapshot + event tail 恢复同一 state hash。行情、研究与质量来源使用本地夹具；2026-10-24 仅核对记录，没有重跑。",
  "verifiedAt": "2026-08-10",
  "failureSlugs": [],
  "deliverySlugs": [],
  "articleSlugs": [
    "qiu-market-virtual-funds-recovery"
  ],
  "command": "make verify-full-stack-golden"
}
---

本地集成证明有界的技术链路。它不证明真实 provider 启用、外部数据许可、生产 OAuth、正式迁移、生产恢复或长期 soak；跨日 Owner Gate 仍待完成。
