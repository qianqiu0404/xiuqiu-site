// Data entry point for the articles feature. Pages in this feature import
// data only from here; generated*.ts and shared helpers stay in src/data.

export { getAdjacentArticles, sortArticlesForReading } from '../../data/articlePresentation'
export { loadArticleContent } from '../../data/articles'
export { evidenceStatusLabels } from '../../data/evidence'
export { evidenceRecords } from '../../data/generatedEvidence'
export { getArticleBySlug, getArticlesBySlugs, getProjectsByIds, siteArticles, siteKnowledge } from '../../data/siteKnowledge'
