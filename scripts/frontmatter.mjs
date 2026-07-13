import { parse as parseYaml } from 'yaml'

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/

export function parseMarkdownFrontmatter(raw, sourceName) {
  const match = raw.match(FRONTMATTER_RE)
  if (!match) throw new Error(`${sourceName}: missing frontmatter block.`)

  const source = match[1].trim()
  let meta

  try {
    meta = source.startsWith('{') ? JSON.parse(source) : parseYaml(source)
  } catch (error) {
    throw new Error(
      `${sourceName}: invalid JSON/YAML frontmatter. ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    throw new Error(`${sourceName}: frontmatter must be an object.`)
  }

  return { meta, body: match[2].trim() }
}

export function requireFields(meta, fields, sourceName) {
  fields.forEach(field => {
    if (meta[field] === undefined || meta[field] === null || meta[field] === '') {
      throw new Error(`${sourceName}: missing required field ${field}.`)
    }
  })
}

export function requireStringArray(meta, field, sourceName) {
  if (!Array.isArray(meta[field]) || meta[field].some(item => typeof item !== 'string')) {
    throw new Error(`${sourceName}: ${field} must be a string array.`)
  }
}

export function requireDate(value, field, sourceName) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${sourceName}: ${field} must use YYYY-MM-DD.`)
  }
}
