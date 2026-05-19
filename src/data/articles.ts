export interface Article {
  id: number
  slug: string
  title: string
  date: string
  summary: string
  tags: string[]
  readingTime: string
  difficulty: string
  content: string
}

export const articles: Article[] = [
  {
    id: 1,
    slug: 'api-system-calls',
    title: 'API 到底是什么？从钱包后端项目理解系统调用',
    date: '2026-05-14',
    summary:
      '从前端、后端、数据库、第三方服务、链节点和签名机之间的关系，拆解 API 在现代软件系统中的连接作用。',
    tags: ['API', 'Backend', 'System Design', 'Wallet'],
    readingTime: '8 min',
    difficulty: '基础',
    content: `# 问题背景

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

\`\`\`
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
\`\`\`

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
- API 中间件设计：限流、鉴权、日志、审计在钱包系统中的具体实现`,
  },
  {
    id: 2,
    slug: 'http-rpc-grpc',
    title: 'HTTP、RPC、gRPC 的区别与项目使用场景',
    date: '2026-05-14',
    summary:
      '结合钱包系统和行情服务，解释 HTTP 更适合对外接口，gRPC 更适合内部服务调用，RPC 是远程过程调用思想。',
    tags: ['HTTP', 'RPC', 'gRPC', 'Backend'],
    readingTime: '10 min',
    difficulty: '进阶',
    content: `# 问题背景

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
- gRPC-Gateway：从 proto 生成 RESTful API，同时提供 HTTP 和 gRPC`,
  },
  {
    id: 3,
    slug: 'wallet-api-boundary',
    title: 'wallet-api：多链钱包后端 API 的职责边界',
    date: '2026-05-14',
    summary:
      '梳理多链钱包 API 服务如何组织链配置、接口入口、节点调用、交易构建和签名服务协作。',
    tags: ['Web3', 'Wallet', 'Go', 'API'],
    readingTime: '12 min',
    difficulty: '项目拆解',
    content: `# 问题背景

多链钱包后端 API 不是一条链一个独立服务，而是通过统一的接口抽象来管理多条公链。难点在于不同链的账户模型、交易结构、RPC 接口、签名算法各不相同，如何在 API 层做好封装和职责划分，是 wallet-api 设计的核心问题。

# 核心概念

wallet-api 在钱包系统中位于最上层，直接对接前端和管理端。它不直接处理链上数据，而是通过 Chain Adapter 调用链节点 RPC；不直接处理私钥，而是通过 gRPC 调用 wallet-sign 获取签名能力。

## 应该负责的

- 对外 HTTP API 入口
- 参数校验和权限控制
- 多链配置读取（RPC 地址、chainId、代币合约地址等）
- 地址生成、余额查询、交易构建等能力的编排
- 调用链节点 RPC 获取链上数据
- 调用 wallet-sign 获取签名能力
- 统一响应格式和错误处理

## 不应该负责的

- 直接暴露私钥或助记词
- 在 API 层管理签名逻辑
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

\`\`\`
HTTP Request (chainId=eth, method=getBalance, params=...)
  → ChainDispatcher
    → 根据 chainId 查找对应的 Chain Adapter
      → ETH Adapter
        → 调用 ETH 节点 RPC
        → 返回统一格式的 Balance 结构
\`\`\`

新增一条链只需要实现 Adapter 接口并注册到 ChainDispatcher，API 层不需要改动。

# 关键调用链

以"构建并发送交易"为例：

\`\`\`
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
\`\`\`

# 工程设计取舍

## API 层编排，签名机处理签名

这不是技术选型，而是安全设计。API 层面向公网，不应该持有私钥能力。签名能力下沉到 wallet-sign，API 层通过内部 gRPC 调用签名能力。

## 链适配器优于暴力 if-else

当链少时，直接在 Service 层写 if chainId == eth {} else if chainId == btc {} 确实简单。但当链超过 3 条时这种写法就变成维护噩梦。Chain Adapter 模式虽然前期多了一层抽象，但新增链时只需要加文件，不需要改已有逻辑。

# 常见坑

- 直接在 Handler 里写链逻辑。Handler 应该只是参数解析和响应包装
- 多链配置写死在代码里。应该通过 config 文件或配置中心管理 RPC 地址、合约地址等
- API 层持有私钥。这是最常见的安全问题
- 错误处理不统一。ETH 返回的错误格式和 BTC 完全不同，前端需要统一处理

# 可继续深入的方向

- Chain Adapter 的接口设计：统一到什么粒度？地址生成、余额查询、交易构建、签名等是否都在同一个接口？
- API 层缓存的引入时机：余额是否需要缓存？交易状态是否需要轮询？
- 多链交易状态跟踪：不同链的确认规则不同，如何统一管理交易状态？`,
  },
  {
    id: 4,
    slug: 'wallet-sign-signer',
    title: 'wallet-sign：多链签名机为什么要独立设计',
    date: '2026-05-14',
    summary:
      '从安全边界、私钥管理、离线签名、批量签名和多链差异角度，拆解签名机在钱包系统中的位置。',
    tags: ['Wallet', 'Signer', 'Security', 'Multi-chain'],
    readingTime: '12 min',
    difficulty: '项目拆解',
    content: `# 问题背景

签名机（Signer）是钱包系统中安全要求最高的组件。它负责一件事：用私钥对交易进行签名。但正是这个看似简单的操作，决定了钱包系统的安全边界。为什么要把签名能力单独拆分出来，而不是直接在 API 层签名？这是理解 wallet-sign 设计的关键。

# 核心概念

签名机解决的是"私钥能力如何安全使用"的问题。它不是业务服务，更像一个能力服务：

- 输入：待签名的交易数据
- 处理：校验请求合法性，找到对应的密钥材料
- 输出：返回签名结果

签名机不应该做太多业务逻辑。它不应该关心交易是否合理、金额是否合法、链是否正常——这些是 API 层的职责。

## 为什么签名机要独立

- 降低攻击面：API 层面向公网，签名机只暴露给受信任的内部服务
- 隔离私钥相关逻辑：私钥的加载、缓存、使用全部在签名机内部完成
- 权限边界更清晰：API 层拿到的是签名结果，不是签名能力
- 方便审计和限流：签名操作需要严格审计，API 层的普通请求不需要这么高规格的审计

# 放到我的项目里怎么理解

## 多链签名差异

不同链的签名逻辑差异巨大，这是签名机设计时必须面对的复杂性：

### BTC
- UTXO 模型：交易由输入和输出组成
- 需要处理找零地址
- SIGHASH 类型决定签名的覆盖范围
- PSBT（部分签名比特币交易）支持多签协作

### ETH
- 账户模型：交易结构包含 nonce、gasPrice、gasLimit、to、value、data
- EIP-1559 引入 maxPriorityFeePerGas 和 maxFeePerGas
- chainId 防止跨链重放攻击
- 签名使用 secp256k1 椭圆曲线

### Solana
- 使用 Ed25519 签名算法
- recentBlockhash 替代 nonce
- 交易由指令（instructions）组成
- 需要处理 ATA（关联代币账户）地址

### Cosmos
- 使用 Tendermint 共识
- account number 和 sequence 控制重放
- fee 和 memo 字段需要处理

# 关键调用链

\`\`\`
wallet-api → gRPC SignTransaction(request)
  → wallet-sign gRPC Server
    → 请求鉴权（内部 Token 验证）
    → 校验请求参数和签名内容
    → Signer Module
      → 根据 chainId 获取对应链的签名器
      → 从 Key Storage 获取私钥
      → 执行签名逻辑
      → 返回签名结果
    → 审计日志记录
  → 返回签名后的交易
\`\`\`

# 工程设计取舍

## 批量签名策略

- 串行批量：简单但吞吐有限，适合低频场景
- 并发签名：需要控制 goroutine 数量，避免资源耗尽
- 签名任务天然适合按请求隔离，每条签名请求互不依赖

## 安全边界设计

- 私钥不能出签名机：签名结果返回给调用方，私钥始终在签名机内部
- 签名请求要鉴权：不是谁都能调用签名机
- 重要操作要审计：谁在什么时间签了什么交易，必须有记录
- 签名内容要可验证：签名机返回的结果应该能被调用方验证
- 防止任意消息签名：签名机应该验证被签名的内容是否合理

# 常见坑

- API 层直接处理私钥。这是最严重的错误，等于把资产安全交给公网接口
- 签名机暴露给公网。签名机应该只在内部网络可达
- 不校验签名内容。签名机应该拒绝明显不合理的签名请求
- 批量签名无并发限制。大量签名请求同时到达可能导致资源耗尽或死锁
- 错误信息泄露敏感细节。签名失败的原因如果包含私钥状态信息，等于主动暴露安全细节

# 可继续深入的方向

- HSM（硬件安全模块）集成：从软件签名到硬件签名的升级路径
- 多签和 MPC（多方计算）签名的设计差异
- 签名请求的限流和优先级策略：提现签名应该比普通签名有更高的优先级
- 签名机的灾备设计：签名机挂了怎么办？如何做热备？`,
  },
  {
    id: 5,
    slug: 'market-services-data-flow',
    title: 'market-services：Go 行情服务如何组织数据流',
    date: '2026-05-14',
    summary:
      '从 HTTP、gRPC、Redis、PostgreSQL、行情同步和 Dashboard API，拆解一个 Go 后端行情服务如何运行。',
    tags: ['Go', 'Market', 'Backend', 'Redis'],
    readingTime: '12 min',
    difficulty: '项目拆解',
    content: `# 问题背景

行情服务（market-services）的核心职责是从交易所获取行情数据，经过清洗、计算和存储后，对外提供查询接口。技术上看起来不复杂——定时拉数据，存起来，再提供 API 查询。但实际落地时，数据流的每个环节都有工程问题需要解决。

# 核心概念

## 行情服务要解决的核心问题

- 从多个交易所获取行情数据
- 清洗和计算数据（聚合、转换、计算指标）
- 缓存高频数据，避免重复计算
- 持久化关键数据，支持历史查询
- 对内对外提供不同类型的 API

## 完整数据链路

\`\`\`
交易所 API → Crawler（数据抓取）
  → Redis Cache（高频缓存）
    → Worker（数据计算和处理）
      → PostgreSQL（持久化存储）
        → HTTP/gRPC API
          → Frontend Dashboard
\`\`\`

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

\`\`\`
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
\`\`\`

## 行情同步流程

\`\`\`
定时任务触发
  → Crawler 调用交易所 REST API / WebSocket
    → 获取原始行情数据
    → 数据清洗（格式统一、异常过滤）
    → 写入 Redis（短期缓存）
    → Worker 计算指标（聚合、统计）
      → 写入 PostgreSQL（持久化快照）
\`\`\`

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
- 行情快照和 K 线数据的存储设计：时间序列数据库 vs 关系型数据库的选择`,
  },
  {
    id: 6,
    slug: 'wallet-address-models',
    title: 'BTC、ETH、Solana 地址生成与签名模型对比',
    date: '2026-05-14',
    summary:
      '对比 UTXO 模型、账户模型、HD 钱包路径、地址格式和不同链的签名逻辑差异，理解多链钱包为什么需要抽象。',
    tags: ['BTC', 'ETH', 'Solana', 'Multi-chain'],
    readingTime: '12 min',
    difficulty: '进阶',
    content: `# 问题背景

多链钱包开发中最容易踩的坑，就是把所有链当成同一种账户模型来理解。BTC 用 UTXO 模型，ETH 用账户模型，Solana 用账户/公钥模型——这三种模型在地址生成、交易构建和签名流程上的差异，直接决定了 wallet-api 和 wallet-sign 中 Chain Adapter 的设计思路。

# 核心概念

## BTC：UTXO 模型

BTC 没有"余额"概念。一个地址的余额是所有未花费输出（UTXO）的总和。交易由输入和输出组成：

- 输入：引用一个已有的 UTXO
- 输出：创建一个新的 UTXO，包含收款地址和金额
- 找零：输入总额大于输出部分，需要创建找零输出回到发送方

地址类型：
- P2PKH（Legacy）：以 1 开头
- P2SH-P2WPKH（Nested SegWit）：以 3 开头
- P2WPKH（Native SegWit）：以 bc1 开头
- Taproot：以 bc1p 开头

HD 钱包路径示例：m/44'/0'/0'/0/0（BIP44）或 m/84'/0'/0'/0/0（BIP84）

## ETH：账户模型

ETH 使用账户模型，每个地址有一个余额和一个 nonce。交易直接修改账户状态：

- 发送方减少余额
- 接收方增加余额
- nonce 递增防止重放和保证交易顺序

地址从 secp256k1 公钥中取 keccak256 哈希的最后 20 字节，前面补 0x。HD 钱包路径：m/44'/60'/0'/0/0

关键概念：
- nonce：交易计数器，从 0 开始递增
- gas：交易执行的计算成本
- EIP-1559：引入基础费用和优先费用，取代原来的 gasPrice
- chainId：防止交易在不同链上被重放

## Solana：账户/公钥模型

Solana 使用 Ed25519 签名算法，地址直接是公钥的 Base58 编码。交易由指令（instructions）组成，每个指令包含程序 ID、账户列表和指令数据。

关键概念：
- recentBlockhash：代替 nonce，用于防止重放和交易过期
- instructions：交易的执行单元
- ATA（关联代币账户）：SPL Token 的持有方式

# 对钱包后端设计的影响

## 地址生成模块必须按链适配

每条链的地址生成算法不同。不能用一个函数生成所有链的地址。Chain Adapter 中的地址生成方法应该按链实现：

- BTC：根据公钥和地址类型生成不同格式的地址
- ETH：公钥取 keccak256 后 20 字节
- Solana：公钥编码为 Base58

## 交易构建不能统一成一种结构

BTC 需要构建输入输出列表、找零地址和手续费估算。ETH 需要 nonce、gas、data 字段。Solana 需要 instructions 和 recentBlockhash。强行统一只会让代码变得难以维护。

## 签名逻辑必须链隔离

不同链的签名算法不同：BTC 和 ETH 使用 secp256k1（ECDSA），Solana 使用 Ed25519。签名机的内部实现需要为每条链提供独立的签名器。

## 数据流差异

\`\`\`
BTC 余额查询：
  调用链节点 → 获取地址的所有 UTXO → 汇总金额

ETH 余额查询：
  调用链节点 → 获取地址的余额和 nonce

Solana 余额查询：
  调用链节点 → 获取账户的 lamports 余额
\`\`\`

# 常见坑

- 把所有链都当 ETH 账户模型处理。BTC 的 UTXO 模型完全不同于账户模型
- 忽略 BTC 找零。构建 BTC 交易时如果忘记找零，多余的金额会被矿工拿走
- 忽略 nonce/sequence。ETH 的 nonce 不连续会导致交易卡死
- 不区分签名算法。用 secp256k1 去签 Solana 的交易
- HD 路径写错。不同链的 coin type 不同，路径不对会导致地址不一致

# 可继续深入的方向

- 多链地址格式转换：如何统一管理不同链的地址显示
- EIP-712 结构化签名在 DApp 中的使用
- BTC Taproot 升级对签名模型的影响
- Solana 版本化交易和查找表的机制`,
  },
  {
    id: 7,
    slug: 'evm-call-proxy-patterns',
    title: '合约调用与代理升级：从 delegatecall 到钻石代理的工程实践',
    date: '2026-05-17',
    summary:
      '拆解 call / delegatecall / staticcall 的底层差异、透明代理 vs UUPS vs 钻石代理的取舍逻辑，以及不可升级合约的升级策略。',
    tags: ['Solidity', 'EVM', 'Proxy', 'Upgradeability'],
    readingTime: '14 min',
    difficulty: '进阶',
    content: `# 问题背景

Solidity 合约一旦部署就不能修改代码——这是区块链的确定性承诺。但在工程实践中，bug 修复、功能迭代、gas 优化都需要合约升级。代理模式（Proxy Pattern）就是为解决这个矛盾而生的：把状态和逻辑分离，让不可变的代理指向可替换的逻辑合约。

# 核心概念

## call、delegatecall 和 staticcall

这三个 opcode 是 EVM 合约间调用的基石，但行为完全不同：

### call
- 切换上下文到被调用合约
- 修改目标合约的 storage
- 可以发送 ETH
- msg.sender 变成当前合约
- 常用于标准的外部合约调用

### delegatecall
- 保持调用者的上下文（storage、msg.sender、msg.value）
- 在被调用合约的代码逻辑中修改调用者的 storage
- 核心特征："借代码，用自己的存储"
- 代理模式的基础——代理合约用 delegatecall 执行逻辑合约的代码

### staticcall
- 只读调用，不允许修改任何状态
- 如果被调用合约尝试写 storage 或 emit event 会 revert
- 适用于 view 函数的外部调用
- 比 call 更安全——保证了无副作用

## 代理模式的核心机制

代理合约的 storage 布局必须和逻辑合约完全一致。这不是建议，是硬约束：

\`\`\`solidity
// 代理合约
contract Proxy {
    address implementation; // slot 0
    
    fallback() external payable {
        address impl = implementation;
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}
\`\`\`

关键：代理合约的 fallback 函数用 delegatecall 把调用转发给逻辑合约。逻辑合约的代码在代理合约的 storage 上下文中执行。

# 透明代理 vs UUPS

## 透明代理（Transparent Proxy）
- 代理合约负责升级逻辑
- admin 地址调用的是升级函数，普通用户调用的是逻辑合约函数
- 每次调用多一次 SLOAD 检查 msg.sender 是否等于 admin
- 部署时同时部署代理和逻辑合约

## UUPS（Universal Upgradeable Proxy Standard）
- 升级逻辑在逻辑合约内部（upgradeTo 函数）
- 代理合约更轻量，只做转发
- 比透明代理省 gas（不需要每次检查 admin）
- 缺点：如果逻辑合约没有 upgradeTo 函数，合约就永远不能升级了

工程选择：
- 简单场景用透明代理（更安全但更贵）
- gas 敏感场景用 UUPS（更省但需要正确编写 upgradeTo）
- 两者都由 OpenZeppelin 提供了生产级实现

## 钻石代理（Diamond Pattern / EIP-2535）

当单个合约超过 24KB 部署限制时，需要钻石代理：
- 不是一对一的代理映射，而是一对多
- 一个钻石代理对应多个 facet 合约
- 每个 facet 负责一组函数
- 通过 function selector 映射到具体的 facet
- 可以单独升级某个 facet 而不影响其他

## 信标代理（Beacon Proxy）
- 引入 Beacon 合约作为逻辑合约地址的注册中心
- 多个代理合约指向同一个 Beacon，Beacon 指向同一个逻辑合约
- 适合需要部署大量相同逻辑实例的场景（如 ERC721 工厂）
- 升级逻辑合约时只需修改 Beacon，所有代理同步更新

# 不可升级合约的升级策略

如果已经部署了不可升级合约但没有预留代理机制：

1. **迁移模式**：部署新合约 + 数据迁移工具（需要用户手动迁移）
2. **Registry 模式**：部署一个 Registry 合约指向最新版本，前端始终从 Registry 读取地址
3. **Wrapper 模式**：部署 Wrapper 合约包装旧合约，逐步迁移功能

# 存储布局冲突的经典问题

代理升级时最危险的就是 storage collision：
- 新版本逻辑合约如果在原有 storage 变量之间插入新变量，会打乱 slot 分配
- 旧数据会被错误解读
- OpenZeppelin 的 Unstructured Storage 模式通过伪随机 slot 避免这个问题

# 常见坑

- delegatecall 后使用 selfdestruct。代理合约的状态会保留，但逻辑合约可能被删除导致代理失效
- UUPS 的 upgradeTo 没有 onlyProxy 保护。攻击者可以通过逻辑合约直接修改 implementation
- 钻石代理的 selector 冲突。两个 facet 有相同的函数选择器会导致路由混乱
- 忘记初始化逻辑合约。透明代理的 initialize 函数如果没有 constructor 保护，可能被多次调用
- storage gap 不足。升级合约时没有预留足够的 storage 空间给未来扩展

# 可继续深入的方向

- EIP-1967 标准代理 storage slot 的设计原理
- OpenZeppelin Upgrades Plugin 的自动化安全校验
- 多链代理治理：不同链上的代理如何由同一个 DAO 管理
- 代理模式在 Layer 2 上的 gas 表现差异`,
  },
  {
    id: 8,
    slug: 'evm-create2-assembly-lifecycle',
    title: 'EVM 深度工程：create2、内联汇编与合约生命周期管理',
    date: '2026-05-17',
    summary:
      '深入 create2 确定性部署、Solidity 内联汇编的内存模型、合约自毁的边界条件和函数选择器的底层工作机制。',
    tags: ['Solidity', 'EVM', 'Assembly', 'create2'],
    readingTime: '14 min',
    difficulty: '进阶',
    content: `# 问题背景

理解 EVM 的工作机制不只是学术兴趣——create2 确定性部署可以支撑工厂模式的 Gas 优化，内联汇编可以突破 Solidity 抽象层的限制，函数选择器是代理路由的核心，selfdestruct 的自毁边界直接影响安全审计。

# create2 确定性部署

## 和 create 的区别

- create：新合约地址 = keccak256(sender, nonce)
- create2：新合约地址 = keccak256(0xFF, sender, salt, bytecodeHash)
- create 依赖 nonce，nonce 增加后无法重复得到同一个地址
- create2 用 salt 控制地址，相同参数可以反复得到同一个地址

## 工程应用场景

1. **反事实部署（Counterfactual Deployment）**
   - 在不知道合约地址的情况下与之交互
   - 先计算地址，再部署合约
   - 用于 Layer 2 和各种 bridge 协议

2. **确定性工厂**
   - 工厂合约用 create2 部署子合约
   - 相同参数永远得到相同地址
   - 部署前就可以计算地址

3. **Metamorphic 合约**
   - create2 + selfdestruct + create2 可以创建不同代码的合约在同一个地址
   - 这是极其危险的技术，需要额外权限控制

## create2 的安全性

- create2 地址不会因为链上状态变化而改变
- salt 暴露出的话攻击者可以抢先部署
- 用 msg.sender 作为 salt 的一部分可以防止跨用户冲突

# Solidity 内联汇编

## 为什么需要内联汇编

- Solidity 某些操作没有高级语言支持（如 extcodesize、returndatasize）
- Gas 关键路径上的优化
- 实现代理合约的 fallback（delegatecall 转发）

## 内存模型

EVM 内存是线性的字节数组：
- 0x00 - 0x3f：临时存储区（scratch space）
- 0x40 - 0x5f：空闲内存指针（free memory pointer）
- 0x60 - 0x7f：零值槽（zero slot）
- 0x80 开始：合约的存储变量区域

内联汇编的内存操作需要注意：
- mload(0x40) 读取空闲内存指针
- mstore(0x40, newPtr) 更新空闲内存指针
- 不要覆盖 0x00-0x7f 的保留区域

## 典型模式

\`\`\`solidity
function getCodeSize(address addr) internal view returns (uint256 size) {
    assembly {
        size := extcodesize(addr)
    }
}
\`\`\`

\`\`\`solidity
function delegateForward() internal {
    assembly {
        calldatacopy(0, 0, calldatasize())
        let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)
        returndatacopy(0, 0, returndatasize())
        switch result
        case 0 { revert(0, returndatasize()) }
        default { return(0, returndatasize()) }
    }
}
\`\`\`

# 合约删除与自毁

## selfdestruct 的行为

- 从区块链状态中删除合约的 bytecode 和 storage
- 剩余 ETH 强制转移到指定地址（即使是拒绝接收 ETH 的合约）
- 这是 EVM 唯一强制转账的方式

## 自毁的时机考量

- 合约被自毁后，调用它不会 revert——而是无声成功（因为没有代码可以执行）
- 攻击者可以自毁包含恶意逻辑的合约并用 create2 重新部署新代码
- EIP-6049 已废弃 selfdestruct 的强制转账能力（将迁移到 SENDALL）

## 工程中的使用场景

- 合约迁移：旧合约自毁，资金转移到新合约
- 合约工厂清理：子合约生命周期结束时的清理
- 紧急停止：在攻击发生时自毁合约以阻止进一步损失

# 函数选择器

函数选择器是 keccak256("functionName(type1,type2,...)") 的前 4 字节：

- transfer(address,uint256) → 0xa9059cbb
- balanceOf(address) → 0x70a08231
- upgradeTo(address) → 0x3659cfe6

代理合约通过 abi.decode 解析 calldata 的前 4 字节来决定路由到哪个逻辑合约（或钻石的哪个 facet）。

参数类型空格规则：uint256 不加空格，address 不加空格，但类型之间的逗号后不加空格——这是一个常见的编码错误。

# 合约 Lib 库

Solidity 的 library 有两种部署方式：

1. **内嵌库（Internal）**
   - 库代码直接嵌入调用合约
   - 不增加外部调用开销
   - 不占用独立地址

2. **链接库（External / Deployed）**
   - 库独立部署，多个合约共享同一个库地址
   - 调用有外部委托调用开销
   - 通过 delegatecall 执行

OpenZeppelin 的库大多是内嵌库，而 Uniswap 的 FixedPoint 等数学库通常作为链接库以节省 bytecode。

# 常见坑

- create2 的 salt 碰撞：部署前不检查地址是否已存在
- 内联汇编不更新 free memory pointer：后续 Solidity 代码可能覆盖已分配的内存
- selfdestruct 后依赖 create2 重新部署的合约：Metamorphic 攻击
- 函数选择器碰撞：两个不同的函数名产生相同的 4 字节选择器
- library 使用了 storage 引用但作为 external library 部署时 storage 指针失效

# 可继续深入的方向

- EVM 的 storage slot packing 和 SSTORE 的 gas 退费机制
- Yul optimization：手动优化内联汇编的 gas 成本
- opcode 级合约分析：用 evmone 或 revm 调试合约执行的每一步
- EIP-6780 对 selfdestruct 的限制——未来的合约自毁行为会如何变化`,
  },
  {
    id: 9,
    slug: 'eip-erc-protocol-evolution',
    title: 'EIP 工程解读：从 ERC20 到 EIP7702 的协议演进与选择逻辑',
    date: '2026-05-17',
    summary:
      '梳理 ERC20/721/1155 的工程差异、EIP1559 的 gas 模型变革、EIP4337 账户抽象和 EIP7702 的 EOA 升级路径。',
    tags: ['EIP', 'ERC', 'Ethereum', 'Standards'],
    readingTime: '14 min',
    difficulty: '进阶',
    content: `# 问题背景

EIP（Ethereum Improvement Proposal）不是简单的 "标准列表"，每一次协议升级背后都有具体的工程问题在驱动。理解这些标准的演进逻辑，比记住它们的编号更重要。

# ERC20 / ERC721 / ERC1155：代币标准的工程差异

## ERC20

- 同质化代币，每个单位的价值相同
- 核心接口：transfer、approve、transferFrom
- approve + transferFrom 的双步授权模式引入了已知的 race condition
- ERC20 的 permit（EIP-2612）通过链下签名改善了 UX

## ERC721

- 非同质化代币，每个 tokenId 独一无二
- 核心接口：ownerOf、safeTransferFrom、approve
- tokenURI 为每个 token 绑定链下元数据（通常指向 IPFS）
- 枚举扩展（ERC721Enumerable）和元数据扩展（ERC721Metadata）是可选的
- 所有权枚举（遍历用户拥有的所有 token）的 gas 成本随持有量线性增长

## ERC1155

- 多代币标准：一个合约管理无限种 token（同质化和非同质化）
- 批量转账：一次交易转移多种 token，大幅降低 gas
- 安全转账回调：onERC1155Received 可以拒绝不支持的 token
- 适合游戏场景——一个合约管理装备、货币、皮肤等所有资产
- 缺点：事件索引更复杂，不支持 approve 模式

## 工程选择逻辑

- 单一资产类型 → ERC20 / ERC721
- 多种资产类型混合 → ERC1155
- 需要 approve + transferFrom 双步流程 → ERC20
- 批量操作频繁 → ERC1155
- 每个 token 需要独立的链下元数据 → ERC721

# EIP1559：Gas 模型的范式转变

不是 "降低 Gas"，而是改变了 Gas 的计算和分配方式：

- 引入基础费用（baseFeePerGas），协议自动调整
- 区块弹性：目标 gas 上限是 maxGasLimit 的 50%，超过后基础费用自动上涨
- 引入优先费用（maxPriorityFeePerGas）作为矿工/验证者的小费
- 基础费用被销毁而不是分配给矿工，减少了 ETH 的通胀率

## 对合约开发的影响

- tx.gasprice 不再可靠——应该用 block.basefee 和 tx.maxPriorityFeePerGas
- 合约不能再用 "gas 价格低就不处理" 的逻辑
- 费用估算需要同时考虑 baseFee 和 priorityFee

# EIP1167：最小代理 Clone

- 部署一个指向现有合约的克隆代理，只需要约 55 字节的 bytecode
- 比全套部署便宜约 10 倍
- 用于工厂模式大量部署相同的逻辑合约实例
- 不是代理升级模式——克隆的代理指向固定逻辑合约
- Uniswap V2 的 pair 合约工厂就是用的这种模式

# EIP2930：可选访问列表

- 交易可以预先声明想要访问的地址和 storage slot
- 访问列表内的地址和 slot 使用更低的 gas 价格（热访问）
- 复杂交易（如跨多个合约的套利）可以节省 5-10% 的 gas
- 缺点是如果声明的 slot 没有被实际访问，白交了列表的 gas

# EIP3643：合规代币标准

- 为证券类代币设计的标准
- 核心：onchainID 身份系统和 transfer 验证
- 只有经过 KYC 认证的地址可以持有和转移代币
- 不是替代 ERC20——是在 ERC20 之上加了合规层
- 用于现实资产的代币化（如房地产、债券）

# EIP4337：账户抽象

- 不是共识层 EIP（账户抽象），而是通过智能合约钱包实现的替代内存池
- UserOperation 替代传统交易结构
- Bundler 收集 UserOperation 并打包提交到 EntryPoint 合约
- Paymaster 机制允许第三方代付 gas
- 核心价值：钱包可以用任何验证逻辑（社交恢复、多签、ECDSA），不局限于 EOA 的 secp256k1

# EIP4844：Blob 交易

- proto-danksharding 的第一步
- 引入 Blob 携带交易——可以在交易中携带大块临时数据
- L2 的 calldata 成本显著下降（rollup 将数据放在 blob 而不是 calldata）
- Blob 数据在约 18 天后被丢弃——不是永久存储
- 对 L1 合约开发没有直接影响，但对 L2 生态是革命性的

# EIP7702：EOA 账户升级

- 允许 EOA（外部账户）临时设置一个合约代码来执行
- EOA 可以拥有智能合约钱包的能力（批量交易、gas 赞助、社交恢复）
- 比 EIP4337 更底层的方案——不需要 Bundler 和 EntryPoint
- 单笔交易设置 code + 执行 code
- 这是让现有 EOA 用户无障碍过渡到智能钱包的桥梁

# 协议演进的底层逻辑

按时间线看 EIP/ERC 的演变：

1. **建立基础**：ERC20 定义同质化代币标准
2. **扩展资产类型**：ERC721（非同质化）、ERC1155（多代币）
3. **优化经济模型**：EIP1559 改革 Gas 市场
4. **降低部署成本**：EIP1167 最小代理
5. **突破 L1 限制**：EIP4844 让 L2 更便宜
6. **打破账户壁垒**：EIP4337（智能钱包）→ EIP7702（EOA 升级）

每一步都不是孤立的——后面的一步往往解决前一步暴露出来的工程瓶颈。

# 常见坑

- ERC20 的 approve 后余额可能被消耗，导致 approve 的额度不再有意义（front-run）
- ERC1155 的安全性回调如果不实现，token 可能被锁死在不支持 ERC1155 的合约里
- EIP1559 后仍然用 tx.gasprice 做费用估算
- EIP1167 克隆的代理完全复制原合约的逻辑——如果原合约有自毁逻辑，克隆也会受影响
- EIP4337 的 UserOperation 如果 gas 设置太低，Bundler 不会打包，但用户可能不知道

# 可继续深入的方向

- Permit2（Uniswap）如何改进 ERC20 的 approve 流程
- ERC6551 Token Bound Account：每个 NFT 可以有自己的钱包地址
- EIP712 结构化签名在 EIP2612 permit 中的应用
- EIP6900 模块化账户架构：智能账户的插件系统
- 跨链代币标准（ERC7281 / xERC20）如何在多链场景下统一接口`,
  },
]
