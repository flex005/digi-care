/**
 * The instant the whole fixture set is generated against.
 *
 * **The clock is the one generation-fixed figure that can honestly be moved,
 * and this is a frontend-only build, so nothing but a decision was stopping
 * it.** Every other figure baked at generation is read-only for a real reason:
 * the records were produced against it, so a control would move a label and not
 * the data. The clock is different in kind — move it and the whole record is
 * regenerated against the new instant, which is exactly what a reviewer needs
 * in order to see a state that only exists at certain hours.
 *
 * A dose inside its window is the case that forced this. It exists for one
 * hour after each round and not otherwise, so on a real clock the Dashboard's
 * due-now segment is zero for sixteen hours of the day and there is no way to
 * tell that from a screen that has stopped working.
 *
 * **A query parameter rather than storage**, for three reasons: the fixtures
 * are built at module load so the value has to be readable before any import
 * runs, a reload is required either way to regenerate them, and CLAUDE.md §6
 * keeps record data out of storage. The URL also makes the override visible
 * and shareable rather than a hidden mode somebody can leave switched on.
 *
 * This file imports nothing. It is the first thing the fixtures read, and an
 * import cycle here would be a blank record rather than an error.
 */

import { ROUND_TIMES, minutesOfDay, roundInProgressAt } from './rounds'

/** `?at=HH:MM` on today's date, or `?at=<ISO instant>` for another day. */
export const CLOCK_PARAM = 'at'

function parse(raw: string): Date | undefined {
  const clock = /^(\d{1,2}):(\d{2})$/.exec(raw.trim())
  if (clock) {
    const hours = Number(clock[1])
    const minutes = Number(clock[2])
    if (hours > 23 || minutes > 59) return undefined
    const at = new Date()
    at.setHours(hours, minutes, 0, 0)
    return at
  }
  const instant = new Date(raw)
  return Number.isNaN(instant.getTime()) ? undefined : instant
}

/** `?at=real` pins the real clock, whether or not a round is running. */
export const REAL_CLOCK = 'real'

function requested(): Date | undefined {
  if (typeof window === 'undefined') return undefined
  const raw = new URLSearchParams(window.location.search).get(CLOCK_PARAM)
  if (raw === null || raw === '') return undefined
  if (raw === REAL_CLOCK) return new Date()
  return parse(raw)
}

/**
 * The nearest instant at which this home is mid-round.
 *
 * **A care home gives medication four times a day, so for sixteen hours of it
 * nothing is due** — which is true, and useless in a prototype nobody can be
 * asked to open at the right minute. Opened at 15:55, the last round closed
 * fifty-five minutes ago and the next is two hours off, and every screen that
 * exists to show a round in progress shows nothing.
 *
 * So the record is drawn at the real time whenever the real time has a round
 * running, and otherwise at twenty minutes into the most recent one. It is
 * never silent about which: the banner on every screen names the instant and
 * the real time beside it.
 */
function nearestLiveRound(from: Date): Date {
  const minutes = from.getHours() * 60 + from.getMinutes()
  const past = ROUND_TIMES.filter((round) => minutesOfDay(round) <= minutes)
  // Before the first round of the day, the last one of yesterday is the most
  // recent: a night shift is a shift.
  const round = past[past.length - 1] ?? ROUND_TIMES[ROUND_TIMES.length - 1]
  const at = new Date(from)
  at.setHours(0, minutesOfDay(round) + 20, 0, 0)
  if (past.length === 0) at.setDate(at.getDate() - 1)
  return at
}

const asked =
  typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get(CLOCK_PARAM)
const override = requested()
const real = new Date()
const realIsLive =
  roundInProgressAt(real.getHours() * 60 + real.getMinutes()) !== undefined

/**
 * What the record was generated against.
 *
 * Read once. A second read could return a different instant, and every screen
 * would then be drawn against a clock the one beside it disagrees with.
 */
export const GENERATED_AT: Date =
  override ?? (realIsLive ? real : nearestLiveRound(real))

/** The real time, for a screen that has to say what it moved away from. */
export const REAL_NOW: Date = real

/**
 * Whether the record is drawn at anything other than the real time.
 *
 * A record drawn against a pretend instant that does not announce it is the
 * reassurance failure with the reader's own change as the cause, and this one
 * is worse than a changed figure: a wrong figure is wrong in one place, a
 * moved clock makes every timestamp on every screen agree with each other and
 * with nothing outside.
 */
export const CLOCK_IS_OVERRIDDEN =
  (override !== undefined && asked !== REAL_CLOCK) ||
  (!realIsLive && override === undefined)

/** Why the clock is where it is, so the banner can say so exactly. */
export const CLOCK_REASON: 'real' | 'requested' | 'nearest_round' =
  override !== undefined
    ? asked === REAL_CLOCK
      ? 'real'
      : 'requested'
    : realIsLive
      ? 'real'
      : 'nearest_round'

/**
 * What the app should call now.
 *
 * **The same clock the record was drawn against, always.** With the fixtures
 * generated at 08:20 and the screens reading the real time, every timestamp on
 * every screen was drawn against one instant and compared against another: the
 * header said 15:42 over a record of the morning, and "how long ago" figures
 * were hours out. That is the two-clocks defect the donut had, one layer up and
 * across every module rather than inside one chart.
 *
 * With no override this is the real time, exactly as before.
 */
export function now(): Date {
  /*
   * Always the generation instant, including when that is the real time.
   *
   * The first version returned the live clock unless a time had been asked
   * for, which left the header reading 16:05 over a record drawn at 14:20 the
   * moment the default started moving the clock for itself. The whole record
   * is a snapshot taken at one instant; every screen is as of that instant,
   * and a clock that ticks past it is comparing the record with a time it was
   * not drawn against.
   */
  return new Date(GENERATED_AT)
}

/** Builds the URL that regenerates the record at a given wall-clock time. */
export function clockHref(value: string): string {
  if (typeof window === 'undefined') return `?${CLOCK_PARAM}=${value}`
  const url = new URL(window.location.href)
  if (value === '') url.searchParams.delete(CLOCK_PARAM)
  else url.searchParams.set(CLOCK_PARAM, value)
  return url.toString()
}
