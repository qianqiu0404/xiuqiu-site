---
{
  "id": 3,
  "slug": "wallet-api-boundary",
  "title": "wallet-api：多链钱包后端 API 的职责边界",
  "date": "2026-05-19",
  "summary": "梳理多链钱包 API 服务如何组织链配置、接口入口、节点 RPC 转换、交易构建、错误处理和签名服务协作。",
  "tags": [
    "Web3",
    "Wallet",
    "Go",
    "API"
  ],
  "readingTime": "12 min",
  "difficulty": "项目拆解",
  "conceptTags": [
    "wallet-backend",
    "api-design",
    "multi-chain"
  ],
  "relatedProjectIds": [
    1,
    2
  ],
  "recommendedSlugs": [
    "wallet-sign-signer",
    "wallet-address-models"
  ],
  "suggestedQuestions": [
    "wallet-api 应该负责什么，不应该负责什么？",
    "多链钱包 API 的核心复杂度在哪里？",
    "为什么 API 不是一个 URL，而是钱包系统的能力边界？"
  ]
}
---

# 问题背景

多链钱包后端 API 不是一条链一个独立服务，而是通过统一的接口抽象来管理多条公链。难点在于不同链的账户模型、交易结构、RPC 接口、签名算法各不相同，如何在 API 层做好封装和职责划分，是 wallet-api 设计的核心问题。

# 核心概念

wallet-api 在钱包系统中位于最上层，直接对接前端和管理端。它不直接处理链上数据，而是通过 Chain Adapter 调用链节点 RPC；不直接处理私钥，而是通过 gRPC 调用 wallet-sign 获取签名能力。

## API 不是 URL，而是钱包系统的能力边界

很多人最开始理解 API，会把它看成一个 URL：前端请求过去，后端返回 JSON。但在钱包系统里，这个理解太薄了。

API 更像是一条能力边界。它定义的是：

```text
谁能访问
能访问什么能力
请求参数如何校验
错误如何表达
重复请求是否幂等
访问频率如何限制
链节点返回如何转换
签名能力如何隔离
```

这也是 `wallet-api` 和普通 CRUD API 最大的差异。普通业务 API 多数是在数据库里读写业务数据；钱包 API 面对的是链上事实、交易构建、签名安全和异步状态。一个参数错误可能构建出错误交易，一个错误码缺失可能让前端无法区分余额不足和节点超时，一个幂等设计缺失可能导致重复提交提现。

所以 `wallet-api` 不只是“给前端用的接口层”，而是把外部 HTTP 请求转换成内部钱包能力的编排层。

## 应该负责的

- 对外 HTTP API 入口
- 参数校验和权限控制
- 鉴权、限流、幂等和统一错误码
- 多链配置读取（RPC 地址、chainId、代币合约地址等）
- 地址生成、余额查询、交易构建等能力的编排
- 调用链节点 RPC 获取链上数据，并转换成统一业务结构
- 调用 wallet-sign 的内部 gRPC 接口获取签名能力
- 统一响应格式和错误处理

## 不应该负责的

- 直接暴露私钥或助记词
- 在 API 层管理签名逻辑
- 把链节点 RPC 原样暴露给前端
- 把不同链逻辑硬编码到接口层
- 让前端决定交易构建的签名细节

# 放到我的项目里怎么理解

## 多链钱包 API 的核心难点

- 不同链账户模型不同：BTC 是 UTXO 模型，ETH 是账户模型，Solana 是账户/公钥模型
- RPC provider 不同：每条链的节点 RPC 接口不同，返回格式不同
- 交易结构不同：BTC 需要处理输入输出和找零，ETH 需要 nonce 和 gas，Solana 需要 instructions
- 费用计算不同：BTC 按字节算，ETH 用 gas，Solana 用 lamports
- 错误返回不统一：节点超时、余额不足、nonce 错误等错误需要翻译成统一格式

## Chain Adapter 的设计意义

Chain Adapter 是多链抽象的核心。每条链实现统一的接口，API 层不直接依赖具体链的实现：

```
HTTP Request (chainId=eth, method=getBalance, params=...)
  → ChainDispatcher
    → 根据 chainId 查找对应的 Chain Adapter
      → ETH Adapter
        → 调用 ETH 节点 RPC
        → 返回统一格式的 Balance 结构
```

新增一条链只需要实现 Adapter 接口并注册到 ChainDispatcher，API 层不需要改动。

# 关键调用链

以"构建并发送交易"为例：

```
Client → HTTP POST /api/v1/transaction/build

  wallet-api:
    1. HTTP Handler：解析请求参数（from, to, amount, chainId）
    2. Service Layer：校验参数、组装业务上下文
    3. Chain Adapter：根据 chainId 获取对应适配器
    4. Adapter 构建未签名交易（UnSignedTransaction）
    5. 调用 wallet-sign gRPC：SignTransaction(UnSignedTransaction)
    6. wallet-sign 返回签名后的交易
    7. Adapter 将签名交易广播到链节点 RPC
    8. 返回交易哈希和状态

  → Response: { txHash: "0x...", status: "broadcasted" }
```

# 工程设计取舍

## API 层编排，签名机处理签名

这不是技术选型，而是安全设计。API 层面向公网，不应该持有私钥能力。签名能力下沉到 wallet-sign，API 层通过内部 gRPC 调用签名能力。

这条边界也解释了为什么前端不应该直接碰链节点 RPC 或签名机 RPC。前端面对的是业务语义：

```text
查询余额
创建提现
查询交易状态
```

而不是：

```text
eth_getBalance
eth_estimateGas
SignTransaction
```

`wallet-api` 的价值就在于把这些底层调用重新组织成稳定、可鉴权、可审计、可限流、可幂等的业务能力。

## 链适配器优于暴力 if-else

当链少时，直接在 Service 层写 if chainId == eth {} else if chainId == btc {} 确实简单。但当链超过 3 条时这种写法就变成维护噩梦。Chain Adapter 模式虽然前期多了一层抽象，但新增链时只需要加文件，不需要改已有逻辑。

# 常见坑

- 直接在 Handler 里写链逻辑。Handler 应该只是参数解析和响应包装
- 多链配置写死在代码里。应该通过 config 文件或配置中心管理 RPC 地址、合约地址等
- API 层持有私钥。这是最常见的安全问题
- 错误处理不统一。ETH 返回的错误格式和 BTC 完全不同，前端需要统一处理
- 把节点 RPC 当成公网 API 直接透出。这样会丢掉鉴权、限流、错误翻译和业务审计

# 可继续深入的方向

- Chain Adapter 的接口设计：统一到什么粒度？地址生成、余额查询、交易构建、签名等是否都在同一个接口？
- API 层缓存的引入时机：余额是否需要缓存？交易状态是否需要轮询？
- 多链交易状态跟踪：不同链的确认规则不同，如何统一管理交易状态？
