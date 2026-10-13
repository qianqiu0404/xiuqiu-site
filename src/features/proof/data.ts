// Data entry point for the proof feature. Pages in this feature import
// data only from here; generated*.ts and shared helpers stay in src/data.

export { evidenceBySlug, evidenceCapabilities, evidenceCellStatus, evidenceForCell, evidenceKinds, evidenceStatusLabels } from '../../data/evidence'
export { deliveryStatusLabels, evidenceKindLabels, evidenceLedgerRecords, evidenceLedgerStats, evidenceProjectOptions, evidenceVisibilityLabels, failureEvidenceStatusLabels } from '../../data/evidenceLedger'
export { deliveryRecords } from '../../data/generatedDeliveries'
export { evidenceRecords } from '../../data/generatedEvidence'
export type { EvidenceKind, EvidenceStatus, EvidenceVisibility } from '../../data/generatedEvidence'
export { failureCases } from '../../data/generatedFailureCases'
export type { FailureAction, FailureCase, FailureCategory, FailureEvidenceStatus, FailurePriority } from '../../data/generatedFailureCases'
export { getArticleBySlug, getProjectByKey, projectClaimStateLabels, projectPublicRoleLabels, siteProjects } from '../../data/siteKnowledge'
