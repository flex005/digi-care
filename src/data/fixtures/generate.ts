/**
 * Deterministic fixture generation.
 *
 * No `Math.random`. Everything derives from a fixed seed, so the same 32
 * residents with the same gaps appear on every reload and in every test run.
 * Fixtures reset on reload and that is intended (PRD §3.6) — but they must
 * reset to the *same* thing, or a review finding cannot be reproduced.
 *
 * `NOW` is captured once at module load because several of PRD §5.3's
 * deliberate gaps are inherently relative — "admitted yesterday",
 * "medication due in the next 2 hours", "finalised 14 months ago and never
 * reviewed". It is exported so tests can reason about the same instant.
 */

import type { IsoDate, IsoDateTime } from '../types'
import { GENERATED_AT } from './clock'
import { atHomeClock, homeDate, shiftOnHomeClock } from './home-zone'

/**
 * The instant the whole fixture set is generated against.
 *
 * Read from `clock.ts`, which takes it from the URL where one is given. That
 * is what makes a state existing only at certain hours — a dose inside its
 * window — reachable at all in a build with no backend to ask.
 */
export const NOW = GENERATED_AT

/**
 * Mulberry32 — small, fast, and stable across runs. The point is not
 * cryptographic quality, it is that seed 0x51D1CA2E always yields this care
 * home and not a different one.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Random {
  /** Integer in [min, max]. */
  int: (min: number, max: number) => number
  /** One member of a non-empty list. */
  pick: <T>(items: readonly T[]) => T
  /** n distinct members, or all of them if n exceeds the list. */
  sample: <T>(items: readonly T[], n: number) => T[]
  /** True with the given probability. */
  chance: (probability: number) => boolean
}

export function makeRandom(seed: number): Random {
  const next = createRandom(seed)
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))
  const pick = <T>(items: readonly T[]): T => {
    const item = items[int(0, items.length - 1)]
    if (item === undefined) throw new Error('pick() called with an empty list')
    return item
  }
  const sample = <T>(items: readonly T[], n: number): T[] => {
    const pool = [...items]
    const taken: T[] = []
    while (taken.length < n && pool.length > 0) {
      const [item] = pool.splice(int(0, pool.length - 1), 1)
      if (item !== undefined) taken.push(item)
    }
    return taken
  }
  return { int, pick, sample, chance: (probability) => next() < probability }
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** The home's calendar day at an instant, never the machine's. */
export function toIsoDate(date: Date): IsoDate {
  return homeDate(date)
}

export function toIsoDateTime(date: Date): IsoDateTime {
  return date.toISOString() as IsoDateTime
}

/** The same time on the home's clock, `days` home days earlier. */
export function daysAgo(days: number, from: Date = NOW): Date {
  return shiftOnHomeClock(from, { days: -days })
}

export function daysAhead(days: number, from: Date = NOW): Date {
  return daysAgo(-days, from)
}

export function monthsAgo(months: number, from: Date = NOW): Date {
  return shiftOnHomeClock(from, { months: -months })
}

/**
 * A given clock time on a given day, **on the home's clock**.
 *
 * It said "in the site's zone" and called `setHours`, which is the machine's.
 * The two agreed while the machine and London were both an hour ahead of UTC,
 * and stopped agreeing on 25/10/2026: every round, care note and incident time
 * moved an hour against the home, and a 20:00 dose read "from 19:00 GMT".
 */
export function atTime(day: Date, hour: number, minute: number): Date {
  return atHomeClock(homeDate(day), hour * 60 + minute)
}

/** Whole days between two dates, positive when `later` is after `earlier`. */
export function daysBetween(earlier: Date, later: Date): number {
  const MS_PER_DAY = 86_400_000
  return Math.floor((later.getTime() - earlier.getTime()) / MS_PER_DAY)
}

/**
 * A record is written **after the event it describes and never after now**.
 *
 * This is the fourth place that rule has had to be enforced by hand — care
 * notes, medication administrations, refusals, and now note reviews — and
 * every failure had the same shape: a timestamp derived by arithmetic from a
 * valid one and never re-checked. `preferred` is where the derivation wanted
 * to put it; `event` is the thing being recorded.
 *
 * Both ends matter. A ceiling alone still allows a note reviewed five hours
 * before it was written, which is impossible in the other direction and is
 * exactly what the previous version of the care note fixtures produced.
 */
export function recordedBetween(event: Date, preferred: Date): Date {
  const floor = event.getTime()
  // Events are generated at or before NOW, so the floor never exceeds the
  // ceiling. If that ever stops being true, the event itself is the bug.
  const ceiling = NOW.getTime()
  return new Date(Math.min(Math.max(preferred.getTime(), floor), ceiling))
}
