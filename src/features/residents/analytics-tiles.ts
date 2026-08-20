import type { Aggregate } from '@/data/types'
import type { ResidentSummary } from '@/data/access/client'
import { INSUFFICIENT_EVIDENCE_THRESHOLD, coverageRatio } from '@/data/types'
import type { IconName } from '@/components/icon/registry.names.generated'
import { recordCompleteness } from '@/data/completeness'
import { tileIcons, type TileId } from './analytics-tiles.icons'
import {
  STALE_NOTE_HOURS,
  hasNoNoteWithinWindow,
  type ResidentFilters,
} from './use-resident-filters'

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
  /** REQUIRED. Applied to the table when the tile is clicked. */
  filter: Omit<ResidentFilters, 'site'>
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
    denominatorNoun: 'residents',
    excludedReason: noExclusions,
    // Everyone. Note this is NOT DEFAULT_FILTERS: the list opens on critical
    // gaps only, so "show me all of them" is its own state.
    filter: { risk: 'all', review: 'all', records: 'all', note: 'all' },
  },
  {
    id: 'critical',
    icon: tileIcons.critical,
    label: 'Critical gaps',
    kind: 'subset',
    assessable: everyone,
    matches: (summary) => recordCompleteness(summary.resident).hasCriticalGaps,
    denominatorNoun: 'residents',
    excludedReason: noExclusions,
    filter: { risk: 'all', review: 'all', records: 'critical', note: 'all' },
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
    denominatorNoun: 'residents',
    excludedReason: noExclusions,
    filter: { risk: 'all', review: 'not_up_to_date', records: 'all', note: 'all' },
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
    // Just "residents". The denominator IS restricted to those here long
    // enough, but saying so in the pill is noise on every site where nobody is
    // excluded — and `excludedReason` says it in full on the one where somebody
    // is, which is exactly when it changes the reading.
    denominatorNoun: 'residents',
    excludedReason: (excluded) =>
      `${excluded} admitted under ${STALE_NOTE_HOURS}h ago, so the window has not elapsed for them.`,
    filter: { risk: 'all', review: 'all', records: 'all', note: 'none_in_48h' },
  },
  {
    id: 'falls',
    icon: tileIcons.falls,
    label: 'Never assessed for falls',
    kind: 'subset',
    assessable: everyone,
    matches: (summary) => summary.resident.risks.falls.kind === 'not_assessed',
    denominatorNoun: 'residents',
    excludedReason: noExclusions,
    filter: { risk: 'not_assessed', review: 'all', records: 'all', note: 'all' },
  },
]

export interface AnalyticsTile {
  source: AnalyticsTileSource
  aggregate: Aggregate
  /** How many residents left the denominator, and why. Empty when none did. */
  excludedReason: string
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
): AnalyticsTile[] {
  return ANALYTICS_TILE_SOURCES.map((source) => {
    const assessable = source.assessable(summaries, now)
    const coverage = { covered: assessable.length, total: summaries.length }
    const excluded = coverage.total - coverage.covered

    if (source.kind === 'census') {
      return {
        source,
        aggregate: {
          kind: 'measured',
          unit: 'count',
          value: summaries.length,
          coverage,
        },
        excludedReason: '',
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
    }
  })
}

/** True when the table is showing exactly what this tile selects. */
export function isTileActive(
  source: AnalyticsTileSource,
  filters: ResidentFilters,
): boolean {
  return (
    filters.risk === source.filter.risk &&
    filters.review === source.filter.review &&
    filters.records === source.filter.records &&
    filters.note === source.filter.note
  )
}

/**
 * Clicking the active tile removes its narrowing — which means showing
 * everyone, not returning to `DEFAULT_FILTERS`.
 *
 * The distinction is load-bearing. The list opens on critical gaps only, so
 * `DEFAULT_FILTERS` is itself a narrowing and the Critical gaps tile is active
 * from the first paint. Clearing to the default would put the filters back
 * exactly where they already were: a control promising "select again to clear"
 * that does nothing when you do.
 */
export const CLEARED_FILTERS: Omit<ResidentFilters, 'site'> = {
  risk: 'all',
  review: 'all',
  records: 'all',
  note: 'all',
}
