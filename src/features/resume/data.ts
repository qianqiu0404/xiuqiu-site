import records from './records.json'
import { featuredProjectIds, formatFeaturedPosition, type ResumeProject } from './presentation'

export const projects: ResumeProject[] = records
export { githubProfileUrl } from '../../../shared/site'
export { filterResumeProjects, normalizeCategory, projectIdFromHash, adjacentProjectId, resumeSeo, resumeExperience, miniExchangeDemo } from './presentation'

type FeaturedVisual =
  | { src: string; alt: string; caption?: string }
  | { label: string; headline: string; steps: string[]; caption: string }

const featuredVisuals: Record<typeof featuredProjectIds[number], FeaturedVisual> = {
  saas: {
    label: 'Agent SaaS / 企业应用',
    headline: '用企业资料回答客户问题',
    steps: ['资料检索', '回答与引用', '微信回复'],
    caption: '团队项目 · 负责客服 Agent 与微信回复',
  },
  miniexchange: {
    label: 'mini-exchange / Agent 评测',
    headline: '用事件记录解释异常',
    steps: ['只读查询', '引用证据', '重复评测'],
    caption: '两轮评测用构造场景，回答由真实模型生成。另有练习盘历史记录回放。',
  },
  steward: {
    src: '/resume/steward-final-daily.jpg',
    alt: '以小镇形式呈现多个 Agent 会话的进展',
    caption: '终版体验设计 · 演示数据',
  },
  qai: {
    label: 'QAI / 团队内部工具',
    headline: '把模型用量记到人',
    steps: ['独立 Key', '配额与用量', '异常核对'],
    caption: '负责功能实现 · 团队内部在用',
  },
  xiaomao: {
    src: '/resume/xiaomao.svg',
    alt: '小猫进度秘书流程示意',
    caption: '流程示意',
  },
  qiumarket: {
    label: 'Qiu Market / 行情聚合',
    headline: '从多源行情到交易练习',
    steps: ['行情来源', '订单与撮合', '账本与恢复'],
    caption: '虚拟资金 · 不连接真实账户',
  },
  wildheart: {
    src: '/resume/knowledge-map.svg',
    alt: '知识地图的虚构结构示意：示例资料、概念、阅读笔记与时间线',
  },
  qiwu: {
    src: '/resume/qiwu-cover.png',
    alt: '齐物论作品封面',
    caption: '代码影像 · 封面',
  },
}

export const featuredProjects = featuredProjectIds.map((id, index) => ({
  project: projects.find(project => project.id === id)!,
  position: formatFeaturedPosition(index),
  visual: featuredVisuals[id],
}))

// Only the reviewed public summaries are bundled. The private knowledge map's
// application, notes and source material are not part of this feature.
export async function loadProjectNotes(): Promise<Record<string, string>> {
  return (await import('./notes.json')).default
}
