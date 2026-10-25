// Live-first loading for the rewritten external feeds, with the build-time
// snapshot as a read-only fallback, plus the wording the pages show for each
// state. Pure helpers take the clock so node:test can pin it.

import { EXTERNAL_SOURCES, externalFreshness, fetchBoundedJson, parseExternalSnapshot } from '../../shared/externalSources.ts'
import type { ExternalFreshness, ExternalSourceId } from '../../shared/externalSources.ts'

export type ExternalOrigin = 'live' | 'snapshot'

export interface ExternalLoad<T> {
  value: T
  origin: ExternalOrigin
  /** Snapshot build time; null for live data. */
  fetchedAt: string | null
}

export function createExternalLoader<T>(
  source: ExternalSourceId,
  live: (force: boolean) => Promise<T>,
  parse: (value: unknown) => T,
  fetcher: typeof fetch = (...args) => fetch(...args),
) {
  let snapshot: Promise<ExternalLoad<T>> | undefined
  function loadSnapshot(): Promise<ExternalLoad<T>> {
    snapshot ??= fetchBoundedJson(EXTERNAL_SOURCES[source].snapshotPath, fetcher, 10_000)
      .then(({ json }) => {
        const parsed = parseExternalSnapshot(json, source, parse)
        return { value: parsed.data, origin: 'snapshot' as const, fetchedAt: parsed.fetched_at }
      })
      // Let a later retry try again instead of caching the failure.
      .catch(error => { snapshot = undefined; throw error })
    return snapshot
  }
  return async function load(force = false): Promise<ExternalLoad<T>> {
    try {
      return { value: await live(force), origin: 'live', fetchedAt: null }
    } catch (liveError) {
      try { return await loadSnapshot() } catch { throw liveError }
    }
  }
}

export type ExternalNoticeTone = 'ok' | 'warn'

export interface ExternalNotice {
  tone: ExternalNoticeTone
  freshness: ExternalFreshness
  text: string
}

function hoursLabel(hours: number): string {
  return hours < 1 ? '不到 1 小时' : hours < 48 ? `${Math.round(hours)} 小时` : `${Math.round(hours / 24)} 天`
}

/** One status line per source: live and current, live but stale, or a snapshot copy. */
export function externalSourceNotice(source: ExternalSourceId, load: Pick<ExternalLoad<{ updated_at: string | null }>, 'value' | 'origin' | 'fetchedAt'>, now: number): ExternalNotice {
  const def = EXTERNAL_SOURCES[source]
  const { freshness, ageHours } = externalFreshness(load.value.updated_at, def.maxAgeHours, now)
  if (load.origin === 'snapshot') {
    const snapAge = load.fetchedAt ? externalFreshness(load.fetchedAt, Infinity, now).ageHours : null
    const when = snapAge == null ? '' : `（${hoursLabel(snapAge)}前）`
    return { tone: 'warn', freshness, text: `${def.label}实时源暂不可用，当前显示站点发布时保存的副本${when}，新资料要等实时源恢复。` }
  }
  if (freshness === 'stale' && ageHours != null) {
    return { tone: 'warn', freshness, text: `${def.label}已有 ${hoursLabel(ageHours)}没有新资料，资料源可能暂停更新。` }
  }
  return { tone: 'ok', freshness, text: '' }
}
