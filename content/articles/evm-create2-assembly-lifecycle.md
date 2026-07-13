---
{
  "id": 8,
  "slug": "evm-create2-assembly-lifecycle",
  "kind": "engineering-note",
  "evidenceLevel": "source-reviewed",
  "evidenceSummary": "基于 CREATE2 与 assembly 生命周期的代码阅读和本地推演。",
  "title": "EVM 深度工程：create2、内联汇编与合约生命周期管理",
  "date": "2026-06-06",
  "summary": "深入 create2 确定性部署、Solidity 内联汇编的内存模型、合约自毁的边界条件和函数选择器的底层工作机制。",
  "tags": [
    "Solidity",
    "EVM",
    "Assembly",
    "create2"
  ],
  "readingTime": "14 min",
  "difficulty": "进阶",
  "conceptTags": [
    "evm"
  ],
  "relatedProjectIds": [],
  "recommendedSlugs": [
    "evm-call-proxy-patterns",
    "eip-erc-protocol-evolution"
  ],
  "suggestedQuestions": [
    "create2 在合约部署中解决什么问题？",
    "内联汇编在 EVM 工程里应该谨慎用在哪里？"
  ]
}
---

# 问题背景

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

```solidity
function getCodeSize(address addr) internal view returns (uint256 size) {
    assembly {
        size := extcodesize(addr)
    }
}
```

```solidity
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
```

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
- EIP-6780 对 selfdestruct 的限制——未来的合约自毁行为会如何变化
