import { readFileSync } from 'node:fs'
import { articleKnowledge } from '../src/data/generatedArticleKnowledge.ts'
import { projects } from '../src/data/generatedProjects.ts'
import { aiCases } from '../src/data/generatedAiCases.ts'
import { engineeringMap, siteProjects } from '../src/data/siteKnowledge.ts'
import { learningRecords } from '../src/data/generatedLearningRecords.ts'
import { dailyRadars } from '../src/data/generatedRadars.ts'
import { failureCases } from '../src/data/generatedFailureCases.ts'
import { evidenceRecords } from '../src/data/generatedEvidence.ts'
import { deliveryRecords } from '../src/data/generatedDeliveries.ts'
import { nowSnapshot } from '../src/data/generatedNow.ts'
import { evidenceCapabilities, evidenceKinds } from '../src/data/evidence.ts'

const sitemapSource = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8')
const articleSlugs = new Set(articleKnowledge.map(article => article.slug))
const projectIds = new Set(projects.flatMap(project => [project.id, ...project.legacyIds]))
const errors = []

function addError(message) {
  errors.push(message)
}

articleKnowledge.forEach(article => {
  if (!sitemapSource.includes(`/articles/${article.slug}`)) {
    addError(`Missing sitemap URL for article: ${article.slug}`)
  }

  article.relatedProjectIds.forEach(projectId => {
    if (!projectIds.has(projectId)) {
      addError(`${article.slug}: related project does not exist: ${projectId}`)
    }
  })

  article.recommendedSlugs.forEach(slug => {
    if (!articleSlugs.has(slug)) {
      addError(`${article.slug}: recommended article does not exist: ${slug}`)
    }
  })
})

siteProjects.forEach(project => {
  if (!sitemapSource.includes(`/projects/${project.slug}`)) {
    addError(`Missing sitemap URL for project: ${project.slug}`)
  }

  project.relatedArticleSlugs.forEach(slug => {
    if (!articleSlugs.has(slug)) {
      addError(`${project.name}: related article does not exist: ${slug}`)
    }
  })
})

if (!sitemapSource.includes('/ai')) addError('Missing sitemap URL for AI collaboration page')
if (!sitemapSource.includes('/radar')) addError('Missing sitemap URL for daily radar page')
if (!sitemapSource.includes('/engineering/failures')) addError('Missing sitemap URL for failure playbook')
if (!sitemapSource.includes('/engineering/evidence')) addError('Missing sitemap URL for engineering evidence')
if (!sitemapSource.includes('/ai/deliveries')) addError('Missing sitemap URL for AI deliveries')
if (!sitemapSource.includes('/now')) addError('Missing sitemap URL for current activity')

aiCases.forEach(item => {
  item.relatedArticleSlugs.forEach(slug => {
    if (!articleSlugs.has(slug)) addError(`${item.title}: related article does not exist: ${slug}`)
  })
})

engineeringMap.forEach(node => {
  node.articleSlugs.forEach(slug => {
    if (!articleSlugs.has(slug)) {
      addError(`${node.title}: map article does not exist: ${slug}`)
    }
  })

  node.projectIds.forEach(projectId => {
    if (!projectIds.has(projectId)) {
      addError(`${node.title}: map project does not exist: ${projectId}`)
    }
  })
})

learningRecords.forEach(record => {
  record.projectIds.forEach(projectId => {
    if (!projectIds.has(projectId)) {
      addError(`${record.slug}: related project does not exist: ${projectId}`)
    }
  })
})

const projectSlugs = new Set(projects.map(project => project.slug))
dailyRadars.forEach(radar => {
  if (!sitemapSource.includes(`/radar/${radar.slug}`)) addError(`Missing sitemap URL for radar: ${radar.slug}`)
  radar.relatedProjectSlugs.forEach(slug => {
    if (!projectSlugs.has(slug)) addError(`${radar.slug}: related project does not exist: ${slug}`)
  })
})

failureCases.forEach(item => {
  item.relatedArticleSlugs.forEach(slug => {
    if (!articleSlugs.has(slug)) addError(`${item.slug}: related article does not exist: ${slug}`)
  })
  item.relatedProjectSlugs.forEach(slug => {
    if (!projectSlugs.has(slug)) addError(`${item.slug}: related project does not exist: ${slug}`)
  })
})

const failureSlugs = new Set(failureCases.map(item => item.slug))
const evidenceSlugs = new Set(evidenceRecords.map(item => item.slug))
const deliverySlugs = new Set(deliveryRecords.map(item => item.slug))
const capabilityIds = new Set(evidenceCapabilities.map(item => item.id))

evidenceRecords.forEach(record => {
  record.projectSlugs.forEach(slug => {
    if (!projectSlugs.has(slug)) addError(`${record.slug}: evidence project does not exist: ${slug}`)
  })
  record.failureSlugs.forEach(slug => {
    if (!failureSlugs.has(slug)) addError(`${record.slug}: evidence failure does not exist: ${slug}`)
  })
  record.deliverySlugs.forEach(slug => {
    if (!deliverySlugs.has(slug)) addError(`${record.slug}: evidence delivery does not exist: ${slug}`)
  })
  record.capabilityIds.forEach(id => {
    if (!capabilityIds.has(id)) addError(`${record.slug}: evidence capability does not exist: ${id}`)
  })
})

deliveryRecords.forEach(record => {
  if (!sitemapSource.includes(`/ai/deliveries/${record.slug}`)) addError(`Missing sitemap URL for delivery: ${record.slug}`)
  record.projectSlugs.forEach(slug => {
    if (!projectSlugs.has(slug)) addError(`${record.slug}: delivery project does not exist: ${slug}`)
  })
  record.evidenceSlugs.forEach(slug => {
    if (!evidenceSlugs.has(slug)) addError(`${record.slug}: delivery evidence does not exist: ${slug}`)
  })
  if (record.status === 'delivered' && record.publicLinks.length === 0) {
    addError(`${record.slug}: delivered record must contain a public link`)
  }
})

evidenceCapabilities.forEach(capability => {
  evidenceKinds.forEach(kind => {
    if (!evidenceRecords.some(record => record.capabilityIds.includes(capability.id) && record.kind === kind.id)) {
      addError(`${capability.id}: no evidence record for ${kind.id}`)
    }
  })
})

nowSnapshot.developmentProjectSlugs.forEach(slug => {
  if (!projectSlugs.has(slug)) addError(`now: development project does not exist: ${slug}`)
})

if (errors.length) {
  console.error('Knowledge validation failed.')
  errors.forEach(error => console.error(`- ${error}`))
  process.exit(1)
}

console.log(`Knowledge validation passed for ${articleKnowledge.length} articles, ${evidenceRecords.length} evidence records and ${deliveryRecords.length} deliveries.`)
