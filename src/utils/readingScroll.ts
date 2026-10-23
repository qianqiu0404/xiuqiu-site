// Async readers render after router navigation. Wait for the actual target,
// rather than letting the router's first lookup race the data request.
export async function waitForReadingElement(find: () => HTMLElement | null, signal: AbortSignal): Promise<HTMLElement | null> {
  if (signal.aborted) return null
  const target = find() || await new Promise<HTMLElement | null>(resolve => {
    const finish = (element: HTMLElement | null) => {
      observer.disconnect()
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      resolve(element)
    }
    const abort = () => finish(null)
    const observer = new MutationObserver(() => { const element = find(); if (element) finish(element) })
    const timer = window.setTimeout(() => finish(null), 10000)
    observer.observe(document.getElementById('main-content') || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-reading-ready'] })
    signal.addEventListener('abort', abort, { once: true })
  })
  if (!target || signal.aborted) return null
  await Promise.race([document.fonts.ready, new Promise(resolve => window.setTimeout(resolve, 500))])
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  return signal.aborted ? null : target
}

export function readingHashId(hash: string): string | undefined {
  if (!hash.startsWith('#')) return undefined
  try { return decodeURIComponent(hash.slice(1)) || undefined } catch { return undefined }
}
