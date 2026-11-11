export const profileSeo = {
  title: 'xiuqiu｜个人主页与作品',
  description: '认识 xiuqiu：维护 Qiu Market，学习钱包基础设施，用 AI 协作把想法做成作品，留下可核对的工程与学习记录。',
} as const

export const profileSections = [
  { id: 'profile-intro', label: '关于我', index: '01' },
  { id: 'profile-focus', label: '实践方向', index: '02' },
  { id: 'profile-projects', label: '项目与作品', index: '03' },
  { id: 'profile-workflow', label: '协作方式', index: '04' },
  { id: 'profile-links', label: '找到我', index: '05' },
] as const

export const profileFocusAreas = [
  {
    title: '把想法做成产品',
    description: '围绕 Qiu Market，实践行情数据、虚拟交易与失败恢复，把界面和背后的系统一起理解。',
    topics: ['产品开发', 'Go 后端', 'Vue / TypeScript'],
    to: '/projects/s78-market-services',
    linkLabel: '看产品与实现',
  },
  {
    title: '理解资金如何流转',
    description: '学习钱包基础设施，关注充值、账务、签名与提现之间的状态，以及异常之后如何恢复。',
    topics: ['钱包工程学习', '账务一致性', '失败恢复'],
    to: '/projects/exchange-wallet-system',
    linkLabel: '看学习与验证',
  },
  {
    title: '与 AI 一起工作',
    description: '让 AI 参与整理上下文、拆解需求、实现和审查，用测试与复盘检验每次尝试。',
    topics: ['AI 协作', '自动化测试', '知识整理'],
    to: '/ai',
    linkLabel: '看协作过程',
  },
] as const

export const profileWorkingPrinciples = [
  { title: '先讲清问题', description: '整理背景、目标和边界，再决定从哪里开始。' },
  { title: '让想法进入实践', description: '拆成可以实现和审查的小步骤，让 AI 参与执行。' },
  { title: '用验证确认结果', description: '看代码、测试和实际运行，把已实现与待验证分开。' },
  { title: '把过程留下来', description: '记录来源、失败和复盘，让下一次工作有迹可循。' },
] as const

interface ProfileProjectSource {
  slug: string
  name: string
  publish: boolean
  publicRole: 'current-product' | 'current-direction' | 'historical-evidence'
  stage: 'exploring' | 'building' | 'verified-local' | 'showcase-ready'
  updatedAt: string
  techStack: readonly string[]
  engineering: { overviewSummary: string }
}

const roleLabels = {
  'current-product': '当前产品',
  'current-direction': '当前学习方向',
  'historical-evidence': '历史工程作品',
} as const

const stageLabels = {
  exploring: '探索与学习',
  building: '实现中',
  'verified-local': '已有本地验证',
  'showcase-ready': '公开展示',
} as const

export function buildProfileProjects(records: readonly ProfileProjectSource[]) {
  const published = records.filter(project => project.publish)
  const present = (project: ProfileProjectSource) => ({
    slug: project.slug,
    name: project.name,
    summary: project.engineering.overviewSummary,
    role: project.publicRole,
    roleLabel: roleLabels[project.publicRole],
    stageLabel: stageLabels[project.stage],
    updatedAt: project.updatedAt,
    techStack: [...project.techStack],
    to: `/projects/${project.slug}`,
  })

  return {
    current: ['current-product', 'current-direction'].flatMap(role => {
      const project = published.find(record => record.publicRole === role)
      return project ? [present(project)] : []
    }),
    historical: ['wallet-reliability-lab', 'wallet-core'].flatMap(slug => {
      const project = published.find(record => record.slug === slug && record.publicRole === 'historical-evidence')
      return project ? [present(project)] : []
    }),
  }
}
