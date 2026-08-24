import { existsSync, lstatSync, readdirSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'

export const OBSIDIAN_PUBLIC_SOURCE_ROOTS = [
  { relativePath: '20-项目做证据', sourceKind: 'project' },
  { relativePath: '50-复盘看变化/每周', sourceKind: 'weekly' },
]

function publicRelativePath(vaultRoot, absolutePath) {
  return relative(vaultRoot, absolutePath).split(sep).join('/')
}

function walkAllowedRoot(vaultRoot, directory, sourceKind) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = resolve(directory, entry.name)
    if (entry.isSymbolicLink()) {
      throw new Error(`${publicRelativePath(vaultRoot, absolutePath)}: symbolic links are not allowed in public source roots.`)
    }
    if (entry.isDirectory()) {
      files.push(...walkAllowedRoot(vaultRoot, absolutePath, sourceKind))
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push({
        absolutePath,
        relativePath: publicRelativePath(vaultRoot, absolutePath),
        sourceKind,
      })
    }
  }
  return files
}

export function listObsidianPublicSourceFiles(vaultPath) {
  const vaultRoot = resolve(vaultPath)
  const missingRoots = OBSIDIAN_PUBLIC_SOURCE_ROOTS
    .filter(root => !existsSync(resolve(vaultRoot, root.relativePath)))
    .map(root => root.relativePath)
  if (missingRoots.length) {
    throw new Error(`Missing required public source roots: ${missingRoots.join(', ')}.`)
  }

  return OBSIDIAN_PUBLIC_SOURCE_ROOTS
    .flatMap(root => {
      const absoluteRoot = resolve(vaultRoot, root.relativePath)
      const rootStat = lstatSync(absoluteRoot)
      if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
        throw new Error(`${root.relativePath}: public source root must be a real directory.`)
      }
      return walkAllowedRoot(vaultRoot, absoluteRoot, root.sourceKind)
    })
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'zh-CN'))
}
