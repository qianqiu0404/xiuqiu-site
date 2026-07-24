import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const links = [
  'https://xiuqiu-site.vercel.app/',
  'https://xiuqiu-site.vercel.app/projects',
  'https://xiuqiu-site.vercel.app/radar',
  'https://xiuqiu-site.vercel.app/projects/wallet-reliability-lab',
  'https://xiuqiu-site.vercel.app/projects/web3-wallet-engineer-lab',
  'https://xiuqiu-site.vercel.app/engineering/evidence',
  'https://wallet-reliability-lab.vercel.app/',
  'https://wallet-reliability-lab.vercel.app/lab/normal-withdrawal',
  'https://wallet-reliability-lab.vercel.app/lab/retryable-broadcast',
  'https://wallet-reliability-lab.vercel.app/lab/compensation-recovery',
  'https://wallet-reliability-lab.vercel.app/architecture',
  'https://wallet-reliability-lab.vercel.app/evidence',
  'https://qianqiu0404.github.io/web3-wallet-engineer-lab/',
  'https://github.com/qianqiu0404/xiuqiu-site',
  'https://github.com/qianqiu0404/wallet-reliability-lab',
  'https://github.com/qianqiu0404/web3-wallet-engineer-lab',
]

async function check(url) {
  const { stdout } = await execFileAsync('curl', [
    '--location',
    '--silent',
    '--show-error',
    '--output', '/dev/null',
    '--write-out', '%{http_code}',
    '--max-time', '15',
    '--retry', '2',
    '--retry-all-errors',
    '--user-agent', 'xiuqiu-site-link-check/1.0',
    url,
  ])
  const status = Number(stdout)
  if (status >= 200 && status < 400) return { url, status }
  throw new Error(`${url}: HTTP ${status || 'unknown'}`)
}

const results = await Promise.allSettled(links.map(check))
const failures = results.filter(result => result.status === 'rejected')

for (const result of results) {
  if (result.status === 'fulfilled') console.log(`${result.value.status} ${result.value.url}`)
  else console.error(result.reason.message)
}

if (failures.length > 0) process.exit(1)
console.log(`Portfolio link check passed for ${links.length} public routes.`)
