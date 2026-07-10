export interface Project {
  id: number
  name: string
  positioning: string
  coreAbilities: string[]
  talkingPoints: string[]
  techStack: string[]
  github: string
  engineering: {
    role: string
    systemBoundary: string
    callFlow: string[]
    failureScenarios: string[]
    evidence: string[]
    knownLimits: string[]
    interviewSummary: string
  }
  learning?: {
    stage: string
    updatedAt: string
    goal: string
    verified: string[]
    verification: string[]
    verificationNote?: string
    tradeoffs: string[]
    nextSteps: string[]
  }
}

export const projects: Project[] = [
  {
    id: 7,
    name: 'wallet-core',
    positioning:
      '用 TypeScript 实现的多链离线钱包核心：统一密钥派生、交易构建与签名，把链上数据获取和私钥操作明确隔离。',
    coreAbilities: [
      '多链离线交易构建与签名',
      '链适配：账户模型、UTXO、对象模型',
      '最小单位整数金额约束',
      '交易元数据与私钥操作隔离',
      'TypeScript SDK 集成与可复现测试',
    ],
    talkingPoints: [
      '为什么离线核心不查询 RPC 或广播交易',
      'EVM nonce、BTC UTXO、Solana blockhash 与 Sui object 如何由调用方提供',
      '为什么金额只接受最小单位整数',
      '如何用链级测试验证不同交易模型',
    ],
    techStack: [
      'TypeScript',
      'ethers',
      'bitcoinjs-lib',
      '@solana/web3.js',
      '@mysten/sui',
      'CosmJS',
      'TronWeb',
      'Jest',
    ],
    github: 'https://github.com/qianqiu0404/wallet-core',
    engineering: {
      role: 'TypeScript 多链离线钱包核心的实现与验证',
      systemBoundary: '只负责密钥派生、交易构建与签名；RPC 查询、链上资源获取和广播由调用方承担。',
      callFlow: ['调用方准备链上资源', 'wallet-core 校验链级输入', '构建并签名交易', '返回 raw transaction 给调用方广播'],
      failureScenarios: ['链上资源过期后必须重新构建，不能复用旧签名', '浮点金额进入签名流程可能造成精度和资产错误'],
      evidence: ['TypeScript 类型检查', '8 个链相关 Jest 套件', 'Sui dry-run 充值模拟'],
      knownLimits: ['Cosmos 全量测试仍受依赖解析阻塞', '不包含在线 RPC 和广播服务'],
      interviewSummary: '用 TypeScript 实现多链离线钱包核心，重点不是统一 SDK，而是统一业务入口并保留 nonce、UTXO、blockhash 和 object version 等资源差异。',
    },
    learning: {
      stage: '持续验证中',
      updatedAt: '2026-07-10',
      goal: '把不同链的密钥、交易和签名差异收敛成可测试的离线核心，同时保留每条链不可被抹平的约束。',
      verified: [
        'EVM 系列原生币与 ERC20/BEP20 离线转账',
        'BTC 多 UTXO、找零、费率与多地址类型',
        'SOL/SPL Token、TRX/TRC20 与 Sui 原生转账',
        'Sui 充值交易的 dry-run 模拟流程',
      ],
      verification: ['npm run typecheck', 'npm test -- --runInBand', 'npm run test:sui', 'npm run build', 'npm run sui:deposit'],
      verificationNote:
        '当前 TypeScript 检查与 8 个链相关 Jest 套件可通过；完整 Jest 仍被 Cosmos 依赖解析缺少 @noble/hashes/sha2.js 阻塞，已作为待解决项记录。',
      tradeoffs: [
        '离线核心不负责 RPC 查询和广播；调用方必须提供新鲜的链元数据。',
        '金额只接受最小单位整数，避免浮点精度进入签名流程。',
        '示例和测试不保存生产密钥、助记词或私钥。',
      ],
      nextSteps: [
        '补齐更多异常交易与签名前参数校验。',
        '修复 Cosmos 测试的依赖解析，再恢复全量 Jest 验证。',
        '将链适配器的输入契约整理为可复用文档。',
        '持续记录多链资源状态在离线签名中的差异。',
      ],
    },
  },
  {
    id: 1,
    name: 'wallet-api',
    positioning:
      '交易所钱包三件套中的多链 RPC 网关：通过 ChainDispatcher 与 Chain Adaptor 路由不同链的区块、交易查询、交易构建和广播能力。',
    coreAbilities: [
      'ChainDispatcher 运行时路由',
      'EVM、Bitcoin、Solana、Sui 链适配',
      '查询、构建与广播职责边界',
      'BTC UTXO 与费率可选能力接口',
      'gRPC 服务与链节点 RPC 接入',
    ],
    talkingPoints: [
      '为什么节点能力与私钥能力使用两套不同接口',
      '工厂、registry 与 IChainAdaptor 分别解决什么问题',
      '为什么 BTC 特有能力不应塞进统一主接口',
      '当前 context 传播与类型断言还有哪些生产化边界',
    ],
    techStack: ['Go', 'gRPC', 'Chain Adaptor', 'EVM RPC', 'Bitcoin', 'Solana', 'Sui'],
    github: 'https://github.com/qianqiu0404/exchange-wallet-api',
    engineering: {
      role: '多链 RPC 网关的代码导读、接口边界梳理与运行验证',
      systemBoundary: '负责节点查询、交易构建与广播，不持有私钥，也不承担业务资金状态。',
      callFlow: ['gRPC 请求进入服务', 'ChainDispatcher 拦截并校验', '按 chain id 选择 adaptor', '调用具体链节点 client'],
      failureScenarios: ['直接类型断言可能因协议扩展遗漏而 panic', '请求取消未完整传播时节点调用仍会继续占用资源'],
      evidence: ['dispatcher 与 Ethereum/Bitcoin adaptor 测试', 'gRPC service 测试', 'BTC UTXO 与 FeeRate 可选接口代码入口'],
      knownLimits: ['核心接口仍偏大', '部分调用仍从 context.Background 创建超时'],
      interviewSummary: 'wallet-api 用 ChainDispatcher、工厂和 registry 路由多链节点能力，并通过小接口保留 BTC 等链的特有能力。',
    },
    learning: {
      stage: '主线项目 · 代码导读与验证中',
      updatedAt: '2026-07-10',
      goal: '把不同链的节点能力收敛到稳定的服务接口，同时保留 UTXO、费率和资源状态等链级差异。',
      verified: [
        'ChainDispatcher 按 chain id 选择具体 adaptor',
        'API 与 Sign 使用不同 IChainAdaptor，隔离节点与密钥能力',
        'BTC UTXO、FeeRate 通过小接口扩展',
      ],
      verification: [
        'go test ./chaindispatcher ./chain/ethereum ./chain/bitcoin',
        'go test ./services/grpc',
      ],
      tradeoffs: [
        '当前主接口仍较大，新链需要实现较多方法。',
        '部分外部边界使用直接类型断言，需要逐步改为显式校验。',
        '请求级 context 尚未完整贯穿到所有节点调用。',
      ],
      nextSteps: [
        '继续按查询、构建、广播拆小接口。',
        '补齐请求级 context 与默认 deadline。',
        '增加 adaptor 构造后的 nil 与能力校验。',
      ],
    },
  },
  {
    id: 2,
    name: 'wallet-sign',
    positioning:
      '交易所钱包三件套中的独立签名层：负责多链地址生成和交易签名，让业务服务与链节点服务都不直接接触完整私钥。',
    coreAbilities: [
      '签名接口与节点接口隔离',
      '多链地址生成与交易签名',
      'ChainDispatcher 签名 adaptor 路由',
      '本地密钥元数据与 LevelDB 边界',
      '普通签名机向 HSM/MPC 演进的接口位置',
    ],
    talkingPoints: [
      '为什么业务 service 不应直接持有私钥',
      'API 与 Sign 的同名接口为什么不能合并',
      '普通签名机的完整私钥单点风险是什么',
      'HSM 或 TSS 应接入在哪一层',
    ],
    techStack: ['Go', 'gRPC', 'LevelDB', 'ECDSA', 'Ed25519', 'BTC', 'EVM', 'Solana'],
    github: 'https://github.com/qianqiu0404/exchange-wallet-sign',
    engineering: {
      role: '签名服务安全边界与多链 adaptor 调用路径梳理',
      systemBoundary: '承接地址生成和交易签名；业务 service 与 wallet-api 均不直接处理私钥。',
      callFlow: ['业务服务提交签名请求', '签名 dispatcher 选择链 adaptor', '加载对应密钥元数据', '生成并返回签名结果'],
      failureScenarios: ['签名后广播前服务重启需要持久化 raw transaction', '普通签名机仍存在完整私钥单点风险'],
      evidence: ['签名 dispatcher 测试', 'RPC service 测试', '多链地址与签名代码入口'],
      knownLimits: ['尚未生产接入 HSM/MPC', 'graceful stop 的 context 约束仍需完善'],
      interviewSummary: 'wallet-sign 把私钥能力从业务和节点服务中隔离出来；HSM/TSS 是这一安全边界的后续升级，不替代提现风控与状态机。',
    },
    learning: {
      stage: '主线项目 · 安全边界梳理中',
      updatedAt: '2026-07-10',
      goal: '把地址生成与交易签名封装为独立安全边界，并明确普通签名、HSM 与 TSS 的能力差异。',
      verified: [
        '独立的签名侧 IChainAdaptor 与 dispatcher',
        '多链地址生成和交易签名调用路径',
        '业务服务通过 RPC 调用签名层，不直接处理私钥',
      ],
      verification: ['go test ./chaindispatcher', 'go test ./services/rpc'],
      tradeoffs: [
        '独立部署降低暴露面，但普通签名机仍存在完整私钥单点。',
        '当前 graceful stop 对传入 context 的约束仍需完善。',
        'HSM、MPC/TSS 属于生产化升级方向，不表述为已完成接入。',
      ],
      nextSteps: [
        '补齐签名请求的 deadline 与取消传播。',
        '整理签名机接入 HSM/MPC 的最小接口契约。',
        '增加异常签名输入与服务关闭场景测试。',
      ],
    },
  },
  {
    id: 3,
    name: 'market-services',
    positioning:
      '交易所行情数据服务：串联 Crawler、Worker、Redis/PostgreSQL、HTTP/gRPC API 与 Dashboard，并显式展示数据更新时间、延迟和错误状态。',
    coreAbilities: [
      'Crawler 与 Worker 职责拆分',
      'Redis 缓存与 PostgreSQL 持久化',
      'HTTP/gRPC 查询服务',
      'last_updated 与 data_delay_seconds',
      '前端显式错误状态，不用 mock 掩盖故障',
    ],
    talkingPoints: [
      '采集、处理、存储和查询为什么需要分层',
      '缓存与数据库如何承担不同的一致性职责',
      '为什么数据新鲜度也是 API 输出的一部分',
      '多数据源容灾与 K 线缺口补偿属于什么阶段',
    ],
    techStack: ['Go', 'HTTP', 'gRPC', 'Redis', 'PostgreSQL', 'GORM', 'Vite'],
    github: 'https://github.com/qianqiu0404/s78-market-services',
    engineering: {
      role: '行情采集、处理、存储与查询链路的拆分和数据可信表达',
      systemBoundary: '负责行情数据流和查询展示，不承担交易撮合与钱包资金状态。',
      callFlow: ['Crawler 获取行情', 'Worker 异步处理', 'Redis/PostgreSQL 存储', 'HTTP/gRPC API 查询', 'Dashboard 展示更新时间和延迟'],
      failureScenarios: ['API 失败时不能用 mock 数据伪装成功', '数据存在但过期时必须显式表达延迟'],
      evidence: ['Crawler/Worker 分层', 'last_updated 与 data_delay_seconds', 'Dashboard 错误状态'],
      knownLimits: ['公开测试与一键演示证据待补齐', '多数据源容灾和 K 线补偿仍是计划'],
      interviewSummary: 'S78 用于证明交易所后端的数据链路能力，核心是让采集、处理、缓存、持久化和查询职责清晰，并显式表达数据新鲜度。',
    },
    learning: {
      stage: '扩展项目 · 数据可信表达',
      updatedAt: '2026-07-10',
      goal: '练习从行情采集到查询展示的异步数据链路，并让接口错误和数据延迟对使用者可见。',
      verified: [
        'Crawler、Worker、缓存、数据库与 API 的职责划分',
        'Dashboard 和 Markets 展示更新时间与数据延迟',
        '接口失败时展示真实 Error，不使用 mock 兜底',
      ],
      verification: [],
      verificationNote: 'Obsidian 已记录实现边界；公开测试命令和演示证据仍待补齐。',
      tradeoffs: [
        '当前不把多数据源容灾和价格异常检测描述为已完成能力。',
        '行情可用不等于行情新鲜，必须同时表达数据时间。',
      ],
      nextSteps: [
        '补齐公开启动、测试与演示证据。',
        '验证 K 线缺口补偿和延迟告警。',
        '探索多数据源切换与价格异常检测。',
      ],
    },
  },
  {
    id: 5,
    name: 'tss-mpc',
    positioning:
      'TSS/MPC 签名安全研究项目：围绕 Manager/Node、Keygen/Sign、committee、threshold 与 key share，理解如何降低完整私钥单点风险。',
    coreAbilities: [
      'Manager 与 Node 职责边界',
      '多节点 Keygen 与 Sign 流程',
      'CPK、committee 与 threshold 元数据',
      '节点仅保存本地 key share',
      '大额提现签名安全的接入思路',
    ],
    talkingPoints: [
      'TSS 与链上 Multisig 的验证位置有什么不同',
      'Manager 为什么只负责调度而不应持有 share',
      'TSS 解决私钥风险但为什么不能替代业务风控',
      '钱包 service 应通过签名网关而不是直连每个 Node',
    ],
    techStack: ['Go', 'GG18', 'ECDSA', 'Paillier', 'P2P', 'gRPC', 'Protobuf'],
    github: 'https://github.com/dapplink-baas/tss',
    engineering: {
      role: 'TSS/MPC 代码导读与钱包签名安全接入研究',
      systemBoundary: 'TSS 负责多方 Keygen/Sign 与 key share 安全，不替代业务审核、限额、幂等和状态推进。',
      callFlow: ['Manager 选择 committee', 'Nodes 参与 Keygen/Sign', '满足 threshold 生成标准签名', '签名结果返回钱包签名网关'],
      failureScenarios: ['在线节点不足门限时签名不可用', 'Manager 不应持有完整 key share 或绕过委员会'],
      evidence: ['Manager/Node 职责代码导读', 'CPK、committee、threshold 元数据路径', 'Keygen/Sign 协议流程模型'],
      knownLimits: ['尚未独立记录完整可复现运行证据', '未生产接入钱包系统'],
      interviewSummary: 'TSS 通过多节点 key share 降低完整私钥单点风险；钱包 service 应调用 Manager 或签名网关，而不是直接连接每个 Node。',
    },
    learning: {
      stage: '安全研究 · 非生产接入',
      updatedAt: '2026-07-10',
      goal: '理解门限签名如何通过多节点 key share 降低完整私钥单点风险，以及它在交易所钱包中的正确接入边界。',
      verified: [
        'Manager 调度 Keygen/Sign 与 committee 选择',
        'Node 持有本地 share 并参与协议轮次',
        '满足 threshold 后生成标准 ECDSA 签名的流程模型',
      ],
      verification: [],
      verificationNote: '当前公开证据以代码导读和架构理解为主，不声称已经生产接入钱包系统。',
      tradeoffs: [
        'TSS 降低完整私钥单点风险，但不替代提现审核、限额和幂等状态机。',
        '研究理解与生产部署分开表述。',
      ],
      nextSteps: [
        '独立运行并记录可复现的 Keygen/Sign 证据。',
        '设计 wallet-sign 到 TSS Manager 的签名请求契约。',
        '补充节点故障和不足门限时的失败场景。',
      ],
    },
  },
]
