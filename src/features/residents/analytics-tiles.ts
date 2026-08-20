import type { Aggregate } from '@/data/types'
import type { ResidentSummary } from '@/data/access/client'
import { INSUFFICIENT_EVIDENCE_THRESHOLD, coverageRatio } from '@/data/types'
import type { IconName } from '@/components/icon/registry.names.generated'
import { hadCriticalGapAt, recordCompleteness } from '@/data/completeness'
import { tileIcons, type TileId } from './analytics-tiles.icons'
import { STALE_NOTE_HOURS, hasNoNoteWithinWindow } from './use-resident-filters'

/**
 * The analytics tiles above the residents list — declared, not assembled in a
 * render function, so a tile cannot quietly lose its denominator or its click.
 *
 * Three rules are structural here rather than editorial:
 *
 *  1. **Every tile is an `Aggregate`.** There is no shape in this file that
 *     can hold a number without a `Coverage` beside it. Rule 4, PRD §2.2.
 *  2. **Every tile carries a filter.** `filter` is required. A tile that only
 *     displays is decoration repeating the table below it; the click is what
 *     earns the space, and a future tile cannot be added without one.
 *  3. **No tile is ever green.** Nothing here carries a tone, so there is
 *     nothing to colour. These exist to find problems, not to congratulate:
 *     zero overdue reviews is a quiet "0", never a tick.
 */

export type { TileId }

export interface AnalyticsTileSource {
  id: TileId
  label: string
  /** REQUIRED, like the filter. A card without one is not the card. */
  icon: IconName
  /**
   * `census` counts the population itself — "how many residents are here" is
   * an exact fact about an empty home too, so it stays a number at n = 0.
   * `subset` counts part of a population, which is undefined when there is no
   * population: "0 of 0" must never read as reassuring.
   */
  kind: 'census' | 'subset'
  /**
   * The residents this figure can honestly be asserted about. Everyone, unless
   * the measurement needs a window that has not elapsed for some of them.
   */
  assessable: (summaries: ResidentSummary[], now: number) => ResidentSummary[]
  /** Of the assessable, the ones the figure counts. */
  matches: (summary: ResidentSummary, now: number) => boolean
  /** What the denominator counts, in words. Rule 4 wants the units named. */
  denominatorNoun: string
  /** Said when the denominator is smaller than the population, and why. */
  excludedReason: (excluded: number) => string
  /**
   * The same measurement, as it stood at an earlier instant — what makes the
   * change figure a reconstruction rather than an invention. REQUIRED, so a
   * card cannot be added that shows a movement it cannot account for.
   */
  matchesAt: (summary: ResidentSummary, at: number) => boolean
}

const everyone = (summaries: ResidentSummary[]) => summaries

const noExclusions = () => ''

export const ANALYTICS_TILE_SOURCES: AnalyticsTileSource[] = [
  {
    id: 'residents',
    icon: tileIcons.residents,
    label: 'Residents',
    kind: 'census',
    assessable: everyone,
    matches: () => true,
    // Resident here then, too. The census change is admissions since.
    matchesAt: (summary, at) => new Date(summary.resident.admittedOn).getTime() <= at,
    denominatorNoun: 'residents',
    excludedReason: noExclusions,
  },
  {
    id: 'critical',
    icon: tileIcons.critical,
    label: 'Critical gaps',
    kind: 'subset',
    assessable: everyone,
    matches: (summary) => recordCompleteness(summary.resident).hasCriticalGaps,
    matchesAt: (summary, at) => hadCriticalGapAt(summary.resident, at),
    denominatorNoun: 'residents',
    excludedReason: noExclusions,
  },
  {
    /**
     * **Overdue OR never scheduled**, and the label says both.
     *
     * Counting only `overdue` would have hidden a whole category: Ashgrove has
     * nothing overdue and three of its four residents have never had a review
     * scheduled. An "overdue" tile reading "0 of 4" there would be untrue by
     * omission — PRD §2.1 names this exact pair as one that must never both
     * render as untroubled.
     */
    id: 'reviews',
    icon: tileIcons.reviews,
    label: 'Reviews overdue or never scheduled',
    kind: 'subset',
    assessable: everyone,
    matches: (summary) =>
      summary.resident.carePlanReview.kind === 'overdue' ||
      summary.resident.carePlanReview.kind === 'never_scheduled',
    // Never scheduled was never scheduled then either. Overdue is a date, so
    // it can be asked of any instant: it was overdue at `at` if it was already
    // past its due date by then.
    matchesAt: (summary, at) => {
      const review = summary.resident.carePlanReview
      if (review.kind === 'never_scheduled') return true
      if (review.kind === 'overdue') return Date.parse(review.dueOn) <= at
      return false
    },
    denominatorNoun: 'residents',
    excludedReason: noExclusions,
  },
  {
    /**
     * The one tile with a genuinely partial denominator.
     *
     * "No care note in 48 hours" cannot be asserted about somebody who has
     * been resident for 20 hours — the window has not elapsed, so the answer
     * is not "no problem", it is not yet knowable. They leave the denominator
     * and the tile says how many and why. Ismail Sowande at Ashgrove is the
     * live case: admitted 45 hours ago, PRD §5.3's gap 3.
     */
    id: 'notes',
    icon: tileIcons.notes,
    label: `No care note in ${STALE_NOTE_HOURS}h`,
    kind: 'subset',
    assessable: (summaries, now) =>
      summaries.filter(
        (summary) =>
          now - new Date(summary.resident.admittedOn).getTime() >=
          STALE_NOTE_HOURS * 3_600_000,
      ),
    matches: (summary, now) => hasNoNoteWithinWindow(summary, now),
    // Care notes carry 90 days of history, so the same question answers for a
    // past instant — provided the period stays inside that history.
    matchesAt: (summary, at) => hasNoNoteWithinWindow(summary, at),
    // Just "residents". The denominator IS restricted to those here long
    // enough, but saying so in the pill is noise on every site where nobody is
    // excluded — and `excludedReason` says it in full on the one where somebody
    // is, which is exactly when it changes the reading.
    denominatorNoun: 'residents',
    excludedReason: (excluded) =>
      `${excluded} admitted under ${STALE_NOTE_HOURS}h ago, so the window has not elapsed for them.`,
  },
  {
    id: 'falls',
    icon: tileIcons.falls,
    label: 'Never assessed for falls',
    kind: 'subset',
    assessable: everyone,
    matches: (summary) => summary.resident.risks.falls.kind === 'not_assessed',
    matchesAt: (summary, at) => {
      const falls = summary.resident.risks.falls
      return falls.kind === 'not_assessed' || Date.parse(falls.assessedAt) > at
    },
    denominatorNoun: 'residents',
    excludedReason: noExclusions,
  },
]

export interface AnalyticsTile {
  source: AnalyticsTileSource
  aggregate: Aggregate
  /** How many residents left the denominator, and why. Empty when none did. */
  excludedReason: string
  /**
   * Movement over the chosen period: today's figure less the same figure
   * reconstructed at the start of it. Null where the figure itself could not
   * be computed, because a change between two unknowns is not a number.
   */
  change: number | null
}

/**
 * Build every tile against the residents at the active site.
 *
 * A `subset` tile over an empty population is Insufficient Evidence, not zero:
 * "0 of 0" is the reading that must never look reassuring, and `coverageRatio`
 * already returns 0 for an empty denominator for that reason. A `census` stays
 * a number — "0 residents here" is exact, not an absence of evidence.
 */
export function buildAnalyticsTiles(
  summaries: ResidentSummary[],
  now: number,
  period: AnalyticsPeriod = DEFAULT_PERIOD,
): AnalyticsTile[] {
  const since = now - period.days * 86_400_000
  return ANALYTICS_TILE_SOURCES.map((source) => {
    const assessable = source.assessable(summaries, now)
    const coverage = { covered: assessable.length, total: summaries.length }
    const excluded = coverage.total - coverage.covered

    if (source.kind === 'census') {
      const thenCount = summaries.filter((s) => source.matchesAt(s, since)).length
      return {
        source,
        aggregate: {
          kind: 'measured',
          unit: 'count',
          value: summaries.length,
          coverage,
        },
        excludedReason: '',
        change: summaries.length - thenCount,
      }
    }

    const thin =
      coverage.total === 0 || coverageRatio(coverage) < INSUFFICIENT_EVIDENCE_THRESHOLD

    if (thin) {
      return {
        source,
        aggregate: {
          kind: 'insufficient_evidence',
          coverage,
          missingDescription:
            coverage.total === 0
              ? 'There are no residents here to count.'
              : 'Too few of them have been here long enough to say.',
        },
        excludedReason: excluded > 0 ? source.excludedReason(excluded) : '',
        // No figure, so no movement. A change between two unknowns is not a
        // number, and a zero here would read as "nothing moved".
        change: null,
      }
    }

    return {
      source,
      aggregate: {
        kind: 'measured',
        unit: 'count',
        value: assessable.filter((summary) => source.matches(summary, now)).length,
        coverage,
      },
      excludedReason: excluded > 0 ? source.excludedReason(excluded) : '',
      // Measured against the same denominator at both ends, so the movement is
      // in the metric rather than in who was counted.
      change:
        assessable.filter((summary) => source.matches(summary, now)).length -
        assessable.filter((summary) => source.matchesAt(summary, since)).length,
    }
  })
}

/**
 * How far back the change figure looks.
 *
 * Bounded by the data, not by what reads well: the fixtures carry 90 days of
 * care notes, so a "last year" option would report that every resident had no
 * care note a year ago — an artefact of the history ending, presented as a
 * finding. Nothing here reaches past 60 days.
 */
export interface AnalyticsPeriod {
  id: string
  label: string
  /** How the change reads on a card: "+3 this month". */
  phrase: string
  days: number
}

export const ANALYTICS_PERIODS: AnalyticsPeriod[] = [
  { id: '7', label: 'Last 7 days', phrase: 'this week', days: 7 },
  { id: '30', label: 'Last 30 days', phrase: 'this month', days: 30 },
  { id: '60', label: 'Last 60 days', phrase: 'in 60 days', days: 60 },
]

export const DEFAULT_PERIOD: AnalyticsPeriod = ANALYTICS_PERIODS[1] as AnalyticsPeriod
