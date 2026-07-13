---
{
  "id": 3,
  "displayOrder": 3,
  "slug": "research-automation-workflows",
  "title": "Obsidian → xiuqiu-site 每日发布",
  "stage": "building",
  "updatedAt": "2026-07-13",
  "summary": "五个定时任务先把研究输入写入 Obsidian；09:15 发布任务只读取四类公开区块，经来源、隐私、PR 与构建门禁进入每日研究雷达。",
  "ownershipNote": "公开范围、发布门禁、失败语义和交付链路由我设计；资讯检索、摘要和托管能力来自外部工具。",
  "currentFocus": "以试运行状态让每日研究内容进入网站，同时核验分支命名、私人内容门禁、来源 URL 与自动合并条件。",
  "flow": ["五个定时任务生成 Obsidian 输入", "只读取 crypto / radar / vibe / reading", "筛选并生成同日 radar Markdown", "校验来源 URL 与隐私边界", "创建或更新自动 PR", "构建通过后 squash merge", "Vercel 从 main 部署"],
  "responsibilities": ["我定义可公开范围、选题价值和最终研究行动", "AI 负责筛选、结构化和关联工程项目", "CI 只允许日报修改白名单文件并执行完整构建"],
  "evidence": ["已有五个定时任务向每日任务文件的固定标记区块写入", "首期雷达已从 crypto、radar、vibe、reading 四类输入生成", "解析器与测试覆盖三类发布阈值、URL 来源约束、隐私关键词和同日幂等"],
  "failureHandling": ["少于三类公开来源时不创建 PR", "来源不足或隐私校验失败时立即停止发布", "PR 越界修改代码或构建失败时禁止合并并保留上一期线上内容"],
  "knownLimits": ["当前仍是试运行，尚未完成连续七天真实自动合并验收", "AI 自动汇总不等于个人最终观点", "外部信息源质量和可访问性仍需持续评估", "自动合并只适用于同仓库指定分支前缀和文件白名单，分支不匹配会跳过合并门禁"],
  "targetOutcome": "形成每天可重复运行的研究发布闭环：Obsidian 是私有工作台，GitHub PR 是交付与审计边界，网站只展示经过自动门禁的精选研究内容。",
  "nextMilestone": "连续运行七天并记录来源覆盖、失败原因、重复 URL 和被晋升为长文章的主题。",
  "relatedArticleSlugs": ["codex-ai-workflow-system-retrospective", "web3-narrative-participation-framework"]
}
---

该案例用真实发布链路证明调度、筛选、验证、隐私控制与自动交付能力。
