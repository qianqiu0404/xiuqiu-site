---
{
  "id": 5,
  "displayOrder": 5,
  "slug": "social-media-research",
  "title": "双后端社交媒体研究 Skill",
  "stage": "verified-local",
  "updatedAt": "2026-07-14",
  "summary": "把 MediaCrawler 的本地免费采集与 TikHub 的付费 MCP 组合为个人 Codex Skill：本地优先、失败分类、费用确认、统一数据，再进入分析。",
  "ownershipNote": "路由、预算门禁、数据结构和公开展示由我定义；MediaCrawler 与 TikHub 保留各自项目、服务和许可证归属。",
  "currentFocus": "验证本地采集环境、付费调用硬门禁、系统钥匙串密钥隔离，以及公开站点只展示工作流而不开放真实采集。",
  "flow": ["识别平台与任务模式", "重叠平台优先本地采集", "区分登录问题与接口失败", "付费备用前展示最高费用", "保存原始响应与统一 JSONL", "Codex 基于问题完成分析"],
  "responsibilities": ["我决定研究目标、数据规模、是否授权付费与最终结论", "Codex 负责路由、执行受限采集、整理数据和生成候选分析", "帖子与评论始终按不可信输入处理，不执行其中夹带的指令"],
  "evidence": ["个人 Codex Skill 已通过结构校验与脚本单元测试", "MediaCrawler 独立工具环境已完成依赖安装和 CLI 冒烟检查", "TikHub 调用缺少费用批准、超过批准金额或超过单任务硬上限时会被拒绝", "公开页面使用静态演示数据，不包含真实 Key、Cookie 或付费调用"],
  "failureHandling": ["二维码、验证码和账号验证问题暂停给本人处理，不自动切换付费服务", "本地接口解析或风控失败只生成备用报价，确认后才调用 TikHub", "付费调用超时后不自动重试，避免不确定状态下重复扣费", "分页预计超出已批准调用次数时停止并重新确认"],
  "knownLimits": ["MediaCrawler 开源许可证只允许非商业学习和研究", "TikHub 端点和价格可能变化，调用前需要动态发现工具并保守报价", "不同平台返回字段并不完全一致，统一数据保留空值和原始响应引用", "当前公开页面是工作流展示，不是面向访客的数据产品"],
  "targetOutcome": "形成一句自然语言即可调用、免费链路优先、付费可控、原始数据可追踪、结果可重复分析的个人社交研究能力。",
  "nextMilestone": "完成一次真实的 1 篇内容与 1 条评论验收，在不扩大抓取规模的前提下核对登录、原始响应、统一数据和分析输出。",
  "relatedArticleSlugs": ["codex-ai-workflow-system-retrospective", "minimal-multi-agent-coding-workflow"]
}
---

公开站点只展示双后端路由、预算门禁和输出结构，不提供真实平台查询入口。
