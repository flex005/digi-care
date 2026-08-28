/**
 * Date and time formatting. PRD §3.6, CLAUDE.md §6.
 *
 * Dates are DD/MM/YYYY. Times are 24-hour. Never MM/DD, never am/pm.
 *
 * **Clinical timestamps render in the site's timezone, never the viewer's.**
 * A dose given at 08:04 at Rosewood Court reads 08:04 to every viewer,
 * anywhere, forever — that is what the care worker signed and what the paper
 * record says. Rendering viewer-local would make the screen contradict the
 * record, which is the core risk wearing a different costume.
 *
 * Every function that formats an instant therefore *requires* a timeZone.
 * There is no defaulted parameter and no viewer-local fallback, because a
 * default is exactly how the wrong zone would creep back in. Components reach
 * these through `useSiteFormat()`, which binds the active site's zone.
 *
 * ESLint bans four `date-fns` names — format, parseISO, formatISO,
 * lightFormat — everywhere, which is what pushes callers here.
 *
 * **That rule does NOT mean a component cannot render viewer-local time.** It
 * covers one import path and nothing else. `toLocaleString`, `toLocaleDateString`,
 * `toDateString`, and `new Intl.DateTimeFormat()` with no `timeZone` all render
 * in the viewer's zone and all pass lint today. The convention is what holds
 * here; the lint rule only makes the convention easy to follow.
 *
 * `src/data/fixtures/medications.ts` already uses `toDateString()` to key MAR
 * records by day. Machine-local, so a site west or east of the runner gets its
 * day boundaries from the wrong zone. Harmless while it is an internal key and
 * both sites are Europe/London; it must not reach Phase 3's grid unexamined.
 */

import { formatDistanceToNowStrict } from 'date-fns'
import { enGB } from 'date-fns/locale'
import type { IsoDate, IsoDateTime } from '@/data/types'

/** IANA zone, e.g. 'Europe/London'. Carried on Site. */
export type TimeZone = string

/**
 * A date-only value is a date, not an instant, and is never zone-converted.
 * '2026-03-12' parsed as UTC midnight and shifted into a zone behind UTC
 * becomes the 11th — a silently wrong clinical date. So this reformats the
 * string and touches nothing else.
 */
/**
 * A count, with thousands grouped. British English, so 11091 reads 11,091.
 *
 * Grouping is not decoration on this product: the figures that get large are
 * the ones describing how much of a record a view is *not* showing, and an
 * ungrouped five-digit number is read as a wrong magnitude at a glance. Rule 4
 * asks for the denominator; being able to read it is the same requirement.
 *
 * Locale-fixed to en-GB rather than the viewer's, for the same reason the
 * date helpers are zone-fixed: a record should not change shape depending on
 * who opens it.
 */
export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-GB').format(value)
}

export function formatDate(value: IsoDate): string {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

const dateParts = { day: '2-digit', month: '2-digit', year: 'numeric' } as const
const timeParts = { hour: '2-digit', minute: '2-digit', hour12: false } as const

/**
 * An instant re-expressed as its wall clock in `timeZone`, encoded as UTC
 * milliseconds.
 *
 * `new Date(zonedWallClock(t, 'Europe/London')).getUTCHours()` is the hour a
 * clock on that wall was showing. That indirection is what lets shift and
 * waking-hour arithmetic be plain UTC maths rather than a pile of offset
 * corrections, and it walks day boundaries correctly across a clock change
 * because each day is converted on its own terms.
 *
 * The result is NOT a real instant and must never be rendered or stored. It is
 * an intermediate for arithmetic only, which is why it lives here beside the
 * formatters rather than anywhere a component can reach for it casually.
 */
export function zonedWallClock(value: IsoDateTime, timeZone: TimeZone): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(value))

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((entry) => entry.type === type)?.value ?? 0)

  // en-GB renders midnight as hour 24 rather than 0.
  return Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour') % 24,
    part('minute'),
    part('second'),
  )
}

/**
 * The calendar day an instant falls on, **in the site's zone**, as an IsoDate.
 *
 * The only correct way to ask "was this today?" about a clinical record. The
 * viewer's day boundary is not the record's: a note written at 00:30 in London
 * belongs to that London day whoever is reading it and wherever they are.
 *
 * This exists because `medications.ts` keys MAR records by `toDateString()`,
 * which is the machine's local day and is wrong the moment a site sits in a
 * different zone from the runner. It is inert today only because both fixture
 * sites are Europe/London. Phase 3's grid is built on that key and replaces it
 * with this.
 */
export function zonedDate(value: IsoDateTime, timeZone: TimeZone): IsoDate {
  const wall = new Date(zonedWallClock(value, timeZone))
  const year = wall.getUTCFullYear()
  const month = String(wall.getUTCMonth() + 1).padStart(2, '0')
  const day = String(wall.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}` as IsoDate
}

/** `12/03/2026`, in the site's zone. */
export function formatInstantDate(value: IsoDateTime, timeZone: TimeZone): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, ...dateParts }).format(
    new Date(value),
  )
}

/** `08:04`, in the site's zone. */
export function formatTime(value: IsoDateTime, timeZone: TimeZone): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, ...timeParts }).format(
    new Date(value),
  )
}

/** `12/03/2026 08:04`, in the site's zone. */
export function formatDateTime(value: IsoDateTime, timeZone: TimeZone): string {
  return `${formatInstantDate(value, timeZone)} ${formatTime(value, timeZone)}`
}

/** `BST` / `GMT` — whichever was in force at that instant, at that site. */
export function zoneLabel(value: IsoDateTime, timeZone: TimeZone): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    timeZoneName: 'short',
  }).formatToParts(new Date(value))
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? timeZone
}

/** The viewer's own zone, resolved once. Used only to decide whether the
 *  site's zone needs labelling — never to format a record. */
export function viewerTimeZone(): TimeZone {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * `2 hours ago`. The one exception to the site-timezone rule: elapsed time is
 * about now, not about the record, so it is correctly viewer-relative. Never
 * rendered on its own — always alongside an absolute timestamp. PRD §3.6.
 */
/**
 * `1 day`, `14 days`. A count and the word that agrees with it.
 *
 * **Because the same mistake has now been made three times in independently
 * written code.** "1 tablets" shipped on the controlled drug register and was
 * written again from scratch on the prescription card three hours later;
 * `${days} day${days === 1 ? '' : 's'}` appears in two status badges by two
 * different routes. None of them is a typo — it is what happens when a
 * clinical figure is formatted at the call site instead of by one function
 * that owns the rule, and the second occurrence proves there will be a third.
 *
 * Not for units of stock: `quantityWithUnit` owns that, because deriving
 * "tablet" from "tablets" is a different problem from choosing between two
 * words that were both given.
 */
export function pluralise(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/**
 * A span of time, in the unit somebody would say it in.
 *
 * **One owner, because "how long" is one question.** How overdue a review is,
 * how long somebody has lived here, how long a goal has gone unanswered — the
 * same arithmetic and the same legibility problem: "426 days" and "1275 days"
 * are figures nobody converts in their head, and "42 months" is barely better.
 *
 * Days below two months, months below two years, then years and months. The
 * switches are where each unit stops being the shorter sentence.
 *
 * **Rounded, not truncated.** Truncation looks like the cautious choice and is
 * not: on an average-month divisor it lands just under every round number, so
 * a year renders as "11 months". Understating a duration is the same class of
 * error as overstating it, and on a lateness it fails in the direction that
 * makes a home look better than it is.
 */
export function formatDuration(days: number): string {
  const DAYS_IN_AVERAGE_MONTH = 30.44
  const MONTH_THRESHOLD_DAYS = 60
  const YEAR_THRESHOLD_DAYS = 730

  if (days < MONTH_THRESHOLD_DAYS) return pluralise(days, 'day')

  const months = Math.round(days / DAYS_IN_AVERAGE_MONTH)
  if (days < YEAR_THRESHOLD_DAYS) return pluralise(months, 'month')

  const years = Math.floor(months / 12)
  const remainder = months % 12
  return remainder === 0
    ? pluralise(years, 'year')
    : `${pluralise(years, 'year')} ${pluralise(remainder, 'month')}`
}

/**
 * How overdue something is.
 *
 * The same rendering as any other span — `formatDuration` owns it — named
 * separately because a lateness is what the call sites are asking for and the
 * name is what makes them ask the right owner.
 */
export function formatLateness(days: number): string {
  return formatDuration(days)
}

export function formatRelative(value: IsoDateTime): string {
  return formatDistanceToNowStrict(new Date(value), {
    addSuffix: true,
    locale: enGB,
  })
}

/**
 * **Whether the author still has access is not this function's business.**
 * It used to append "(deactivated)" from `StaffRef.isActive`, which made a fact
 * about *now* part of a record about *then* — reactivate somebody and every
 * historic note would still have called them deactivated. The name arrives
 * already decorated, from `staffLabel` in the team store, which reads current
 * standing. One owner, one lookup, and the record keeps its snapshot.
 *
 * How a record's authorship reads: `C. Nwosu, 08:04` — or, once the author
 * has been deactivated, `J. Whitfield (deactivated), 08:04`. Records outlive
 * access (PRD §5.3), and every clinical record displays its author and its
 * timestamp, always visible, never hover-only (PRD §3.6).
 */
export function formatAttribution(
  displayName: string,
  at: IsoDateTime,
  timeZone: TimeZone,
): string {
  return `${displayName}, ${formatTime(at, timeZone)}`
}

/**
 * Who and when, in full: `C. Nwosu, 22/08/2026 11:29`.
 *
 * **`formatAttribution` renders the time alone, and that is right only for a
 * record somebody is reading on the day it was made** — a dose at 08:04, a
 * note from this shift, a handover being signed now. It is wrong for a record
 * that may be days old: an unsigned care plan draft from last Tuesday rendered
 * as "11:29" reads as this morning, and a reader deciding whether a revision
 * is current gets the opposite of the answer.
 *
 * Relative time is not a substitute for either. It goes beside an absolute
 * timestamp or not at all (CLAUDE.md §6).
 */
export function formatAttributionOn(
  displayName: string,
  at: IsoDateTime,
  timeZone: TimeZone,
): string {
  return `${displayName}, ${formatDateTime(at, timeZone)}`
}

/** Whole years, from a date of birth to today. */
export function ageFrom(dateOfBirth: IsoDate, today: Date = new Date()): number {
  const [year, month, day] = dateOfBirth.split('-').map(Number)
  let age = today.getFullYear() - (year ?? 0)
  const monthDelta = today.getMonth() + 1 - (month ?? 0)
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < (day ?? 0))) age -= 1
  return age
}
