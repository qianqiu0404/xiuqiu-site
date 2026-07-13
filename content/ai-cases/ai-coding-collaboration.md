---
{
  "id": 1,
  "displayOrder": 1,
  "slug": "ai-coding-collaboration",
  "title": "AI Coding 协作",
  "stage": "verified-local",
  "updatedAt": "2026-07-13",
  "summary": "用 Planner、Worker、Reviewer 和人工验收拆开计划、执行与审查，让 AI 修改代码时有边界、有交接、有验证。",
  "ownershipNote": "协作协议、角色边界和验收方式由我设计；底层模型与编码工具来自外部产品。",
  "currentFocus": "把这套协作方式应用到钱包项目的真实改动，并让每次交付都能回到代码差异、测试结果和未解决风险。",
  "flow": ["定义目标与不做什么", "Planner 拆解边界与验收标准", "Worker 按计划实现", "Reviewer 检查错误、遗漏和越界", "我运行验证并决定是否接受"],
  "responsibilities": ["我负责目标、风险偏好和最终验收", "AI 负责方案比较、实现辅助、测试补充和第二视角审查", "高风险钱包判断必须由代码与运行结果支撑"],
  "evidence": ["已形成最小 Planner/Worker/Reviewer 工作流", "在网站与钱包项目中使用构建、类型检查和测试作为完成条件", "记录 Agent 修改错文件、目标漂移和验证不足等失败模式"],
  "failureHandling": ["发现目标漂移时回到原始成功标准", "发现修改越界时保留用户变更并缩小补丁", "测试失败时不把代码生成等同于完成"],
  "knownLimits": ["并非所有小任务都值得拆成多 Agent", "模型审查不能替代本人理解和安全判断", "仍需积累更多钱包项目中的量化案例"],
  "targetOutcome": "形成一套可以在复杂工程任务中重复使用的协作协议：上下文模板、角色边界、交接格式、验证清单和失败接管规则完整一致。",
  "nextMilestone": "选择一次钱包状态机或签名边界改动，保留计划、实现、审查和人工验收的完整公开复盘。",
  "relatedArticleSlugs": ["minimal-multi-agent-coding-workflow", "codex-ai-workflow-system-retrospective"]
}
---

该案例展示 AI 如何参与工程过程，以及哪些判断仍然必须由本人完成。
