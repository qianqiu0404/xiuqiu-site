import { evidenceRecords, type EvidenceKind, type EvidenceRecord, type EvidenceStatus } from './generatedEvidence.ts'

export interface EvidenceCapability {
  id: string
  title: string
  summary: string
}

export const evidenceCapabilities: EvidenceCapability[] = [
  { id: 'request-idempotency', title: '请求幂等与并发控制', summary: '避免重复请求、并发 worker 和旧状态覆盖制造第二个资金动作。' },
  { id: 'fund-state', title: '资金状态机与账务边界', summary: '区分订单、冻结、账务、链上事实和通知的独立推进状态。' },
  { id: 'risk-authorization', title: '风控审批与交易一致性', summary: '审批内容必须与待签名交易一致，关键依赖不可用时 fail-closed。' },
  { id: 'chain-resources', title: '多链适配与链资源', summary: '显式管理 nonce、UTXO、blockhash、TAPOS、sequence 与对象版本。' },
  { id: 'signer-boundary', title: '签名边界与密钥后端', summary: '业务授权、签名策略和 Local/MPC/HSM 后端保持清晰边界。' },
  { id: 'broadcast-finality', title: '广播、确认与最终性', summary: '区分调用结果、节点可见性、canonical receipt 与最终确认。' },
  { id: 'reconciliation', title: '对账、补偿与异常恢复', summary: '让本地状态以幂等方式追平已经发生的链上资金事实。' },
  { id: 'observability', title: '可观测性与运维恢复', summary: '通过健康、指标、审计、outbox 与失败记录定位恢复入口。' },
]

export const evidenceKinds: Array<{ id: EvidenceKind; title: string }> = [
  { id: 'implementation', title: '工程实现' },
  { id: 'test', title: '自动化测试' },
  { id: 'demo', title: '可运行演示' },
  { id: 'writeup', title: '公开说明' },
]

export const evidenceStatusLabels: Record<EvidenceStatus | 'none', string> = {
  verified: '已验证', partial: '部分验证', design: '工程设计', none: '暂无证据',
}

const statusRank: Record<EvidenceStatus, number> = { verified: 3, partial: 2, design: 1 }

export function evidenceForCell(capabilityId: string, kind: EvidenceKind): EvidenceRecord[] {
  return evidenceRecords
    .filter(record => record.kind === kind && record.capabilityIds.includes(capabilityId))
    .sort((a, b) => statusRank[b.status] - statusRank[a.status] || b.verifiedAt.localeCompare(a.verifiedAt))
}

export function evidenceCellStatus(records: EvidenceRecord[]): EvidenceStatus | 'none' {
  return records[0]?.status || 'none'
}

export function evidenceBySlug(slug: string): EvidenceRecord | undefined {
  return evidenceRecords.find(record => record.slug === slug)
}
