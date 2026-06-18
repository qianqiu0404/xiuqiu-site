---
{
  "id": 9,
  "slug": "eip-erc-protocol-evolution",
  "title": "EIP 工程解读：从 ERC20 到 EIP7702 的协议演进与选择逻辑",
  "date": "2026-06-10",
  "summary": "梳理 ERC20/721/1155 的工程差异、EIP1559 的 gas 模型变革、EIP4337 账户抽象和 EIP7702 的 EOA 升级路径。",
  "tags": [
    "EIP",
    "ERC",
    "Ethereum",
    "Standards"
  ],
  "readingTime": "14 min",
  "difficulty": "进阶",
  "conceptTags": [
    "evm",
    "api-design"
  ],
  "relatedProjectIds": [
    4,
    6
  ],
  "recommendedSlugs": [
    "evm-call-proxy-patterns",
    "evm-create2-assembly-lifecycle"
  ],
  "suggestedQuestions": [
    "ERC20 到 EIP7702 的演进反映了哪些工程取舍？",
    "协议标准如何影响钱包和 DApp 的设计？"
  ]
}
---

# 问题背景

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
- 跨链代币标准（ERC7281 / xERC20）如何在多链场景下统一接口
