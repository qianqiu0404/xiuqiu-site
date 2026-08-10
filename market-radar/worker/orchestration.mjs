import {
  encodeMarketSourceCursor,
  newestMarketSourceCursor,
  parseMarketSourceCursor,
  selectMarketItemsAfterCursor,
} from './core.mjs'

export async function collectMarketSourceOutsideLock({ fetchItems, preflightItems, prepareItem }) {
  const fetchedItems = await fetchItems()
  const preparation = preflightItems
    ? await preflightItems(fetchedItems)
    : new Map(fetchedItems.map(item => [`${item.provider}:${item.providerId}`, true]))
  const preparedItems = []
  for (const item of fetchedItems) {
    const key = `${item.provider}:${item.providerId}`
    preparedItems.push({
      item,
      summary: preparation.get(key) === true ? await prepareItem(item) : null,
    })
  }
  return { fetchedItems, preparedItems }
}

export async function persistMarketSourceBatch({
  source,
  fetchedItems,
  preparedItems,
  collectionError = null,
  startRun,
  finishRun,
  loadCursor,
  persistItem,
  saveCursor,
}) {
  const runId = await startRun()
  if (!runId) return { source, skipped: true }
  try {
    if (collectionError) throw new Error(collectionError)
    const cursor = parseMarketSourceCursor(await loadCursor())
    const items = selectMarketItemsAfterCursor(fetchedItems, cursor)
    const prepared = new Map(preparedItems.map(entry => [
      `${entry.item.provider}:${entry.item.providerId}`,
      entry,
    ]))
    let inserted = 0
    let published = 0
    for (const item of items) {
      const summary = prepared.get(`${item.provider}:${item.providerId}`)?.summary || null
      const result = await persistItem(item, summary)
      if (result.inserted) inserted += 1
      if (result.published) published += 1
    }
    const newest = newestMarketSourceCursor(fetchedItems, cursor)
    await saveCursor(encodeMarketSourceCursor(newest))
    await finishRun(runId, 'succeeded', items.length)
    return { source, fetched: fetchedItems.length, items: items.length, inserted, published }
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 120) : 'unknown_error'
    await finishRun(runId, 'failed', 0, code)
    return { source, error: code }
  }
}

export async function persistCollectedWithLock({ withLock, work }) {
  const result = await withLock(work)
  return result.acquired ? result.value : { skipped: true, reason: 'radar_database_lock_held' }
}

export async function withMarketWorkerLease({ claim, release, work }) {
  const token = await claim()
  if (!token) return { skipped: true, reason: 'worker_lease_held' }
  try {
    return await work(token)
  } finally {
    await release(token)
  }
}
