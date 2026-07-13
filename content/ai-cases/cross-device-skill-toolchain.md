---
{
  "id": 4,
  "displayOrder": 2,
  "slug": "cross-device-skill-toolchain",
  "title": "跨设备 Skill 工具链",
  "stage": "verified-local",
  "updatedAt": "2026-07-13",
  "summary": "把重复使用的方法沉淀为 Skill，经来源分层、去敏和私有 Git 版本化，在 MacBook、Mac mini、Codex 与 Hermes 之间复用。",
  "ownershipNote": "我负责工作流设计、个人 Skill 整理、来源标注、去敏、同步规则和验收；第三方 Skill 保留原作者归属，不视为我的原创。",
  "currentFocus": "让 Skill 从单机文件变成可迁移、可更新、可验证的个人 Agent 工具链，同时避免把密钥、会话缓存和第三方内容错误公开。",
  "flow": ["从真实任务识别可重复方法", "沉淀或整理个人 Skill", "区分个人与第三方来源", "扫描敏感内容并建立私有 Git 快照", "MacBook 与 Mac mini 拉取版本", "Codex 软链接与 Hermes external_dirs 加载", "运行检查并把失败回流到 Skill"],
  "responsibilities": ["我决定哪些方法值得沉淀，以及个人 Skill 的边界和验收标准", "我维护来源、隐私规则、版本更新和两端恢复说明", "第三方 Skill 只作为依赖或参考使用，不包装为本人原创"],
  "evidence": ["已建立两个私有 Skill 仓库并分别维护个人 Skill 与跨 Agent 打包结果", "已整理新机器 clone、Codex 软链接与 Hermes external_dirs 的恢复说明", "打包前排除缓存、统计、内部 manifest 与 Codex 内置 system skills", "已执行敏感文件扫描，并比较重叠 Skill 避免静默覆盖"],
  "failureHandling": ["发现疑似密钥、Token 或本机状态文件时停止提交", "同名 Skill 内容不一致时先比较来源，不直接覆盖", "新机器缺少命令、MCP 或插件依赖时明确报告，不把 Git 同步当成可运行验证"],
  "knownLimits": ["两个仓库目前均为私有，因此网站不提供仓库链接", "部分 Skill 来自第三方，不属于本人原创", "Git 只能同步文件，不能自动安装命令、MCP、插件或模型配置", "跨设备更新后仍需分别验证 Codex 与 Hermes 的发现和运行结果"],
  "targetOutcome": "形成一条稳定的 SkillOps Loop：方法可以被沉淀、追踪来源、安全同步、跨 Agent 加载，并通过真实任务的失败继续迭代。",
  "nextMilestone": "为个人 Skill 增加统一 manifest 与双端 smoke check，记录每次同步后哪些 Skill 被发现、哪些依赖仍然缺失。",
  "relatedArticleSlugs": ["minimal-multi-agent-coding-workflow", "codex-ai-workflow-system-retrospective"]
}
---

网站只公开工具链设计、本人职责和验证边界，不公开私有仓库内容，也不把第三方 Skill 计作原创成果。
