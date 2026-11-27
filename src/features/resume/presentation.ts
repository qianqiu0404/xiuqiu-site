export interface ResumeProject {
  id: string
  title: string
  intro: string
  category: string
  label: string
  status: string
  history: boolean
  tech: string
  kind: string
  kindLabel: string
  visibility?: string
  openSource?: boolean
}

export const resumeSeo = {
  title: 'xiuqiu · AI 应用工程师｜简历与作品集',
  description: 'xiuqiu 的 AI 应用工程师简历与作品集。主线是让 AI Agent 在真实业务里靠得住：企业客服 Agent、交易所只读诊断 Agent 与评测、团队模型中转站和多 Agent 进展台。',
}

export const featuredProjectIds = [
  'saas', 'miniexchange', 'qai', 'steward', 'xiaomao', 'qiumarket', 'wildheart', 'qiwu',
] as const

export function formatFeaturedPosition(index: number): string {
  return `${String(index + 1).padStart(2, '0')} / ${String(featuredProjectIds.length).padStart(2, '0')}`
}

export const miniExchangeDemo = { href: '/mini-exchange-demo/index.html', label: '打开诊断演示' }
export const answerCheckDemo = { href: '/answer-check-demo/index.html', label: '客服回答质检演示' }
export const memoryDemo = { href: '/memory-demo/index.html', label: '客服记忆演示' }
export const watchDemo = { href: '/watch-demo/index.html', label: 'AI 调用监测演示' }

export const resumeExperience = {
  company: '天津根哈希',
  role: '后端开发（AI 应用 / 交易系统）',
  start: '2025.07',
  end: '2026.11',
  description: 'Web3 与 AI 应用方向的技术团队。先做预测市场 chooseme 的撮合和交易所钱包的地址派生，公司转向 AI 应用后负责企业客服 Agent。',
  entries: [
    {
      id: 'saas',
      title: 'Agent SaaS · 企业客服 Agent',
      responsibility: '团队项目 · 负责客服 Agent 与微信回复',
      bullets: [
        '在团队已有的 GeWe 收发能力上实现客服 Agent 与微信自动回复，支持上线前试聊、群名同步和人工接管。',
        '按租户和知识库限制检索范围，校验引用来自已绑定资料，资料变更或权限撤销时作废在途回答。',
        '用租约和条件更新控制并发领取，发送前复核会话，结果不明时转待核对。模型调用前预留额度。有用量上报时按上报值结算，正常返回但缺用量时按预留量记，报错且缺用量时转待核对。',
        '在模型调用前、生成后和发送前三处检查泄露风险，定位并修复 Go 与 PostgreSQL 时间精度差异导致的合法回复丢弃。',
      ],
      result: '约两周内 5 个 PR 合入主干',
    },
    {
      id: 'qai',
      title: 'QAI · 团队内部模型中转站',
      responsibility: '内部工具 · 负责功能实现',
      bullets: [
        '为每位同事分配独立 Key，支持启停、轮换和撤销。按人设置 Token 上限，并限制并发请求。',
        '记录 JSON 和 SSE 的最终用量，每次调用均可追查。缺少用量时冻结 Key 待核对。',
      ],
      result: '两周交付，团队内部在用',
    },
    {
      id: 'chooseme',
      title: 'chooseme · 预测市场交易撮合',
      responsibility: '公司项目 · 负责撮合模块',
      bullets: [
        '实现价格、时间优先的内存订单簿及 YES / NO 两簿交叉撮合，支持限价单和市价单。',
        '在同一事务写入成交、双方订单、仓位和余额，撮合前重读订单状态。',
        '启动时全量加载订单，运行中按资产范围增量拉取，并按订单号补回漏加载的订单。',
      ],
      result: '撮合引擎随 chooseme 上线',
    },
  ],
}

export function normalizeCategory(value: unknown, projects: readonly ResumeProject[]): string {
  return typeof value === 'string' && projects.some(project => project.category === value) ? value : 'all'
}

export function filterResumeProjects(projects: readonly ResumeProject[], category: string, includeHistory: boolean, query: string): ResumeProject[] {
  const term = query.trim().toLocaleLowerCase()
  return projects.filter(project =>
    (category === 'all' || project.category === category)
    && (includeHistory || !project.history)
    && (!term || [project.title, project.intro, project.label, project.kindLabel, project.tech, project.status].join(' ').toLocaleLowerCase().includes(term)),
  )
}

export function projectIdFromHash(hash: string, projects: readonly ResumeProject[]): string | null {
  if (!hash.startsWith('#project/')) return null
  try {
    const id = decodeURIComponent(hash.slice('#project/'.length))
    return projects.some(project => project.id === id) ? id : null
  } catch { return null }
}

export function adjacentProjectId(projects: readonly ResumeProject[], id: string, step: number): string {
  if (!projects.length) return ''
  const index = projects.findIndex(project => project.id === id)
  return projects[(Math.max(index, 0) + step + projects.length) % projects.length]!.id
}
