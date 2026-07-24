import { aiCases, type AiCase } from './generatedAiCases.ts'
import { articleKnowledge, type ArticleKnowledge } from './generatedArticleKnowledge.ts'
import { learningRecords } from './generatedLearningRecords.ts'
import { dailyRadars, type DailyRadar } from './generatedRadars.ts'
import { radarWeeklies, type RadarWeekly } from './generatedRadarWeeklies.ts'
import {
  projects,
  type Project,
  type ProjectActivityStatus,
  type ProjectPortfolioTier,
  type ProjectSourceType,
  type ProjectStage,
  type ProjectVisibility,
} from './generatedProjects.ts'
import { failureCases, type FailureCase } from './generatedFailureCases.ts'
import { evidenceRecords, type EvidenceRecord } from './generatedEvidence.ts'
import { deliveryRecords, type DeliveryRecord } from './generatedDeliveries.ts'
import { nowSnapshot, type NowSnapshot } from './generatedNow.ts'

export type KnowledgeTag = ArticleKnowledge['conceptTags'][number] | 'wallet-core'
export type SiteArticle = ArticleKnowledge
export type SiteProject = Project
export type SiteAiCase = AiCase
export type SiteRadar = DailyRadar
export type SiteRadarWeekly = RadarWeekly
export type SiteFailureCase = FailureCase
export type SiteEvidenceRecord = EvidenceRecord
export type SiteDeliveryRecord = DeliveryRecord

export const projectStageLabels: Record<ProjectStage, string> = {
  exploring: '探索中',
  building: '实现中',
  'verified-local': '本地已验证',
  'showcase-ready': '可展示',
}

export const projectSourceLabels: Record<ProjectSourceType, string> = {
  original: '原创实现',
  adapted: '基于现有项目改造',
  'source-study': '源码学习',
}

export const projectVisibilityLabels: Record<ProjectVisibility, string> = {
  private: '私有仓库',
  public: '公开仓库',
  none: '暂无独立仓库',
}

export const projectPortfolioTierLabels: Record<ProjectPortfolioTier, string> = {
  flagship: '旗舰系统',
  verified: '可验证作品',
  exploration: '工程探索',
  paused: '暂停保留',
}

export const projectActivityLabels: Record<ProjectActivityStatus, string> = {
  active: '进行中',
  paused: '已暂停',
  completed: '已完成',
}

export const aiStageLabels: Record<AiCase['stage'], string> = {
  building: '持续建设中',
  'verified-local': '已在本地项目验证',
  operational: '正在日常运行',
}

export interface EngineeringMapNode {
  id: KnowledgeTag
  title: string
  subtitle: string
  projectIds: number[]
  articleSlugs: string[]
}

export interface SiteKnowledge {
  owner: {
    name: string
    title: string
    summary: string
    focus: string[]
  }
  projects: SiteProject[]
  aiCases: SiteAiCase[]
  articles: SiteArticle[]
  radars: SiteRadar[]
  failureCases: SiteFailureCase[]
  evidenceRecords: SiteEvidenceRecord[]
  deliveryRecords: SiteDeliveryRecord[]
  now: NowSnapshot
  tags: KnowledgeTag[]
  engineeringMap: EngineeringMapNode[]
}

export interface SiteReference {
  type: 'article' | 'project' | 'capability' | 'ai' | 'radar' | 'failure' | 'evidence' | 'delivery'
  title: string
  href: string
  summary: string
}

export const siteArticles: SiteArticle[] = articleKnowledge

export const siteArticlesByNewest: SiteArticle[] = [...siteArticles].sort((a, b) => {
  const dateOrder = b.date.localeCompare(a.date)
  return dateOrder || b.id - a.id
})

export const siteProjects: SiteProject[] = projects
export const siteAiCases: SiteAiCase[] = aiCases
export const siteRadars: SiteRadar[] = dailyRadars
export const siteRadarWeeklies: SiteRadarWeekly[] = radarWeeklies
export const siteFailureCases: SiteFailureCase[] = failureCases
export const siteEvidenceRecords: SiteEvidenceRecord[] = evidenceRecords
export const siteDeliveryRecords: SiteDeliveryRecord[] = deliveryRecords
export const latestRadar: SiteRadar | undefined = siteRadars[0]

export const engineeringMap: EngineeringMapNode[] = [
  {
    id: 'wallet-backend',
    title: 'Exchange Wallet Infrastructure',
    subtitle: '资金编排、风险控制、多链交互、签名边界和异常恢复。',
    projectIds: [1, 8],
    articleSlugs: ['cex-evm-wallet-deposit-withdrawal-loop', 'withdrawal-error-handling', 'wallet-ledger-transaction-mq-consistency', 'wallet-api-boundary'],
  },
  {
    id: 'wallet-core',
    title: 'wallet-core · TypeScript',
    subtitle: '多链离线密钥派生、交易构建、签名与链级资源输入。',
    projectIds: [7],
    articleSlugs: ['multi-chain-wallet-resource-state', 'wallet-address-models', 'wallet-sign-signer'],
  },
  {
    id: 'signer-service',
    title: '签名安全边界',
    subtitle: '独立签名机、私钥隔离、HSM 与 TSS/MPC 演进。',
    projectIds: [1, 7, 5],
    articleSlugs: ['wallet-sign-signer', 'mpc-wallet-sign-integration', 'aws-cloudhsm-wallet-sign-integration'],
  },
  {
    id: 'multi-chain',
    title: '多链资源状态',
    subtitle: 'nonce、UTXO、blockhash、TAPOS 与 object version。',
    projectIds: [1, 7],
    articleSlugs: ['multi-chain-wallet-resource-state', 'new-chain-integration-checklist', 'wallet-address-models'],
  },
  {
    id: 'go-infra',
    title: 'Go 后端工程',
    subtitle: 'gRPC、PostgreSQL、Redis、Worker、Context 与服务生命周期。',
    projectIds: [1, 8, 3],
    articleSlugs: ['http-rpc-grpc', 'market-services-data-flow', 'api-system-calls'],
  },
  {
    id: 'mpc-tss',
    title: 'MPC / TSS',
    subtitle: 'Keygen/Sign、committee、threshold、key share 与可用性边界。',
    projectIds: [5],
    articleSlugs: ['mpc-wallet-sign-integration', 'thorchain-tss-attack-analysis'],
  },
  {
    id: 'evm',
    title: 'EVM 学习主题',
    subtitle: '账户抽象、合约调用、代理和协议演进的工程笔记。',
    projectIds: [1, 7],
    articleSlugs: ['erc4337-useroperation-lifecycle', 'eip-erc-protocol-evolution', 'evm-call-proxy-patterns'],
  },
  {
    id: 'ai-engineering',
    title: 'AI 协作工程',
    subtitle: '计划、执行、审查、知识治理和可恢复自动化。',
    projectIds: [1, 7, 8],
    articleSlugs: ['minimal-multi-agent-coding-workflow', 'codex-ai-workflow-system-retrospective'],
  },
]

export const siteKnowledge: SiteKnowledge = {
  owner: {
    name: 'xiuqiu',
    title: 'Web3 钱包后端工程 × AI 协作',
    summary:
      '我正在建设可运行、可解释、可验证的 Exchange Wallet Infrastructure，并用 AI 组织研发、验证、知识沉淀和持续复盘。',
    focus: [
      'Exchange Wallet Infrastructure',
      '交易风控与提现放行',
      '资金状态与异常恢复',
      '多链 RPC 与离线交易',
      '独立签名与 TSS/MPC',
      'Go 与 TypeScript',
      'AI Coding 协作',
      '跨设备 Skill 工具链与来源治理',
      'Obsidian 知识与自动化工作流',
    ],
  },
  projects: siteProjects,
  aiCases: siteAiCases,
  articles: siteArticles,
  radars: siteRadars,
  failureCases: siteFailureCases,
  evidenceRecords: siteEvidenceRecords,
  deliveryRecords: siteDeliveryRecords,
  now: nowSnapshot,
  tags: ['wallet-core', 'wallet-backend', 'signer-service', 'multi-chain', 'go-infra', 'evm', 'mpc-tss', 'api-design', 'ai-engineering'],
  engineeringMap,
}

export function getArticleBySlug(slug: string): SiteArticle | undefined {
  return siteArticles.find(article => article.slug === slug)
}

export function getProjectById(id: number): SiteProject | undefined {
  return siteProjects.find(project => project.id === id || project.legacyIds.includes(id))
}

export function getProjectByKey(key: string | number): SiteProject | undefined {
  if (typeof key === 'number' || /^\d+$/.test(key)) return getProjectById(Number(key))
  return siteProjects.find(project => project.slug === key)
}

export function getArticlesBySlugs(slugs: string[]): SiteArticle[] {
  return slugs.map(getArticleBySlug).filter((article): article is SiteArticle => Boolean(article))
}

export function getProjectsByIds(ids: number[]): SiteProject[] {
  const seen = new Set<number>()
  return ids
    .map(getProjectById)
    .filter((project): project is SiteProject => Boolean(project))
    .filter(project => {
      if (seen.has(project.id)) return false
      seen.add(project.id)
      return true
    })
}

export function getRelatedArticlesForProject(projectId: number): SiteArticle[] {
  const project = getProjectById(projectId)
  return project ? getArticlesBySlugs(project.relatedArticleSlugs) : []
}

export function buildKnowledgeContext(): string {
  return [
    `${siteKnowledge.owner.name}: ${siteKnowledge.owner.title}.`,
    siteKnowledge.owner.summary,
    `Current snapshot (${nowSnapshot.updatedAt}): ${nowSnapshot.headline}. ${nowSnapshot.summary}`,
    `Next focus: ${nowSnapshot.nextFocus.join(' | ')}`,
    '',
    'Engineering projects:',
    ...siteProjects.map(project =>
      [
        `- ${project.name}: ${project.positioning}`,
        `  Status: ${projectStageLabels[project.stage]}; Source: ${projectSourceLabels[project.sourceType]}; Visibility: ${projectVisibilityLabels[project.visibility]}`,
        `  Current focus: ${project.currentFocus}`,
        `  Verified evidence: ${project.verifiedEvidence.join(' | ')}`,
        `  Target outcome: ${project.targetOutcome}`,
        `  Next milestone: ${project.nextMilestone}`,
        `  System boundary: ${project.engineering.systemBoundary}`,
        `  Call flow: ${project.engineering.callFlow.join(' -> ')}`,
        `  Failure scenarios: ${project.engineering.failureScenarios.join(' | ')}`,
        `  Known limits: ${project.knownLimits.join(' | ')}`,
      ].join('\n'),
    ),
    '',
    'AI collaboration cases:',
    ...siteAiCases.map(item =>
      [
        `- ${item.title}: ${item.summary}`,
        `  Status: ${aiStageLabels[item.stage]}`,
        `  Ownership: ${item.ownershipNote}`,
        `  Flow: ${item.flow.join(' -> ')}`,
        `  Human responsibility: ${item.responsibilities.join(' | ')}`,
        `  Evidence: ${item.evidence.join(' | ')}`,
        `  Target outcome: ${item.targetOutcome}`,
        `  Next milestone: ${item.nextMilestone}`,
        `  Limits: ${item.knownLimits.join(' | ')}`,
      ].join('\n'),
    ),
    '',
    'Articles:',
    ...siteArticles.map(article =>
      `- ${article.title}: ${article.summary}; Kind: ${article.kind}; Tags: ${article.conceptTags.join(', ')}`,
    ),
    '',
    'Wallet failure playbook (these are engineering cases, not claimed production incidents):',
    ...siteFailureCases.map(item => [
      `- ${item.title}: ${item.symptom}`,
      `  Evidence status: ${item.evidenceStatus}; Fund risk: ${item.fundRisk}`,
      `  Stop-loss first: ${item.stopLoss}`,
      `  Recovery: ${item.recovery.join(' | ')}`,
      `  Idempotency: ${item.idempotencyBasis}`,
      `  Current project boundary: ${item.currentBoundary}`,
    ].join('\n')),
    '',
    'Engineering evidence (verified means reproducible evidence, not production readiness):',
    ...siteEvidenceRecords.map(item => [
      `- ${item.title}: ${item.summary}`,
      `  Kind: ${item.kind}; Status: ${item.status}; Visibility: ${item.visibility}; Verified at: ${item.verifiedAt}`,
      `  Capabilities: ${item.capabilityIds.join(' | ')}`,
      item.command ? `  Verification command: ${item.command}` : '',
    ].filter(Boolean).join('\n')),
    '',
    'AI-assisted public deliveries:',
    ...siteDeliveryRecords.map(item => [
      `- ${item.title}: ${item.summary}`,
      `  Status: ${item.status}; Goal: ${item.goal}`,
      `  AI contribution: ${item.aiContribution.join(' | ')}`,
      `  Human decisions: ${item.humanDecisions.join(' | ')}`,
      `  Review findings: ${item.reviewFindings.join(' | ')}`,
      `  Corrections: ${item.corrections.join(' | ')}`,
      `  Known limits: ${item.knownLimits.join(' | ')}`,
      `  Next step: ${item.nextStep}`,
    ].join('\n')),
    '',
    'Curated learning records:',
    ...learningRecords.map(record =>
      `- ${record.title}: ${record.summary}; Achieved: ${record.achieved.join(', ')}; Next: ${record.nextSteps.join(', ')}`,
    ),
    '',
    'Recent daily research radar:',
    ...siteRadars.slice(0, 7).map(radar =>
      `- ${radar.date}: ${radar.summary}; Signals: ${[...radar.marketSignals, radar.aiTip, radar.web3Design, radar.vibeProject, radar.readingPick].filter(Boolean).map(item => item!.title).join(' | ')}`,
    ),
  ].join('\n')
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5]+/).filter(token => token.length > 1)
}

function scoreText(queryTokens: string[], value: string): number {
  const haystack = value.toLowerCase()
  return queryTokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0)
}

export function findRelevantReferences(query: string, pageTitle?: string, max = 4): SiteReference[] {
  const queryTokens = tokenize([query, pageTitle || ''].join(' '))

  const articleRefs = siteArticles.map(article => ({
    score: scoreText(queryTokens, [article.title, article.summary, article.tags.join(' '), article.conceptTags.join(' '), article.suggestedQuestions.join(' ')].join(' ')) + (pageTitle === article.title ? 10 : 0),
    ref: { type: 'article' as const, title: article.title, href: `/articles/${article.slug}`, summary: article.summary },
  }))

  const projectRefs = siteProjects.map(project => ({
    score: scoreText(queryTokens, [project.name, project.positioning, project.currentFocus, project.targetOutcome, project.techStack.join(' '), project.conceptTags.join(' ')].join(' ')) + (pageTitle === project.name ? 10 : 0),
    ref: { type: 'project' as const, title: project.name, href: `/projects/${project.slug}`, summary: project.positioning },
  }))

  const aiRefs = siteAiCases.map(item => ({
    score: scoreText(queryTokens, [item.title, item.summary, item.ownershipNote, item.currentFocus, item.flow.join(' '), item.evidence.join(' ')].join(' ')) + (pageTitle === item.title ? 10 : 0),
    ref: { type: 'ai' as const, title: item.title, href: `/ai#${item.slug}`, summary: item.summary },
  }))

  const radarRefs = siteRadars.map(item => ({
    score: scoreText(queryTokens, [item.title, item.summary, ...item.marketSignals.map(signal => signal.title), item.aiTip?.title || '', item.web3Design?.title || '', item.vibeProject?.title || '', item.readingPick?.title || ''].join(' ')) + (pageTitle === item.title ? 10 : 0),
    ref: { type: 'radar' as const, title: item.title, href: `/radar/${item.slug}`, summary: item.summary },
  }))

  const capabilityRefs = engineeringMap.map(node => ({
    score: scoreText(queryTokens, [node.title, node.subtitle, node.id].join(' ')),
    ref: { type: 'capability' as const, title: node.title, href: '/engineering', summary: node.subtitle },
  }))

  const failureRefs = siteFailureCases.map(item => ({
    score: scoreText(queryTokens, [item.title, item.symptom, item.fundRisk, item.stopLoss, item.services.join(' '), item.chains.join(' ')].join(' ')) + (pageTitle === item.title ? 10 : 0),
    ref: { type: 'failure' as const, title: item.title, href: `/engineering/failures#${item.slug}`, summary: `${item.stopLoss} 当前边界：${item.currentBoundary}` },
  }))

  const evidenceRefs = siteEvidenceRecords.map(item => ({
    score: scoreText(queryTokens, [item.title, item.summary, item.kind, item.status, item.capabilityIds.join(' '), item.failureSlugs.join(' ')].join(' ')),
    ref: { type: 'evidence' as const, title: item.title, href: '/engineering/evidence', summary: `${item.summary} 当前状态：${item.status}。` },
  }))

  const deliveryRefs = siteDeliveryRecords.map(item => ({
    score: scoreText(queryTokens, [item.title, item.summary, item.goal, item.aiContribution.join(' '), item.humanDecisions.join(' '), item.reviewFindings.join(' '), item.corrections.join(' ')].join(' ')) + (pageTitle === item.title ? 10 : 0),
    ref: { type: 'delivery' as const, title: item.title, href: `/ai/deliveries/${item.slug}`, summary: item.summary },
  }))

  return [...articleRefs, ...projectRefs, ...aiRefs, ...radarRefs, ...capabilityRefs, ...failureRefs, ...evidenceRefs, ...deliveryRefs]
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(item => item.ref)
}
