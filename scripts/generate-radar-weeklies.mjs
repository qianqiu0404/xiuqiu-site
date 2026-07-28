import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertPublicHttpUrl, isPublishable } from './public-data-contracts.mjs'

const SNAPSHOT_URL = new URL('../content/obsidian-public/radar-weeklies.json', import.meta.url)
const PROJECT_SNAPSHOT_URL = new URL('../content/obsidian-public/projects.json', import.meta.url)
const OUTPUT_URL = new URL('../src/data/generatedRadarWeeklies.ts', import.meta.url)
const WEEKLY_LIST_FIELDS = ['judgments', 'shipped', 'watch', 'stopped', 'nextFocus']
const REQUIRED_WEEKLY_LIST_FIELDS = new Set(['judgments', 'nextFocus'])
const PROJECT_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PLACEHOLDER_TEXT_RE = /(?:\b(?:todo|tbd|placeholder)\b|待补充|占位|稍后补充)/i
const PLACEHOLDER_HOST_RE = /(?:^|\.)(?:example\.(?:com|net|org)|invalid|test)$/

function assertReviewedDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must use a valid YYYY-MM-DD date.`)
  }

  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} must use a valid YYYY-MM-DD date.`)
  }
}

function assertMeaningfulText(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`)
  }
  if (value !== value.trim()) {
    throw new Error(`${label} must not contain surrounding whitespace.`)
  }
  if (PLACEHOLDER_TEXT_RE.test(value)) {
    throw new Error(`${label} must not contain placeholder text.`)
  }
}

function assertUniqueTextList(value, label, required) {
  if (!Array.isArray(value) || (required && value.length === 0)) {
    throw new Error(
      required
        ? `${label} must contain at least one reviewed item.`
        : `${label} must be an array.`,
    )
  }

  const seen = new Set()
  value.forEach((item, index) => {
    assertMeaningfulText(item, `${label}[${index}]`)
    if (seen.has(item)) {
      throw new Error(`${label} must not contain duplicate items.`)
    }
    seen.add(item)
  })
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function isoWeeksInYear(year) {
  const firstDay = new Date(Date.UTC(year, 0, 1)).getUTCDay()
  return firstDay === 4 || (firstDay === 3 && isLeapYear(year)) ? 53 : 52
}

function assertWeeklyIdentity(weekly) {
  const match = typeof weekly.week === 'string' && weekly.week.match(/^(\d{4})-W(\d{2})$/)
  if (!match || weekly.slug !== weekly.week) {
    throw new Error(`Invalid weekly radar identity: ${weekly.slug ?? 'missing slug'}`)
  }

  const year = Number(match[1])
  const weekNumber = Number(match[2])
  if (weekNumber < 1 || weekNumber > isoWeeksInYear(year)) {
    throw new Error(`${weekly.slug}: week must be a valid ISO week.`)
  }
}

function assertRelatedProjects(slugs, projectSlugs, weeklySlug) {
  if (!Array.isArray(slugs)) {
    throw new Error(`${weeklySlug}: relatedProjectSlugs must be an array.`)
  }

  const seen = new Set()
  slugs.forEach((slug, index) => {
    if (typeof slug !== 'string' || !PROJECT_SLUG_RE.test(slug)) {
      throw new Error(`${weeklySlug}: relatedProjectSlugs[${index}] must be a valid project slug.`)
    }
    if (seen.has(slug)) {
      throw new Error(`${weeklySlug}: relatedProjectSlugs must not contain duplicates.`)
    }
    if (!projectSlugs.has(slug)) {
      throw new Error(`${weeklySlug}: related project does not exist: ${slug}`)
    }
    seen.add(slug)
  })
}

function assertSourceUrls(sourceUrls, weeklySlug) {
  if (!Array.isArray(sourceUrls) || sourceUrls.length === 0) {
    throw new Error(`${weeklySlug}: sourceUrls must contain at least one public source.`)
  }

  const seen = new Set()
  sourceUrls.forEach((sourceUrl, index) => {
    assertPublicHttpUrl(sourceUrl, `${weeklySlug}: sourceUrls[${index}]`)
    const parsed = new URL(sourceUrl)
    if (parsed.protocol !== 'https:') {
      throw new Error(`${weeklySlug}: sourceUrls[${index}] must use HTTPS.`)
    }
    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '')
    if (PLACEHOLDER_HOST_RE.test(hostname)) {
      throw new Error(`${weeklySlug}: sourceUrls[${index}] must not use a placeholder hostname.`)
    }

    const canonicalUrl = parsed.href
    if (seen.has(canonicalUrl)) {
      throw new Error(`${weeklySlug}: sourceUrls must not contain duplicates.`)
    }
    seen.add(canonicalUrl)
  })
}

export function validateRadarWeekly(weekly, projectSlugs) {
  if (!weekly || typeof weekly !== 'object' || Array.isArray(weekly)) {
    throw new Error('Weekly radar entry must be an object.')
  }
  if (weekly.publish !== true) {
    throw new Error(`${weekly.slug ?? 'weekly radar'}: publish must be true before generation.`)
  }

  assertWeeklyIdentity(weekly)
  assertMeaningfulText(weekly.title, `${weekly.slug}: title`)
  assertMeaningfulText(weekly.summary, `${weekly.slug}: summary`)
  assertReviewedDate(weekly.reviewedAt, `${weekly.slug}: reviewedAt`)
  WEEKLY_LIST_FIELDS.forEach(field => {
    assertUniqueTextList(
      weekly[field],
      `${weekly.slug}: ${field}`,
      REQUIRED_WEEKLY_LIST_FIELDS.has(field),
    )
  })
  if (weekly.nextFocus.length > 2) {
    throw new Error(`${weekly.slug}: nextFocus must contain one or two items.`)
  }
  assertRelatedProjects(weekly.relatedProjectSlugs, projectSlugs, weekly.slug)
  assertSourceUrls(weekly.sourceUrls, weekly.slug)

  return weekly
}

export function selectPublishableRadarWeeklies(entries, projectSlugs) {
  if (!Array.isArray(entries)) {
    throw new Error('Invalid Obsidian weekly radar snapshot.')
  }
  if (!(projectSlugs instanceof Set) || projectSlugs.size === 0) {
    throw new Error('A non-empty public project slug set is required.')
  }

  const published = entries.filter(isPublishable)
  const identities = new Set()
  published.forEach(weekly => {
    validateRadarWeekly(weekly, projectSlugs)
    if (identities.has(weekly.week)) {
      throw new Error(`Duplicate weekly radar identity: ${weekly.week}`)
    }
    identities.add(weekly.week)
  })

  return published.sort((a, b) => b.week.localeCompare(a.week))
}

function generateRadarWeeklies() {
  if (!existsSync(SNAPSHOT_URL)) {
    throw new Error('Missing Obsidian weekly radar snapshot. Run npm run sync:obsidian-public first.')
  }
  if (!existsSync(PROJECT_SNAPSHOT_URL)) {
    throw new Error('Missing Obsidian public project snapshot. Run npm run sync:obsidian-public first.')
  }

  const snapshot = JSON.parse(readFileSync(SNAPSHOT_URL, 'utf8'))
  if (!snapshot || !Array.isArray(snapshot.radarWeeklies)) {
    throw new Error('Invalid Obsidian weekly radar snapshot.')
  }
  const projectSnapshot = JSON.parse(readFileSync(PROJECT_SNAPSHOT_URL, 'utf8'))
  if (!projectSnapshot || !Array.isArray(projectSnapshot.projects)) {
    throw new Error('Invalid Obsidian public project snapshot.')
  }
  const projectSlugs = new Set(projectSnapshot.projects.map(project => project.siteSlug))
  const weeklies = selectPublishableRadarWeeklies(snapshot.radarWeeklies, projectSlugs)

  const output = `/* eslint-disable */
// Generated by scripts/generate-radar-weeklies.mjs from the reviewed Obsidian public snapshot.

export interface RadarWeekly {
  week: string
  slug: string
  title: string
  summary: string
  judgments: string[]
  shipped: string[]
  watch: string[]
  stopped: string[]
  nextFocus: string[]
  relatedProjectSlugs: string[]
  sourceUrls: string[]
  publish: true
  reviewedAt: string
}

export const radarWeeklies: RadarWeekly[] = ${JSON.stringify(weeklies, null, 2)}
`

  writeFileSync(OUTPUT_URL, output)
  console.log(`Generated ${weeklies.length} weekly radar entries from the Obsidian public snapshot.`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  generateRadarWeeklies()
}
