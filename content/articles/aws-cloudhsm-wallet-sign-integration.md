---
{
  "id": 12,
  "slug": "aws-cloudhsm-wallet-sign-integration",
  "kind": "engineering-note",
  "title": "wallet-sign 接入 AWS CloudHSM：一次生产级 HSM 签名架构复盘",
  "date": "2026-06-19",
  "summary": "这次改造里，我把 wallet-sign 从本地私钥签名升级为 AWS CloudHSM 支撑的生产级签名架构，让私钥在 HSM 内生成、不可导出，并通过 hsm-gateway 收敛 PKCS#11 复杂性。",
  "tags": [
    "Web3",
    "Wallet",
    "AWS",
    "CloudHSM",
    "HSM",
    "wallet-sign",
    "Security"
  ],
  "difficulty": "项目拆解",
  "conceptTags": [
    "signer-service",
    "wallet-backend",
    "multi-chain",
    "mpc-tss"
  ],
  "relatedProjectIds": [
    2,
    5
  ],
  "recommendedSlugs": [
    "mpc-wallet-sign-integration",
    "wallet-sign-signer",
    "wallet-api-boundary",
    "withdrawal-error-handling"
  ],
  "suggestedQuestions": [
    "这次 wallet-sign 接入 AWS CloudHSM 后，签名安全边界发生了什么变化？",
    "为什么要在 wallet-sign 和 CloudHSM 之间加 hsm-gateway？",
    "CloudHSM 签名失败时，为什么不能 fallback 到本地私钥？"
  ]
}
---

# wallet-sign 接入 AWS CloudHSM：一次生产级 HSM 签名架构复盘

这次改造里，我把 `wallet-sign` 从本地私钥签名升级成了 AWS CloudHSM 支撑的生产级签名架构。

改造前，`wallet-sign` 的核心模型是 `LevelDB 保存完整私钥 + 本地 signer 签名`。这套模型适合学习版签名机，也能把多链签名流程跑通，但它的安全边界不够高：私钥、签名逻辑、机器权限和运维权限都集中在同一个系统域里。

改造后，我把 `wallet-sign` 收敛成签名编排层，把 AWS CloudHSM 放在真正持有和使用私钥的位置。私钥在 CloudHSM 内生成，设置为 sensitive / non-exportable；`wallet-sign` 只保存 `public_key -> hsm_key_id` 这类 key metadata；PKCS#11、session 池、Crypto User 登录和错误码转换则放到内部 `hsm-gateway` 里处理。

这篇记录不是一篇 HSM 接入教程，而是我对一次生产级签名安全边界升级的复盘。

# 改造前的问题

原来的本地签名流程很直接：

```text
wallet-sign
  -> 根据 public_key 从 LevelDB 找到 private_key
  -> 使用本地 signer 完成 ECDSA / Ed25519 签名
  -> 返回 signature
```

这个结构的问题不是功能不完整，而是信任假设过于集中。

在本地私钥模型里，`wallet-sign` 同时负责密钥存储、密钥解密、签名执行和签名结果返回。一旦签名机、LevelDB、配置文件或运维权限被攻破，攻击者就可能拿到完整私钥，或者绕过上游业务流程构造签名请求。

所以这次改造的目标不是简单把 `hsm_enable` 改成 true，而是把完整私钥从应用层移走，让签名机只负责编排和审计，不再直接持有可导出的私钥材料。

# 为什么选择 AWS CloudHSM

AWS 里有几个容易混在一起的概念：

```text
AWS CloudHSM
  -> 客户可控的云 HSM 集群
  -> 通过 PKCS#11、JCE、CNG/KSP 等方式接入

AWS KMS
  -> 托管密钥服务
  -> API 更简单，运维负担更低，但抽象层更高

AWS KMS Custom Key Store backed by CloudHSM
  -> 使用 KMS API
  -> key material 放在 CloudHSM 集群里
```

这次我记录的是 `AWS CloudHSM + PKCS#11 Client SDK` 这条路径。原因是它更贴近生产级签名机的安全目标：应用可以通过标准 PKCS#11 接口让 CloudHSM 生成和使用私钥，同时把私钥设置为不可导出。

CloudHSM 不是打开一个 HTTP API 就能用的托管服务。它是一套独立 HSM 集群，需要完成 VPC、subnet、security group、cluster 初始化、证书信任、mTLS、Crypto User 和 Client SDK 配置。这个复杂度本身也是我引入 `hsm-gateway` 的原因。

# 我最终落下来的生产架构

最终架构没有让所有链 adaptor 直接碰 PKCS#11，也没有让 `wallet-service` 或 `wallet-api` 直接连接 CloudHSM。

我把链路收敛成这样：

```text
wallet-service
  -> wallet-sign
    -> hsm-gateway
      -> CloudHSM Client SDK 5 / PKCS#11
        -> AWS CloudHSM cluster
```

各层职责重新确认了一遍：

```text
wallet-service
  -> 提现单、审批、风控、状态机、失败重试和人工复核

wallet-api
  -> 链上交易构建、签名后组装、广播、链上确认查询

wallet-sign
  -> 签名前校验、key metadata 查询、签名编排、审计记录

hsm-gateway
  -> PKCS#11 session 池、CloudHSM 登录、签名调用、错误码转换、限流

CloudHSM
  -> 私钥生成、私钥保存、硬件内签名
```

这样拆完以后，`wallet-sign` 仍然是业务系统眼里的签名服务，但 PKCS#11 的复杂性不会扩散到多链 adaptor 里。后续如果更换 HSM 厂商、调整 session 策略、升级 Client SDK，也可以集中在 `hsm-gateway` 内部处理。

# CloudHSM 基础设施接入

CloudHSM 的第一步不是写代码，而是把基础设施信任链建立起来。

生产环境里，我把它拆成几个基础对象：

```text
VPC
-> private subnet
-> security group
-> CloudHSM cluster
-> 至少 2 个 HSM，分布在不同 AZ
-> 运行 wallet-sign / hsm-gateway 的 EC2、ECS 或 EKS
```

安全组的边界也很明确：

```text
只有 hsm-gateway 能访问 CloudHSM
wallet-service 不直连 CloudHSM
wallet-api 不直连 CloudHSM
HSM 管理入口只允许跳板机或管理网络访问
生产签名链路不暴露到公网
```

初始化 CloudHSM cluster 时，还要处理 cluster CSR、CA 签名、HSM certificate、client mTLS 和 cluster 激活。这里的根信任不是普通业务配置，Root CA 私钥必须离线保存，初始化和激活流程也需要有 runbook、审批和操作审计。

应用侧运行前还要完成 Client SDK 5 和 PKCS#11 library 配置。AWS CloudHSM Client SDK 5 的 PKCS#11 library 兼容 PKCS#11 2.40，这意味着 Go 服务可以通过 PKCS#11 library 访问 CloudHSM，但也要自己管理 session、登录、超时、错误码和并发。

# Crypto User 和权限边界

应用通常以 Crypto User 登录 CloudHSM。PKCS#11 的 pin 格式类似：

```text
<CU_user_name>:<password>
```

这类凭证不能写进 `config.yml`，也不能进入代码仓库。我把它交给 Secrets Manager、SSM Parameter Store 或 Kubernetes Secret 管理，并且在应用启动时注入给 `hsm-gateway`。

这里我刻意区分了几个角色：

```text
key admin
  -> 负责 key 管理和权限配置

signing user
  -> 负责生产签名调用

auditor
  -> 负责审计和操作追踪
```

`wallet-sign` 使用的 signing user 不需要拥有过大的 key 管理权限。CU 密码轮换也要按灰度流程处理，支持双 CU 过渡，避免一次性轮换导致生产签名不可用。

# Keygen 改造后的数据流

改造前，地址创建依赖本地生成私钥：

```text
wallet-sign 生成 private_key / public_key
-> private_key 写入 LevelDB
-> public_key 推导 address
-> 返回 address 给 wallet-service
```

接入 CloudHSM 后，我把 keygen 改成 HSM 内生成：

```text
hsm-gateway 调 PKCS#11 C_GenerateKeyPair
-> curve 选择 secp256k1
-> private key 设置为 sensitive / non-exportable
-> CloudHSM 返回 public key 和 private key handle
-> wallet-sign 保存 public_key -> hsm_key_id
-> wallet-sign 根据 public key 推导链上 address
-> 返回 address 给 wallet-service
```

对 ETH、BTC、TRON、Cosmos 这类 secp256k1 链，我重点校验了几个点：

```text
曲线是 secp256k1，不是 P-256
private key 不可导出
public key 可导出，用来推导地址
key label / key id 能稳定映射到业务 metadata
key_status 能表达 active、disabled、pending、orphan 等状态
```

LevelDB 在这个阶段不再是私钥存储，而只是 metadata store。更生产化的形态会把 metadata 放到数据库表里，并且加上备份、审计、权限控制和补偿任务。

metadata 的核心字段是：

```text
public_key
compressed_public_key
address
chain_id
network
hsm_key_id
hsm_key_label
curve
algorithm
key_status
created_at
updated_at
```

这一层变化很关键：业务侧仍然拿到普通链上地址，但完整私钥从来没有离开 CloudHSM。

# SignDigest 改造后的调用流

签名链路也从本地 private key 签名，改成了 key id 签名。

改造前：

```text
privateKey = GetPrivateKey(publicKey)
signature = LocalSigner.Sign(privateKey, messageHash)
```

改造后：

```text
hsmKeyId = GetHsmKeyId(publicKey)
signature = hsmGateway.SignDigest(hsmKeyId, messageHash)
```

完整提现签名链路变成：

```text
1. wallet-service 完成提现业务校验与状态编排
2. risk-service 校验提现内容并产生风控放行结果
3. wallet-api 构建待签 message hash
4. wallet-service 调 wallet-sign.SignTransactionsMessage
5. wallet-sign 校验 token、chain_id、wallet_key_hash、risk_key_hash
6. wallet-sign 根据 public_key 查询 hsm_key_id
7. wallet-sign 调 hsm-gateway.SignDigest
8. hsm-gateway 调 PKCS#11 C_SignInit + C_Sign
9. CloudHSM 使用内部私钥完成签名
10. hsm-gateway 返回 signature
11. wallet-sign 做本地 verify 和审计记录
12. wallet-api 组装 signed transaction 并广播
```

这条链路里，CloudHSM 只负责使用 HSM 内部私钥签名。它不决定提现是否成立，也不决定链上交易怎么构建。资金状态由 `wallet-service` 编排，风险校验由 `risk-service` 承担，链上交易表达仍然在 `wallet-api`，签名安全边界仍然由 `wallet-sign` 收口。

# 多链签名格式适配

CloudHSM 能完成签名，不代表签名结果天然满足所有链的交易格式。

这次改造里，我把签名格式适配单独作为一层处理。

对 EVM / TRON 这类链，CloudHSM 可以用 secp256k1 做 ECDSA 签名，但 AWS CloudHSM Client SDK 5 的 PKCS#11 library 不支持 Sign Recover。也就是说，ETH 交易需要的 `v` / recovery id 不能直接指望 HSM 返回，需要应用侧根据 message hash、signature 和 public key 推导或适配。

对 BTC，除了 secp256k1 签名，还要处理脚本类型、sighash type、UTXO 上下文和签名序列化。签名本身只是其中一环，最终能否广播成功取决于完整交易格式。

对 Cosmos，要确认 SignDoc、account number、sequence、chain id、sign mode 和 hash 规则一致。

对 Solana，我没有直接承诺走 AWS CloudHSM。Solana 使用 Ed25519，而 CloudHSM PKCS#11 key types 文档主要覆盖 NIST EC curves 和 secp256k1。Solana 是否走 CloudHSM，需要单独验证 Ed25519 支持或切到其他签名后端。

因此，签名返回后我加了一步本地 verify：

```text
CloudHSM signature
-> DER / r,s 格式转换
-> recovery id 推导或链级适配
-> 本地 verify
-> 通过后再返回上游
```

签名不能只看 HSM 有没有返回成功，还要看链级验签是否通过。

# 生产失败处理复盘

生产级接入和 demo 最大的区别，是不能只设计 happy path。

CloudHSM 连接失败时，`hsm-gateway` 的健康检查会失败，对应实例要从服务发现中摘除，`wallet-sign` 不再把签名请求路由过去。提现单进入待重试或人工处理，并触发告警。

```text
hsm-gateway 健康检查失败
-> 从服务发现摘除实例
-> wallet-sign 停止路由签名请求
-> wallet-service 标记提现待重试或人工处理
-> 触发告警
```

Crypto User 登录失败时，服务要 fail fast。不能让 `hsm-gateway` 在没有 HSM 登录能力的状态下继续承接生产签名。认证失败、Secret 注入失败、CU 被禁用和 HSM 短暂不可用也要区分错误码，避免排障时混在一起。

Keygen 失败时，系统不能创建地址：

```text
CreateKey 失败
-> 不创建地址
-> 不写入可用 address 表
-> 不返回给业务可用地址
-> 记录 request_id / chain_id / error_code
```

如果 keygen 成功但 metadata 写库失败，这把 key 不能直接丢掉。我会把它标记为 orphan / pending，并由补偿任务修复或禁用。最危险的状态是“地址已经返回给用户，但 key metadata 没有落库”，这会让后续签名无法闭环。

metadata 查询失败时，`wallet-sign` 直接拒签，不调用 HSM：

```text
KEY_NOT_FOUND
KEY_DISABLED
CHAIN_KEY_MISMATCH
METADATA_STORE_UNAVAILABLE
```

找不到 key 或 key 状态不对，不能尝试猜 key，也不能走备用私钥。

SignDigest 超时或失败时，`wallet-sign` 返回单笔签名失败，`wallet-service` 把提现单放到待重试或人工处理，不广播交易。只有明确可重试错误才做有限重试，并且使用指数退避和 jitter。

这里最重要的一条边界是：CloudHSM 失败不能自动 fallback 到本地私钥。

如果 HSM 不可用就自动降级到 LevelDB 私钥，攻击者只要制造 HSM 故障，就可能诱导系统走弱安全路径。生产上宁愿拒签、告警、人工处理，也不能让失败变成绕过安全边界的入口。

# 审计和灰度

签名审计不是额外日志，而是生产签名链路的一部分。

我在审计里只记录可排障、可追踪但不可滥用的信息：

```text
request_id
chain_id
public_key 摘要
hsm_key_id 摘要
签名后端
签名结果
耗时
错误码
```

日志里不能出现 private key、CU pin、HSM 凭证、完整敏感交易体或可重放的签名凭证。

灰度切换也不能按“大开关”处理。我会按链、按钱包、按金额逐步切：

```text
测试链
-> 小额钱包
-> 部分热钱包
-> 高价值钱包
```

灰度期间重点观察：

```text
本地 verify 通过率
链上广播成功率
签名耗时
HSM session 池压力
错误码分布
提现状态机是否正确处理 HSM 错误
```

回滚也不能是自动绕过 HSM。回滚可以是配置级回滚、暂停某条链、暂停某类钱包签名，或者让提现进入人工处理，但不能静默切回本地私钥签名。

# 复盘后的理解

这次 wallet-sign 接入 AWS CloudHSM 后，我更明确地意识到：生产级 HSM 接入不是把一个 SDK 塞进项目，也不是把 `hsm_enable` 从 false 改成 true。

它至少包含两层改造。

第一层是基础设施信任：

```text
CloudHSM cluster
cluster 初始化
mTLS
Crypto User
Client SDK
PKCS#11 library
多 AZ 可用性
审计和权限边界
```

第二层是钱包业务系统改造：

```text
wallet-sign 不保存明文私钥
LevelDB 从私钥存储降级为 metadata 存储
Keygen 在 HSM 内完成
SignDigest 通过 hsm_key_id 调用 HSM
签名前必须完成业务、审批和风控校验
签名后必须做链级格式适配和 verify
失败不能绕过安全边界
```

最终沉淀下来的边界是：

```text
wallet-service 决定该不该签
wallet-api 决定签什么链上数据
wallet-sign 决定如何安全地产生签名
hsm-gateway 收敛 PKCS#11 和 CloudHSM 复杂性
CloudHSM 保证完整私钥不离开 HSM
```

对交易所钱包来说，真正的生产级不是“用了 CloudHSM”这几个字，而是私钥不可导出、签名前有业务和风控校验、签名行为可审计、失败不会降级绕过安全边界、多链签名结果能被真实验证。

这些边界同时成立，HSM 才从一个基础设施组件变成钱包系统里的签名安全能力。
