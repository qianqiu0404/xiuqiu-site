import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)

export async function verifyExactGitPublication({ repo, expectedSha, trackedFiles, git = exec }) {
  if (!repo?.startsWith('/') || !/^[0-9a-f]{40}$/.test(expectedSha || '')) {
    throw new Error('Radar publication requires an absolute repo and exact lowercase Git SHA')
  }
  if (!Array.isArray(trackedFiles) || !trackedFiles.length || trackedFiles.some(file => file.startsWith('/') || file.includes('\0'))) {
    throw new Error('Radar publication requires tracked repo-relative content paths')
  }
  const [{ stdout: head }, { stdout: dirty }] = await Promise.all([
    git('/usr/bin/git', ['-C', repo, 'rev-parse', 'HEAD']),
    git('/usr/bin/git', ['-C', repo, 'status', '--porcelain', '--untracked-files=all']),
  ])
  const revision = head.trim()
  if (revision !== expectedSha) throw new Error('Radar publication SHA does not match exact Git HEAD')
  if (dirty.trim()) throw new Error('Radar publication requires a clean Git worktree')
  for (const file of [...new Set(trackedFiles)].sort()) {
    await git('/usr/bin/git', ['-C', repo, 'ls-files', '--error-unmatch', file])
  }
  return revision
}
