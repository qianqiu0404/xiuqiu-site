---
{
  "id": 37,
  "slug": "wallet-software-supply-chain",
  "kind": "engineering-note",
  "series": "钱包签名与基础设施安全",
  "seriesOrder": 5,
  "evidenceLevel": "source-reviewed",
  "evidenceSummary": "依据 CISA 软件供应链指南、GitHub Actions 安全指南、npm Lockfile 文档与 Bybit 官方事件时间线整理；当前项目已执行依赖锁定与 Secret Scan，但未完成签名制品和部署 Provenance。",
  "title": "从恶意依赖到错误交易：钱包软件供应链攻击路径",
  "date": "2026-07-20",
  "summary": "攻击者不一定攻击链或签名算法，也可以从开发机、依赖、CI、Artifact、容器和签名界面进入。本文沿源码到生产运行的交付链，分析钱包项目如何防止可信流程交付恶意代码。",
  "tags": ["Web3", "Wallet", "Supply Chain", "CI/CD", "Security"],
  "difficulty": "安全工程",
  "conceptTags": ["wallet-backend", "signer-service", "go-infra", "api-design"],
  "relatedProjectIds": [1],
  "recommendedSlugs": [
    "wallet-signing-intent-abuse",
    "cryptographic-nonce-key-leak",
    "hsm-key-extractability-boundaries",
    "wallet-sign-signer",
    "codex-ai-workflow-system-retrospective",
    "wallet-rpc-trust-boundary"
  ],
  "suggestedQuestions": [
    "为什么私钥隔离仍然挡不住供应链攻击？",
    "钱包项目从源码到部署应建立哪些完整性证据？",
    "签名界面和交易构建代码为什么属于同一安全边界？"
  ]
}
---

# 从恶意依赖到错误交易：钱包软件供应链攻击路径

钱包系统通常把主要注意力放在私钥、合约和链节点上，但攻击者也可以选择一条成本更低的路径：不破解密码学，而是让团队自己部署恶意代码。

软件供应链不是单独的“依赖安全”问题，而是一整条交付链：

```text
开发者设备
→ Git 仓库
→ 第三方依赖
→ CI Runner
→ 构建 Artifact / 镜像
→ 部署平台
→ 管理台与签名界面
→ wallet-api / wallet-sign
```

只要其中一个环节可以静默修改交易构建、审批展示或签名请求，私钥即使从未离开签名机，资金仍可能被有效签名转走。

# 为什么供应链攻击特别适合钱包系统

普通应用被植入恶意代码，常见影响是数据泄露或服务中断。钱包系统的构建产物还可能直接影响：

- 提现地址和金额；
- 合约 calldata；
- Chain ID 与 Token；
- BTC Outputs；
- Sui Move Call；
- 审批页面显示内容；
- 实际发送给 wallet-sign 的 Digest。

2025 年 Bybit 官方事件时间线记录了一起签名界面与实际交易内容偏离的事故。这说明“签名设备是安全的”并不能证明上游生成和展示的交易可信。[Bybit 官方事件时间线](https://www.bybit.com/en/learn/this-week-in-bybit/bybit-security-incident-timeline)

# 攻击者可能进入的六个位置

## 开发者设备

攻击者通过钓鱼、恶意项目、浏览器扩展、远程控制或被替换的开发工具取得开发环境权限，然后窃取 Git、云平台、npm、CI 或部署凭证。

开发机不应同时承担日常浏览、生产签名和高权限部署。高风险仓库与生产控制面需要独立身份、硬件认证和最小权限。

## Git 与代码审查

攻击者可能利用被盗账号、未保护分支、隐藏生成文件或超大自动化 Diff 混入改动。

钱包安全相关代码至少要关注：

```text
交易序列化
Digest 计算
审批 Hash
地址规范化
依赖与生成代码
CI Workflow
部署脚本
```

这些文件的变更不应该仅凭“测试通过”自动获得生产权限。

## 第三方依赖

风险来源包括维护者账号失陷、恶意新版本、名称相似包、Install Script、Transitive Dependency 和被修改的下载源。

`package-lock.json` 的价值是记录确定的依赖树与 Integrity 信息，让安装更可重复；它不能证明依赖本身没有恶意行为。[npm package-lock.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json/)

Go、npm 和容器都应锁定版本，升级时查看真实 Diff、维护者变化、发布来源和构建结果。

## CI Runner 与 Workflow

CI 常同时接触源码、Secret、Artifact 和部署权限，因此是高价值目标。

[GitHub Actions Secure Use](https://docs.github.com/en/actions/reference/security/secure-use) 建议限制 Workflow 权限、谨慎处理不可信输入，并将第三方 Action 固定到完整 Commit SHA。

更稳妥的方向包括：

- `GITHUB_TOKEN` 默认只读；
- 部署使用短期 OIDC，而不是长期云密钥；
- Fork/PR 不接触生产 Secret；
- Self-hosted Runner 与日常开发环境隔离；
- Artifact 生成后记录 Digest 与 Provenance；
- 发布和部署需要独立环境审批。

## Artifact、镜像和部署

源码审查通过，不代表生产运行的就是该源码构建的产物。

需要建立：

```text
Commit SHA
→ 可复现 Build
→ Artifact Digest
→ 镜像 Digest
→ 部署版本
→ 运行时 Attestation
```

CISA 的软件供应链指南强调开发、构建与交付过程的完整性，以及对下游合法分发恶意代码的防范。[CISA 软件供应链开发者指南](https://www.cisa.gov/sites/default/files/2023-12/ESF_SECURING_THE_SOFTWARE_SUPPLY_CHAIN_DEVELOPERS.pdf)

## 管理台和签名界面

前端经常被当作低风险展示层，但如果签署人根据页面决定是否批准交易，它就是授权链的一部分。

大额交易应使用独立通道展示规范化内容：

- Chain 与网络；
- From / To；
- Asset 与 Amount；
- 合约方法与关键参数；
- Nonce、有效期与策略版本；
- 最终 Digest。

展示通道与交易构建通道不能完全依赖同一份前端代码和同一台设备。

# 你的四服务应该怎样抵抗供应链篡改

## wallet-service

保存原始订单事实，不接受下游静默修改金额、地址和资产。状态推进需要数据库约束与审计事件。

## risk-service

审批完整 Canonical Payload，而不是批准一句“允许提现”。审批输出包含版本、有效期和 Hash。

## wallet-api

确定性构建 Unsigned Transaction，并产生可由其他组件重新计算的 Digest。依赖升级不能改变同一 Fixture 的结果，除非经过显式迁移。

## wallet-sign

不信任调用方给出的说明文字，只验证 Canonical Digest、审批证据、Key Policy 和请求身份。签名后返回 Signature 与审计引用。

# 应该补的供应链实验

1. 修改 Lockfile 之外的依赖版本，CI 必须失败；
2. 第三方 Action 未固定完整 SHA，Workflow Lint 失败；
3. 构建 Artifact Digest 与部署 Digest 不一致，阻断部署；
4. PR 尝试读取生产 Secret，必须没有权限；
5. 修改交易构建 Fixture，Golden Hash 变化并要求安全审查；
6. 管理台显示内容与 Canonical Payload 不一致，独立验证器报警；
7. Secret 出现在源码、Git 历史、日志或 Artifact，发布门禁失败；
8. 回滚到旧版本时，旧的审批格式和 Key Policy不能被重新启用。

# 当前项目边界

当前多个仓库已经使用锁定依赖、构建测试和敏感信息扫描，wallet-core 公开前也执行过完整历史 Secret Scan。这些是基础证据，但还没有形成生产级软件供应链闭环。

后续值得继续补齐：签名 Artifact、部署 Provenance、第三方 Action 固定、短期云身份、交易 Fixture Golden Hash，以及独立的签名内容展示。

供应链安全最终要回答的不是“源码有没有后门”，而是“线上运行的每一个字节，能否追溯到经过批准的源码与构建过程”。
