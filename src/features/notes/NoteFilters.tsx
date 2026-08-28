import type { CareNoteCategoryId, StaffId } from '@/data/types'
import { CARE_NOTE_CATEGORIES } from '@/data/types'
import { SHIFTS, type ShiftId } from '@/lib/shift'
import { Button, Select } from '@/components/primitives'
import type { FlaggedFilter, NoteFilters, RangeFilter } from './use-note-filters'
import styles from './notes.module.css'

/**
 * PRD §6.3: "filterable by category, date range, shift, author, flagged
 * status." All five, in that order.
 *
 * Every dropdown opens on "any", never on a narrowing. A timeline that opens
 * already filtered is a timeline that has hidden part of somebody's record
 * before the reader has looked at it once.
 */
export function NoteFilterBar({
  filters,
  authors,
  narrowed,
  onChange,
  onClear,
}: {
  filters: NoteFilters
  authors: [StaffId, string][]
  narrowed: boolean
  onChange: (next: NoteFilters) => void
  onClear: () => void
}) {
  return (
    <div className={styles.filterBar}>
      <Select
        label="Category"
        placeholder="Any category"
        value={filters.category}
        onValueChange={(value) =>
          onChange({ ...filters, category: value as CareNoteCategoryId | 'all' })
        }
        options={[
          { value: 'all', label: 'Any category' },
          ...CARE_NOTE_CATEGORIES.map((category) => ({
            value: category.id,
            label: category.name,
          })),
        ]}
      />

      <Select
        label="Date range"
        placeholder="All time"
        value={filters.range}
        onValueChange={(value) => onChange({ ...filters, range: value as RangeFilter })}
        options={[
          { value: 'all', label: 'All time' },
          { value: 'last_7', label: 'Last 7 days' },
          { value: 'last_30', label: 'Last 30 days' },
        ]}
      />

      <Select
        label="Shift"
        placeholder="Any shift"
        value={filters.shift}
        onValueChange={(value) =>
          onChange({ ...filters, shift: value as ShiftId | 'all' })
        }
        options={[
          { value: 'all', label: 'Any shift' },
          ...SHIFTS.map((shift) => ({ value: shift.id, label: `${shift.name} shift` })),
        ]}
      />

      <Select
        label="Author"
        placeholder="Any author"
        value={filters.author}
        onValueChange={(value) =>
          onChange({ ...filters, author: value as StaffId | 'all' })
        }
        options={[
          { value: 'all', label: 'Any author' },
          ...authors.map(([id, name]) => ({ value: id, label: name })),
        ]}
      />

      <Select
        label="Review status"
        placeholder="Any review status"
        value={filters.flagged}
        onValueChange={(value) =>
          onChange({ ...filters, flagged: value as FlaggedFilter })
        }
        options={[
          { value: 'all', label: 'Any review status' },
          { value: 'flagged_not_reviewed', label: 'Flagged, not reviewed' },
          { value: 'reviewed', label: 'Reviewed' },
          { value: 'not_flagged', label: 'Not flagged' },
        ]}
      />

      {narrowed ? (
        <Button variant="secondary" onClick={onClear}>
          Show the whole record
        </Button>
      ) : null}
    </div>
  )
}
