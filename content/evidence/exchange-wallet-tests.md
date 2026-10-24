---
{
  "slug": "exchange-wallet-tests",
  "title": "历史四服务局部测试基线",
  "capabilityIds": [
    "request-idempotency",
    "fund-state",
    "risk-authorization",
    "chain-resources",
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
  "summary": "2026-07-13 的旧四服务记录分别运行过 dispatcher、chain adaptor、RPC、risk approval 与幂等局部测试；未形成跨四服务一键基线，也不验证当前 WIF。",
  "verifiedAt": "2026-07-13",
  "command": "go test ./services ./services/grpc ./services/rpc ./chaindispatcher",
  "failureSlugs": [
    "duplicate-request-id",
    "broadcast-result-unknown",
    "chain-success-local-failure",
    "risk-signer-unavailable"
  ],
  "deliverySlugs": []
}
---

命令保留历史记录原意，不能在当前 WIF 仓库套用，也不等同于当前公开 CI 或实网验收。
