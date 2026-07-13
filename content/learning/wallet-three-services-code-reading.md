---
{
  "id": 1,
  "slug": "wallet-three-services-code-reading",
  "kind": "learning-log",
  "publish": true,
  "title": "Exchange Wallet Infrastructure 代码导读",
  "date": "2026-07-10",
  "summary": "沿 wallet-service、risk-service、wallet-api、wallet-sign 的真实调用路径，区分资金编排、风险控制、节点能力与签名安全边界。",
  "projectIds": [1, 2],
  "achieved": [
    "定位 API 与 Sign 两套 IChainAdaptor 的职责差异",
    "梳理 ChainDispatcher、工厂和 registry 的运行时关系",
    "追踪充值与提现中的 worker、状态持久化和通知路径"
  ],
  "evidence": [
    "完成钱包基础设施代码入口索引",
    "验证 risk-service 的提现校验、审批哈希与幂等标记单测",
    "记录 context、channel、Bloom 与事务的当前代码边界",
    "为关键模块整理可复现的 go test 命令"
  ],
  "reflection": [
    "多链抽象不能抹平 UTXO、nonce、blockhash 等资源差异",
    "RPC 超时只代表结果未知，不能直接触发重复出金",
    "设计目标必须与当前代码事实分开表达"
  ],
  "nextSteps": [
    "验证请求级 context 是否完整传播到节点调用",
    "补充 consumer 提前退出时 producer 可取消的测试",
    "继续追踪资金状态条件更新与重启恢复"
  ]
}
---

这是一条经过筛选的公开学习记录。原始逐行笔记与私人计划仍保留在本地 Obsidian。
