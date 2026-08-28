/**
 * The times this home gives medication, and how long a round stays open.
 *
 * **One owner, and it imports nothing.** The clock reads it to decide whether
 * a round is running, and the clock is read before any fixture module loads, so
 * anything imported here would be a cycle and a blank record rather than an
 * error. `fixtures.test.ts` holds every drug's schedule against this list, so
 * the two cannot drift.
 */
export const ROUND_TIMES = ['08:00', '14:00', '18:00', '20:00'] as const

/** A round is open for an hour. The MAR fixture uses the same window. */
export const ROUND_WINDOW_MINUTES = 60

/** Minutes past midnight, for comparing a round with a wall clock. */
export const minutesOfDay = (clock: string): number => {
  const [hours, minutes] = clock.split(':').map(Number)
  return (hours ?? 0) * 60 + (minutes ?? 0)
}

/** The round currently running at this wall-clock time, if any. */
export function roundInProgressAt(minutes: number): string | undefined {
  return [...ROUND_TIMES].reverse().find((round) => {
    const since = minutes - minutesOfDay(round)
    return since >= 0 && since < ROUND_WINDOW_MINUTES
  })
}
