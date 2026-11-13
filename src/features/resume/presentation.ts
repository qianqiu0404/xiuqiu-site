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
  title: 'xiuqiu / Qiu · 简历与完整作品集',
  description: '后端与全栈、AI 应用与 Web3 工程。29 条作品与实践记录，包含业务参与、个人工具、知识系统和代码影像。',
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
