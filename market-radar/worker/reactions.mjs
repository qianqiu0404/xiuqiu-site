import { calculateExcess, calculateReturn, nearestPrice } from './core.mjs'
import { fetchBinanceSeries } from './providers.mjs'

function benchmarkFor(symbol) {
  return symbol === 'BTC' ? null : 'BTC'
}

export async function enrichPendingReactions(sql, limit = 2) {
  const rows = await sql.query(`select e.id, e.occurred_at, e.news_direction, ea.namespace, ea.symbol
    from market_radar.events e
    join lateral (
      select namespace, symbol from market_radar.event_assets where event_id = e.id order by relevance desc limit 1
    ) ea on true
    join market_radar.market_reactions mr on mr.event_id = e.id
    where e.status = 'published' and mr.status = 'pending' and ea.namespace = 'crypto'
      and e.occurred_at <= now() - interval '5 minutes'
    order by e.occurred_at desc limit $1`, [limit])
  let updated = 0
  for (const row of rows) {
    try {
      const at = new Date(row.occurred_at)
      const startTime = new Date(at.getTime() - 10 * 60_000)
      const endTime = new Date(Math.min(Date.now(), at.getTime() + 4 * 60 * 60_000 + 10 * 60_000))
      const benchmark = benchmarkFor(row.symbol)
      const assetSeries = await fetchBinanceSeries({ symbol: row.symbol, startTime, endTime })
      const benchmarkSeries = benchmark ? await fetchBinanceSeries({ symbol: benchmark, startTime, endTime }) : []
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
      if (return5m == null && return30m == null && return4h == null) continue
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
      // A missing public Binance pair leaves the reaction pending for a later run.
    }
  }
  return { checked: rows.length, updated }
}
