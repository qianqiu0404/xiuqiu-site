---
{
  "id": 1,
  "slug": "api-system-calls",
  "kind": "engineering-note",
  "title": "API 到底是什么？从钱包后端项目理解系统调用",
  "date": "2026-05-14",
  "summary": "作为基础补充，解释 API 为什么是系统能力边界；核心工程用法已在 wallet-api 职责边界文章中展开。",
  "tags": [
    "API",
    "Backend",
    "System Design",
    "Wallet"
  ],
  "readingTime": "8 min",
  "difficulty": "基础",
  "conceptTags": [
    "api-design",
    "wallet-backend"
  ],
  "relatedProjectIds": [
    1,
    2,
    3
  ],
  "recommendedSlugs": [
    "wallet-api-boundary",
    "cex-evm-wallet-deposit-withdrawal-loop"
  ],
  "suggestedQuestions": [
    "这篇文章如何解释钱包 API 的系统边界？",
    "普通业务 API 和钱包 API 的差异是什么？"
  ]
}
---

# 问题背景

很多开发者对 API 的第一印象是"一个 URL 地址，发请求过去就返回数据"。这个理解虽然能用，但不足以支撑后端系统设计。在 Web3 钱包项目中，API 不仅仅是前端和后端之间的通道，它还需要组织多链配置、调用链节点、协调签名服务、返回统一错误——这比普通 CRUD API 复杂得多。

# 核心概念

API（Application Programming Interface）是一种系统能力的边界。调用方按照约定传入参数，服务方处理后返回结果。这里的核心要素不是"能访问"，而是：

- 谁能访问（权限校验）
- 访问什么能力（接口语义）
- 传什么参数（请求结构）
- 返回什么结果（响应结构）
- 错误如何表达（错误码和错误消息）
- 是否幂等（重复调用是否安全）
- 频率如何控制（限流和配额）

这些要素在设计钱包系统 API 时尤其重要，因为错误的参数可能构建出错误的交易，未限流的接口可能被滥用，不统一的错误处理会让前端调试非常困难。

# 放到我的项目里怎么理解

在 wallet-api 项目中，API 层承担了以下职责：

- 作为对外的统一入口，接收前端或管理端的请求
- 校验参数和权限，确保请求合法
- 根据请求的 chainId 和 method，路由到对应的链适配器
- 通过链适配器调用链节点 RPC 获取链上数据
- 当需要签名能力时，调用 wallet-sign 的 gRPC 接口
- 查询数据库或缓存获取已持久化的数据
- 统一包装响应并返回

# 关键调用链

以"查询用户余额"为例，调用链如下：

```
前端（浏览器）
  → HTTP GET /api/v1/balance?chainId=eth&address=0x...
    → wallet-api HTTP Handler
      → 参数校验和权限检查
      → Service Layer：组装请求
      → Chain Adapter：根据 chainId 路由到 ETH 适配器
        → ETH 节点 RPC：eth_getBalance
        → 返回原始余额（Wei 单位）
      → 余额统一转换（Wei → ETH）
    → 统一响应包装
  → 前端收到 JSON 响应
```

这个链中，API 层不直接操作私钥，不直接处理签名逻辑，不直接暴露链节点 RPC 格式——它负责的是"编排"和"转换"。

# 工程设计取舍

## 普通业务 API vs 钱包 API 的差异

普通业务 API 处理的是业务数据，比如用户信息、订单状态、文章内容。这些数据存储在数据库中，API 层负责 CRUD 操作。

钱包 API 需要处理的是链上状态：账户余额依赖链节点确认，交易构建需要组装转账或合约调用数据，签名涉及私钥安全——这些都不是简单的数据库读写。

## 为什么 API 层不能处理私钥

这是钱包系统最重要的设计边界之一。API 层面向公网，攻击面大，如果 API 层持有私钥，一旦被攻破，所有资产都可能被盗。私钥能力应该隔离到签名机服务中，API 层通过安全的内部 RPC 调用签名能力。

# 常见坑

- 把 API 当成简单接口地址，不设计错误码。错误返回只有 200/500，前端无法区分"参数错误""余额不足""节点超时"
- 不区分内部 API 和外部 API。把 gRPC proto 直接暴露给前端，或者让前端直接调用链节点 RPC
- 把私钥能力暴露在 API 层。这等于在门口放了一把保险箱的钥匙
- 不做幂等设计。交易构建接口如果重复调用可能导致重复构建

# 可继续深入的方向

- RESTful API 和 RPC 风格 API 在钱包场景中的选择
- API 版本管理策略：URL 路径 vs Header 方式
- 多链错误码体系设计：不同链的错误如何翻译成统一错误响应
- API 中间件设计：限流、鉴权、日志、审计在钱包系统中的具体实现
