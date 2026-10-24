---
{
  "id": 1,
  "slug": "wallet-three-services-code-reading",
  "kind": "learning-log",
  "publish": true,
  "title": "历史四服务钱包代码导读",
  "date": "2026-07-10",
  "summary": "2026 年 7 月的历史导读：沿 wallet-service、risk-service、wallet-api、wallet-sign 的调用路径，区分资金编排、风险控制、节点能力与签名边界；不作为当前 WIF 的实现说明。",
  "projectIds": [
    1,
    2
  ],
  "achieved": [
    "定位 API 与 Sign 两套 IChainAdaptor 的职责差异",
    "梳理 ChainDispatcher、工厂和 registry 的运行时关系",
    "追踪充值与提现中的 worker、状态持久化和通知路径"
  ],
  "evidence": [
    "历史材料中的钱包基础设施代码入口索引",
    "当时记录的 risk-service 提现校验、审批哈希与幂等标记单测",
    "当时记录的 context、channel、Bloom 与事务代码边界",
    "历史 go test 命令只适用于原四服务基线，不验证当前 WIF"
  ],
  "reflection": [
    "多链抽象不能抹平 UTXO、nonce、blockhash 等资源差异",
    "RPC 超时只代表结果未知，不能直接触发重复出金",
    "设计目标必须与当前代码事实分开表达"
  ],
  "nextSteps": [
    "阅读时先确认是历史四服务还是当前 WIF 的代码与版本",
    "历史待验证问题继续保留为问题，不自动写成当前已掌握或已完成",
    "当前 WIF 的充值、Ledger、Outbox 与提现证据另行跟踪"
  ]
}
---

保留原始学习日期。2026-10-24 只澄清历史适用范围，没有重新运行原四服务测试，也没有确认本人掌握度。
