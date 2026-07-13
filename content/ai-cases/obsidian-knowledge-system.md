---
{
  "id": 2,
  "displayOrder": 4,
  "slug": "obsidian-knowledge-system",
  "title": "Obsidian 知识系统",
  "stage": "operational",
  "updatedAt": "2026-07-13",
  "summary": "把外部资料、AI 候选、项目记录和个人理解分层管理，通过人工审核与发布门禁维护唯一主库。",
  "ownershipNote": "知识分层、审核规则和公开边界由我维护；资料、模型建议和部分模板保留各自来源。",
  "currentFocus": "减少重复笔记和未经核验的 AI 内容，让知识能回到钱包项目、工程说明、文章和下一步行动。",
  "flow": ["来源进入资料库或收件箱", "AI 生成待审核候选", "人工核对代码与来源", "结论合并到唯一主库", "显式 publish: true 后生成公开内容"],
  "responsibilities": ["我决定哪些结论进入主库和公开站点", "AI 负责查重、结构化、关联与候选生成", "私人日记、个人计划和未核验内容永远不自动公开"],
  "evidence": ["已建立项目、知识、资料、模板和归档分区", "网站同步脚本只接受显式发布标记", "钱包讲义、Go 学习和项目看板使用统一入口与维护规则"],
  "failureHandling": ["没有 publish: true 时同步器忽略笔记", "内容重复时合并到唯一主库而不是新增第二份", "来源或代码事实不足时保持候选状态"],
  "knownLimits": ["发布记录仍需要人工挑选和编辑", "站点不读取本机绝对路径", "知识结构需要定期清理失效入口"],
  "targetOutcome": "让每次学习都可以沿来源、候选、核验、主库、项目和公开输出追踪，同时确保隐私内容无法因自动同步进入网站。",
  "nextMilestone": "把项目里程碑也接入显式发布流程，并为同步前后的字段、隐私词和关联项目增加自动校验。",
  "relatedArticleSlugs": ["codex-ai-workflow-system-retrospective", "minimal-multi-agent-coding-workflow"]
}
---

网站只展示这套知识系统的方法和公开产物，不展示私人知识库内容。
