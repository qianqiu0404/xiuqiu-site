const usMarketHolidays2026 = new Set([
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25',
  '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
])

export function newYorkParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date)
  return Object.fromEntries(parts.map(part => [part.type, part.value]))
}

export function isUsPremarketWindow(date = new Date()) {
  const parts = newYorkParts(date)
  const day = `${parts.year}-${parts.month}-${parts.day}`
  if (parts.weekday === 'Sat' || parts.weekday === 'Sun' || usMarketHolidays2026.has(day)) return false
  return Number(parts.hour) === 8 && Number(parts.minute) >= 40 && Number(parts.minute) <= 50
}
