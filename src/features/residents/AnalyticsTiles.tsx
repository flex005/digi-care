import { assertNever } from '@/lib/assert-never'
import { Unrecorded } from '@/components/status'
import {
  ANALYTICS_TILE_SOURCES,
  CLEARED_FILTERS,
  buildAnalyticsTiles,
  isTileActive,
} from './analytics-tiles'
import type { ResidentSummary } from '@/data/access/client'
import type { ResidentFilters } from './use-resident-filters'
import { LIST_CLOCK } from './list-clock'
import styles from './residents.module.css'

/**
 * The analytics row above the residents list.
 *
 * Every tile is a button that narrows the table, and the active one clears on
 * a second click. A tile that only displayed would be decoration repeating the
 * rows underneath it — the click is what earns the space.
 *
 * **Deliberately quieter than the table.** These are a way in, not the
 * headline: light surfaces, one modest figure each, and the row occupies less
 * vertical space than three rows of the thing it points at. Nothing here is
 * green, because none of it is good news to celebrate — a zero is a quiet
 * zero, the same reasoning that took the tick off completed reviews.
 *
 * The figures recompute against the site filter and name the site they counted,
 * so a tile can never be read against the wrong home.
 */

export interface AnalyticsTilesProps {
  /** Everyone at the active site, before the other filters. */
  atSite: ResidentSummary[]
  siteLabel: string
  filters: ResidentFilters
  onApply: (filters: Omit<ResidentFilters, 'site'>) => void
}

export function AnalyticsTiles({
  atSite,
  siteLabel,
  filters,
  onApply,
}: AnalyticsTilesProps) {
  const tiles = buildAnalyticsTiles(atSite, LIST_CLOCK)

  return (
    <div className={styles.tiles} role="group" aria-label="Filter the list by figure">
      {tiles.map(({ source, aggregate, excludedReason }) => {
        const active = isTileActive(source, filters)
        // The census tile IS the cleared state, so it has no narrowing to
        // remove. Saying "select again to clear" on it would promise something
        // that cannot happen.
        const clearable = source.kind === 'subset'

        // The whole claim, in one sentence, for the accessible name. A screen
        // reader gets the figure and its denominator together or not at all.
        let spoken: string
        let figure: React.ReactNode
        let coverage: string

        switch (aggregate.kind) {
          case 'measured':
            figure = <span className={styles.tileValue}>{aggregate.value}</span>
            coverage =
              source.kind === 'census'
                ? `at ${siteLabel}`
                : `of ${aggregate.coverage.covered} ${source.denominatorNoun} at ${siteLabel}`
            spoken = `${source.label} — ${aggregate.value} ${coverage}.`
            break

          case 'insufficient_evidence':
            // Not a milder zero. The absence of a finding, in the unrecorded
            // treatment, never in a RAG hue. PRD §2.3.
            figure = (
              <Unrecorded
                // chip, not badge: the badge form is uppercase and lays label
                // and detail side by side, which in a 190px tile wraps into an
                // unreadable block. Same hatch, same required label.
                variant="chip"
                label="Insufficient evidence"
                detail={aggregate.missingDescription}
              />
            )
            coverage = `${aggregate.coverage.covered} of ${aggregate.coverage.total} ${source.denominatorNoun} at ${siteLabel}`
            spoken = `${source.label} — insufficient evidence. ${aggregate.missingDescription} ${coverage}.`
            break

          default:
            return assertNever(aggregate)
        }

        return (
          <button
            key={source.id}
            type="button"
            className={[styles.tile, active ? styles.tileActive : '']
              .filter(Boolean)
              .join(' ')}
            aria-pressed={active}
            aria-label={
              active
                ? clearable
                  ? `${spoken} Filtering the list. Select again to clear.`
                  : `${spoken} Showing every resident.`
                : spoken
            }
            onClick={() => onApply(active ? CLEARED_FILTERS : source.filter)}
          >
            <span className={styles.tileLabel}>{source.label}</span>
            {figure}
            <span className={styles.tileCoverage}>
              {coverage}
              {excludedReason ? ` ${excludedReason}` : ''}
            </span>
            {/* Selection is never carried by the border colour alone. */}
            {active ? (
              <span className={styles.tileActiveNote}>
                {clearable
                  ? 'Filtering the list — select again to clear'
                  : 'Showing every resident'}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/** Re-exported so the structural guard has one import site. */
export { ANALYTICS_TILE_SOURCES }
