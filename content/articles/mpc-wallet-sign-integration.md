---
{
  "id": 11,
  "slug": "mpc-wallet-sign-integration",
  "title": "wallet-sign 接入 MPC：一次签名安全边界升级的工程复盘",
  "date": "2026-06-19",
  "summary": "这次改造里，我把 wallet-sign 从本地私钥签名机收敛成 SignerBackend 调度层，并将 MPC 作为生产级签名后端接入，让完整私钥不再落在单点服务里。",
  "tags": [
    "Web3",
    "Wallet",
    "MPC",
    "TSS",
    "wallet-sign",
    "Security"
  ],
  "difficulty": "项目拆解",
  "conceptTags": [
    "mpc-tss",
    "signer-service",
    "wallet-backend",
    "multi-chain"
  ],
  "relatedProjectIds": [
    2,
    5
  ],
  "recommendedSlugs": [
    "wallet-sign-signer",
    "wallet-api-boundary",
    "wallet-address-models",
    "withdrawal-error-handling"
  ],
  "suggestedQuestions": [
    "这次 wallet-sign 接入 MPC 后，签名边界发生了什么变化？",
    "为什么我没有让 wallet-api 或 wallet-service 直接感知 MPC？",
    "MPC 接入后，SignerBackend 抽象解决了什么问题？"
  ]
}
---

# wallet-sign 接入 MPC：一次签名安全边界升级的工程复盘

在这次 wallet-sign 的演进里，我没有把 MPC 当成一个外挂 SDK 接进去，而是把它当成一次签名安全边界升级来处理。

改造前，wallet-sign 更像一台本地私钥签名机：根据 public_key 找到本地 private_key，完成 ECDSA 或 Ed25519 签名，再把 signature 返回给上游。这个模型能跑通多链签名，但安全边界很清楚：只要签名机、密钥存储或运维权限被攻破，完整私钥就可能暴露。

改造后，我把 wallet-sign 收敛成一个签名能力调度层。它不再把签名理解成固定的本地私钥操作，而是通过 `SignerBackend` 在 local、HSM、MPC 之间切换。MPC 作为生产级签名后端接入后，wallet-sign 只保存 key metadata，完整私钥不再落在单点服务里。

# 改造前的问题

原来的本地签名流程很直接：

```text
wallet-sign
  -> 根据 public_key 读取 private_key
  -> 使用 ECDSA / Ed25519 本地签名
  -> 返回 signature
```

这个流程的问题不是不能用，而是安全假设太集中。

在本地私钥模型里，签名机既负责密钥索引，也负责持有完整私钥，还负责生成签名。一旦攻击者拿到机器权限、数据库权限或密钥解密材料，就可能绕过上游业务流程直接构造签名请求。

所以这次改造的核心目标不是让系统看起来更高级，而是把私钥持有方式从单点完整私钥，升级为多方协作签名。

# 我为什么把 MPC 放在 wallet-sign

这套钱包系统本来已经拆成三层：

```text
wallet-service -> 业务编排
wallet-api     -> 链交互
wallet-sign    -> 密钥和签名
```

MPC 接入后，我没有让 `wallet-service` 或 `wallet-api` 直接感知 MPC。原因是 MPC 解决的是私钥安全和签名生成问题，不是提现审批问题，也不是链 RPC 问题。

`wallet-service` 负责判断一笔提现该不该发生。它关心余额、风控、审批、提现状态机、失败重试和人工复核。

`wallet-api` 负责判断这笔交易在链上怎么表达。它关心 nonce、gas、UTXO、unsigned transaction、signed transaction、广播和链上确认。

`wallet-sign` 才是签名安全边界。它负责校验签名请求、索引密钥、调用签名后端、返回标准 signature，并留下可审计记录。

所以我最后把 MPC 接在 wallet-sign 内部，让它成为签名后端的一种实现，而不是让整个钱包系统到处出现 MPC provider 的调用代码。

# 接入后重新确认的三层边界

这次改造完成后，我重新把三层职责压得更清楚。

`wallet-service` 决定该不该签：

```text
余额是否足够
提现地址是否合规
风控是否通过
是否需要人工审批
提现状态是否允许进入签名阶段
失败后进入自动重试、补偿任务还是人工复核
```

`wallet-api` 决定签什么链上数据：

```text
EVM nonce / gas / calldata
BTC UTXO 选择和 sighash
Solana message
Cosmos SignDoc
unsigned transaction 构建
signed transaction 组装
交易广播和 receipt 查询
```

`wallet-sign` 决定如何安全地产生 signature：

```text
请求来源是否可信
chain_id 是否支持
public_key 是否属于平台管理地址
审批凭证和风控凭证是否有效
这把 key 应该走 local、HSM 还是 MPC
签名结果如何审计
签名失败如何返回给上游状态机
```

这个边界确定以后，MPC 的位置就很自然：它只替换 wallet-sign 内部的私钥持有和签名方式。

# 接入后的提现签名链路

改造后，一笔提现的签名链路变成这样：

```text
1. 用户发起提现
2. wallet-service 创建提现单
3. wallet-service 完成余额校验、地址校验、风控校验
4. 大额或高风险提现进入人工审批
5. 审批通过后，wallet-api 构建待签交易或 message hash
6. wallet-service 调用 wallet-sign.SignTransactionsMessage
7. wallet-sign 校验 request_id、chain_id、from_address、审批凭证和风控凭证
8. wallet-sign 根据 public_key 找到 mpc_key_id
9. wallet-sign 调用 MPC 服务完成协作签名
10. MPC 多节点生成 signature
11. wallet-sign 返回标准 signature
12. wallet-api 组装 signed transaction 并广播
13. wallet-service 监听链上确认并更新提现状态
```

这个链路里最重要的一点是：MPC 不决定交易该不该发生。

该不该签，仍然由业务、审批和风控决定。MPC 只负责在已经被授权的签名请求上，用更安全的方式产生签名。

# Keygen 改造后的数据流

创建地址时，原来的 wallet-sign 会在本地生成私钥：

```text
wallet-sign 生成 private_key / public_key
-> private_key 存入本地密钥存储
-> public_key 推导 address
-> 返回 address
```

MPC 接入后，我把地址创建改成协作 keygen：

```text
wallet-sign 请求 MPC Keygen
-> 多个 MPC 节点分别生成 key share
-> 没有任何单点拥有完整私钥
-> MPC 返回 public_key 和 key_id
-> wallet-sign 保存 public_key -> mpc_key_id 映射
-> wallet-sign 根据 public_key 推导 address
-> 返回 address 给 wallet-service
```

业务侧拿到的仍然是普通链上地址。链上也不会知道这个地址背后是本地私钥、HSM 还是 MPC。变化发生在钱包系统内部的密钥安全边界。

wallet-sign 里保存的数据从完整私钥，变成了 key metadata：

```text
public_key
address
chain_id
mpc_key_id
key_status
created_at
```

这一步是整个改造里最关键的结构变化：wallet-sign 仍然能索引和管理地址，但不再持有完整私钥。

# Sign 改造后的调用流

签名时，原来的实现类似：

```text
privateKey = GetPrivateKey(publicKey)
signature = SignMessage(privateKey, messageHash)
```

MPC 接入后，调用流变成：

```text
keyId = GetMpcKeyId(publicKey)
signature = mpcClient.Sign(keyId, messageHash)
```

wallet-sign 拿到 signature 后，再返回给上游。上游继续组装交易、广播交易和监听确认。

这里有一个容易被低估的点：MPC 签出来的 signature 必须和普通签名格式保持一致。

不同链的签名差异不能被“接了 MPC”这件事抹平：

```text
ETH / TRON: secp256k1 ECDSA，关注 r/s/v 和 recovery id
BTC: 关注脚本类型、sighash、签名序列化和 UTXO 上下文
Solana: Ed25519 message signature
Cosmos: SignDoc、account number、sequence 和签名模式
```

所以这次改造里，MPC provider 不是只要能签 ECDSA 就够了，还要能满足具体链的 hash 规则、序列化格式和签名校验方式。

# 最终沉淀出的 SignerBackend 抽象

为了不让链适配器直接依赖某一种签名实现，我在 wallet-sign 内部沉淀了 `SignerBackend` 抽象：

```text
SignerBackend
  - CreateKey(ctx, chainId, network)
  - SignHash(ctx, chainId, publicKey, messageHash)
```

然后再拆成不同实现：

```text
LocalSignerBackend
  -> 本地生成 private key
  -> 本地保存密钥材料
  -> 本地完成签名

MPCSignerBackend
  -> 调用 MPC Keygen
  -> 调用 MPC Sign
  -> wallet-sign 只保存 key metadata
```

这样拆完以后，本地开发仍然可以用 local 模式，生产环境的高价值钱包可以切到 MPC。更重要的是，`wallet-service` 和 `wallet-api` 不需要因为签名后端变化而重新理解密钥系统。

配置上也能按链或钱包等级做切换：

```yaml
sign_backend:
  ethereum: mpc
  bitcoin: mpc
  solana: local
```

这个抽象的价值不只是接 MPC。以后如果要接 HSM、换 MPC 厂商、把部分链从 local 迁移到 MPC，也都可以集中在 wallet-sign 内部完成。

# 这次接入后我踩出来的边界问题

MPC 接入以后，系统看起来只是换了签名后端，但真正需要守住的是几条边界。

第一，MPC 不能绕过风控。

wallet-sign 在调用 MPC 前仍然要校验：

```text
request_id
chain_id
from_address
to_address
amount
token
审批状态
风控状态
提现单状态
```

否则 MPC 会变成一台更安全但同样危险的盲签机器。

第二，MPC 不可用时不能自动降级到本地私钥。

如果 MPC 服务挂了，系统不能为了可用性自动 fallback 到本地私钥。否则攻击者只要制造 MPC 不可用，就可能诱导系统走弱安全路径。

这类故障在提现链路里应该变成：

```text
MPC 不可用
-> wallet-sign 返回签名失败
-> wallet-service 标记提现为待重试或人工处理
-> 触发告警
-> 不广播交易
```

第三，MPC 节点不能落在同一个权限域。

如果多个 share 都部署在同一台机器、同一个云账号、同一套运维权限下，系统只是形式上用了 MPC，实际信任假设仍然高度集中。

第四，日志不能泄漏敏感材料。

签名日志里只能记录用于审计和排障的信息：

```text
request_id
chain_id
public_key 摘要
mpc_key_id 摘要
签名结果
耗时
错误码
```

不能记录 private key、MPC share、审批密钥、完整敏感交易体或可重放的签名凭证。

# 复盘后的理解

这次 wallet-sign 接入 MPC 后，我对“钱包签名安全”的理解更具体了。

MPC 的价值不在于项目里多了一个密码学组件，而在于它让完整私钥不再落在单点服务里。真正的工程价值，是把业务判断、链上交易构建、密钥签名这三件事拆开，并且让每一层只承担自己的责任。

最终这套架构可以概括成：

```text
wallet-service 决定该不该签
wallet-api 决定签什么链上数据
wallet-sign 决定如何安全地产生签名
MPC 负责让完整私钥不在单点出现
```

对交易所钱包来说，真正重要的不是“用了 MPC”这四个字，而是这些边界是否被守住：

- 完整私钥不落单点。
- 签名前有业务、审批和风控校验。
- 签名请求和结果可审计。
- 失败不会绕过安全边界。
- 多链签名格式和链上验签结果可验证。

如果这些边界没有建立起来，MPC 只是一个更复杂的签名 SDK。只有当它被接入到清晰的 wallet-sign 边界里，才真正变成钱包系统里的安全能力升级。
