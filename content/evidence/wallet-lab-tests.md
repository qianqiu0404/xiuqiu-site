---
{"slug":"wallet-lab-tests","title":"Wallet Reliability Lab Runner 与状态机测试","capabilityIds":["fund-state","broadcast-finality","reconciliation","observability"],"projectSlugs":["wallet-reliability-lab"],"kind":"test","status":"verified","visibility":"public","summary":"前端测试验证场景事实与确定性推进，Go race 测试覆盖单播放器、暂停/重置代次、SSE 续传、并发取消和本地地址脱敏。","verifiedAt":"2026-07-13","command":"npm test && go test -race ./...","url":"https://github.com/qianqiu0404/wallet-reliability-lab/actions","failureSlugs":["rpc-lag-rate-limit","chain-success-local-failure","long-pending-transaction"],"deliverySlugs":["wallet-reliability-lab-v1"]}
---

测试验证确定性模型和运行协议，不声称复现真实生产事故。
