import { writeFileSync } from 'node:fs'
import { articleSummaries } from '../src/data/generatedArticleKnowledge.ts'
import { projects } from '../src/data/generatedProjects.ts'
import { dailyRadars } from '../src/data/generatedRadars.ts'
import { radarWeeklies } from '../src/data/generatedRadarWeeklies.ts'
import { deliveryRecords } from '../src/data/generatedDeliveries.ts'

const SITE_URL = 'https://xiuqiu-site.vercel.app'
const articleSlugs = articleSummaries.map(article => article.slug)

const routes = [
  '/',
  '/engineering',
  '/engineering/failures',
  '/engineering/evidence',
  '/projects',
  '/ai',
  '/ai/social-research',
  '/ai/deliveries',
  '/now',
  '/radar',
  '/learning',
  '/articles',
  ...projects.map(project => `/projects/${project.slug}`),
  ...articleSlugs.map(slug => `/articles/${slug}`),
  ...dailyRadars.map(radar => `/radar/${radar.slug}`),
  ...radarWeeklies.map(weekly => `/radar/week/${weekly.slug}`),
  ...deliveryRecords.map(record => `/ai/deliveries/${record.slug}`),
]
const urls = routes
  .map(route => {
    const loc = route === '/' ? `${SITE_URL}/` : `${SITE_URL}${route}`
    return ['  <url>', `    <loc>${loc}</loc>`, '  </url>'].join('\n')
  })
  .join('\n')

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  urls,
  '</urlset>',
  '',
].join('\n')

writeFileSync(new URL('../public/sitemap.xml', import.meta.url), sitemap)
console.log(`Generated sitemap.xml with ${routes.length} routes.`)
