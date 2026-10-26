import type { DailyRadar, RadarIndexEntry } from './generatedRadars.ts'

export type LatestRadarState =
  | { status: 'loading' | 'empty' | 'error'; radar?: undefined }
  | { status: 'ready'; radar: DailyRadar }

type LatestRadarIndex = Pick<RadarIndexEntry, 'slug' | 'snapshotId'>
type LoadRadar = (slug: string) => Promise<DailyRadar | undefined>

// The synchronous index owns date/SEO. Full content uses the existing monthly
// loader; only the active request may publish state to its route consumer.
export function createLatestRadarLoader(
  onChange: (state: LatestRadarState) => void,
  loadBySlug: LoadRadar,
) {
  let requestVersion = 0
  let disposed = false
  return {
    async load(index?: LatestRadarIndex): Promise<void> {
      if (disposed) return
      const version = ++requestVersion
      if (!index) {
        onChange({ status: 'empty' })
        return
      }
      onChange({ status: 'loading' })
      try {
        const radar = await loadBySlug(index.slug)
        if (disposed || version !== requestVersion) return
        // An indexed publication without its matching body is unavailable,
        // not evidence that no public edition exists.
        if (!radar || radar.slug !== index.slug || radar.snapshotId !== index.snapshotId) {
          throw new Error('Published radar body does not match its index')
        }
        onChange({ status: 'ready', radar })
      } catch {
        if (!disposed && version === requestVersion) onChange({ status: 'error' })
      }
    },
    dispose() {
      disposed = true
      requestVersion += 1
    },
  }
}
