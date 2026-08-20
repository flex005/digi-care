import type { Site } from '@/data/types'
import { Select } from '@/components/primitives'
import type {
  NoteFilter,
  RecordsFilter,
  ResidentFilters,
  ReviewFilter,
  RiskFilter,
  SiteFilter,
} from './use-resident-filters'
import { STALE_NOTE_HOURS } from './use-resident-filters'
import styles from './residents.module.css'

/**
 * Filters for the residents list. PRD §6.2 — site, risk level, review status,
 * records.
 *
 * The records filter offers **both** severity levels. "Critical gaps only" is
 * the default because that is what the chip shouts about and what a manager
 * acts on first; "Any incomplete record" is one click away. Nothing is hidden,
 * it is just not shouted.
 */

export interface ResidentsFilterBarProps {
  sites: Site[]
  filters: ResidentFilters
  onSiteChange: (site: SiteFilter) => void
  onRiskChange: (risk: RiskFilter) => void
  onReviewChange: (review: ReviewFilter) => void
  onRecordsChange: (records: RecordsFilter) => void
  onNoteChange: (note: NoteFilter) => void
}

export function ResidentsFilterBar({
  sites,
  filters,
  onSiteChange,
  onRiskChange,
  onReviewChange,
  onRecordsChange,
  onNoteChange,
}: ResidentsFilterBarProps) {
  return (
    <div className={styles.filterBar}>
      <Select
        label="Site"
        placeholder="Choose a site"
        value={filters.site}
        onValueChange={(value) => onSiteChange(value as SiteFilter)}
        options={[
          { value: 'all', label: 'All sites' },
          ...sites.map((site) => ({ value: site.id, label: site.name })),
        ]}
      />
      <Select
        label="Falls risk level"
        placeholder="Any falls risk"
        value={filters.risk}
        onValueChange={(value) => onRiskChange(value as RiskFilter)}
        options={[
          { value: 'all', label: 'Any falls risk' },
          { value: 'high', label: 'Falls risk — high' },
          { value: 'moderate', label: 'Falls risk — moderate' },
          { value: 'low', label: 'Falls risk — low' },
          { value: 'not_assessed', label: 'Falls — not assessed' },
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
      <Select
        label="Records"
        placeholder="Records"
        value={filters.records}
        onValueChange={(value) => onRecordsChange(value as RecordsFilter)}
        options={[
          { value: 'critical', label: 'Critical gaps only' },
          { value: 'any_incomplete', label: 'Any incomplete record' },
          { value: 'all', label: 'All residents' },
        ]}
      />
      {/* Present as a real control, not only as a tile, so a filter applied by
          clicking a tile is never invisible state in the bar. */}
      <Select
        label="Care note recency"
        placeholder="Any care note"
        value={filters.note}
        onValueChange={(value) => onNoteChange(value as NoteFilter)}
        options={[
          { value: 'all', label: 'Any care note' },
          { value: 'none_in_48h', label: `No care note in ${STALE_NOTE_HOURS}h` },
        ]}
      />
    </div>
  )
}
