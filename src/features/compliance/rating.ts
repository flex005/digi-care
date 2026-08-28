import type {
  Aggregate,
  CheckReading,
  CheckResult,
  Coverage,
  PanelVerdict,
  Rating,
} from '@/data/types'
import {
  insufficientEvidenceThreshold,
  minPopulationForARate,
} from '@/data/access/settings-store'

/**
 * How a check becomes a rating, and how ratings become a panel.
 *
 * **Everything in this file is a placeholder and every screen using it says
 * so.** The bands below, the direction of each check and the worst-of rule are
 * a developer's answers to a regulator's question — the same standing as the
 * risk instrument in §9.2a, and recorded beside it. A threshold wrong by one
 * point puts a home in the wrong band.
 */

/**
 * The bands, invented and named once rather than per check.
 *
 * Thirty-odd checks with their own thresholds would be thirty-odd invented
 * numbers nobody could review. One set, stated, is reviewable in a sitting.
 */
export const BANDS = {
  /** A coverage figure at or above this is green. */
  good: 95,
  /** At or above this is amber; below it is red. */
  acceptable: 80,
} as const

/**
 * **Every check is framed as coverage**, so a high figure is always the good
 * news and there is one direction rather than two.
 *
 * It began with a `Polarity` argument and a second pair of bands for failure
 * rates, and no check ever used them — a branch no fixture reached, which is
 * the §8 rule applied to code rather than to a screen. Framing "doses with no
 * record" as "doses with a record against them" costs a word and removes a
 * whole direction the reader would otherwise have to work out per row.
 */
export function bandFor(percentage: number): Rating {
  if (percentage >= BANDS.good) return 'green'
  if (percentage >= BANDS.acceptable) return 'amber'
  return 'red'
}

/**
 * A coverage pair becomes a reading, or the reason it cannot.
 *
 * **The population floor is applied here and nowhere else**, so no check can
 * forget it. Below `minPopulationForARate()` the figure is replaced by
 * Insufficient Evidence with its coverage — not by a smaller rating.
 */
export function reading(input: {
  coverage: Coverage
  /** What the figure counted: "20 of 1,219 doses with no record". */
  detail: string
  /** What is missing, where the population is too thin. */
  missing: string
  caveat?: string
}): CheckReading {
  const { coverage, detail, missing, caveat } = input

  if (coverage.total < minPopulationForARate()) {
    return {
      kind: 'insufficient',
      aggregate: {
        kind: 'insufficient_evidence',
        coverage,
        missingDescription: missing,
      },
      detail,
      ...(caveat === undefined ? {} : { caveat }),
    }
  }

  const percentage = Math.round((coverage.covered / coverage.total) * 100)
  const aggregate: Aggregate = {
    kind: 'measured',
    unit: 'percentage',
    value: percentage,
    coverage,
  }
  if (aggregate.kind !== 'measured') throw new Error('unreachable')

  return {
    kind: 'measured',
    aggregate,
    rating: bandFor(percentage),
    detail,
    ...(caveat === undefined ? {} : { caveat }),
  }
}

const SEVERITY: Record<Rating, number> = { green: 0, amber: 1, red: 2 }

/**
 * The five panels' rule: worst of the usable checks, above the threshold.
 *
 * **Worst-of rather than a weighting**, declared a placeholder. A weighting is
 * a domain answer and inventing one would be the §9.2a mistake; worst-of is
 * defensible on its own terms — a panel is only as good as its worst check —
 * and it errs toward alarm rather than reassurance, which is the only
 * direction to err in this product.
 *
 * **A check that is itself Insufficient Evidence does not count toward the
 * threshold.** Same argument as the denominator exclusion in Phase 7: a panel
 * assembled from figures none of which can support a claim cannot support one
 * either, and counting them would let five unusable checks make a panel look
 * measured.
 *
 * **`not_held` checks are not in either number.** They are gaps in the
 * product, not in the home, and nothing on any screen can close them.
 */
export function verdictFor(results: CheckResult[]): PanelVerdict {
  const derived = results.filter((result) => result.kind === 'derived')
  const usable = derived.filter((result) => result.reading.kind === 'measured')
  const total = derived.length

  if (total === 0 || usable.length / total < insufficientEvidenceThreshold()) {
    return { kind: 'insufficient_evidence', usable: usable.length, total }
  }

  /*
   * The worst check, and the panel says which one it is.
   *
   * Ties break on the lower figure and then on declaration order, so the same
   * record always names the same check — a panel whose driver moved between
   * renders would be a panel nobody could act on.
   */
  let driver: { result: CheckResult; rating: Rating; value: number } | undefined
  for (const result of usable) {
    if (result.kind !== 'derived' || result.reading.kind !== 'measured') continue
    const candidate = {
      result,
      rating: result.reading.rating,
      value: result.reading.aggregate.value,
    }
    if (driver === undefined) {
      driver = candidate
      continue
    }
    if (SEVERITY[candidate.rating] > SEVERITY[driver.rating]) driver = candidate
    else if (
      SEVERITY[candidate.rating] === SEVERITY[driver.rating] &&
      candidate.value < driver.value
    ) {
      driver = candidate
    }
  }

  if (driver === undefined || driver.result.kind !== 'derived') {
    return { kind: 'insufficient_evidence', usable: usable.length, total }
  }

  return {
    kind: 'rated',
    rating: driver.rating,
    usable: usable.length,
    total,
    driver: {
      id: driver.result.definition.id,
      name: driver.result.definition.name,
      detail: driver.result.reading.detail,
      value: driver.value,
    },
  }
}
