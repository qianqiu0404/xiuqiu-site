import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

function readJsonl(path) {
  return readFileSync(path, 'utf8').split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line))
}

function readPassages(directory) {
  const passages = {}
  for (const file of readdirSync(directory).filter(name => name.endsWith('.md')).sort()) {
    const doc = basename(file, '.md')
    let number = 0
    let body = []
    const save = () => {
      if (number === 0) return
      // Python str.strip() also treats the four ASCII separators as whitespace.
      passages[`${doc}#${number}`] = body.join('\n').replace(/^[\p{White_Space}\x1c-\x1f]+|[\p{White_Space}\x1c-\x1f]+$/gu, '')
    }
    // Match Python str.splitlines() in answercheck/kb.py, including CRLF.
    for (const line of readFileSync(join(directory, file), 'utf8').split(/\r\n|[\r\n\v\f\x1c-\x1e\x85\u2028\u2029]/u)) {
      if (line.startsWith('## ')) {
        save()
        number += 1
        body = []
      } else if (number > 0) {
        body.push(line)
      }
    }
    save()
  }
  return passages
}

const [sourcePath] = process.argv.slice(2)
if (!sourcePath) {
  console.error('用法：node scripts/build-answer-check-demo.mjs <support-answer-check 目录>')
  process.exit(1)
}

const root = resolve(sourcePath)
const data = join(root, 'data')
const readReport = name => JSON.parse(readFileSync(join(root, 'reports', `${name}.json`), 'utf8'))
const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
const bundle = {
  source: { repo: 'support-answer-check', commit },
  passages: readPassages(join(data, 'kb')),
  cases: readJsonl(join(data, 'cases.jsonl')),
  bots: Object.fromEntries(['naive', 'careful'].map(bot => [bot, {
    answers: readJsonl(join(data, 'answers', `${bot}.jsonl`)),
    report: readReport(bot),
    labels: readJsonl(join(data, 'labels', `${bot}.jsonl`)),
    agree: readReport(`agree-${bot}`),
  }])),
}

const output = new URL('../public/answer-check-demo/data/', import.meta.url)
mkdirSync(output, { recursive: true })
writeFileSync(new URL('bundle.json', output), `${JSON.stringify(bundle, null, 2)}\n`)
