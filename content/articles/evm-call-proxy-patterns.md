---
{
  "id": 7,
  "slug": "evm-call-proxy-patterns",
  "kind": "engineering-note",
  "title": "合约调用与代理升级：从 delegatecall 到钻石代理的工程实践",
  "date": "2026-06-02",
  "summary": "拆解 call / delegatecall / staticcall 的底层差异、透明代理 vs UUPS vs 钻石代理的取舍逻辑，以及不可升级合约的升级策略。",
  "tags": [
    "Solidity",
    "EVM",
    "Proxy",
    "Upgradeability"
  ],
  "readingTime": "14 min",
  "difficulty": "进阶",
  "conceptTags": [
    "evm"
  ],
  "relatedProjectIds": [],
  "recommendedSlugs": [
    "evm-create2-assembly-lifecycle",
    "eip-erc-protocol-evolution"
  ],
  "suggestedQuestions": [
    "delegatecall 和代理升级的工程风险是什么？",
    "钻石代理适合什么样的合约系统？"
  ]
}
---

# 问题背景

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

```solidity
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
```

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
- 代理模式在 Layer 2 上的 gas 表现差异
