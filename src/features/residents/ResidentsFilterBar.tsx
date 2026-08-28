import { Select } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import type {
  RecordsFilter,
  ResidentFilters,
  ReviewFilter,
  RiskFilter,
} from './use-resident-filters'
import { ANALYTICS_PERIODS, type AnalyticsPeriod } from './analytics-tiles'
import styles from './residents.module.css'

/**
 * Filters for the residents list. PRD §6.2 — risk level, review status,
 * records; and care note recency, which the figures above made worth having.
 *
 * **No site control.** §2.4 requires the active site to be permanently
 * visible, and it is, in the header. A second control for the same fact could
 * disagree with the first, and a list showing one home under a header naming
 * another is the wrong-subject failure at the scale of a building.
 *
 * The records filter is a segmented control rather than a dropdown. It is the
 * primary narrowing on this screen — the one the whole list is built around —
 * and its three options are mutually exclusive and worth seeing at once. A
 * dropdown hides two of the three, including "All residents", which is the
 * one a reader needs to know exists when the list opens already narrowed.
 */

/**
 * Widest first, narrowing left to right — so the reader meets the whole
 * population before the subsets of it, and can see what they are a subset OF.
 * The list still OPENS on critical gaps; where the default sits and where the
 * options read from are different questions.
 */
const RECORDS_TABS: { value: RecordsFilter; label: string }[] = [
  { value: 'all', label: 'All residents' },
  { value: 'any_incomplete', label: 'Any incomplete record' },
  { value: 'critical', label: 'Critical gaps' },
]

export interface ResidentsFilterBarProps {
  filters: ResidentFilters
  onRiskChange: (risk: RiskFilter) => void
  onReviewChange: (review: ReviewFilter) => void
  onRecordsChange: (records: RecordsFilter) => void
  onQueryChange: (query: string) => void
  period: AnalyticsPeriod
  onPeriodChange: (period: AnalyticsPeriod) => void
}

export function ResidentsFilterBar({
  filters,
  onRiskChange,
  onReviewChange,
  onRecordsChange,
  onQueryChange,
  period,
  onPeriodChange,
}: ResidentsFilterBarProps) {
  return (
    <>
      {/*
       * The three views, on their own row and reading from the left edge.
       *
       * A real tablist would imply panels to switch between; these are radio
       * buttons in appearance and behaviour, one of three and always exactly
       * one chosen. `aria-pressed` on toggle buttons in a named group says
       * that without promising tab semantics nothing here implements.
       */}
      <div className={styles.viewRow}>
        <div className={styles.segmented} role="group" aria-label="Show residents">
          {RECORDS_TABS.map((tab) => {
            const active = filters.records === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                className={[styles.segment, active ? styles.segmentActive : '']
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={active}
                onClick={() => onRecordsChange(tab.value)}
                data-records-tab={tab.value}
              >
                {/* The selected one carries a mark, not only a fill: colour is
                    never the sole carrier of a chosen state (§7). */}
                {active ? (
                  <Icon name="check-validation/tick-02" size={16} aria-hidden />
                ) : null}
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Search first, then what narrows the list, then the figures period. */}
      <div className={styles.filterBar}>
        <label className={styles.search}>
          <span className={styles.searchLabel}>Search residents</span>
          <Icon name="search/search-02" size={16} aria-hidden />
          <input
            type="search"
            value={filters.query}
            placeholder="Name or room"
            onChange={(event) => onQueryChange(event.target.value)}
            data-resident-search
          />
        </label>

        <Select
          label="Falls risk level"
          placeholder="Any falls risk"
          value={filters.risk}
          onValueChange={(value) => onRiskChange(value as RiskFilter)}
          options={[
            { value: 'all', label: 'Any falls risk' },
            { value: 'high', label: 'Falls risk: high' },
            { value: 'moderate', label: 'Falls risk: moderate' },
            { value: 'low', label: 'Falls risk: low' },
            { value: 'not_assessed', label: 'Falls risk: not assessed' },
          ]}
        />
        <Select
          label="Review status"
          placeholder="Any review status"
          value={filters.review}
          onValueChange={(value) => onReviewChange(value as ReviewFilter)}
          options={[
            { value: 'all', label: 'Any review status' },
            { value: 'overdue', label: 'Review overdue' },
            { value: 'due', label: 'Review due' },
            { value: 'never_scheduled', label: 'Review never scheduled' },
            { value: 'not_up_to_date', label: 'Overdue or never scheduled' },
          ]}
        />
        {/* Deliberately last: this one does not filter the list. It sets how
            far back the figures above look, and it is bounded by the history
            that exists rather than by what reads well. */}
        <div className={styles.periodSlot}>
          <Select
            label="Figures period"
            placeholder="Period"
            value={period.id}
            onValueChange={(value) =>
              onPeriodChange(
                ANALYTICS_PERIODS.find((entry) => entry.id === value) ?? period,
              )
            }
            options={ANALYTICS_PERIODS.map((entry) => ({
              value: entry.id,
              label: entry.label,
            }))}
          />
        </div>
      </div>
    </>
  )
}
