---
{
  "id": 40,
  "slug": "qiu-market-virtual-funds-recovery",
  "kind": "engineering-note",
  "evidenceLevel": "local-verified",
  "evidenceSummary": "基于 Qiu Market 已审核的本地提交与测试记录：BTC/USDT 虚拟撮合、available/held 双重记账、PostgreSQL 事件/快照/outbox、幂等重试与 state hash 恢复已验证；不代表真实资金、实盘交易或生产部署。",
  "title": "虚拟资金也要守账：Qiu Market 的撮合、双重记账与确定性恢复",
  "date": "2026-07-28",
  "summary": "Qiu Market 不连接真实资金，但仍用资金系统的标准约束一个 BTC/USDT 虚拟交易纵切片：整数金额、available/held、借贷平衡、串行撮合、事务事件流、结果未知停机和 state hash 恢复。",
  "tags": [
    "Go",
    "Exchange",
    "Ledger",
    "PostgreSQL",
    "Recovery"
  ],
  "difficulty": "项目拆解",
  "conceptTags": [
    "go-infra",
    "api-design",
    "wallet-backend"
  ],
  "relatedProjectIds": [
    3
  ],
  "recommendedSlugs": [
    "market-services-data-flow",
    "wallet-ledger-transaction-mq-consistency",
    "http-rpc-grpc"
  ],
  "suggestedQuestions": [
    "为什么虚拟资金系统也需要双重记账和不可变分录？",
    "提交结果未知时为什么 MarketRunner 必须停止接单？",
    "事件流、快照、投影和 outbox 在恢复中分别负责什么？"
  ]
}
---

# 虚拟资金也要守账：Qiu Market 的撮合、双重记账与确定性恢复

> 证据边界：本文基于 Qiu Market 已审核本地基线 `7df9001` 及其中的测试与验收记录。项目只使用虚拟资金，当前分支没有合并到共享 `origin/main`。本文不代表真实充值提现、私钥托管、真实交易所下单、实盘资产、生产 HFT、公开 Preview、容量或长期稳定性验收。

# 为什么虚拟交易仍要按资金系统设计

虚拟资金不会造成真实资产损失，但如果系统允许负余额、重复成交、账本不平或重启后状态变化，它也无法证明撮合与资金控制流是正确的。

Qiu Market 把范围收窄为一个单用户、单市场纵切片：

```text
市场：BTC-USDT
资金：只允许显式虚拟入金
订单：Limit / Market，GTC / IOC / FOK / Post Only
状态：available / held
持久化：PostgreSQL event stream / snapshot / outbox / projection
接口：loopback gRPC + 共享 HTTP / WebSocket
```

明确排除真实充值、提现、私钥、真实交易所订单和实盘资金，让工程验证集中在撮合、账本、幂等与恢复。

# 金额先变成整数，再进入账本

交易系统不能用 `float64` 表示资产：

```text
1 BTC  = 100,000,000 base atoms
1 USDT =   1,000,000 quote atoms
Price  = 一枚完整 BTC 对应的 USDT atoms
```

买单冻结按最坏价格向上取整，实际成交按成交价向下结算；价格改善、取消和未成交余量再释放。乘除使用检查溢出的整数运算。

这不是性能技巧，而是账务语义。`0.1 + 0.2` 的浮点误差不能进入资金不变量，网络边界也必须用十进制字符串表达金额、价格、数量和 sequence。

# available / held 表达资金义务

账户余额拆为：

```text
available：还可以被新订单使用
held：已经为 open order 锁定
```

下单不是直接扣减总余额，而是把最坏义务从 available 转入 held。成交后按实际价格和费用结算，取消或剩余量再释放。

项目用不可变的双重记账分录描述每次变化。每个资产的一笔 ledger transaction 中，借贷和必须为零；虚拟入金也不是直接改余额，而是由 treasury 对手账户产生显式分录。

当前实现持续检查：

- available 和 held 不能为负；
- 每笔分录按资产平衡；
- open order 的 held 必须覆盖剩余最坏义务；
- 重复 transaction ID 不能再次改变余额；
- 同一业务幂等键配不同 payload 必须拒绝。

这些约束让余额不仅是页面上的数字，而是可以从 journal 重建和审计的资金状态。

# 单市场串行化换取确定性

`BTC-USDT` 由唯一 `MarketRunner` 接收命令。它使用一个 goroutine、有界队列和严格递增的 market sequence。

调用路径可以简化为：

```text
浏览器 session / CSRF / Origin / rate limit
  ↓
共享 HTTP API
  ↓ loopback gRPC
MarketRunner
  ↓
Exchange：幂等、冻结、订单簿、撮合、费用
  ↓
Ledger：不可变借贷分录
  ↓
PostgreSQL：event batch + ledger + outbox + projections
```

串行执行牺牲了单市场的并行吞吐，但换来了更容易证明的 sequence、同价 FIFO、状态变更顺序和确定性重放。对教学型纵切片，这比提前包装成高吞吐撮合引擎更重要。

# 先试算，事务成功后再改变正式内存

每条命令先在克隆状态中完成：

1. 幂等键和订单规则检查；
2. available / held 冻结；
3. 价格时间优先撮合；
4. Maker / Taker 费用计算；
5. 事件、账本和投影增量生成。

随后 PostgreSQL 在同一个显式事务中：

- CAS 更新 stream sequence；
- 写 event batch；
- 写 ledger entries；
- 写 outbox；
- 更新订单、成交、余额和 checkpoint 投影。

只有事务确定成功，试算状态才会进入正式内存。

如果数据库提交结果未知，runner 不会假设失败并继续接单，也不会盲目重放命令。它先停止接受新命令，再从持久化事件流恢复。这样可以避免数据库已经提交、内存却再次执行同一资金效果。

# 事件是真值，投影可以重建

核心持久化对象的职责不同：

| 数据 | 职责 |
| --- | --- |
| event batch | 命令、结果、journal、投影增量和 state hash，作为最终真值 |
| snapshot | 某个 sequence 的完整状态与 hash，加速恢复 |
| order / trade / balance | 查询投影，可以从事件重建 |
| outbox | 与业务事务一起写入的待发布事件 |
| event feed | WebSocket 与轮询使用的持久化 cursor 流 |
| checkpoint | 记录 publisher 和 projection 已推进到的位置 |

启动时先校验 snapshot 的 schema version 和 state hash，再重放后续 event batch，并重新计算命令结果、账本和最终 hash。任何损坏或不一致都会 fail closed，不能忽略 hash 后继续提供下单。

每 100 条命令和优雅退出时保存快照。恢复完成且状态一致以后，runner 才重新 ready。

# 幂等键绑定一次操作意图

交易命令使用下面的幂等范围：

```text
market_id + account_id + operation + request_id
```

同一幂等键与同一 payload 返回原结果，不产生第二批事件；相同幂等键配不同订单参数则拒绝。

这让 HTTP timeout 后的正确动作变成“复用原 request ID 查询或重试”，而不是生成新 ID 再下一个看起来相同的订单。

# 本地验证覆盖了什么

已审核基线中的测试与记录覆盖：

- 虚拟入金、hold、release 后 available / held 正确；
- 不平衡分录和余额不足被拒绝，失败不改变余额；
- 重复 ledger transaction 被拒绝；
- PostgreSQL 中完成虚拟入金、挂单、成交、费用、取消和快照；
- 从 snapshot 与 event stream 恢复后 sequence 和 state hash 一致；
- 删除可重建投影后，能够从事件重新生成订单、成交、余额和 checkpoint；
- 相同订单请求重试返回原 sequence，不增加事件记录；
- outbox 发布到持久化 feed 后保持 cursor 顺序；
- stale writer 遇到 stream sequence 冲突时不能写入新资金事实；
- 本地浏览器记录覆盖虚拟入金、挂单、成交、费用、撤单、WebSocket 与交易重启恢复。

这些证据支持 `local-verified`，但不能升级为下面的声明：

- 系统处理过真实资金或真实用户资产；
- 已接入充值、提现、私钥或真实交易所下单；
- 当前分支已经 push、merge 或成为共享生产基线；
- 已完成公开 Preview、真实 OAuth 回调和生产迁移；
- 已通过容量、低延迟、备份恢复、监控告警或长期 soak；
- 这是生产级 CEX 或 HFT 撮合引擎。

# 结论

虚拟资金不是降低正确性标准的理由，而是隔离风险、验证资金模型的边界。

Qiu Market 用单市场串行执行、整数金额、available / held、不可变双重记账、事务事件流、幂等键和 state hash 恢复，构成一个可解释的交易系统纵切片。它证明的是本地工程控制流和恢复不变量，不是真实交易或生产运行经验。
