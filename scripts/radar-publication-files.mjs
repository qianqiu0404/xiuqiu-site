import { existsSync, readFileSync } from 'node:fs'
import { parseMarkdownFrontmatter } from './frontmatter.mjs'
import { validateMarketRadar } from './market-radar-contracts.mjs'
import { assertPublicRadarContent } from './radar-pipeline.mjs'
import { buildRadarPublication } from './radar-publication-boundary.mjs'
import { normalizeLearningEditionV2 } from './learning-radar-v2.mjs'

export function readRadarPublication(path, kind, date) {
  if (!existsSync(path)) return null
  const { meta } = parseMarkdownFrontmatter(readFileSync(path, 'utf8'), path.pathname)
  if (meta.date !== date || meta.slug !== date || meta.publish !== true || meta.reviewStatus !== 'automated') {
    throw new Error(`${kind} radar ${date} is not an automated publishable daily page.`)
  }
  if (kind === 'learning') {
    assertPublicRadarContent(meta)
    return buildRadarPublication(kind, meta.schemaVersion === 2 ? normalizeLearningEditionV2(meta) : meta)
  }
  validateMarketRadar(meta, path.pathname)
  return buildRadarPublication(kind, meta)
}

export function radarPublicationPath(repoUrl, kind, date) {
  const directory=kind==='learning'?'radar':'market-radar'
  return new URL(`content/${directory}/${date}.md`,repoUrl)
}
