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

/** The instant the whole fixture set is generated against. */
export const NOW = new Date()

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

export function toIsoDate(date: Date): IsoDate {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}` as IsoDate
}

export function toIsoDateTime(date: Date): IsoDateTime {
  return date.toISOString() as IsoDateTime
}

export function daysAgo(days: number, from: Date = NOW): Date {
  const date = new Date(from)
  date.setDate(date.getDate() - days)
  return date
}

export function daysAhead(days: number, from: Date = NOW): Date {
  return daysAgo(-days, from)
}

export function monthsAgo(months: number, from: Date = NOW): Date {
  const date = new Date(from)
  date.setMonth(date.getMonth() - months)
  return date
}

/** A given clock time on a given day, in the site's zone. */
export function atTime(day: Date, hour: number, minute: number): Date {
  const date = new Date(day)
  date.setHours(hour, minute, 0, 0)
  return date
}

/** Whole days between two dates, positive when `later` is after `earlier`. */
export function daysBetween(earlier: Date, later: Date): number {
  const MS_PER_DAY = 86_400_000
  return Math.floor((later.getTime() - earlier.getTime()) / MS_PER_DAY)
}
