import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { parseMarkdownFrontmatter } from './frontmatter.mjs'

const sourceRoot = resolve(process.argv[2] || process.env.OBSIDIAN_VAULT || '')
const targetRoot = resolve('content/learning')

if (!sourceRoot || !existsSync(sourceRoot)) {
  throw new Error('Provide an Obsidian vault path as the first argument or OBSIDIAN_VAULT.')
}

function markdownFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? markdownFiles(path) : path.endsWith('.md') ? [path] : []
  })
}

const published = []
for (const path of markdownFiles(sourceRoot)) {
  const raw = readFileSync(path, 'utf8')
  let meta
  try {
    meta = parseMarkdownFrontmatter(raw, path).meta
  } catch {
    continue
  }

  if (meta.publish !== true || meta.kind !== 'learning-log') continue
  if (!meta.slug) throw new Error(`${path}: published learning record needs a slug.`)

  const target = join(targetRoot, `${meta.slug}.md`)
  mkdirSync(targetRoot, { recursive: true })
  writeFileSync(target, raw)
  published.push(basename(target))
}

console.log(`Synced ${published.length} explicitly published learning records.`)
