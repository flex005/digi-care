import type { Aggregate, IsoDate } from '@/data/types'
import type { Reviewable } from './projection'
import { minPopulationForARate } from '@/data/access/settings-store'

/**
 * Review coverage over a range, as an `Aggregate`. PRD §6.7.
 *
 * **A queue of completed records has no gap to lead on**, so the lead becomes
 * a figure rather than a finding — and a figure needs its denominator, or it
 * is the bare percentage the whole build refuses.
 *
 * The denominator is *records whose review fell due in the window*, never
 * *records reviewed in the window*. Counting what was done would make a home
 * that reviewed one thing and ignored ninety read as complete — the same
 * defect as a risk queue whose denominator is the assessments that exist.
 *
 * And a completed review is counted **against the date it was due, not the
 * date it was done**. Otherwise a home that clears a year's backlog in one
 * afternoon makes the year it neglected disappear.
 */

/**
 * How far back the coverage figure looks.
 *
 * **Invented, and named like the other invented figures.** A real home would
 * set this alongside its review frequency; see §9.
 */
export const COVERAGE_WINDOW_DAYS = 90

export interface Coverage {
  aggregate: Aggregate
  onTime: number
  late: number
  /** Fell due in the window and still has not been done. */
  outstanding: number
}

export function coverageOver(items: Reviewable[], since: IsoDate): Coverage {
  let onTime = 0
  let late = 0
  let outstanding = 0

  for (const item of items) {
    const standing = item.standing

    if (standing.kind === 'completed') {
      /*
       * A review nobody ever scheduled has no due date, so it cannot be placed
       * in a window by one. It is left out of the rate rather than counted as
       * on time — a home that reviewed something it had never scheduled did
       * something good, and it is not evidence about whether it meets its
       * dates, which is what this figure claims.
       */
      if (standing.against.kind !== 'due_on') continue
      if (standing.against.dueOn < since) continue
      if (standing.late) late += 1
      else onTime += 1
      continue
    }

    // Fell due inside the window and nobody has done it. A record with no date
    // at all is not counted here — it has no due date to fall inside anything,
    // and it is the lead finding on the queue's other four filters.
    if (standing.kind === 'overdue' && standing.dueOn >= since) outstanding += 1
  }

  const reviewed = onTime + late
  const total = reviewed + outstanding
  const coverage = { covered: reviewed, total }

  const aggregate: Aggregate =
    total < minPopulationForARate()
      ? {
          kind: 'insufficient_evidence',
          coverage,
          missingDescription:
            total === 0
              ? 'No review fell due here in this window, so there is no rate to report.'
              : `Only ${total} reviews fell due here in this window: too few to support a rate.`,
        }
      : {
          kind: 'measured',
          unit: 'percentage',
          value: Math.round((reviewed / total) * 100),
          coverage,
        }

  return { aggregate, onTime, late, outstanding }
}
