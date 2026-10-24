// Data entry point for the market-radar feature. Pages in this feature import
// data only from here; generated*.ts and shared helpers stay in src/data.

export { allMarketRadars } from '../../data/generatedMarketRadarAll'
export { loadMarketRadarBySlug } from '../../data/generatedMarketRadarLoader'
export { latestMarketRadars, marketRadarIndex } from '../../data/generatedMarketRadars'
export type { MarketRadarDaily, MarketRadarEvent as StaticMarketRadarEvent } from '../../data/generatedMarketRadars'
export { findStaticMarketRadarEvent } from '../../data/marketRadarPresentation'
export { filterMarketEvents, formatMarketTime, marketCategoryLabel, marketCategoryOptions, marketPriorityLabels, marketSnapshotSummary, marketStatusLabels } from '../../data/marketRadarPresentation'
export type { StaticMarketRadarEventMatch } from '../../data/marketRadarPresentation'
export { getRadarCollectionSeo, getSnapshotFreshness } from '../../data/snapshotFreshness'

export { readingReturnLink } from '../../data/readingNavigationPresentation'

export { getRadarCorrections } from '../../data/radarCorrectionPresentation'
