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
export function formatDate(value: IsoDate): string {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

const dateParts = { day: '2-digit', month: '2-digit', year: 'numeric' } as const
const timeParts = { hour: '2-digit', minute: '2-digit', hour12: false } as const

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
export function formatRelative(value: IsoDateTime): string {
  return formatDistanceToNowStrict(new Date(value), {
    addSuffix: true,
    locale: enGB,
  })
}

/**
 * How a record's authorship reads: `C. Nwosu, 08:04` — or, once the author
 * has been deactivated, `J. Whitfield (deactivated), 08:04`. Records outlive
 * access (PRD §5.3), and every clinical record displays its author and its
 * timestamp, always visible, never hover-only (PRD §3.6).
 */
export function formatAttribution(
  displayName: string,
  at: IsoDateTime,
  timeZone: TimeZone,
  isActive = true,
): string {
  const who = isActive ? displayName : `${displayName} (deactivated)`
  return `${who}, ${formatTime(at, timeZone)}`
}

/** Whole years, from a date of birth to today. */
export function ageFrom(dateOfBirth: IsoDate, today: Date = new Date()): number {
  const [year, month, day] = dateOfBirth.split('-').map(Number)
  let age = today.getFullYear() - (year ?? 0)
  const monthDelta = today.getMonth() + 1 - (month ?? 0)
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < (day ?? 0))) age -= 1
  return age
}
