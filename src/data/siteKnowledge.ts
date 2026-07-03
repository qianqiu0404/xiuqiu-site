import { articleKnowledge, type ArticleKnowledge } from './generatedArticleKnowledge.ts'
import { projects, type Project } from './projects.ts'

export type KnowledgeTag =
  | 'wallet-backend'
  | 'signer-service'
  | 'multi-chain'
  | 'go-infra'
  | 'evm'
  | 'mpc-tss'
  | 'api-design'
  | 'ai-engineering'

export interface SiteArticle extends ArticleKnowledge {
  conceptTags: KnowledgeTag[]
}

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
  4: {
    conceptTags: ['evm', 'go-infra'],
    relatedArticleSlugs: ['evm-call-proxy-patterns', 'evm-create2-assembly-lifecycle', 'eip-erc-protocol-evolution'],
    suggestedQuestions: [
      'prediction-market 如何从 mock 走到链上闭环？',
      '链上事件 Indexer 在这个项目里解决什么问题？',
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
  6: {
    conceptTags: ['evm', 'wallet-backend'],
    relatedArticleSlugs: ['evm-call-proxy-patterns', 'eip-erc-protocol-evolution'],
    suggestedQuestions: [
      'Scaffold-ETH 适合沉淀哪些 DApp 基础能力？',
      'Web3 前端和传统前端的主要差异是什么？',
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
    id: 'wallet-backend',
    title: 'Web3 Wallet Backend',
    subtitle: 'API boundary, chain adapters, transaction construction, unified responses.',
    projectIds: [1, 2],
    articleSlugs: ['api-system-calls', 'wallet-api-boundary', 'wallet-address-models'],
  },
  {
    id: 'signer-service',
    title: 'Signer Service',
    subtitle: 'Private-key isolation, offline signing, batch signing, security boundary.',
    projectIds: [2, 5],
    articleSlugs: ['wallet-sign-signer', 'wallet-api-boundary'],
  },
  {
    id: 'multi-chain',
    title: 'Multi-chain Models',
    subtitle: 'BTC UTXO, ETH account model, Solana account/public-key model.',
    projectIds: [1, 2],
    articleSlugs: ['wallet-address-models', 'wallet-api-boundary'],
  },
  {
    id: 'go-infra',
    title: 'Go Backend Infra',
    subtitle: 'HTTP/gRPC services, Redis cache, PostgreSQL persistence, dashboard APIs.',
    projectIds: [1, 3, 4],
    articleSlugs: ['http-rpc-grpc', 'market-services-data-flow'],
  },
  {
    id: 'evm',
    title: 'EVM Engineering',
    subtitle: 'Contracts, proxy patterns, create2, assembly, EIP/ ERC evolution.',
    projectIds: [4, 6],
    articleSlugs: ['evm-call-proxy-patterns', 'evm-create2-assembly-lifecycle', 'eip-erc-protocol-evolution'],
  },
  {
    id: 'mpc-tss',
    title: 'MPC / TSS',
    subtitle: 'Threshold signature scheme, GG18 protocol, Paillier cryptosystem, key share security.',
    projectIds: [5],
    articleSlugs: ['mpc-wallet-sign-integration', 'thorchain-tss-attack-analysis'],
  },
  {
    id: 'ai-engineering',
    title: 'AI Engineering Workflows',
    subtitle: 'Verified engineering loops, reusable skills, scheduled research, and MCP-backed knowledge workflows.',
    projectIds: [1, 2, 3],
    articleSlugs: [
      'codex-ai-workflow-system-retrospective',
      'cex-evm-wallet-deposit-withdrawal-loop',
      'stablecoin-x402-agent-payments',
    ],
  },
]

export const siteKnowledge: SiteKnowledge = {
  owner: {
    name: 'xiuqiu',
    title: 'Web3 Wallet & Backend Developer',
    summary:
      'Building practical systems around multi-chain wallets, signer services, Go backend infrastructure, Solidity/EVM, MPC/TSS, and AI-assisted engineering workflows.',
    focus: [
      'Web3 Wallet Backend',
      'Multi-chain Signer',
      'Solidity / EVM',
      'MPC / TSS',
      'Go Backend Infrastructure',
      'AI-assisted Development',
    ],
  },
  projects: siteProjects,
  articles: siteArticles,
  tags: ['wallet-backend', 'signer-service', 'multi-chain', 'go-infra', 'evm', 'mpc-tss', 'api-design', 'ai-engineering'],
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
        `  Related Articles: ${getArticlesBySlugs(project.relatedArticleSlugs).map(article => article.title).join(' | ')}`,
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
        `  Related Projects: ${getProjectsByIds(article.relatedProjectIds).map(project => project.name).join(', ')}`,
      ].join('\n'),
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
