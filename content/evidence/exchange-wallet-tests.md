---
{"slug":"exchange-wallet-tests","title":"四服务局部测试基线","capabilityIds":["request-idempotency","fund-state","risk-authorization","chain-resources","signer-boundary","broadcast-finality","reconciliation","observability"],"projectSlugs":["exchange-wallet-system"],"kind":"test","status":"partial","visibility":"private-summary","summary":"dispatcher、chain adaptor、RPC、risk approval 与幂等相关测试已分别运行；跨四服务的一键基线仍在整理。","verifiedAt":"2026-07-13","command":"go test ./services ./services/grpc ./services/rpc ./chaindispatcher","failureSlugs":["duplicate-request-id","broadcast-result-unknown","chain-success-local-failure","risk-signer-unavailable"],"deliverySlugs":[]}
---

命令来自当前私有仓库验证记录，不等同于公开 CI。
