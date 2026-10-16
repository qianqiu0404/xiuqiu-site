import type { RadarReview, RadarReviewTrend } from './generatedRadarReviews'

const DAY_MS = 86_400_000

function dayIndex(value: string): number {
  return Math.round(Date.parse(`${value}T00:00:00Z`) / DAY_MS)
}

export interface TrendTrackPoint {
  date: string
  text: string
  url: string
  // Position along the review period, 0–100, for the timeline track.
  offset: number
}

export interface TrendMonthTick {
  label: string
  offset: number
}

export function reviewPeriodDays(review: Pick<RadarReview, 'periodStart' | 'periodEnd'>): number {
  return dayIndex(review.periodEnd) - dayIndex(review.periodStart) + 1
}

export function trendTrack(review: Pick<RadarReview, 'periodStart' | 'periodEnd'>, trend: Pick<RadarReviewTrend, 'milestones'>): TrendTrackPoint[] {
  const start = dayIndex(review.periodStart)
  const span = Math.max(1, dayIndex(review.periodEnd) - start)
  return trend.milestones.map(milestone => ({
    ...milestone,
    offset: Math.round(((dayIndex(milestone.date) - start) / span) * 1000) / 10,
  }))
}

// Active span of a trend on the track: from its first to its last milestone.
export function trendSpan(points: readonly TrendTrackPoint[]): { from: number; to: number } {
  if (!points.length) return { from: 0, to: 0 }
  return { from: points[0].offset, to: points[points.length - 1].offset }
}

// First-of-month ticks inside the period, so the track reads as a calendar.
export function trendMonthTicks(review: Pick<RadarReview, 'periodStart' | 'periodEnd'>): TrendMonthTick[] {
  const start = dayIndex(review.periodStart)
  const span = Math.max(1, dayIndex(review.periodEnd) - start)
  const ticks: TrendMonthTick[] = []
  const cursor = new Date(`${review.periodStart.slice(0, 7)}-01T00:00:00Z`)
  cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  while (cursor.toISOString().slice(0, 10) <= review.periodEnd) {
    const iso = cursor.toISOString().slice(0, 10)
    ticks.push({ label: `${cursor.getUTCMonth() + 1} 月`, offset: Math.round(((dayIndex(iso) - start) / span) * 1000) / 10 })
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return ticks
}

export function reviewDomainCounts(review: Pick<RadarReview, 'trends'>): Record<'ai' | 'web3', number> {
  return {
    ai: review.trends.filter(trend => trend.domain === 'ai').length,
    web3: review.trends.filter(trend => trend.domain === 'web3').length,
  }
}

export function reviewMilestoneCount(review: Pick<RadarReview, 'trends'>): number {
  return review.trends.reduce((sum, trend) => sum + trend.milestones.length, 0)
}
