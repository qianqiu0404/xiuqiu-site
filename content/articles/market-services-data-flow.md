---
{
  "id": 5,
  "slug": "market-services-data-flow",
  "kind": "engineering-note",
  "evidenceLevel": "local-verified",
  "evidenceSummary": "已梳理并局部运行采集、存储、API 与数据新鲜度链路。",
  "title": "market-services：Go 行情服务如何组织数据流",
  "date": "2026-05-24",
  "summary": "从 HTTP、gRPC、Redis、PostgreSQL、行情同步和 Dashboard API，拆解一个 Go 后端行情服务如何运行。",
  "tags": [
    "Go",
    "Market",
    "Backend",
    "Redis"
  ],
  "readingTime": "12 min",
  "difficulty": "项目拆解",
  "conceptTags": [
    "go-infra",
    "api-design"
  ],
  "relatedProjectIds": [
    3
  ],
  "recommendedSlugs": [
    "http-rpc-grpc",
    "api-system-calls"
  ],
  "suggestedQuestions": [
    "market-services 的数据流如何组织？",
    "Redis 和 PostgreSQL 在行情服务里如何分工？"
  ]
}
---

# 问题背景

行情服务（market-services）的核心职责是从交易所获取行情数据，经过清洗、计算和存储后，对外提供查询接口。技术上看起来不复杂——定时拉数据，存起来，再提供 API 查询。但实际落地时，数据流的每个环节都有工程问题需要解决。

# 核心概念

## 行情服务要解决的核心问题

- 从多个交易所获取行情数据
- 清洗和计算数据（聚合、转换、计算指标）
- 缓存高频数据，避免重复计算
- 持久化关键数据，支持历史查询
- 对内对外提供不同类型的 API

## 完整数据链路

```
交易所 API → Crawler（数据抓取）
  → Redis Cache（高频缓存）
    → Worker（数据计算和处理）
      → PostgreSQL（持久化存储）
        → HTTP/gRPC API
          → Frontend Dashboard
```

# 放到我的项目里怎么理解

## Redis 的作用

- 存储高频行情数据：最新价格、涨跌幅、成交量等
- 降低数据库压力：高频率的读取请求由 Redis 承接
- 做短期缓存：适合存储 TTL 较短的数据，过期自动清除
- 支撑快速读取：毫秒级响应，适合 Dashboard 的实时展示

## PostgreSQL 的作用

- 存储资产信息、交易对配置、历史行情快照
- 提供可查询、可关联的数据基础
- 适合存储需要长期保留、需要 SQL 分析的数据

## HTTP 服务和 gRPC 服务

- HTTP API：给前端 Dashboard 使用，JSON 响应格式，方便调试和对接
- gRPC 服务：给内部服务或其他后端系统使用，使用 proto 定义强类型接口

# 关键数据流

以"查询 Dashboard 行情数据"为例：

```
Frontend → HTTP GET /api/dashboard?pair=BTC/USDT

  market-services:
    1. HTTP Handler：解析请求参数
    2. Service Layer：判断数据从哪里获取
    3. Redis：尝试获取缓存的最新行情
      - 命中：直接返回
      - 未命中：走数据库查询
    4. PostgreSQL：查询持久化的行情快照
    5. 数据组装：聚合最新价格、24h 变化、成交量等
    6. 返回统一格式的 Dashboard 数据

  → Response: { pair, price, change24h, volume, timestamp }
```

## 行情同步流程

```
定时任务触发
  → Crawler 调用交易所 REST API / WebSocket
    → 获取原始行情数据
    → 数据清洗（格式统一、异常过滤）
    → 写入 Redis（短期缓存）
    → Worker 计算指标（聚合、统计）
      → 写入 PostgreSQL（持久化快照）
```

# 工程设计取舍

## 为什么需要 Redis + PostgreSQL 两层存储

高频行情数据变化极快，但每次变化都写数据库会造成严重的写入压力。使用 Redis 作为热存储层，高频读写走 Redis，只有需要持久化的快照数据写入 PostgreSQL。这是典型的分层缓存策略，用空间换性能。

## 服务拆分思路

行情服务中的各个组件职责清晰：Crawler 只负责抓取，Worker 只负责计算，API 层只负责对外暴露接口。每个组件可以独立部署和扩展。比如 Crawler 可以横向扩展以支持更多交易所。

# 常见坑

- 服务启动配置混乱。RPC 地址、Redis 地址、DB 连接串散落在代码里，没有统一的配置管理
- Redis 和 DB 职责不清。什么数据放 Redis、什么放 DB、什么时候同步，没有明确规则
- 高频数据直接写入 PostgreSQL。行情每秒钟变化多次，直接写数据库会导致严重的写入压力
- API 层组装过多业务逻辑。Handler 应该很薄，复杂的组装逻辑应该在 Service 层完成
- 缺少超时和错误处理。同步交易所数据可能因为网络问题超时，需要有重试和降级策略

# 可继续深入的方向

- WebSocket 行情推送：从轮询到推送到前端的改造
- 多交易所数据聚合：如何处理不同交易所的数据格式和延迟
- Redis 缓存淘汰策略：用 allkeys-lru 还是 volatile-ttl？
- 行情快照和 K 线数据的存储设计：时间序列数据库 vs 关系型数据库的选择
