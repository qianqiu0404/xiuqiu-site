import { readFileSync } from 'node:fs'
import { articleKnowledge } from '../src/data/generatedArticleKnowledge.ts'
import { projects } from '../src/data/projects.ts'
import { engineeringMap, siteProjects } from '../src/data/siteKnowledge.ts'
import { learningRecords } from '../src/data/generatedLearningRecords.ts'

const sitemapSource = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8')
const articleSlugs = new Set(articleKnowledge.map(article => article.slug))
const projectIds = new Set(projects.map(project => project.id))
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
  project.relatedArticleSlugs.forEach(slug => {
    if (!articleSlugs.has(slug)) {
      addError(`${project.name}: related article does not exist: ${slug}`)
    }
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

if (errors.length) {
  console.error('Knowledge validation failed.')
  errors.forEach(error => console.error(`- ${error}`))
  process.exit(1)
}

console.log(`Knowledge validation passed for ${articleKnowledge.length} Markdown articles.`)
