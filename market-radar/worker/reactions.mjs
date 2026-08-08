import { calculateExcess, calculateReturn, nearestPrice } from './core.mjs'
import { fetchTwelveDataSeries } from './providers.mjs'

function providerSymbol(namespace, symbol) {
  if (namespace === 'crypto') return `${symbol}/USD`
  return symbol
}

function benchmarkFor(namespace, symbol) {
  if (namespace === 'crypto') return symbol === 'BTC' ? null : 'BTC/USD'
  return symbol === 'QQQ' || symbol === 'SPY' ? null : 'QQQ'
}

export async function enrichPendingReactions(sql, apiKey, limit = 2) {
  if (!apiKey) return { checked: 0, updated: 0 }
  const rows = await sql.query(`select e.id, e.occurred_at, e.news_direction, ea.namespace, ea.symbol
    from market_radar.events e
    join lateral (
      select namespace, symbol from market_radar.event_assets where event_id = e.id order by relevance desc limit 1
    ) ea on true
    join market_radar.market_reactions mr on mr.event_id = e.id
    where e.status = 'published' and mr.status = 'pending' and e.occurred_at <= now() - interval '5 minutes'
    order by e.occurred_at desc limit $1`, [limit])
  let updated = 0
  for (const row of rows) {
    try {
      const symbol = providerSymbol(row.namespace, row.symbol)
      const benchmark = benchmarkFor(row.namespace, row.symbol)
      const assetSeries = await fetchTwelveDataSeries({ apiKey, symbol, outputsize: 90 })
      const benchmarkSeries = benchmark ? await fetchTwelveDataSeries({ apiKey, symbol: benchmark, outputsize: 90 }) : []
      const at = new Date(row.occurred_at)
      const priceAt = nearestPrice(assetSeries, at)
      const price5m = nearestPrice(assetSeries, new Date(at.getTime() + 5 * 60_000))
      const price30m = nearestPrice(assetSeries, new Date(at.getTime() + 30 * 60_000))
      const price4h = nearestPrice(assetSeries, new Date(at.getTime() + 4 * 60 * 60_000), 12)
      const benchmarkAt = benchmark ? nearestPrice(benchmarkSeries, at) : priceAt
      const benchmark5m = benchmark ? nearestPrice(benchmarkSeries, new Date(at.getTime() + 5 * 60_000)) : priceAt
      const benchmark30m = benchmark ? nearestPrice(benchmarkSeries, new Date(at.getTime() + 30 * 60_000)) : priceAt
      const benchmark4h = benchmark ? nearestPrice(benchmarkSeries, new Date(at.getTime() + 4 * 60 * 60_000), 12) : priceAt
      const return5m = calculateReturn(priceAt, price5m)
      const return30m = calculateReturn(priceAt, price30m)
      const return4h = calculateReturn(priceAt, price4h)
      const excess5m = calculateExcess(return5m, calculateReturn(benchmarkAt, benchmark5m))
      const excess30m = calculateExcess(return30m, calculateReturn(benchmarkAt, benchmark30m))
      const excess4h = calculateExcess(return4h, calculateReturn(benchmarkAt, benchmark4h))
      const direction = row.news_direction === 'bullish' ? 1 : row.news_direction === 'bearish' ? -1 : 0
      const signedMove = (excess30m ?? return30m ?? excess5m ?? return5m ?? 0) * direction
      const status = direction === 0 ? 'ignored' : signedMove >= 0.003 ? 'confirmed' : signedMove <= -0.003 ? 'contradicted' : 'priced_in'
      await sql.query(`update market_radar.market_reactions set status=$2, benchmark=$3,
        event_price=$4, price_5m=$5, price_30m=$6, price_4h=$7,
        benchmark_event_price=$8, benchmark_5m=$9, benchmark_30m=$10, benchmark_4h=$11,
        return_5m=$12, return_30m=$13, return_4h=$14, excess_5m=$15, excess_30m=$16, excess_4h=$17, updated_at=now()
        where event_id=$1`, [row.id, status, benchmark, priceAt, price5m, price30m, price4h, benchmarkAt, benchmark5m, benchmark30m, benchmark4h,
        return5m, return30m, return4h, excess5m, excess30m, excess4h])
      updated += 1
    } catch {
      // A missing free-tier quote leaves the reaction pending for a later run.
    }
  }
  return { checked: rows.length, updated }
}
