import type { IsoDate, IsoDateTime, Period } from '@/data/types'
import { formatDate, zonedDate } from '@/lib/format'
import { wholeDaysBetween } from '@/lib/review-interval'

/**
 * The period a report covers, and the one before it.
 *
 * **Nothing in this build carried a period before Phase 13.** The compliance
 * panels are all-time or a fixed window and the queues are "now", so this is
 * the first module where a figure has a start and an end — and the only one
 * where "against the period before" is a question that can be asked at all.
 */

/** The default window. Invented, named, and folded under §9.2b. */
export const REPORT_PERIOD_DAYS = 30

/** The windows a report offers. Each is a real answer, not a slider. */
export const PERIOD_OPTIONS = [7, 30, 90] as const
export type PeriodDays = (typeof PERIOD_OPTIONS)[number]

const shift = (date: IsoDate, days: number): IsoDate =>
  new Date(new Date(`${date}T00:00:00.000Z`).getTime() + days * 86_400_000)
    .toISOString()
    .slice(0, 10) as IsoDate

/**
 * The period ending today, in the site's zone.
 *
 * `to` is inclusive — the last day the period covers, not the day after it —
 * because a reader comparing "25/07 to 23/08" against a calendar counts the
 * days it names.
 */
export function periodEndingToday(
  now: IsoDateTime,
  timeZone: string,
  days: PeriodDays,
): Period {
  const to = zonedDate(now, timeZone)
  return { from: shift(to, -(days - 1)), to, days }
}

/**
 * The period immediately before, of the same length.
 *
 * Same length, always. A 30-day period compared against a 27-day one would
 * make a home look better for having been measured over less time.
 */
export function previousPeriod(period: Period): Period {
  const to = shift(period.from, -1)
  return { from: shift(to, -(period.days - 1)), to, days: period.days }
}

export function describePeriod(period: Period): string {
  return `${formatDate(period.from)} to ${formatDate(period.to)}`
}

/** Whether an instant falls inside a period, counted in the site's zone. */
export function within(at: IsoDateTime, period: Period, timeZone: string): boolean {
  const day = zonedDate(at, timeZone)
  return day >= period.from && day <= period.to
}

/** Days covered, derived rather than trusted — used by the guards. */
export function daysIn(period: Period): number {
  return wholeDaysBetween(period.from, period.to) + 1
}
