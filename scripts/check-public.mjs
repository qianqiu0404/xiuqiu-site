import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ignoredDirectories = new Set(['.git', '.vercel', 'dist', 'node_modules'])

function walkFiles(directory = '.') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) return ignoredDirectories.has(entry.name) ? [] : walkFiles(join(directory, entry.name))
    return entry.isFile() ? [join(directory, entry.name).replace(/^\.\//, '')] : []
  })
}

function listedFiles() {
  try {
    return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean)
  } catch {
    return walkFiles()
  }
}

const files = listedFiles()
  .filter(file => file !== '.git')
  .filter(file => !file.endsWith('package-lock.json'))
  .filter(file => !file.endsWith('.test.mjs'))
  .filter(file => existsSync(file) && lstatSync(file).isFile())

const rules = [
  { label: 'absolute local path', pattern: /\/(?:Users|home)\/[^/\s]+\// },
  { label: 'private Git remote', pattern: /git@github\.com:/ },
  { label: 'private key block', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { label: 'GitHub or cloud credential', pattern: /(?:gh[pousr]_|AKIA)[A-Za-z0-9_]{12,}/ },
  { label: 'filled DeepSeek key', pattern: /DEEPSEEK_API_KEY[ \t]*=[ \t]*[^\s#]+/ },
]

const failures = []
for (const file of files) {
  const value = readFileSync(file, 'utf8')
  for (const rule of rules) {
    if (rule.pattern.test(value)) failures.push(`${file}: ${rule.label}`)
  }
}

if (failures.length) {
  console.error(`Public safety check failed:\n${failures.join('\n')}`)
  process.exit(1)
}
console.log(`Public safety check passed for ${files.length} files.`)
