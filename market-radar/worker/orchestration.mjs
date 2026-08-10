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
