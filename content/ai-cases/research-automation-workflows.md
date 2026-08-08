---
{
  "id": 3,
  "displayOrder": 3,
  "slug": "research-automation-workflows",
  "title": "ResearchOps → xiuqiu-site 每日雷达",
  "stage": "operational",
  "updatedAt": "2026-08-05",
  "summary": "四路独立研究采集、GitHub PR、CI、Vercel 与微信通知分别验收；2026-08-05 的内容发布完成，但微信没有确认送达，因此整次运行保持 partial。",
  "ownershipNote": "公开范围、时间表、来源门禁、失败语义和最终验收由我定义；检索、摘要、GitHub、Vercel 与微信通道保留各自的外部系统边界。",
  "currentFocus": "保持四路采集彼此独立、发布候选只消费 ResearchOps 中允许公开的输入，并让 PR 合并、CI、生产页面与微信通知分别留下可审计结果。",
  "flow": [
    "05:30 Crypto：采集三条去重后的钱包、链与基础设施信号",
    "05:50 AI/Web3：整理一项可实践的 AI 工程技巧和一项钱包基础设施设计",
    "06:10 Vibe：验证一个公开工具或工程项目并记录真实运行边界",
    "06:30 Reading：选择一篇公开材料并提炼可行动问题",
    "07:00 Publish：汇总四路 ResearchOps 输入，执行来源、隐私、内容、构建与差异门禁后创建 PR",
    "07:30 Verify/WeChat：核对 PR、origin/main、Vercel 页面与通知结果，分别记录 success 或 partial"
  ],
  "responsibilities": [
    "我定义四类输入的公开边界、去重窗口、选题价值和最终研究行动",
    "Codex 负责在独立 ResearchOps 工作区采集、结构化、验证并生成候选内容",
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
    "单个采集模块只写自己的输入；其他模块尚未完成时，保留真实的 succeeded 与 missing 状态",
    "少于三类公开来源、隐私检查失败、候选越界或构建失败时停止发布",
    "同日内容已经进入 origin/main 时返回 already-published，不创建重复 PR",
    "PR、合并或生产页面失败时不进入通知成功；微信限流时保留 partial 和失败阶段，等待后续补发"
  ],
  "knownLimits": [
    "AI 自动汇总是研究输入，不等于人工复核后的最终工程判断",
    "微信通道可能因外部限流失败，网站成功不能证明通知已送达",
    "外部来源、GitHub、Vercel 和通知通道的可用性仍需分别观测",
    "公开案例只描述允许披露的流程与结果，不公开完整研究输入、认证状态或本机路径"
  ],
  "targetOutcome": "形成可重复、可恢复、可审计的每日研究闭环：四路采集独立运行，GitHub PR 是内容交付边界，Vercel 是页面验收边界，通知结果另行确认，人工周报再决定哪些判断进入工程。",
  "nextMilestone": "补齐通知限流后的可控重试、送达回执与成功归档，并持续产出人工复核的周度收敛，避免日报数量替代工程判断。",
  "relatedArticleSlugs": ["codex-ai-workflow-system-retrospective", "minimal-multi-agent-coding-workflow"]
}
---

该案例证明公开研究发布链路能够运行；它不把 AI 摘要、网站上线或微信通知中的任意单项成功扩张为整条链路全部成功。
