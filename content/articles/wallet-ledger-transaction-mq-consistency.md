---
{
  "id": 32,
  "slug": "wallet-ledger-transaction-mq-consistency",
  "kind": "engineering-note",
  "evidenceLevel": "design",
  "evidenceSummary": "基于钱包后端资金状态、幂等和异常恢复问题整理的架构设计说明；不代表生产事故复盘，也不表示数据库、MQ 与补偿链路已经完成端到端集成验证。",
  "title": "资金系统一致性：从余额冻结、数据库事务到 MQ 幂等",
  "date": "2026-07-20",
  "summary": "以一笔提现为主线，区分链上资产与业务负债，解释本地事务、条件更新、request_id 幂等、Transactional Outbox、结果未知重试和可审计补偿如何共同守住资金一致性。",
  "tags": [
    "Web3",
    "Wallet",
    "Ledger",
    "Transaction",
    "MQ",
    "Backend"
  ],
  "difficulty": "架构设计",
  "conceptTags": [
    "wallet-backend",
    "go-infra",
    "api-design"
  ],
  "relatedProjectIds": [
    1,
    8,
    10
  ],
  "recommendedSlugs": [
    "withdrawal-error-handling",
    "cex-evm-wallet-deposit-withdrawal-loop",
    "wallet-api-boundary",
    "market-services-data-flow"
  ],
  "suggestedQuestions": [
    "数据库事务能保证哪些资金一致性，又不能跨过哪些服务边界？",
    "为什么同一个 request_id 的金额变化必须拒绝，而不是覆盖或重新执行？",
    "Transactional Outbox 如何处理数据库提交与 MQ 投递之间的失败窗口？"
  ]
}
---

# 一笔提现背后的三个事实世界

余额冻结、数据库事务、MQ、幂等键和人工调账看起来是不同问题，实际上都在处理同一个目标：一笔资金业务只能产生一份可解释、可恢复、可审计的最终事实。

钱包后端同时面对三个事实世界：

| 事实层 | 记录什么 | 典型标识 | 回答的问题 |
| --- | --- | --- | --- |
| 链上资产 | 地址、交易和区块确认 | address、txHash、block height | 平台控制的资产在链上发生了什么 |
| 业务账本 | 用户负债、冻结和资金分录 | account、ledger entry、business id | 平台欠谁多少钱，资金为什么变化 |
| 服务事件 | 跨服务需要继续处理的业务事实 | event_id、request_id | 哪个已提交事实需要被下游处理 |

这三层有关联，但不能相互替代。地址余额不能直接当成用户余额，MQ 消息不能代替已提交的数据库记录，一次接口 timeout 也不能证明对方没有执行。

# 链上余额不等于用户余额

充值地址只是链上入金入口，不是用户业务账户本身。地址可能被归集、共享或轮换，资金进入平台后也可能转移到热钱包或冷钱包。

例如，用户向地址 A 充值 100 USDT，平台确认入账后把币归集到热钱包 H：

```text
地址 A 链上余额 = 0
用户业务余额     = 100
```

这并不矛盾。用户业务余额表示平台对用户的负债；地址余额表示某个链上地址当前控制的资产。平台应该在资产负债层面对账，而不是把某个用户历史充值地址的余额简单相加。

```text
链上托管资产 + 其他清算资产
    对照
用户负债汇总 + 手续费负债 + 运营调整
```

因此，用户余额必须从受控的 ledger 和账户聚合得出，充值地址只提供链上事实与入账证据。

# 提现冻结没有减少用户总负债

账户通常至少区分可用余额和冻结余额：

```text
total = available + locked
```

用户申请提现 300 前后可以表示为：

| 阶段 | available | locked | total | 业务含义 |
| --- | ---: | ---: | ---: | --- |
| 提现前 | 1000 | 0 | 1000 | 全部可用 |
| 冻结后 | 700 | 300 | 1000 | 300 不可重复使用，但平台仍欠用户 |
| 提现完成 | 700 | 0 | 700 | 出金事实确定，平台负债减少 |
| 提现失败并解冻 | 1000 | 0 | 1000 | 资金重新可用 |

所以“提现申请后 balance 为什么不变”首先是口径问题。如果 balance 表示 total，它就不应在冻结时下降；如果表示 available，它应当下降。字段名不能代替业务定义，接口和报表必须明确返回的是 available、locked 还是 total。

# 本地数据库事务守住最小原子边界

一笔提现冻结通常至少涉及四类写入：

- 创建或确认提现订单。
- 把账户资金从 available 转入 locked。
- 写入不可变的资金流水。
- 写入待发布的 outbox 事件。

这些写入应进入同一个本地数据库事务：

```sql
BEGIN;

INSERT INTO withdrawal_order (
  request_id, user_id, asset, amount, payload_hash, status
) VALUES (
  :request_id, :user_id, :asset, :amount, :payload_hash, 'FROZEN'
);

UPDATE account_balance
SET available = available - :amount,
    locked = locked + :amount,
    version = version + 1
WHERE user_id = :user_id
  AND asset = :asset
  AND available >= :amount;

-- 必须断言上面的 UPDATE 恰好影响一行

INSERT INTO ledger_entry (
  entry_id, business_id, user_id, asset, entry_type, amount
) VALUES (
  :entry_id, :request_id, :user_id, :asset, 'WITHDRAW_FREEZE', :amount
);

INSERT INTO outbox_event (
  event_id, aggregate_id, event_type, payload, publish_status
) VALUES (
  :event_id, :request_id, 'WITHDRAWAL_FROZEN', :event_payload, 'PENDING'
);

COMMIT;
```

任何一步失败都回滚，避免出现“有订单没冻结”“冻结了没流水”或“数据库没有事实但下游已经开始执行”。这里的事务边界只覆盖同一个数据库中的操作，不会自动覆盖 MQ broker、远程风控服务或链节点。

# 把 ACID 翻译成资金语义

ACID 不是背诵题，它对应四种直接的资金风险控制。

| 特性 | 在提现冻结中的含义 | 仍需业务层补充什么 |
| --- | --- | --- |
| Atomicity | 订单、余额、流水和 outbox 同时提交或同时回滚 | 正确划定同一业务事实的写入集合 |
| Consistency | 提交后仍满足余额非负、流水唯一、状态合法等约束 | 唯一索引、检查约束、状态机和会计不变量 |
| Isolation | 并发请求不能重复消费同一份 available | 条件更新、行锁、CAS 和冲突后的重新读取 |
| Durability | COMMIT 成功后，服务重启仍能恢复事实 | 备份、复制、恢复演练和持久化配置 |

数据库不会自动理解“同一个 request_id 不得改变金额”，也不会自动判断某个终态是否符合链上事实。事务提供机制，业务约束决定机制要守护什么。

# 并发冻结应依赖原子条件，而不是先查后改

危险做法是先查询 available，在应用内判断余额充足，再执行更新。两个并发事务可能同时读到 500，并分别尝试冻结 400。

更稳妥的做法是让余额条件成为同一条 UPDATE 的一部分：

```sql
UPDATE account_balance
SET available = available - :amount,
    locked = locked + :amount,
    version = version + 1
WHERE user_id = :user_id
  AND asset = :asset
  AND available >= :amount;
```

第一个事务更新并锁定目标行后，第二个事务必须基于最新值重新判断条件。最终只能有一个请求影响一行，另一个请求得到零行。

订单状态推进也应使用 CAS 风格的条件：

```sql
UPDATE withdrawal_order
SET status = 'PAID',
    version = version + 1
WHERE request_id = :request_id
  AND status = 'FROZEN'
  AND version = :expected_version;
```

这种写法避免旧 worker 把新状态覆盖掉，也让并发冲突表现为明确的零行结果。

# UPDATE 返回零行不是“自动成功”

零行只表示当前没有记录满足更新条件，必须重新读取并分类。

| 重新读取结果 | 可能含义 | 处理方式 |
| --- | --- | --- |
| 已是目标状态 | 重复消费或前一次执行已成功 | 按幂等成功返回原结果 |
| 合法的其他终态 | 业务已取消、拒绝或失败 | 返回真实终态，不继续推进 |
| 仍在其他中间态 | 并发竞争、旧 version 或前置状态改变 | 停止当前动作，按最新状态重新决策 |
| 记录不存在 | 请求未创建、路由条件错误或数据缺失 | 报错并调查，不能伪装成成功 |
| 状态组合非法 | 数据损坏或代码违反状态机 | 暂停自动处理并告警 |

对零行结果一概返回成功，会隐藏请求丢失和状态异常；一概返回失败，又会破坏安全重试。正确动作来自当前事实，而不是影响行数本身。

# request_id 绑定的是业务意图

request_id 不是一个可随意复用的重试编号，它应该稳定地标识一次业务意图。服务应把关键请求字段规范化后计算 payload hash，例如：

```text
canonical payload = user_id + asset + amount + destination + operation_type
idempotency key   = request_id + hash(canonical payload)
```

处理规则应固定为：

| request_id 状态 | payload 是否一致 | 处理结果 |
| --- | --- | --- |
| 不存在 | 不适用 | 创建业务并执行 |
| 已存在 | 一致 | 返回原订单和原结果，不再次产生资金效果 |
| 已存在 | 不一致 | 拒绝、告警并保留冲突证据 |

相同 request_id、不同 amount 说明幂等键被错误复用，也可能表示请求在链路中被篡改。覆盖旧金额会改写历史，按新请求执行会重复冻结，直接返回旧成功又会掩盖参数冲突。因此唯一安全的默认行为是拒绝并告警。

数据库层应使用 request_id 唯一约束收敛并发创建，再读取已有记录比较 payload hash。不能只依赖“先 SELECT 看是否存在”，因为两个请求仍可能同时通过查询。

# 数据库事务和 MQ 不共享提交边界

直接在数据库事务中先发送 MQ，再提交数据库，会产生幽灵事件：

```text
Service          Database            MQ             Consumer
   | BEGIN           |                |                 |
   | write freeze -->|                |                 |
   | send event --------------------->| deliver ------->|
   | COMMIT -------->| fails          |                 | starts payout
   | ROLLBACK        |                |                 |
```

MQ 已经被消费，但本地冻结回滚，下游可能处理一笔没有本地资金事实的订单。

反过来，先提交数据库再发送 MQ 也有窗口：数据库已提交，服务却在发送前崩溃，导致冻结长期没有进入下游。

| 顺序 | 故障点 | 不一致结果 |
| --- | --- | --- |
| 先 MQ，后 COMMIT | MQ 成功后数据库回滚 | 下游收到不存在或未冻结的业务事件 |
| 先 COMMIT，后 MQ | 数据库成功后服务崩溃 | 本地已冻结但下游永远收不到事件 |

本地事务无法凭空把外部 broker 变成同一个原子资源。要么引入明确的分布式事务协议及其成本，要么把跨边界问题改造成可重试、可去重的最终一致性流程。

# Transactional Outbox 把“待发送”变成本地事实

Outbox 的核心不是多一张表，而是让业务事实和“应该发布的事件”在同一数据库事务中共同提交。

```text
请求线程
  BEGIN
    创建订单
    冻结余额
    写资金流水
    写 outbox(PENDING)
  COMMIT

Outbox Relay
  读取 PENDING
  -> 发布 MQ
  -> 标记 SENT

Consumer
  检查 event_id / business_id
  -> 未处理：在本地事务中记录 inbox 并执行业务
  -> 已处理：返回原结果，不重复产生资金效果
```

Relay 在“发布成功、标记 SENT 前”崩溃时会重复发布。因此 Outbox 通常把消息语义变成至少一次，而不是自动实现传输层的恰好一次。

系统真正需要的是“业务效果恰好一次”：消息可以重复到达，但冻结、扣款、状态推进和通知记录不能重复产生。消费者应使用 event_id 或稳定 business_id 建立唯一约束，并在同一个本地事务中写 inbox/消费记录和业务结果。

# 跨服务 timeout 表示结果未知

服务 A 调用服务 B 冻结资金时发生 timeout，只能说明 A 没有及时收到响应：

```text
A 发送 request_id=REQ-001
-> B 成功冻结并提交
-> 响应在网络中丢失
-> A 观察到 timeout
```

此时如果 A 换成 REQ-002，B 会把它当成新的业务意图，可能第二次冻结。正确恢复路径是：

- 使用 REQ-001 查询处理状态。
- 或携带完全相同的参数，用 REQ-001 幂等重试。
- 如果参数与原记录不一致，拒绝并告警。
- 在确认原请求未产生资金事实前，不创建新的业务 ID。

这条规则不仅适用于冻结，也适用于签名、广播、扣款和人工补偿。通信失败与业务失败必须使用不同的状态和错误码表达。

# 人工调账必须新增补偿事实

直接修改余额会让系统失去解释能力：无法知道在修正哪一笔事件、是否已经修过、为什么修、由谁批准，也无法从流水重算账户。

正确方式是保留原流水，并新增引用原事件的补偿分录：

```text
原流水
  entry_id       = L001
  business_id    = REQ-001
  entry_type     = WITHDRAW_DEBIT
  amount         = -100

补偿流水
  entry_id       = L002
  business_id    = ADJ-001
  reference_id   = L001
  entry_type     = MANUAL_COMPENSATION
  amount         = +100
  reason_code    = DUPLICATE_DEBIT_RECOVERY
```

补偿动作还应记录审批人、操作者、时间、理由和证据引用，并通过唯一约束防止同一原流水、同一补偿类型被执行两次。资金历史不应被悄悄覆盖，而应通过新的相反事实进行纠正。

# 七类问题的统一处置矩阵

| 观察到的现象 | 不能直接假设 | 正确判断与动作 |
| --- | --- | --- |
| 用户充值地址余额之和变化 | 用户业务余额同步变化 | 以 ledger 负债为用户余额，链上资产单独对账 |
| 提现申请后 total 不变 | 冻结失败 | 检查 available 是否转入 locked |
| 同 request_id、不同 amount | 可以作为重试覆盖 | 拒绝、告警并保留 payload 冲突证据 |
| 状态 UPDATE 返回零行 | 一定成功或一定失败 | 重读订单，按当前状态分类 |
| MQ 已发送 | 数据库一定提交 | 用本地事务写 outbox，提交后异步投递 |
| 跨服务调用 timeout | 对方一定没执行 | 查询或使用原 ID 幂等重试 |
| 余额需要人工修正 | 可以直接 UPDATE | 新增引用原流水的补偿分录 |

# 架构评审时应守住的资金不变量

- 用户余额来自业务 ledger，不来自历史充值地址余额相加。
- available 与 locked 的迁移不改变 total，最终扣款或解冻必须与订单终态一致。
- 一个 request_id 只对应一组规范化关键参数。
- 订单、余额、流水和 outbox 在同一个本地事务中共同提交。
- 条件 UPDATE 影响零行后必须重读事实，不能猜测结果。
- MQ、RPC 和链节点调用都可能重复、延迟或结果未知，所有资金动作必须幂等。
- 重试复用原业务 ID；新 ID 表示新的业务意图。
- 账务修正追加补偿分录并引用原事件，不覆盖资金历史。
- 对账无法解释的差异必须暂停自动处理并进入人工复核。

数据库事务解决的是单个数据库里的原子性；Outbox 和消费者幂等解决的是跨系统的可恢复交付；ledger 与补偿分录解决的是资金事实的解释和重算。只有把三者连成一条链路，提现系统才不仅能在正常路径上工作，也能在超时、重试、并发和部分失败之后恢复到唯一、可审计的结果。
