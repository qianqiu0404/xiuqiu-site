---
{
  "id": 3,
  "displayOrder": 3,
  "slug": "research-automation-workflows",
  "title": "ResearchOps → xiuqiu-site 每日雷达",
  "stage": "operational",
  "updatedAt": "2026-08-10",
  "summary": "单窗口主流程从公开来源采集到 GitHub、Vercel 与微信分别验收；每天只保留一个 ledger、分支和 PR，AI Hot 只承担 AI 线索发现。",
  "ownershipNote": "同一主流程负责采集、去重、核验、深度编辑、发布与验收；GitHub、Vercel 与微信仍作为需要独立回执的外部边界。",
  "currentFocus": "用唯一日期键串联上游采集、30 天去重、来源与隐私门禁、唯一 PR、生产验收和微信回执，失败后从 ledger 恢复而不重复采集。",
  "flow": [
    "05:30 Idempotency：先检查当日内容、分支、PR 与生产页面，避免重复采集和重复发布",
    "05:35 Collect：主流程按五条受控泳道采集，AI Hot 只做 AI 线索发现并回到原始来源核验",
    "06:20 Edit：把每项压缩为事实、机制、价值、风险与行动，并写入唯一日期 ledger",
    "06:50 Gate：执行 30 天去重、七项上限、三类最低覆盖、来源、隐私、内容与构建门禁",
    "07:10 Publish：从 origin/main 创建唯一日报分支与 PR，GitHub 门禁通过后自动 squash 合并",
    "07:30 Verify/WeChat：分别核对 origin/main、Vercel 页面和微信送达回执；任一缺失都保持 partial"
  ],
  "responsibilities": [
    "我定义五条泳道的公开边界、去重窗口、选题价值和最终研究行动",
    "Codex 在同一固定聊天中调度采集、结构化、原文核验、深度编辑与发布，不再为每个阶段创建窗口",
    "AI Hot 仅为 AI Engineering 提供候选线索，最终页面必须引用并核验原始来源",
    "发布流程只允许日报源文件、生成数据和 sitemap 三类预期差异，并等待 GitHub 与 Vercel 门禁",
    "验收流程把网站发布与微信通知拆开记录，不能用页面 HTTP 200 代替消息送达"
  ],
  "evidence": [
    "2026-08-05 四路采集全部完成且 missing 为 0；Crypto、AI/Web3、Vibe、Reading 分别使用 4、2、10、1 个公开来源",
    "同日唯一 PR #49 以 squash 方式合并，Daily Radar Gate and Merge 与 Site CI 均通过",
    "生产页面 https://xiuqiu-site.vercel.app/radar/2026-08-05 通过 GET 验证并返回 HTTP 200",
    "微信共尝试两次：首次受 iLink 限流，冷却重试没有可恢复退出结果或送达回执；weixin.send 失败使整次运行保持 partial"
  ],
  "failureHandling": [
    "每个栏目写入唯一 ledger；失败后从现有栏目恢复，不重新搜索已经完成的输入",
    "少于三类公开来源、隐私检查失败、候选越界或构建失败时停止发布",
    "同日内容已经进入 origin/main 时返回 already-published，不创建重复 PR",
    "PR、合并或生产页面失败时不进入通知成功；微信限流时保留 partial 和失败阶段，等待后续补发"
  ],
  "knownLimits": [
    "AI 自动汇总和 AI Hot 聚合信息只是研究输入，不等于人工复核后的最终工程判断",
    "微信通道可能因外部限流失败，网站成功不能证明通知已送达",
    "外部来源、GitHub、Vercel 和通知通道的可用性仍需分别观测",
    "公开案例只描述允许披露的流程与结果，不公开完整研究输入、认证状态或本机路径"
  ],
  "targetOutcome": "形成可重复、可恢复、可审计的单窗口每日研究闭环：唯一 ledger 驱动唯一 PR，Vercel 与通知分别验收，人工周报再决定哪些规则进入长期门禁。",
  "nextMilestone": "接入可返回 event id、发送时间与通道结果的微信发送器，并用周度人工反馈持续校正来源权重和内容深度。",
  "relatedArticleSlugs": ["codex-ai-workflow-system-retrospective", "minimal-multi-agent-coding-workflow"]
}
---

该案例证明公开研究发布链路能够运行；单窗口收敛减少重复调度，但不会把 AI 摘要、网站上线或微信通知中的任意单项成功扩张为整条链路全部成功。
