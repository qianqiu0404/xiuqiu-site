---
{
  "id": 29,
  "slug": "erc4337-useroperation-lifecycle",
  "kind": "engineering-note",
  "evidenceLevel": "source-reviewed",
  "evidenceSummary": "协议与实现路径学习笔记，不代表线上 ERC-4337 生产接入。",
  "title": "ERC-4337 工程拆解：一笔 UserOperation 如何验证、支付 Gas 并进入链上",
  "date": "2026-07-07",
  "summary": "从钱包后端视角拆解一笔 UserOperation 如何经过 nonce 分配、账户签名、Bundler 模拟、Paymaster 验证、EntryPoint 执行和 Gas 结算，并说明账户抽象为什么没有消除状态机。",
  "tags": [
    "Web3",
    "Wallet",
    "ERC-4337",
    "Account Abstraction",
    "Bundler",
    "Paymaster"
  ],
  "difficulty": "项目拆解",
  "conceptTags": [
    "wallet-backend",
    "signer-service",
    "api-design",
    "evm"
  ],
  "relatedProjectIds": [
    1,
    2
  ],
  "recommendedSlugs": [
    "multi-chain-wallet-resource-state",
    "wallet-api-boundary",
    "wallet-sign-signer",
    "eip-erc-protocol-evolution",
    "wallet-evolution-2026",
    "withdrawal-error-handling"
  ],
  "suggestedQuestions": [
    "UserOperation 已经签名，为什么 Bundler 还需要模拟验证？",
    "ERC-4337 的 nonce key 和 sequence 如何支持并行操作？",
    "Paymaster 支付 Gas 后，钱包后端需要记录哪些资金状态？"
  ]
}
---

# ERC-4337 工程拆解：一笔 UserOperation 如何验证、支付 Gas 并进入链上

理解 ERC-4337 时，我最初很容易把它简化成一句话：智能账户构建一笔 `UserOperation`，用户签名，再由 Bundler 帮忙上链。

这句话没有错，但它隐藏了真正重要的工程问题。

```text
用户完成签名
!= Bundler 接受
!= EntryPoint 验证通过
!= 目标调用执行成功
```

签名只能证明某套账户规则认可了这次操作。它没有回答 nonce 是否仍然有效、谁承担 Gas、Paymaster 是否接受、验证依赖的链上状态是否变化，也没有证明目标合约最终执行成功。

因此，ERC-4337 并没有消除钱包后端状态机。它把一笔普通交易背后原本相对固定的验证过程，拆成了智能账户、Bundler、EntryPoint、Paymaster 和链上执行之间的协作。

这篇文章沿着一笔 USDC 转账走完全程，重点回答三个问题：

```text
UserOperation 已经签名，为什么还要模拟？
谁授权操作，和谁支付 Gas，有什么区别？
钱包后端应该保存哪些中间状态？
```

# 从用户意图到链上执行

假设用户想通过智能账户转出 100 USDC，并由 Paymaster 赞助 Gas。

从用户界面看，这可能只有一次确认。但在系统内部，它会经过一条更长的链路：

```text
用户确认转出 100 USDC
-> wallet-service 创建业务订单
-> wallet-api 构建 UserOperation
-> 查询 nonce key / sequence
-> wallet-sign 签署 userOpHash
-> 提交给 Bundler
-> Bundler 离链模拟验证
-> 进入 UserOperation mempool
-> Bundler 打包 handleOps
-> EntryPoint 执行验证阶段
-> 智能账户调用 USDC 合约
-> EntryPoint 结算实际 Gas
-> wallet-service 根据 receipt 推进订单状态
```

这里真正进入以太坊区块的，不是 UserOperation 本身。

Bundler 会收集一个或多个 UserOperation，构建一笔调用 `EntryPoint.handleOps()` 的普通链上交易。EntryPoint 再逐项验证和执行这些操作。

所以 UserOperation 更像一份等待基础设施验证和打包的操作请求，而不是另一种可以直接发送给区块生产者的普通交易。

# UserOperation 究竟承诺了什么

UserOperation 的字段很多，但可以先按职责分成四组。

| 分组 | 典型内容 | 解决的问题 |
| --- | --- | --- |
| 身份与防重放 | `sender`、`nonce` | 谁发起操作，这次操作是否重复 |
| 执行意图 | `callData` | 智能账户最终要调用什么 |
| Gas 边界 | verification、execution、pre-verification Gas 和费用字段 | 最多允许消耗多少执行资源 |
| 部署与赞助 | factory、paymaster 相关数据 | 账户如何创建，谁承担 Gas |

链上调用使用的是打包后的 `PackedUserOperation`。具体编码会随着规范和 EntryPoint 版本演进，但钱包后端最需要理解的边界没有变化：签名不是只覆盖“给谁转多少钱”。

`userOpHash` 还会绑定 UserOperation 内容、EntryPoint 和 chainId。这样同一份签名不能被随意拿到另一条链或另一个 EntryPoint 上使用。

对 `wallet-sign` 来说，这意味着签名前至少要能解释：

```text
sender 是谁
callData 最终调用什么
使用哪个 nonce
在哪条链执行
信任哪个 EntryPoint
Gas 上限是多少
是否使用 Paymaster
```

如果签名服务只收到一个不透明 hash 并直接签名，智能账户虽然支持更灵活的授权，平台自己的签名安全边界却反而退化了。

# Semi-abstracted Nonce：不再只有一条队列

普通 EOA 使用单调递增的账户 nonce。同一账户的交易天然排成一条队列，前一笔卡住时，后续 nonce 通常也会受到影响。

ERC-4337 把 UserOperation 的 `uint256 nonce` 解释成两部分：

```text
192-bit key
+
64-bit sequence
```

`key` 可以代表一条独立的操作通道，`sequence` 在该通道内单调递增。

例如，一个智能账户可以约定：

```text
key 0 -> 普通资产转账
key 1 -> 管理员和恢复操作
key 2 -> Session Key 小额支付
```

三条通道可以拥有各自的 sequence。管理操作不必和高频小额支付争抢同一条 nonce 队列。

但“可以并行”不等于“不用管理”。EntryPoint 仍然会校验每个 key 对应的 sequence。Bundler 如果接收同一 sender 的多个操作，也要跟踪 mempool 中已经占用的 key 和 sequence。

钱包后端不能只保存一个最终的 `userOpHash`，而应该把资源状态和业务订单绑定：

```text
sender
entry_point
nonce_key
nonce_sequence
business_order_id
user_op_hash
status
```

如果两个 worker 为同一 sender 和 nonce key 分配了相同 sequence，最终仍会发生冲突。Semi-abstracted nonce 扩展了并行模型，没有替平台解决并发控制。

# 为什么 Bundler 必须先模拟验证

普通 EOA 交易的基本有效性可以用固定规则检查：签名能否恢复出发送者、nonce 是否正确、余额是否足够、chainId 是否匹配。

UserOperation 的验证逻辑却可以由智能账户和 Paymaster 合约定义。Bundler 不能只看字段格式就知道它是否有效，必须在当前链上状态下运行验证过程。

模拟需要确认的内容包括：

```text
nonce 是否有效
智能账户是否认可签名
账户是否需要部署
validAfter / validUntil 是否满足
Paymaster 是否愿意赞助
预付资金是否覆盖最大成本
验证过程是否符合 Bundler 的准入规则
```

当前 ERC-4337 规范把 simulation 描述为对 EntryPoint 执行离链 view call 或 trace call，并应用验证阶段的共享规则。实现和版本可能提供不同辅助接口，因此不应该把旧版本里的某个 `simulateValidation()` 函数名当成永久不变的协议边界。

这里最重要的理解是：

> 模拟验证是准入检查，不是最终执行证明。

模拟通过后，UserOperation 才有资格进入 Bundler 的本地 mempool 或继续传播。但在真正上链前，账户状态、nonce、Paymaster 额度和有效期都可能变化。

不同 Bundler 还可能有不同的费用阈值、声誉策略和 mempool 规则。因此，一个 Bundler 接受操作，也不等于所有 Bundler 都会接受。

# 授权操作和支付 Gas 是两件事

账户抽象经常被描述为“可以让别人代付 Gas”。这个体验背后至少有四个容易混淆的概念。

| 概念 | 作用 |
| --- | --- |
| Prefund | 当前 UserOperation 为覆盖最大可能成本需要准备的资金 |
| Deposit | Account 或 Paymaster 存放在 EntryPoint 中、可用于支付未来操作 Gas 的余额 |
| Stake | Factory、Paymaster 等实体为获得特定验证能力提供的带延迟退出经济承诺 |
| Actual Gas Cost | 验证和执行完成后，根据实际消耗结算的费用 |

在没有 Paymaster 时，智能账户需要保证 EntryPoint 能获得足够的预付资金。如果账户在 EntryPoint 中已有 deposit，可以从 deposit 覆盖；不足部分会作为 `missingAccountFunds` 交给账户验证逻辑处理。

使用 Paymaster 时，Paymaster 的验证逻辑决定是否赞助这次操作。它可以检查用户身份、目标合约、金额、有效期或平台额度，然后通过自己的 EntryPoint deposit 承担 Gas。

这形成了两条独立关系：

```text
用户或账户策略 -> 授权执行 100 USDC 转账
Paymaster 策略 -> 同意承担这次操作的 Gas
```

Paymaster 同意付费，不能替代用户对资产转移的授权。用户签名有效，也不能强迫 Paymaster 提供赞助。

即使目标调用最终 revert，Paymaster 仍可能已经承担验证和执行消耗的 Gas。因此钱包后端不仅要记录“是否使用 Paymaster”，还需要记录赞助请求、验证结果、最大成本、实际成本和结算结果。

# EntryPoint 如何完成验证和执行

可以把 `handleOps` 的工作理解成两个阶段。

## 验证阶段

```text
必要时通过 factory 创建账户
-> 校验 nonce
-> 计算最大可能费用
-> 调用 Account.validateUserOp
-> 调用 Paymaster validation（如果存在）
-> 检查 deposit / prefund
-> 检查有效时间和其他验证结果
```

智能账户的 `validateUserOp` 会检查 EntryPoint 是否可信、签名是否满足账户策略，并返回签名或授权信息以及有效时间范围。

Paymaster 存在时，EntryPoint 还会调用 Paymaster 的验证逻辑。任何关键验证失败，都可能让该 UserOperation 被拒绝执行。

## 执行阶段

```text
调用智能账户执行 callData
-> 智能账户调用 USDC 合约
-> 记录执行成功或 revert
-> 调用 Paymaster postOp（如果需要）
-> 计算实际 Gas 成本
-> 退回未使用的预付资金
-> 向 Bundler beneficiary 支付费用
```

验证成功和目标调用成功是两个不同结果。

UserOperation 可以通过账户与 Paymaster 验证，但在调用 USDC 时因为余额不足、合约暂停或业务参数错误而 revert。此时不能把它当成“从未发送”，因为链上已经执行了验证并消耗 Gas。

# Exchange Wallet Infrastructure 如何接入 ERC-4337

把这条链路映射回钱包基础设施的四个服务边界后，职责可以这样划分。

## wallet-service：业务状态和恢复策略

`wallet-service` 不负责拼装 PackedUserOperation，但需要保存足够的中间事实：

```text
business_order_id
sender
nonce_key / sequence
user_op_hash
gas_sponsor
validation_status
bundler_submission
entry_point
transaction_hash
actual_gas_cost
execution_result
```

它还要处理幂等、替换、超时、业务补偿和用户状态展示。

## risk-service：业务意图与风险放行

`risk-service` 不负责判断 UserOperation 的链上编码是否正确，而是校验这次操作是否符合平台的风险策略：目标地址、资产与金额、调用意图、额度、审批状态，以及当前签名请求是否仍然绑定同一份业务事实。

它输出的放行结果需要绑定 `business_order_id`、`sender`、`nonce`、`callData` 摘要和有效期。只要这些关键字段发生变化，就不能复用旧的风险结果。

## wallet-api：账户抽象基础设施适配

`wallet-api` 负责和链、Bundler 及 EntryPoint 交互：

```text
解析智能账户地址
查询 nonce
构建 UserOperation
估算 Gas
调用 Bundler RPC 提交
查询 UserOperation receipt
解析最终链上事件和 transaction hash
```

它不应该把所有步骤揉成一个没有中间结果的 `send()`。模拟失败、Paymaster 拒绝和 Bundler 丢弃需要被上层区分处理。

## wallet-sign：签署被冻结的完整意图

`wallet-sign` 只签署经过业务和策略校验的完整 UserOperation。签名前要确认：

```text
chainId
EntryPoint
sender
nonce
callData
费用上限
Paymaster 相关字段
```

签名完成后，如果这些字段发生变化，就应该重新走策略校验和签名。`wallet-api` 不能为了让 Bundler 接受请求，在签名后静默刷新关键字段。

# 钱包后端建议保存的状态机

下面的状态不是 ERC-4337 规定的链上枚举，而是钱包后端为了追踪一笔业务操作可以采用的内部模型。

```text
CREATED
-> BUILT
-> SIGNED
-> SIMULATED
-> SUBMITTED
-> INCLUDED
-> EXECUTED
```

异常状态需要保留失败语义：

| 状态 | 含义 | 典型恢复动作 |
| --- | --- | --- |
| VALIDATION_REJECTED | nonce、签名、账户验证或有效期不满足 | 修正原因后重新构建和签名 |
| SPONSOR_REJECTED | Paymaster 不接受或资金不足 | 更换 Gas 来源并重新校验 |
| DROPPED | Bundler 未继续保留或传播操作 | 检查 nonce、有效期和替换规则 |
| EXPIRED | 授权或赞助有效窗口已经结束 | 重新构建、估算和签名 |
| REPLACED | 相同 sender / nonce 的新操作替换旧操作 | 关联新旧 userOpHash，停止追踪旧操作 |
| EXECUTION_REVERTED | 验证通过但目标调用失败 | 记录链上结果和实际 Gas，不重复执行业务 |

这组状态最重要的价值，是阻止系统把所有失败都归为 `send_failed`。

模拟失败时，操作还没有进入链上；执行 revert 时，链上事实和 Gas 消耗已经发生。二者显然不能使用同一套重试策略。

# 回到最初的三个问题

第一，UserOperation 已经签名，为什么还要模拟？

因为签名只证明账户授权。模拟还要检查 nonce、账户验证、Paymaster、有效期、prefund 和 Bundler 准入规则。

第二，谁授权操作和谁支付 Gas 有什么区别？

账户签名决定资产操作是否被允许，Account 或 Paymaster 的 EntryPoint deposit 决定谁承担执行成本。两套策略可以独立成功或失败。

第三，钱包后端为什么仍然需要状态机？

因为一笔 UserOperation 会经过构建、签名、模拟、提交、打包、验证、执行和结算。每个阶段的失败事实和恢复动作都不同。

最终我对 ERC-4337 的理解是：

**账户抽象让签名、恢复和 Gas 支付变得可编程，但没有抽象掉资金系统对 nonce、验证结果、执行状态和费用结算的责任。**

# 参考资料

- [EIP-4337: Account Abstraction Using Alt Mempool](https://eips.ethereum.org/EIPS/eip-4337)
- [ERC-7769: JSON-RPC API for ERC-4337](https://eips.ethereum.org/EIPS/eip-7769)
- [ERC-4337 Bundler Simulation Requirements](https://docs.erc4337.io/bundlers/simulation-requirements.html)
- [eth-infinitism/account-abstraction](https://github.com/eth-infinitism/account-abstraction)
- [EntryPoint.sol](https://github.com/eth-infinitism/account-abstraction/blob/develop/contracts/core/EntryPoint.sol)
