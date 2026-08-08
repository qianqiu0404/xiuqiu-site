export const WATCHLIST = {
  crypto: ['BTC', 'ETH', 'SOL', 'HYPE', 'XRP', 'ZEC'],
  us_equity: ['SPY', 'QQQ', 'NVDA', 'TSLA', 'COIN', 'MSTR', 'AAPL', 'MSFT'],
  macro: ['FED', 'RATES', 'CPI', 'EMPLOYMENT', 'SEC', 'CRYPTO_ETF', 'STABLECOIN_REGULATION', 'AI_INFRA'],
}

export const MARKET_GROUPS = [
  { key: 'crypto', market: 'crypto', symbols: WATCHLIST.crypto },
  { key: 'us_equity', market: 'us_equity', symbols: WATCHLIST.us_equity },
]

export const SOURCE_WEIGHTS = {
  sec_edgar: 20,
  federal_reserve: 20,
  marketaux: 16,
  alpha_vantage: 14,
  twelve_data: 15,
  qiu_market: 8,
}

export const IMPACT_PATTERNS = [
  /approval|approved|ban|lawsuit|settlement|hack|exploit|outage|bankruptcy|acquisition|earnings/i,
  /利率|降息|加息|通胀|就业|监管|批准|起诉|黑客|漏洞|宕机|破产|收购|财报/,
]
