import { articleKnowledge, type ArticleKnowledge } from './generatedArticleKnowledge.ts'
import { deliveryRecords, type DeliveryRecord, type DeliveryStatus } from './generatedDeliveries.ts'
import {
  evidenceRecords,
  type EvidenceKind,
  type EvidenceRecord,
  type EvidenceStatus,
  type EvidenceVisibility,
} from './generatedEvidence.ts'
import {
  failureCases,
  type FailureCase,
  type FailureEvidenceStatus,
} from './generatedFailureCases.ts'
import { projects, type Project } from './generatedProjects.ts'

export interface EvidenceLedgerRecord {
  evidence: EvidenceRecord
  projects: Project[]
  deliveries: DeliveryRecord[]
  failures: FailureCase[]
  articles: ArticleKnowledge[]
}

export interface EvidenceLedgerStats {
  total: number
  verified: number
  partial: number
  design: number
  public: number
  latestVerifiedAt: string
}

export const evidenceKindLabels: Record<EvidenceKind, string> = {
  implementation: '工程实现',
  test: '自动化测试',
  demo: '可运行演示',
  writeup: '公开说明',
}

export const evidenceVisibilityLabels: Record<EvidenceVisibility, string> = {
  public: '公开可复核',
  'private-summary': '私有工程去敏摘要',
}

export const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  'in-progress': '进行中',
  partial: '部分完成',
  delivered: '已交付',
}

export const failureEvidenceStatusLabels: Record<FailureEvidenceStatus, string> = {
  implemented: '当前已实现',
  partial: '部分验证',
  design: '生产设计',
}

const statusRank: Record<EvidenceStatus, number> = {
  verified: 3,
  partial: 2,
  design: 1,
}

const projectsBySlug = new Map(projects.map(project => [project.slug, project]))
const deliveriesBySlug = new Map(deliveryRecords.map(delivery => [delivery.slug, delivery]))
const failuresBySlug = new Map(failureCases.map(failure => [failure.slug, failure]))
const articlesBySlug = new Map(articleKnowledge.map(article => [article.slug, article]))

function resolveMany<T>(slugs: string[], recordsBySlug: Map<string, T>): T[] {
  return slugs
    .map(slug => recordsBySlug.get(slug))
    .filter((record): record is T => Boolean(record))
}

export const evidenceLedgerRecords: EvidenceLedgerRecord[] = evidenceRecords
  .map(evidence => ({
    evidence,
    projects: resolveMany(evidence.projectSlugs, projectsBySlug),
    deliveries: resolveMany(evidence.deliverySlugs, deliveriesBySlug),
    failures: resolveMany(evidence.failureSlugs, failuresBySlug),
    articles: resolveMany(evidence.articleSlugs, articlesBySlug),
  }))
  .sort((a, b) => (
    b.evidence.verifiedAt.localeCompare(a.evidence.verifiedAt)
    || statusRank[b.evidence.status] - statusRank[a.evidence.status]
    || a.evidence.title.localeCompare(b.evidence.title, 'zh-CN')
  ))

export const evidenceProjectOptions: Project[] = [
  ...new Map(
    evidenceLedgerRecords
      .flatMap(record => record.projects)
      .map(project => [project.slug, project]),
  ).values(),
].sort((a, b) => a.name.localeCompare(b.name, 'en'))

export const evidenceLedgerStats: EvidenceLedgerStats = {
  total: evidenceRecords.length,
  verified: evidenceRecords.filter(record => record.status === 'verified').length,
  partial: evidenceRecords.filter(record => record.status === 'partial').length,
  design: evidenceRecords.filter(record => record.status === 'design').length,
  public: evidenceRecords.filter(record => record.visibility === 'public' && record.url).length,
  latestVerifiedAt: evidenceLedgerRecords[0]?.evidence.verifiedAt || '',
}
