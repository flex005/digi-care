import { useMemo, useState } from 'react'
import type { CareNote, CareNoteCategoryId, StaffId } from '@/data/types'
import type { ShiftId } from '@/lib/shift'
import { staffLabel } from '@/data/access/team-store'

/**
 * Filters for the note timeline. PRD §6.3: "filterable by category, date
 * range, shift, author, flagged status."
 *
 * Date range is a set of presets rather than a pair of date pickers. There is
 * no date-picker primitive in this build and inventing one here would be a
 * primitive designed in passing, on a screen that does not need it: the
 * question a reader actually asks of a timeline is "recently" or "all of it".
 * Noted in PROGRESS.md as a deliberate narrowing rather than an omission.
 */

export type FlaggedFilter = 'all' | 'flagged_not_reviewed' | 'reviewed' | 'not_flagged'
export type RangeFilter = 'all' | 'last_7' | 'last_30'

export interface NoteFilters {
  category: CareNoteCategoryId | 'all'
  shift: ShiftId | 'all'
  author: StaffId | 'all'
  flagged: FlaggedFilter
  range: RangeFilter
}

const NONE: NoteFilters = {
  category: 'all',
  shift: 'all',
  author: 'all',
  flagged: 'all',
  range: 'all',
}

/**
 * True when the visible list is narrower than the record.
 *
 * Load-bearing, not cosmetic: gap markers are suppressed while it is true. A
 * six-hour hole in "Medication notes only" is a hole in the filter, not in the
 * record, and rendering it as "No care note recorded" would be the screen
 * making a false claim about somebody's care. See NotesTab.
 */
export function isNarrowed(filters: NoteFilters): boolean {
  return (
    filters.category !== 'all' ||
    filters.shift !== 'all' ||
    filters.author !== 'all' ||
    filters.flagged !== 'all' ||
    filters.range !== 'all'
  )
}

const RANGE_DAYS: Record<Exclude<RangeFilter, 'all'>, number> = {
  last_7: 7,
  last_30: 30,
}

export function filterNotes(
  notes: CareNote[],
  filters: NoteFilters,
  now: Date,
): CareNote[] {
  const cutoff =
    filters.range === 'all'
      ? undefined
      : now.getTime() - RANGE_DAYS[filters.range] * 86_400_000

  return notes.filter((note) => {
    if (filters.category !== 'all' && note.category !== filters.category) return false
    if (filters.shift !== 'all' && note.shift.value !== filters.shift) return false
    if (filters.author !== 'all' && note.recordedBy.id !== filters.author) return false
    if (filters.flagged !== 'all' && note.review.kind !== filters.flagged) return false
    if (cutoff !== undefined && new Date(note.recordedAt).getTime() < cutoff) {
      return false
    }
    return true
  })
}

export function useNoteFilters(notes: CareNote[], now: Date) {
  const [filters, setFilters] = useState<NoteFilters>(NONE)

  const visible = useMemo(() => filterNotes(notes, filters, now), [notes, filters, now])

  /**
   * Only the authors who actually wrote for this resident. A dropdown listing
   * every member of staff would offer fifteen filters that return nothing,
   * and an empty result from a filter that was never going to match teaches
   * the reader nothing about the record.
   */
  const authors = useMemo(() => {
    const seen = new Map<StaffId, string>()
    for (const note of notes) {
      if (!seen.has(note.recordedBy.id)) {
        seen.set(note.recordedBy.id, staffLabel(note.recordedBy))
      }
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [notes])

  return {
    filters,
    setFilters,
    visible,
    authors,
    narrowed: isNarrowed(filters),
    clear: () => setFilters(NONE),
  }
}
