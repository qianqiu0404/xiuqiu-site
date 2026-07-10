import { articleKnowledge, type ArticleKnowledge } from './generatedArticleKnowledge.ts'
import { projects, type Project } from './projects.ts'
import { learningRecords } from './generatedLearningRecords.ts'

export type KnowledgeTag = ArticleKnowledge['conceptTags'][number] | 'wallet-core'

export type SiteArticle = ArticleKnowledge

export interface SiteProject extends Project {
  conceptTags: KnowledgeTag[]
  relatedArticleSlugs: string[]
  suggestedQuestions: string[]
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
  articles: SiteArticle[]
  tags: KnowledgeTag[]
  engineeringMap: EngineeringMapNode[]
}

export interface SiteReference {
  type: 'article' | 'project' | 'capability'
  title: string
  href: string
  summary: string
}

const projectMetadata: Record<number, Pick<SiteProject, 'conceptTags' | 'relatedArticleSlugs' | 'suggestedQuestions'>> = {
  7: {
    conceptTags: ['wallet-core', 'multi-chain', 'signer-service', 'wallet-backend'],
    relatedArticleSlugs: ['multi-chain-wallet-resource-state', 'wallet-sign-signer', 'wallet-address-models', 'wallet-api-boundary'],
    suggestedQuestions: [
      'wallet-core 如何处理不同链的离线签名输入？',
      'wallet-core 的 TypeScript 实现如何避免把浮点金额带入交易构建？',
      '这个项目如何验证多链交易构建与签名？',
    ],
  },
  1: {
    conceptTags: ['wallet-backend', 'api-design', 'multi-chain'],
    relatedArticleSlugs: ['api-system-calls', 'wallet-api-boundary', 'http-rpc-grpc', 'wallet-address-models'],
    suggestedQuestions: [
      'wallet-api 在钱包系统里承担哪些职责？',
      '为什么 wallet-api 不直接处理私钥？',
    ],
  },
  2: {
    conceptTags: ['signer-service', 'wallet-backend', 'multi-chain'],
    relatedArticleSlugs: ['wallet-sign-signer', 'wallet-api-boundary', 'wallet-address-models'],
    suggestedQuestions: [
      'wallet-sign 的安全边界是什么？',
      '离线签名服务如何与 wallet-api 协作？',
    ],
  },
  3: {
    conceptTags: ['go-infra', 'api-design'],
    relatedArticleSlugs: ['market-services-data-flow', 'http-rpc-grpc', 'api-system-calls'],
    suggestedQuestions: [
      'market-services 如何组织 HTTP、gRPC、Redis 和 PostgreSQL？',
      '行情服务的数据同步链路如何拆分职责？',
    ],
  },
  5: {
    conceptTags: ['mpc-tss', 'signer-service'],
    relatedArticleSlugs: ['wallet-sign-signer', 'wallet-address-models'],
    suggestedQuestions: [
      'TSS 和普通多签的本质区别是什么？',
      'MPC/TSS 在钱包基础设施里承担什么角色？',
    ],
  },
}

export const siteArticles: SiteArticle[] = articleKnowledge

export const siteArticlesByNewest: SiteArticle[] = [...siteArticles].sort((a, b) => {
  const dateOrder = b.date.localeCompare(a.date)
  return dateOrder || b.id - a.id
})

export const siteProjects: SiteProject[] = projects.map(project => ({
  ...project,
  ...projectMetadata[project.id],
}))

export const engineeringMap: EngineeringMapNode[] = [
  {
    id: 'wallet-core',
    title: 'wallet-core · TypeScript',
    subtitle: 'TypeScript 多链离线密钥派生、交易构建、签名与链级资源输入。',
    projectIds: [7],
    articleSlugs: ['multi-chain-wallet-resource-state', 'wallet-sign-signer', 'wallet-address-models', 'wallet-api-boundary'],
  },
  {
    id: 'wallet-backend',
    title: '交易所钱包后端',
    subtitle: '多链 RPC、交易构建、充值提现状态机与服务职责边界。',
    projectIds: [7, 1, 2],
    articleSlugs: ['erc4337-useroperation-lifecycle', 'multi-chain-wallet-resource-state', 'wallet-api-boundary', 'wallet-address-models', 'api-system-calls'],
  },
  {
    id: 'signer-service',
    title: '签名安全边界',
    subtitle: '私钥隔离、离线签名、普通签名机与 TSS/MPC 演进。',
    projectIds: [7, 2, 5],
    articleSlugs: ['erc4337-useroperation-lifecycle', 'multi-chain-wallet-resource-state', 'wallet-sign-signer', 'wallet-api-boundary'],
  },
  {
    id: 'multi-chain',
    title: '多链交易模型',
    subtitle: 'BTC UTXO、EVM 账户、Solana blockhash 与 Sui object 模型。',
    projectIds: [7, 1, 2],
    articleSlugs: ['multi-chain-wallet-resource-state', 'wallet-address-models', 'wallet-api-boundary'],
  },
  {
    id: 'go-infra',
    title: 'Go 后端工程',
    subtitle: 'HTTP/gRPC、Redis、PostgreSQL、异步 Worker 与服务生命周期。',
    projectIds: [1, 2, 3],
    articleSlugs: ['http-rpc-grpc', 'market-services-data-flow'],
  },
  {
    id: 'evm',
    title: 'EVM 学习主题',
    subtitle: '合约代理、create2、assembly 与 EIP/ERC 演进的学习笔记。',
    projectIds: [7, 1],
    articleSlugs: ['erc4337-useroperation-lifecycle', 'eip-erc-protocol-evolution', 'evm-call-proxy-patterns', 'evm-create2-assembly-lifecycle'],
  },
  {
    id: 'mpc-tss',
    title: 'MPC / TSS',
    subtitle: 'GG18、Paillier、Keygen/Sign、threshold 与 key share 安全边界。',
    projectIds: [5],
    articleSlugs: ['mpc-wallet-sign-integration', 'thorchain-tss-attack-analysis'],
  },
  {
    id: 'ai-engineering',
    title: 'AI 工程工作流',
    subtitle: '可验证工程循环、Skills、自动化与知识工作流。',
    projectIds: [1, 2, 3],
    articleSlugs: [
      'minimal-multi-agent-coding-workflow',
      'codex-ai-workflow-system-retrospective',
      'cex-evm-wallet-deposit-withdrawal-loop',
      'stablecoin-x402-agent-payments',
    ],
  },
]

export const siteKnowledge: SiteKnowledge = {
  owner: {
    name: 'xiuqiu',
    title: 'Web3 钱包后端学习档案',
    summary:
      '记录交易所钱包后端、多链 RPC、独立签名、TypeScript 离线钱包与 Go 数据服务的代码实践、验证证据和工程边界。',
    focus: [
      '交易所钱包后端',
      '多链 RPC 与 Chain Adaptor',
      '独立签名服务',
      'wallet-core / TypeScript',
      'MPC / TSS 安全研究',
      'Go 后端工程',
      'AI 辅助开发与验证',
    ],
  },
  projects: siteProjects,
  articles: siteArticles,
  tags: ['wallet-core', 'wallet-backend', 'signer-service', 'multi-chain', 'go-infra', 'evm', 'mpc-tss', 'api-design', 'ai-engineering'],
  engineeringMap,
}

export function getArticleBySlug(slug: string): SiteArticle | undefined {
  return siteArticles.find(article => article.slug === slug)
}

export function getProjectById(id: number): SiteProject | undefined {
  return siteProjects.find(project => project.id === id)
}

export function getArticlesBySlugs(slugs: string[]): SiteArticle[] {
  return slugs.map(getArticleBySlug).filter((article): article is SiteArticle => Boolean(article))
}

export function getProjectsByIds(ids: number[]): SiteProject[] {
  return ids.map(getProjectById).filter((project): project is SiteProject => Boolean(project))
}

export function getRelatedArticlesForProject(projectId: number): SiteArticle[] {
  const project = getProjectById(projectId)
  return project ? getArticlesBySlugs(project.relatedArticleSlugs) : []
}

export function buildKnowledgeContext(): string {
  return [
    `${siteKnowledge.owner.name} is a ${siteKnowledge.owner.title}.`,
    siteKnowledge.owner.summary,
    '',
    'Projects:',
    ...siteKnowledge.projects.map(project =>
      [
        `- ${project.name}: ${project.positioning}`,
        `  Engineering Focus: ${project.coreAbilities.join(', ')}`,
        `  Talking Points: ${project.talkingPoints.join(', ')}`,
        `  Tech Stack: ${project.techStack.join(', ')}`,
        `  Engineering Role: ${project.engineering.role}`,
        `  System Boundary: ${project.engineering.systemBoundary}`,
        `  Call Flow: ${project.engineering.callFlow.join(' -> ')}`,
        `  Failure Scenarios: ${project.engineering.failureScenarios.join(' | ')}`,
        `  Engineering Evidence: ${project.engineering.evidence.join(', ')}`,
        `  Known Limits: ${project.engineering.knownLimits.join(', ')}`,
        `  Related Articles: ${getArticlesBySlugs(project.relatedArticleSlugs).map(article => article.title).join(' | ')}`,
        project.learning
          ? `  Learning record: ${project.learning.stage}; Goal: ${project.learning.goal}; Verified: ${project.learning.verified.join(', ')}; Verification: ${project.learning.verification.join(', ')}; Next: ${project.learning.nextSteps.join(', ')}`
          : '',
      ].join('\n'),
    ),
    '',
    'Articles:',
    ...siteKnowledge.articles.map(article =>
      [
        `- ${article.title}`,
        `  Slug: ${article.slug}`,
        `  Summary: ${article.summary}`,
        `  Tags: ${article.tags.join(', ')}`,
        `  Concept Tags: ${article.conceptTags.join(', ')}`,
        `  Difficulty: ${article.difficulty}`,
        `  Kind: ${article.kind}`,
        `  Related Projects: ${getProjectsByIds(article.relatedProjectIds).map(project => project.name).join(', ')}`,
      ].join('\n'),
    ),
    '',
    'Curated learning records:',
    ...learningRecords.map(record =>
      `- ${record.title}: ${record.summary}; Achieved: ${record.achieved.join(', ')}; Reflection: ${record.reflection.join(', ')}; Next: ${record.nextSteps.join(', ')}`,
    ),
  ].join('\n')
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/)
    .filter(token => token.length > 1)
}

function scoreText(queryTokens: string[], text: string): number {
  const haystack = text.toLowerCase()
  return queryTokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0)
}

export function findRelevantReferences(query: string, pageTitle?: string, max = 4): SiteReference[] {
  const queryTokens = tokenize([query, pageTitle || ''].join(' '))

  const articleRefs = siteArticles.map(article => {
    const score = scoreText(
      queryTokens,
      [
        article.title,
        article.summary,
        article.tags.join(' '),
        article.conceptTags.join(' '),
        article.suggestedQuestions.join(' '),
        article.slug,
      ].join(' '),
    )

    return {
      score: pageTitle && article.title === pageTitle ? score + 10 : score,
      ref: {
        type: 'article' as const,
        title: article.title,
        href: `/articles/${article.slug}`,
        summary: article.summary,
      },
    }
  })

  const projectRefs = siteProjects.map(project => {
    const score = scoreText(
      queryTokens,
      [
        project.name,
        project.positioning,
        project.coreAbilities.join(' '),
        project.talkingPoints.join(' '),
        project.techStack.join(' '),
        project.conceptTags.join(' '),
      ].join(' '),
    )

    return {
      score: pageTitle && project.name === pageTitle ? score + 10 : score,
      ref: {
        type: 'project' as const,
        title: project.name,
        href: '/#projects',
        summary: project.positioning,
      },
    }
  })

  const capabilityRefs = engineeringMap.map(node => {
    const score = scoreText(queryTokens, [node.title, node.subtitle, node.id].join(' '))

    return {
      score,
      ref: {
        type: 'capability' as const,
        title: node.title,
        href: '/#engineering-map',
        summary: node.subtitle,
      },
    }
  })

  return [...articleRefs, ...projectRefs, ...capabilityRefs]
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(item => item.ref)
}
