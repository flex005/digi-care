import type { IsoDate, IsoDateTime } from '@/data/types'

/**
 * How long a completed review buys before the next one is due.
 *
 * **One constant, one owner.** A risk re-score and a finalised care plan
 * domain both move a review date forward, and until this existed each one did
 * its own month arithmetic in a local function — two figures that agree today
 * and are one edit away from disagreeing, on a screen that tells somebody when
 * to look at a person again.
 *
 * **It is a placeholder**, and both modules say so where it appears. A real
 * home sets frequency per instrument, per domain and per resident: a Waterlow
 * on somebody with a grade 3 ulcer is not reviewed on the same clock as an
 * end-of-life plan nobody expects to change. Six months everywhere is a
 * developer's answer to a clinical question; see §9.
 */
export const REVIEW_INTERVAL_MONTHS = 6

/**
 * The date the next review falls due, counted from an instant or a day.
 *
 * Month arithmetic rather than a day count, because a review interval is
 * expressed in months and 6 × 30 is not six months. `setMonth` rolls a 31st
 * into the following month, which is the behaviour a diary has.
 */
export function nextReviewFrom(at: IsoDateTime | IsoDate): IsoDate {
  const date = new Date(at.length === 10 ? `${at}T00:00:00.000Z` : at)
  date.setUTCMonth(date.getUTCMonth() + REVIEW_INTERVAL_MONTHS)
  return date.toISOString().slice(0, 10) as IsoDate
}

/**
 * How long before a deadline it starts reading as approaching.
 *
 * A named constant like every other figure derived from now
 * (`GAP_THRESHOLD_WAKING_MINUTES`, `INSUFFICIENT_EVIDENCE_THRESHOLD`) rather
 * than a number inline, so it can be found, changed in one place, and pinned
 * in a test.
 *
 * **Named for the shape rather than the module**, because a document's expiry
 * is the same kind of instant as a review's due date — a deadline somebody has
 * to beat — and 30 days written twice is two figures that agree today and are
 * one edit away from disagreeing. Documents read this one.
 *
 * **Invented, and it belongs with the other invented figures** — it is a care
 * manager's answer, not a developer's.
 */
export const DUE_SOON_DAYS = 30

/**
 * Whole days from one date to another. Negative where `to` is in the past.
 *
 * Rounds rather than truncates: 1 October to 26 October 2026 crosses the end
 * of British Summer Time and a 24-hour-based count lands on 24.96 days, so
 * truncating would report a review one day less imminent than it is.
 */
export function wholeDaysBetween(from: IsoDate, to: IsoDate): number {
  const MS_PER_DAY = 86_400_000
  return Math.round((Date.parse(to) - Date.parse(from)) / MS_PER_DAY)
}
