---
{
  "id": 2,
  "slug": "http-rpc-grpc",
  "kind": "engineering-note",
  "evidenceLevel": "source-reviewed",
  "evidenceSummary": "结合本地后端项目接口边界整理的协议选型笔记。",
  "title": "HTTP、RPC、gRPC 的区别与项目使用场景",
  "date": "2026-05-16",
  "summary": "作为基础补充，解释 HTTP、RPC、gRPC 的边界；在钱包工程里重点落到 wallet-api 对外 HTTP、wallet-sign 内部 gRPC。",
  "tags": [
    "HTTP",
    "RPC",
    "gRPC",
    "Backend"
  ],
  "readingTime": "10 min",
  "difficulty": "进阶",
  "conceptTags": [
    "api-design",
    "go-infra"
  ],
  "relatedProjectIds": [
    1,
    2,
    3
  ],
  "recommendedSlugs": [
    "wallet-sign-signer",
    "wallet-api-boundary",
    "cex-evm-wallet-deposit-withdrawal-loop"
  ],
  "suggestedQuestions": [
    "HTTP、RPC、gRPC 在钱包系统里分别适合什么场景？",
    "wallet-api 和 wallet-sign 为什么适合用 gRPC 通信？"
  ]
}
---

# 问题背景

HTTP、RPC、gRPC 这三个词经常被放在一起比较，但实际上它们不在同一抽象层级。一个常见的误解是"gRPC 比 HTTP 高级"或"gRPC 是 HTTP 的替代品"。在 wallet-api 和 market-services 项目中，三种方式都有各自的位置。

# 核心概念

HTTP 是通信协议。它定义了数据在网络上如何传输、请求和响应的结构，以及状态码等语义。RESTful HTTP 是围绕资源设计的风格：GET /assets、POST /transactions。

RPC（Remote Procedure Call）是一种远程调用思想。它的核心是让调用远程服务像调用本地函数一样：GetBalance()、SignTransaction()。RPC 不绑定具体协议——可以跑在 HTTP 上，也可以跑在 TCP 上。

gRPC 是 RPC 的一种工程实现，基于 HTTP/2 和 Protocol Buffers。它不是比 HTTP 更高级的东西，而是 RPC 思想在工程层面的落地。

# 放到我的项目里怎么理解

## 为什么前端更适合 HTTP

- 浏览器原生支持 HTTP，不需要额外库
- JSON 格式可读性强，调试方便
- RESTful 风格的 URL 路径清晰：GET /api/v1/balance 一眼就能看出在做什么
- 前端生态成熟：axios、fetch、React Query 等工具都基于 HTTP

在 wallet-api 中，对外暴露的是 HTTP 接口。前端不需要关心 gRPC、proto 或 HTTP/2，只需要构造 HTTP 请求和解析 JSON 响应。

## 为什么内部服务更适合 gRPC

- 强类型接口定义：proto 文件就是接口契约，客户端和服务端必须保持一致
- 自动生成代码：从 proto 直接生成 Go、TypeScript、Java 等语言的代码
- 性能更好：基于 HTTP/2 多路复用，Protocol Buffers 二进制序列化比 JSON 轻量
- 适合服务间调用：接口清晰，调用方便

在 wallet-api 和 wallet-sign 之间，使用 gRPC 通信。wallet-api 需要签名能力时，直接调用 wallet-sign 的 gRPC 方法 SignTransaction()，就像调用本地函数一样。

## 在 market-services 中的分工

- HTTP API：给前端 Dashboard 展示行情数据，JSON 响应，方便调试和对接
- gRPC 服务：给内部服务或其他后端系统调用，强类型契约，性能更好

# 工程设计取舍

## 小项目不必强行 gRPC

如果项目只有两个服务，内部调用用 HTTP 完全够用。gRPC 的复杂度（proto 管理、代码生成、调试工具）在服务少的时候是纯开销。

## 内外部边界明确后再拆服务

不要一开始就把所有服务拆开用 gRPC。先在一个模块里把 HTTP 和 gRPC 的边界画清楚，等业务确实需要分离时再拆。wallet-api 和 wallet-sign 拆开不是因为技术，是因为安全边界——这是比性能更重要的理由。

## gRPC 调试成本高于 HTTP

curl 可以直接调试 HTTP 接口。gRPC 需要 grpcurl 或专门的工具，proto 文件版本不一致时错误信息也不够友好。

# 常见坑

- 把 gRPC 当成比 HTTP 更高级的万能方案。两者适用的场景不同，不是替代关系
- 对外暴露内部 RPC 接口。wallet-sign 的 gRPC 接口不应该暴露给公网
- proto 字段设计随意。字段编号不能修改，预留字段不足后续扩展困难
- 不做超时和错误处理。gRPC 调用默认可能有超时，但应用层仍然需要设计错误码和重试策略

# 可继续深入的方向

- HTTP/2 多路复用对比 HTTP/1.1 keep-alive 的性能差异
- gRPC 流式接口在行情推送场景中的应用
- proto 版本兼容策略：向后兼容和向前兼容的字段设计规则
- gRPC-Gateway：从 proto 生成 RESTful API，同时提供 HTTP 和 gRPC
