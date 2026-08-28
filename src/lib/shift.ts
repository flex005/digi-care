import type { IsoDateTime, Shift } from '@/data/types'
import type { TimeZone } from './format'
import { pluralise, zonedWallClock } from './format'

/**
 * Shifts and the working day. PRD §6.3.
 *
 * Everything here is reckoned in the SITE's timezone, never the viewer's, for
 * the same reason every other clinical timestamp is (PRD §3.6): a note written
 * on the late shift at Rosewood Court was written on the late shift whoever is
 * reading it and wherever they are.
 */

export const SHIFTS = [
  { id: 'early', name: 'Early', from: 7, to: 14 },
  { id: 'late', name: 'Late', from: 14, to: 21 },
  { id: 'night', name: 'Night', from: 21, to: 7 },
] as const satisfies ReadonlyArray<{
  id: Shift
  name: string
  from: number
  to: number
}>

/**
 * The same three values as `Shift` in the data types, and pinned to it by the
 * `satisfies` above: if the record ever grows a fourth shift, this list stops
 * compiling until it grows one too.
 */
export type ShiftId = Shift

export const SHIFT_NAMES: Record<ShiftId, string> = {
  early: 'Early',
  late: 'Late',
  night: 'Night',
}

/**
 * ⚠️ **AN ASSUMPTION, NOT A SPECIFICATION.**
 *
 * PRD §6.3 requires a gap marker after "more than 4 waking hours" and neither
 * that document nor the source PRD says what a waking hour is. 07:00 to 22:00
 * is invented here. It is not measured, it is not from a care home, and it is
 * almost certainly wrong for somebody.
 *
 * It is a single constant, in one place, precisely so that a real answer is a
 * one-line change touching no screen. Everything derived from it — the gap
 * threshold, the night length, which stretches count as overnight — is
 * computed from these two numbers rather than typed again.
 *
 * **What a care manager needs to be asked**, and PROGRESS.md records this as
 * an open item:
 *
 *  - Are waking hours the same for every resident? They are not, in reality.
 *    Somebody who is up at 05:00 every day and somebody who sleeps until 11:00
 *    are both being measured against this one window.
 *  - Are they the same for every site? A dementia unit and a residential floor
 *    do not run the same day.
 *  - Should the window be a resident-level or site-level record rather than a
 *    constant? If it is per-resident it is clinical data, it belongs in the
 *    fixture types, and it needs its own unrecorded member.
 *
 * Until that is answered, the number on screen is honest about what it counted
 * — the markers state elapsed time and waking time separately, so nobody has
 * to trust this constant to read the record.
 */
export const WAKING_HOURS = { from: 7, to: 22 } as const

/** More than this much waking time between notes is an omission. PRD §6.3. */
export const GAP_THRESHOLD_WAKING_MINUTES = 4 * 60

/**
 * How far ahead a screen looks for medication that is about to fall due.
 *
 * **One home for a figure that was written in two places and named in
 * neither.** The fixture generator marked a record `due` when it fell inside
 * `2 * 3_600_000`, and a separate function called `dueWithinTwoHours` claimed
 * the same window in its name while its body only filtered on the state the
 * generator had already set. Two copies of a rule that agreed by coincidence,
 * and a name asserting something the code did not do.
 *
 * Invented, like the other figures derived from now, and folded under §9.2b.
 */
export const MEDICATION_LOOKAHEAD_HOURS = 2

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

/** Derived, never typed twice: whatever is left of the day after waking. */
export const NIGHT_LENGTH_MINUTES = (24 - (WAKING_HOURS.to - WAKING_HOURS.from)) * 60

/**
 * Which shift an instant falls in, in the site's zone.
 *
 * Agrees with the fixture generator by construction: it only ever stamps notes
 * at 07, 09, 11, 13, 15, 17, 19 and 22, and those land on the same three
 * answers here. The difference is that this also handles 00:00 to 06:59, which
 * the generator never produces and would have called "early".
 */
export function shiftAt(value: IsoDateTime, timeZone: TimeZone): ShiftId {
  const hour = new Date(zonedWallClock(value, timeZone)).getUTCHours()
  if (hour >= SHIFTS[0].from && hour < SHIFTS[0].to) return 'early'
  if (hour >= SHIFTS[1].from && hour < SHIFTS[1].to) return 'late'
  return 'night'
}

/**
 * Minutes of waking time between two instants, in the site's zone.
 *
 * Walks the interval a day at a time rather than assuming a fixed offset, so a
 * gap that straddles a clock change counts the hours that actually happened.
 */
export function wakingMinutesBetween(
  from: IsoDateTime,
  to: IsoDateTime,
  timeZone: TimeZone,
): number {
  const start = zonedWallClock(from, timeZone)
  const end = zonedWallClock(to, timeZone)
  if (end <= start) return 0

  let total = 0
  for (
    let dayStart = Math.floor(start / DAY_MS) * DAY_MS;
    dayStart < end;
    dayStart += DAY_MS
  ) {
    const wakeFrom = dayStart + WAKING_HOURS.from * HOUR_MS
    const wakeTo = dayStart + WAKING_HOURS.to * HOUR_MS
    total += Math.max(0, Math.min(end, wakeTo) - Math.max(start, wakeFrom))
  }
  return Math.round(total / 60_000)
}

/** Total minutes between two instants. Zone-independent; this is elapsed time. */
export function elapsedMinutesBetween(from: IsoDateTime, to: IsoDateTime): number {
  return Math.max(
    0,
    Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000),
  )
}

/**
 * "6 hours 25 minutes". Never "6h" and never a bare decimal: this figure is
 * read as evidence of how long somebody went unwritten-up, and rounding it is
 * editing it.
 */
export function formatDuration(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes))
  const hours = Math.floor(whole / 60)
  const rest = whole % 60
  const hourPart = pluralise(hours, 'hour')
  const minutePart = pluralise(rest, 'minute')
  if (hours === 0) return minutePart
  if (rest === 0) return hourPart
  return `${hourPart} ${minutePart}`
}
